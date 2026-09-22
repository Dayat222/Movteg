import { socket } from './socket';

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

class ScreenShareManager {
  constructor() {
    this.localStream = null;
    this.remoteStream = null;
    this.isSharing = false; // True if this device is sharing screen
    this.sharerId = null;
    this.sharerName = null;
    this.peers = new Map(); // targetId -> RTCPeerConnection
    this.candidateQueues = new Map(); // targetId -> RTCIceCandidate[]
    this.onStateChange = null;

    // Listen to signaling and room events
    socket.on('webrtc-screen-offer', this.handleOffer.bind(this));
    socket.on('webrtc-screen-answer', this.handleAnswer.bind(this));
    socket.on('webrtc-screen-ice', this.handleIceCandidate.bind(this));
    socket.on('screen-share-state', this.handleScreenShareState.bind(this));
    socket.on('user-left', this.handleUserLeft.bind(this));
    socket.on('user-joined', this.handleUserJoined.bind(this));
  }

  isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  async startScreenShare() {
    if (!this.isSupported()) {
      alert('Peramban atau perangkat ini tidak mendukung fitur Bagi Layar (getDisplayMedia). Biasanya fitur ini hanya tersedia di browser komputer/laptop.');
      return false;
    }

    if (this.isSharing) {
      this.stopScreenShare();
      return false;
    }

    try {
      console.log('[ScreenShare] Requesting display media...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { max: 30 },
        },
        audio: true, // Capture system / browser tab audio if supported
      });

      this.localStream = stream;
      this.isSharing = true;
      this.sharerId = socket.id;
      this.sharerName = socket.username || 'Pasangan';
      this.remoteStream = null;

      // Handle user stopping share via browser native banner ("Stop sharing")
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('[ScreenShare] Track ended by browser UI banner');
          this.stopScreenShare();
        };
      }

      // Broadcast to room that screen share has started
      socket.emit('screen-share-state', {
        isSharing: true,
        sharerId: socket.id,
        sharerName: this.sharerName,
      });

      this._notifyStateChange();

      // Call all other peers in the room
      if (socket.usersMap) {
        socket.usersMap.forEach((user, peerId) => {
          if (peerId !== socket.id) {
            console.log(`[ScreenShare] Calling peer ${peerId} (${user.username})`);
            this.callPeer(peerId);
          }
        });
      }

      return true;
    } catch (err) {
      console.error('[ScreenShare] Failed to start screen sharing:', err);
      if (err.name !== 'NotAllowedError') {
        alert(`Gagal membagikan layar: ${err.message || err.name}`);
      }
      return false;
    }
  }

  stopScreenShare() {
    if (!this.isSharing && !this.remoteStream) return;

    if (this.isSharing) {
      this.isSharing = false;
      this.sharerId = null;
      this.sharerName = null;

      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
      }

      // Broadcast stop event
      socket.emit('screen-share-state', {
        isSharing: false,
        sharerId: socket.id,
      });
    } else {
      this.remoteStream = null;
      this.sharerId = null;
      this.sharerName = null;
    }

    // Cleanup all peer connections
    this.peers.forEach((peer, targetId) => {
      this.cleanupPeer(targetId);
    });

    this._notifyStateChange();
  }

  callPeer(targetId) {
    if (!this.localStream) return;
    this.cleanupPeer(targetId);

    const pc = this.createPeerConnection(targetId);
    this.peers.set(targetId, pc);

    // Add all tracks (video and tab audio)
    this.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream);
    });

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('webrtc-screen-offer', {
          targetId,
          offer: pc.localDescription,
        });
      })
      .catch((err) => {
        console.error(`[ScreenShare] Failed to create offer for ${targetId}:`, err);
      });
  }

  async handleOffer({ senderId, offer }) {
    // If we are the sharer, ignore incoming offers
    if (this.isSharing) return;

    console.log(`[ScreenShare] Received offer from ${senderId}`);
    this.cleanupPeer(senderId);

    const pc = this.createPeerConnection(senderId);
    this.peers.set(senderId, pc);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      this.processQueuedCandidates(senderId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('webrtc-screen-answer', {
        targetId: senderId,
        answer: pc.localDescription,
      });
    } catch (err) {
      console.error(`[ScreenShare] Error handling offer from ${senderId}:`, err);
    }
  }

  async handleAnswer({ senderId, answer }) {
    const pc = this.peers.get(senderId);
    if (!pc) return;

    console.log(`[ScreenShare] Received answer from ${senderId}`);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      this.processQueuedCandidates(senderId, pc);
    } catch (err) {
      console.error(`[ScreenShare] Error handling answer from ${senderId}:`, err);
    }
  }

  async handleIceCandidate({ senderId, candidate }) {
    if (!candidate) return;
    const pc = this.peers.get(senderId);

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[ScreenShare] Error adding ICE candidate:', err);
      }
    } else {
      if (!this.candidateQueues.has(senderId)) {
        this.candidateQueues.set(senderId, []);
      }
      this.candidateQueues.get(senderId).push(candidate);
    }
  }

  handleScreenShareState(data) {
    console.log('[ScreenShare] Received state:', data);
    if (data.isSharing) {
      this.sharerId = data.sharerId;
      this.sharerName = data.sharerName;
      if (data.sharerId === socket.id) {
        this.isSharing = true;
      }
      this._notifyStateChange();
    } else {
      this.stopScreenShare();
    }
  }

  handleUserJoined({ username, users }) {
    // If we are currently sharing, invite newly joined user automatically
    if (this.isSharing && this.localStream) {
      const newUser = users?.find((u) => u.username === username);
      if (newUser && newUser.id !== socket.id) {
        console.log(`[ScreenShare] New user ${newUser.id} joined, sending screen offer`);
        // Notify them of sharing state first
        socket.emit('screen-share-state', {
          isSharing: true,
          sharerId: socket.id,
          sharerName: this.sharerName,
        });
        setTimeout(() => {
          this.callPeer(newUser.id);
        }, 800);
      }
    }
  }

  handleUserLeft({ username }) {
    // If the person who left was sharing screen, revert to URL player
    if (this.sharerName === username && !this.isSharing) {
      this.stopScreenShare();
    }
  }

  createPeerConnection(targetId) {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-screen-ice', {
          targetId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[ScreenShare] ontrack received:', event.track.kind, event.streams);
      const incomingStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      this.remoteStream = incomingStream;
      this._notifyStateChange();
    };

    pc.onconnectionstatechange = () => {
      console.log(`[ScreenShare] Connection with ${targetId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(targetId);
      }
    };

    return pc;
  }

  processQueuedCandidates(targetId, pc) {
    const queue = this.candidateQueues.get(targetId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[ScreenShare] Error adding queued ICE candidate:', err);
      }
    }
  }

  cleanupPeer(targetId) {
    const pc = this.peers.get(targetId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
      this.peers.delete(targetId);
    }
    this.candidateQueues.delete(targetId);
  }

  _notifyStateChange() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({
        isSharing: this.isSharing, // We are sharing
        hasActiveShare: !!(this.isSharing || this.remoteStream || this.sharerId),
        stream: this.isSharing ? this.localStream : this.remoteStream,
        sharerName: this.sharerName,
        isPresenter: this.isSharing,
      });
    }
  }
}

export const screenShare = new ScreenShareManager();
