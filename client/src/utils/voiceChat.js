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

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.peers = new Map(); // targetId -> RTCPeerConnection
    this.remoteStreams = new Map(); // targetId -> MediaStream
    this.remoteAudioElements = new Map(); // targetId -> HTMLAudioElement
    this.candidateQueues = new Map(); // targetId -> RTCIceCandidate[]
    this.activeVoiceUsers = new Set(); // set of user IDs with voice enabled
    this.isMuted = false;
    this.isActive = false;
    this.onStateChange = null;
    this.onPartnerVoiceStatus = null; // callback for partner voice changes

    // Listen to signaling and room events
    socket.on('webrtc-offer', this.handleOffer.bind(this));
    socket.on('webrtc-answer', this.handleAnswer.bind(this));
    socket.on('webrtc-ice', this.handleIceCandidate.bind(this));
    socket.on('voice-state', this.handleVoiceState.bind(this));
    socket.on('user-left', this.handleUserLeft.bind(this));
    socket.on('user-joined', this.handleUserJoined.bind(this));
  }

  async toggleVoice() {
    if (this.isActive) {
      this.stopVoice();
      return false;
    } else {
      const success = await this.startVoice();
      return success;
    }
  }

  async startVoice() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Peramban atau WebView tidak mendukung akses mikrofon. Pastikan izin mikrofon diberikan dan aplikasi berjalan dalam mode aman (HTTPS).');
      return false;
    }

    try {
      let stream;
      try {
        // Try ideal audio constraints with echo cancellation & noise suppression
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
          video: false,
        });
      } catch (constraintErr) {
        console.warn('[Voice] Ideal constraints failed, falling back to basic audio', constraintErr);
        // Fallback for devices / Android WebViews with strict audio constraints
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      this.localStream = stream;
      this.isActive = true;
      this.isMuted = false;
      this.activeVoiceUsers.add(socket.id);

      // Broadcast to room that we have joined voice chat
      socket.emit('voice-state', {
        senderId: socket.id,
        username: socket.username || 'Pasangan',
        isActive: true,
      });

      this._notifyStateChange();

      // Initiate calls with peers who already have voice active
      // Using deterministic initiator pattern: the peer with lexicographically smaller ID calls
      this.activeVoiceUsers.forEach((peerId) => {
        if (peerId !== socket.id) {
          const shouldInitiate = socket.id < peerId;
          if (shouldInitiate) {
            console.log(`[Voice] Deterministic initiator calling peer ${peerId}`);
            this.callPeer(peerId);
          } else {
            console.log(`[Voice] Waiting for peer ${peerId} to initiate call`);
          }
        }
      });

      return true;
    } catch (err) {
      console.error('[Voice] Failed to get microphone stream:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Izin mikrofon ditolak. Silakan izinkan akses mikrofon di pengaturan perangkat / peramban Anda.');
      } else {
        alert(`Gagal mengakses mikrofon: ${err.message || err.name}`);
      }
      return false;
    }
  }

  stopVoice() {
    this.isActive = false;
    this.activeVoiceUsers.delete(socket.id);

    // Stop all local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Broadcast that we left voice chat
    socket.emit('voice-state', {
      senderId: socket.id,
      username: socket.username || 'Pasangan',
      isActive: false,
    });

    // Close and cleanup all peer connections
    this.peers.forEach((peer, targetId) => {
      this.cleanupPeer(targetId);
    });

    this._notifyStateChange();
  }

  toggleMute() {
    if (this.localStream) {
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
      this._notifyStateChange();
    }
  }

  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isActive: this.isActive,
        isMuted: this.isMuted,
        connectedPeers: this.peers.size,
        hasPartnerInVoice: Array.from(this.activeVoiceUsers).some((id) => id !== socket.id),
      });
    }
  }

  createPeerConnection(targetId) {
    if (this.peers.has(targetId)) {
      const existingPc = this.peers.get(targetId);
      // If the existing connection is healthy or active, return it
      if (existingPc.signalingState === 'stable') {
        return existingPc;
      }
      // If stuck in a non-stable state, close it cleanly first to prevent glare/collision
      console.warn(`[Voice] Existing PC for ${targetId} is in non-stable state (${existingPc.signalingState}). Re-creating.`);
      existingPc.close();
      this.peers.delete(targetId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks if available
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice', { targetId, candidate: event.candidate });
      }
    };

    // Remote audio track received
    pc.ontrack = (event) => {
      console.log(`[Voice] Received remote audio track from ${targetId}`, event);
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      this.remoteStreams.set(targetId, stream);
      this.playRemoteStream(targetId, stream);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] ICE connection state for ${targetId}:`, pc.iceConnectionState);
      if (
        pc.iceConnectionState === 'disconnected' ||
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'closed'
      ) {
        this.cleanupPeer(targetId);
      }
    };

    this.peers.set(targetId, pc);
    this._notifyStateChange();
    return pc;
  }

  playRemoteStream(targetId, stream) {
    let audio = this.remoteAudioElements.get(targetId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      this.remoteAudioElements.set(targetId, audio);
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.muted = false;
    audio.volume = 1.0;
    audio.play().catch((e) => {
      console.warn('[Voice] Remote audio play error:', e);
    });
  }

  async callPeer(targetId) {
    const pc = this.createPeerConnection(targetId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { targetId, offer });
    } catch (err) {
      console.error('[Voice] Error creating offer:', err);
    }
  }

  async handleOffer(data) {
    const { senderId, offer } = data;
    if (!senderId || !offer) return;

    // Reset any previous connection in invalid state to avoid collision
    if (this.peers.has(senderId)) {
      const oldPc = this.peers.get(senderId);
      if (oldPc.signalingState !== 'stable') {
        console.warn(`[Voice] Received offer while PC was in ${oldPc.signalingState}, resetting connection.`);
        oldPc.close();
        this.peers.delete(senderId);
      }
    }

    const pc = this.createPeerConnection(senderId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush queued candidates that arrived before remoteDescription
      this._drainCandidateQueue(senderId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: senderId, answer });
    } catch (err) {
      console.error('[Voice] Error handling offer:', err);
    }
  }

  async handleAnswer(data) {
    const { senderId, answer } = data;
    if (!senderId || !answer) return;

    const pc = this.peers.get(senderId);
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // Flush queued candidates
        this._drainCandidateQueue(senderId, pc);
      } catch (err) {
        console.error('[Voice] Error handling answer:', err);
      }
    }
  }

  async handleIceCandidate(data) {
    const { senderId, candidate } = data;
    if (!senderId || !candidate) return;

    const pc = this.peers.get(senderId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[Voice] Error adding ICE candidate:', err);
      }
    } else {
      // Queue candidate until setRemoteDescription completes
      if (!this.candidateQueues.has(senderId)) {
        this.candidateQueues.set(senderId, []);
      }
      this.candidateQueues.get(senderId).push(candidate);
    }
  }

  _drainCandidateQueue(senderId, pc) {
    if (this.candidateQueues.has(senderId)) {
      const queue = this.candidateQueues.get(senderId);
      while (queue.length > 0) {
        const cand = queue.shift();
        try {
          pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.error('[Voice] Error draining queued candidate:', e);
        }
      }
      this.candidateQueues.delete(senderId);
    }
  }

  handleVoiceState(data) {
    const { senderId, username, isActive } = data;
    if (!senderId || senderId === socket.id) return;

    console.log(`[Voice] Partner ${username || senderId} voice state:`, isActive);

    if (isActive) {
      this.activeVoiceUsers.add(senderId);

      // If we are also active, deterministic initiator establishes connection
      if (this.isActive) {
        const shouldInitiate = socket.id < senderId;
        if (shouldInitiate) {
          console.log(`[Voice] Calling newly active peer ${senderId}`);
          this.callPeer(senderId);
        }
      }

      if (this.onPartnerVoiceStatus) {
        this.onPartnerVoiceStatus({ senderId, username, isActive: true });
      }
    } else {
      this.activeVoiceUsers.delete(senderId);
      this.cleanupPeer(senderId);

      if (this.onPartnerVoiceStatus) {
        this.onPartnerVoiceStatus({ senderId, username, isActive: false });
      }
    }

    this._notifyStateChange();
  }

  handleUserJoined(data) {
    // If we are currently active, broadcast our voice state so newly joined users are informed
    if (this.isActive) {
      socket.emit('voice-state', {
        senderId: socket.id,
        username: socket.username || 'Pasangan',
        isActive: true,
      });
    }
  }

  handleUserLeft(data) {
    // When a user leaves, cleanup any associated peer connection
    setTimeout(() => {
      this.peers.forEach((_, targetId) => {
        if (!socket.usersMap.has(targetId)) {
          this.activeVoiceUsers.delete(targetId);
          this.cleanupPeer(targetId);
        }
      });
    }, 500);
  }

  cleanupPeer(targetId) {
    if (this.peers.has(targetId)) {
      try {
        this.peers.get(targetId).close();
      } catch {
        // ignore
      }
      this.peers.delete(targetId);
    }

    if (this.remoteAudioElements.has(targetId)) {
      const audio = this.remoteAudioElements.get(targetId);
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
      this.remoteAudioElements.delete(targetId);
    }

    this.remoteStreams.delete(targetId);
    this.candidateQueues.delete(targetId);
    this._notifyStateChange();
  }
}

export const voiceChat = new VoiceChatManager();
