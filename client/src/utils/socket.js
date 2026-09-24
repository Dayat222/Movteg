import mqtt from 'mqtt';

const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';

class MqttSocketAdapter {
  constructor() {
    this.client = null;
    this.roomId = null;
    this.username = null;
    this.listeners = new Map();
    this.connected = false;
    this.id = Math.random().toString(36).substr(2, 9);
    this.usersMap = new Map(); // id -> { id, username, fcmToken }
    this.fcmToken = localStorage.getItem('movteg_fcm_token') || null;
    
    // Video state tracking for late joiners
    this.currentVideoUrl = null;
    
    this.connect();
  }
  
  connect() {
    if (this.client) return;
    console.log('[MQTT] Connecting to Public Broker...');
    this.client = mqtt.connect(brokerUrl, {
      clientId: 'movteg_' + this.id,
      clean: true,
      connectTimeout: 5000,
    });
    
    this.client.on('connect', () => {
      console.log('[MQTT] Connected');
      this.connected = true;
      if (this.roomId) {
        this.client.subscribe(`movteg/room/${this.roomId}`);
        this.broadcastPresence();
      }
      this.emitLocal('connect');
    });
    
    this.client.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const senderId = payload.senderId;
        const event = payload.event;
        const data = payload.data;
        
        // Handle presence and discovery
        if (event === 'presence') {
          this.handlePresence(senderId, data.username, data.videoUrl, data.fcmToken);
          if (senderId !== this.id) {
             // Acknowledge new peers so they know we exist too (if they just joined)
             if (data.isNew) {
                 this.broadcastPresence(false); // broadcast without isNew to prevent infinite loops
             }
          }
          // Do not emit 'presence' to App.jsx, it's internal
          return;
        }

        if (event === 'leave') {
           if (this.usersMap.has(senderId)) {
               const leftUser = this.usersMap.get(senderId);
               this.usersMap.delete(senderId);
               this.emitLocal('user-left', {
                 username: leftUser.username,
                 users: Array.from(this.usersMap.values())
               });
           }
           return;
        }

        if (event === 'change-video' && data?.videoUrl) {
           this.currentVideoUrl = data.videoUrl;
        }

        // WebRTC Signaling: Pass senderId so receiver knows who sent it
        if (event.startsWith('webrtc-')) {
           // We only process signaling directed at us, or broadcasts
           if (data.targetId && data.targetId !== this.id) return;
           this.emitLocal(event, { senderId, ...data });
           return;
        }
        
        // Avoid processing our own emitted actions for UI (like video-play)
        if (senderId === this.id) return;

        // Translate call events
        if (event === 'call-partner') {
          const senderUser = this.usersMap.get(senderId);
          this.emitLocal('incoming-call', {
            callerName: senderUser ? senderUser.username : 'Pasangan',
            callerId: senderId
          });
          return;
        }
        
        if (event === 'answer-call') {
          // data contains { accepted, callerId }
          // only process if we were the original caller
          if (data.callerId !== this.id) return;
          const senderUser = this.usersMap.get(senderId);
          this.emitLocal('call-answered', {
            accepted: data.accepted,
            responderName: senderUser ? senderUser.username : 'Pasangan'
          });
          return;
        }

        if (event === 'end-call') {
          const senderUser = this.usersMap.get(senderId);
          this.emitLocal('call-ended', {
            by: senderUser ? senderUser.username : 'Pasangan'
          });
          return;
        }

        if (event === 'ping-room') {
          if (this.roomId && this.client) {
            const topic = `movteg/room/${this.roomId}`;
            this.client.publish(topic, JSON.stringify({
              senderId: this.id,
              event: 'pong-room',
              data: {
                requestId: data?.requestId,
                hostName: this.username || 'Pasangan',
                usersCount: this.usersMap.size
              }
            }), { qos: 0 });
          }
          return;
        }
        
        this.emitLocal(event, data);
      } catch (e) {
        console.error('[MQTT] Message parse error', e);
      }
    });
    
    this.client.on('disconnect', () => {
      this.connected = false;
      this.emitLocal('disconnect');
    });

    // Handle abrupt close
    window.addEventListener('beforeunload', () => {
       this.emit('leave', {});
       if (this.client) this.client.end();
    });
  }

  setFcmToken(token) {
    if (!token) return;
    this.fcmToken = token;
    try {
      localStorage.setItem('movteg_fcm_token', token);
    } catch (e) {}
    if (this.connected && this.roomId) {
       this.broadcastPresence(false);
    }
  }

  handlePresence(senderId, username, videoUrl, fcmToken) {
    if (!username) return;
    
    // If they have a video url, update ours if we don't have one
    if (videoUrl && !this.currentVideoUrl) {
        this.currentVideoUrl = videoUrl;
        this.emitLocal('room-state', { videoUrl });
    }

    if (!this.usersMap.has(senderId) || this.usersMap.get(senderId).fcmToken !== fcmToken) {
      this.usersMap.set(senderId, { id: senderId, username, isHost: false, fcmToken });
      
      // Remember last partner's token for offline calling
      if (fcmToken && senderId !== this.id) {
        localStorage.setItem('movteg_last_partner_token', fcmToken);
        localStorage.setItem('movteg_last_partner_name', username);
      }

      this.emitLocal('user-joined', {
        username: username,
        users: Array.from(this.usersMap.values())
      });
    }
  }

  broadcastPresence(isNew = true) {
     if (!this.client || !this.roomId || !this.connected) return;
     const topic = `movteg/room/${this.roomId}`;
     const payload = JSON.stringify({
       senderId: this.id,
       event: 'presence',
       data: { 
         username: this.username, 
         isNew: isNew,
         videoUrl: this.currentVideoUrl,
         fcmToken: this.fcmToken
       }
     });
     this.client.publish(topic, payload, { qos: 0 });
  }

  joinRoom(roomId, username) {
    if (this.roomId && this.roomId !== roomId && this.client) {
      this.client.unsubscribe(`movteg/room/${this.roomId}`);
      this.emit('leave', {});
      this.usersMap.clear();
    }
    
    this.roomId = roomId;
    this.username = username || this.username;
    
    // Add self to users map immediately
    if (this.username) {
        this.usersMap.set(this.id, { id: this.id, username: this.username, isHost: true });
    }
    
    if (this.connected && this.client) {
      this.client.subscribe(`movteg/room/${this.roomId}`);
      this.broadcastPresence(true);
      
      // Update room state locally
      this.emitLocal('room-state', {
         videoUrl: this.currentVideoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
         users: Array.from(this.usersMap.values())
      });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      if (callback) {
        this.listeners.get(event).delete(callback);
      } else {
        this.listeners.get(event).clear();
      }
    }
  }

  emitLocal(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  emit(event, data) {
    if (event === 'join-room') {
       this.joinRoom(data.roomId, data.username);
       return;
    }
    
    if (event === 'change-video') {
       this.currentVideoUrl = data.videoUrl;
    }

    if (!this.client || !this.roomId || !this.connected) return;
    
    // Format messages before broadcasting to match expected schema
    let payloadData = data;
    if (event === 'send-message') {
      event = 'new-message';
      payloadData = {
        id: `mqtt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sender: this.username,
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      this.emitLocal(event, payloadData);
    } else if (event === 'send-reaction') {
      event = 'new-reaction';
      payloadData = {
        id: `mqtt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sender: this.username,
        emoji: data.emoji,
      };
      this.emitLocal(event, payloadData);
    } else if (event === 'request-sync') {
      this.broadcastPresence(false);
      return;
    }
    
    const topic = `movteg/room/${this.roomId}`;
    const payload = JSON.stringify({
      senderId: this.id,
      event: event,
      data: payloadData
    });
    
    this.client.publish(topic, payload, { qos: 0 }, (err) => {
       if (err) console.error('[MQTT] Publish error', err);
    });
  }

  checkRoomExists(targetRoomId, timeoutMs = 1500) {
    return new Promise((resolve) => {
      if (!this.client || !this.connected) {
        // If client not connected yet, try connecting and default to allow
        this.connect();
        return setTimeout(() => resolve({ exists: true }), 300);
      }

      const requestId = Math.random().toString(36).substr(2, 9);
      const probeTopic = `movteg/room/${targetRoomId}`;
      let resolved = false;

      const onMessageProbe = (topic, message) => {
        if (topic !== probeTopic) return;
        try {
          const payload = JSON.parse(message.toString());
          if (payload.event === 'pong-room' && payload.data?.requestId === requestId) {
            cleanup(true, payload.data);
          }
        } catch (e) {}
      };

      const cleanup = (exists, details = {}) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        this.client.removeListener('message', onMessageProbe);
        if (this.roomId !== targetRoomId) {
          this.client.unsubscribe(probeTopic);
        }
        resolve({ exists, ...details });
      };

      const timer = setTimeout(() => {
        cleanup(false);
      }, timeoutMs);

      this.client.on('message', onMessageProbe);
      this.client.subscribe(probeTopic, (err) => {
        if (err) return cleanup(true); // network error, fallback to allow
        this.client.publish(probeTopic, JSON.stringify({
          senderId: this.id,
          event: 'ping-room',
          data: { requestId }
        }), { qos: 0 });
      });
    });
  }

  disconnect() {
    if (this.client) {
      this.emit('leave', {});
      this.client.end();
      this.client = null;
      this.connected = false;
    }
  }
}

export const isP2PMode = false;
export const SERVER_URL = 'Cloud Server Gratis (Bebas Error)';

export const socket = new MqttSocketAdapter();
export const updateServerUrl = () => {};
export const resetToP2P = () => {};
