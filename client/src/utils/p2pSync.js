import Peer from 'peerjs';

class P2PSync {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.listeners = new Map();
    this.isHost = false;
    this.roomId = null;
    this.username = null;
    this.connected = false;
    this.currentVideoState = {
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      isPlaying: false,
      currentTime: 0,
    };
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _trigger(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  connect() {
    // no-op, connection starts in join-room
  }

  emit(event, data = {}) {
    if (event === 'join-room') {
      this.joinRoom(data.roomId, data.username);
      return;
    }

    // Keep track of video state on local actions
    if (event === 'video-play') {
      this.currentVideoState.isPlaying = true;
      if (typeof data.currentTime === 'number') {
        this.currentVideoState.currentTime = data.currentTime;
      }
    } else if (event === 'video-pause') {
      this.currentVideoState.isPlaying = false;
      if (typeof data.currentTime === 'number') {
        this.currentVideoState.currentTime = data.currentTime;
      }
    } else if (event === 'video-seek') {
      if (typeof data.currentTime === 'number') {
        this.currentVideoState.currentTime = data.currentTime;
      }
    } else if (event === 'change-video') {
      this.currentVideoState.videoUrl = data.videoUrl;
      this.currentVideoState.currentTime = 0;
      this.currentVideoState.isPlaying = false;
    }

    const payload = {
      type: event,
      ...data,
      by: this.username,
      sender: this.username,
    };

    if (event === 'send-message') {
      const msg = {
        id: `p2p-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sender: this.username,
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      // Trigger locally
      this._trigger('new-message', msg);
      // Send to peers
      this.broadcast({ type: 'new-message', ...msg });
      return;
    }

    if (event === 'send-reaction') {
      const reaction = {
        id: `p2p-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sender: this.username,
        emoji: data.emoji,
      };
      this._trigger('new-reaction', reaction);
      this.broadcast({ type: 'new-reaction', ...reaction });
      return;
    }

    if (event === 'request-sync') {
      if (!this.isHost) {
        this.broadcast({ type: 'request-sync' });
      }
      return;
    }

    this.broadcast(payload);
  }

  broadcast(payload) {
    this.connections.forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          console.warn('Failed to send payload to peer:', e);
        }
      }
    });
  }

  joinRoom(roomId, username) {
    if (!roomId || !username) return;

    this.roomId = roomId;
    this.username = username;

    // Clean up any existing peer
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
    }

    const cleanRoomCode = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hostPeerId = `movteg-v1-${cleanRoomCode}`;

    // Attempt to register as Host first
    try {
      this.peer = new Peer(hostPeerId);
    } catch {
      this.peer = new Peer();
    }

    this.peer.on('open', () => {
      this.isHost = true;
      this.connected = true;
      this._trigger('connect');

      const initialUsers = [{ id: this.peer.id, username: this.username, isHost: true }];
      this._trigger('room-state', {
        roomId: this.roomId,
        videoUrl: this.currentVideoState.videoUrl,
        isPlaying: this.currentVideoState.isPlaying,
        currentTime: this.currentVideoState.currentTime,
        users: initialUsers,
        isHost: true,
      });
    });

    this.peer.on('error', (err) => {
      // If host ID is already taken, someone is hosting! We connect as guest!
      if (err.type === 'unavailable-id') {
        this._connectAsGuest(hostPeerId);
      } else {
        console.warn('PeerJS notice:', err.type, err.message);
      }
    });

    this.peer.on('connection', (conn) => {
      this._handleIncomingConnection(conn);
    });
  }

  _connectAsGuest(hostPeerId) {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
    }

    this.peer = new Peer();
    this.isHost = false;

    this.peer.on('open', () => {
      const conn = this.peer.connect(hostPeerId, {
        metadata: { username: this.username },
        reliable: true,
      });

      conn.on('open', () => {
        this.connected = true;
        this.connections.set(hostPeerId, conn);
        this._trigger('connect');

        // Announce join to host
        conn.send({
          type: 'guest-hello',
          username: this.username,
        });
      });

      conn.on('data', (data) => {
        this._handleData(data, conn);
      });

      conn.on('close', () => {
        this.connections.delete(hostPeerId);
        this.connected = false;
        this._trigger('disconnect');
      });

      conn.on('error', (err) => {
        console.warn('Guest connection error:', err);
      });
    });

    this.peer.on('error', (err) => {
      console.warn('Guest peer error:', err);
    });
  }

  _handleIncomingConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);

      // Send initial room state
      const usersList = this._getUsersList();
      conn.send({
        type: 'room-state',
        videoUrl: this.currentVideoState.videoUrl,
        isPlaying: this.currentVideoState.isPlaying,
        currentTime: this.currentVideoState.currentTime,
        users: usersList,
        isHost: false,
      });

      // Inform existing users
      this.broadcast({
        type: 'user-joined',
        username: conn.metadata?.username || 'Pasangan',
        users: usersList,
      });
    });

    conn.on('data', (data) => {
      if (data.type === 'guest-hello') {
        conn.metadata = { username: data.username };
        const usersList = this._getUsersList();
        this._trigger('user-joined', {
          username: data.username,
          users: usersList,
        });
        this.broadcast({
          type: 'user-joined',
          username: data.username,
          users: usersList,
        });
        return;
      }

      if (data.type === 'request-sync' && this.isHost) {
        conn.send({
          type: 'room-state',
          videoUrl: this.currentVideoState.videoUrl,
          isPlaying: this.currentVideoState.isPlaying,
          currentTime: this.currentVideoState.currentTime,
          users: this._getUsersList(),
        });
        return;
      }

      // Handle event locally
      this._handleData(data, conn);

      // Forward to other connected peers (if any)
      this.connections.forEach((otherConn, peerId) => {
        if (peerId !== conn.peer && otherConn.open) {
          otherConn.send(data);
        }
      });
    });

    conn.on('close', () => {
      const leftUsername = conn.metadata?.username || 'Pasangan';
      this.connections.delete(conn.peer);
      const remainingUsers = this._getUsersList();
      this._trigger('user-left', {
        username: leftUsername,
        users: remainingUsers,
      });
      this.broadcast({
        type: 'user-left',
        username: leftUsername,
        users: remainingUsers,
      });
    });
  }

  _getUsersList() {
    const list = [{ id: this.peer?.id || 'host', username: this.username, isHost: this.isHost }];
    this.connections.forEach((conn) => {
      list.push({
        id: conn.peer,
        username: conn.metadata?.username || 'Pasangan',
        isHost: false,
      });
    });
    return list;
  }

  _handleData(data) {
    if (!data || !data.type) return;

    if (data.type === 'video-play') {
      this.currentVideoState.isPlaying = true;
      if (typeof data.currentTime === 'number') {
        this.currentVideoState.currentTime = data.currentTime;
      }
      this._trigger('video-play', data);
    } else if (data.type === 'video-pause') {
      this.currentVideoState.isPlaying = false;
      if (typeof data.currentTime === 'number') {
        this.currentVideoState.currentTime = data.currentTime;
      }
      this._trigger('video-pause', data);
    } else if (data.type === 'video-seek') {
      if (typeof data.currentTime === 'number') {
        this.currentVideoState.currentTime = data.currentTime;
      }
      this._trigger('video-seek', data);
    } else if (data.type === 'change-video') {
      this.currentVideoState.videoUrl = data.videoUrl;
      this.currentVideoState.currentTime = 0;
      this.currentVideoState.isPlaying = false;
      this._trigger('change-video', data);
    } else {
      this._trigger(data.type, data);
    }
  }
}

export const p2pSync = new P2PSync();
