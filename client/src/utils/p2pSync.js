import PeerModule from 'peerjs';

// Ensure correct Peer constructor across different bundler outputs (ESM / CommonJS / Vite)
const Peer = PeerModule.default?.Peer || PeerModule.default || PeerModule.Peer || PeerModule;

// Reliable public STUN and TURN servers for WebRTC NAT traversal (including 4G CGNAT)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

class P2PSync {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> conn
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
    // no-op, joinRoom handles initialization
  }

  emit(event, data = {}) {
    if (event === 'join-room') {
      this.joinRoom(data.roomId, data.username, data.isGuest);
      return;
    }

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

    if (event === 'send-message') {
      const msg = {
        id: `p2p-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sender: this.username,
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      this._trigger('new-message', msg);
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

    const payload = {
      type: event,
      ...data,
      by: this.username,
      sender: this.username,
    };
    this.broadcast(payload);
  }

  broadcast(payload) {
    this.connections.forEach((conn) => {
      if (conn && conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          console.warn('Broadcast error:', e);
        }
      }
    });
  }

  joinRoom(roomId, username, isGuest = false) {
    if (!roomId || !username) return;

    this.roomId = roomId;
    this.username = username;

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // ignore
      }
    }

    const cleanRoomCode = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hostPeerId = `movteg-v4-${cleanRoomCode}`;

    // If opened via invite link, directly connect as Guest!
    if (isGuest) {
      this._connectAsGuest(hostPeerId);
      return;
    }

    // Otherwise register as Host
    try {
      this.peer = new Peer(hostPeerId, {
        config: { iceServers: ICE_SERVERS },
      });
    } catch {
      this.peer = new Peer({ config: { iceServers: ICE_SERVERS } });
    }

    this.peer.on('open', (id) => {
      console.log('[P2P] Host peer opened with ID:', id);
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
      console.warn('[P2P] Host peer error:', err.type);
      if (err.type === 'unavailable-id') {
        // Someone is already host, connect as guest
        this._connectAsGuest(hostPeerId);
      }
    });

    this.peer.on('connection', (conn) => {
      console.log('[P2P] Host received incoming connection from:', conn.peer);
      this._handleIncomingGuest(conn);
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

    this.peer = new Peer({
      config: { iceServers: ICE_SERVERS },
    });
    this.isHost = false;

    this.peer.on('open', (guestId) => {
      console.log('[P2P] Guest peer opened with ID:', guestId, 'connecting to host:', hostPeerId);
      const conn = this.peer.connect(hostPeerId, {
        metadata: { username: this.username },
        reliable: true,
      });

      const setupConn = (openedConn) => {
        console.log('[P2P] Guest connection successfully OPENED to host!');
        this.connected = true;
        this.connections.set(hostPeerId, openedConn);
        this._trigger('connect');

        // Greet host immediately with username
        openedConn.send({
          type: 'guest-hello',
          username: this.username,
        });
      };

      if (conn.open) {
        setupConn(conn);
      } else {
        conn.on('open', () => setupConn(conn));
      }

      conn.on('data', (data) => {
        console.log('[P2P] Guest received data:', data.type);
        this._handleData(data, conn);
      });

      conn.on('close', () => {
        console.log('[P2P] Guest connection closed');
        this.connections.delete(hostPeerId);
        this.connected = false;
        this._trigger('disconnect');
      });

      conn.on('error', (err) => {
        console.warn('[P2P] Guest connection error:', err);
      });
    });

    this.peer.on('error', (err) => {
      console.warn('[P2P] Guest peer error:', err);
    });
  }

  _handleIncomingGuest(conn) {
    const handleOpen = () => {
      console.log('[P2P] Host accepted open connection with guest:', conn.peer);
      this.connections.set(conn.peer, conn);

      // Send initial room state
      const currentUsers = this._getUsersList();
      conn.send({
        type: 'room-state',
        videoUrl: this.currentVideoState.videoUrl,
        isPlaying: this.currentVideoState.isPlaying,
        currentTime: this.currentVideoState.currentTime,
        users: currentUsers,
        isHost: false,
      });
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
      console.log('[P2P] Host received data from guest:', data.type);
      if (data.type === 'guest-hello') {
        conn.metadata = { username: data.username };
        const updatedUsers = this._getUsersList();

        // 1. Update Host UI
        this._trigger('user-joined', {
          username: data.username,
          users: updatedUsers,
        });

        // 2. Broadcast to all peers
        this.broadcast({
          type: 'user-joined',
          username: data.username,
          users: updatedUsers,
        });

        // 3. Send current state to guest with updated user list
        conn.send({
          type: 'room-state',
          videoUrl: this.currentVideoState.videoUrl,
          isPlaying: this.currentVideoState.isPlaying,
          currentTime: this.currentVideoState.currentTime,
          users: updatedUsers,
          isHost: false,
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

      this._handleData(data, conn);

      // Forward to other connected peers
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

    if (data.type === 'room-state') {
      if (data.videoUrl) this.currentVideoState.videoUrl = data.videoUrl;
      this._trigger('room-state', data);
    } else if (data.type === 'user-joined') {
      this._trigger('user-joined', data);
    } else if (data.type === 'user-left') {
      this._trigger('user-left', data);
    } else if (data.type === 'video-play') {
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
