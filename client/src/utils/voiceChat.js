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

class CallManager {
  constructor() {
    this.localStream = null;
    this.peers = new Map(); // targetId -> RTCPeerConnection
    this.remoteStreams = new Map(); // targetId -> MediaStream
    this.remoteAudioElements = new Map(); // targetId -> HTMLAudioElement
    this.candidateQueues = new Map(); // targetId -> RTCIceCandidate[]
    this.activeVoiceUsers = new Set(); // set of user IDs with voice enabled
    this.activeCamUsers = new Set(); // set of user IDs with camera enabled
    this.isMuted = false;
    this.isActive = false; // Voice active
    this.isVideoActive = false; // Camera active
    this.facingMode = 'user'; // 'user' (front) or 'environment' (back)
    this.onStateChange = null;
    this.onPartnerVoiceStatus = null;
    this.onPartnerCamStatus = null;

    // Listen to signaling and room events
    socket.on('webrtc-offer', this.handleOffer.bind(this));
    socket.on('webrtc-answer', this.handleAnswer.bind(this));
    socket.on('webrtc-ice', this.handleIceCandidate.bind(this));
    socket.on('voice-state', this.handleVoiceState.bind(this));
    socket.on('cam-state', this.handleCamState.bind(this));
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
      let audioStream;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
          video: false,
        });
      } catch (constraintErr) {
        console.warn('[Call] Ideal audio constraints failed, falling back to basic audio', constraintErr);
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      const audioTrack = audioStream.getAudioTracks()[0];
      if (!this.localStream) {
        this.localStream = new MediaStream([audioTrack]);
      } else {
        // Replace or add audio track
        const oldAudio = this.localStream.getAudioTracks()[0];
        if (oldAudio) {
          this.localStream.removeTrack(oldAudio);
          oldAudio.stop();
        }
        this.localStream.addTrack(audioTrack);
      }

      this.isActive = true;
      this.isMuted = false;
      this.activeVoiceUsers.add(socket.id);

      // Add track to all active peer connections
      this.peers.forEach((pc, targetId) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
        if (sender) {
          sender.replaceTrack(audioTrack);
        } else {
          pc.addTrack(audioTrack, this.localStream);
        }
      });

      // Broadcast to room that we have joined voice chat
      socket.emit('voice-state', {
        senderId: socket.id,
        username: socket.username || 'Pasangan',
        isActive: true,
      });

      this._notifyStateChange();

      // Initiate calls with peers
      this._reconnectActivePeers();
      return true;
    } catch (err) {
      console.error('[Call] Failed to get microphone stream:', err);
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

    // Stop and remove local audio track
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.stop();
        this.localStream.removeTrack(audioTrack);
      }
    }

    // Broadcast that we left voice chat
    socket.emit('voice-state', {
      senderId: socket.id,
      username: socket.username || 'Pasangan',
      isActive: false,
    });

    // If camera is also inactive, cleanup all connections
    if (!this.isVideoActive) {
      this.peers.forEach((peer, targetId) => {
        this.cleanupPeer(targetId);
      });
      if (this.localStream) {
        this.localStream.getTracks().forEach((t) => t.stop());
        this.localStream = null;
      }
    } else {
      // Just mute/disable audio sender
      this.peers.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
        if (sender) {
          sender.replaceTrack(null);
        }
      });
    }

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

  async toggleVideo() {
    if (this.isVideoActive) {
      this.stopVideo();
      return false;
    } else {
      const success = await this.startVideo();
      return success;
    }
  }

  async startVideo() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Peramban atau WebView tidak mendukung akses kamera.');
      return false;
    }

    try {
      // Auto-start voice if not started yet so users can talk
      if (!this.isActive) {
        await this.startVoice();
      }

      console.log(`[Call] Starting camera (facingMode: ${this.facingMode})...`);
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facingMode,
          width: { ideal: 480 },
          height: { ideal: 360 },
          frameRate: { ideal: 24 },
        },
        audio: false,
      });

      const videoTrack = camStream.getVideoTracks()[0];

      if (!this.localStream) {
        this.localStream = new MediaStream([videoTrack]);
      } else {
        const oldVideo = this.localStream.getVideoTracks()[0];
        if (oldVideo) {
          this.localStream.removeTrack(oldVideo);
          oldVideo.stop();
        }
        this.localStream.addTrack(videoTrack);
        // Force React to detect object reference change
        this.localStream = new MediaStream(this.localStream.getTracks());
      }

      this.isVideoActive = true;
      this.activeCamUsers.add(socket.id);

      // Attach track to existing peer connections
      let needsRenegotiation = false;
      this.peers.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, this.localStream);
          needsRenegotiation = true;
        }
      });

      // Broadcast cam state to room
      socket.emit('cam-state', {
        senderId: socket.id,
        username: socket.username || 'Pasangan',
        isVideoActive: true,
      });

      this._notifyStateChange();

      if (needsRenegotiation || this.peers.size === 0) {
        this._reconnectActivePeers();
      }

      return true;
    } catch (err) {
      console.error('[Call] Failed to access camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan perangkat Anda.');
      } else {
        alert(`Gagal mengakses kamera: ${err.message || err.name}`);
      }
      return false;
    }
  }

  stopVideo() {
    this.isVideoActive = false;
    this.activeCamUsers.delete(socket.id);

    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        this.localStream.removeTrack(videoTrack);
      }
    }

    // Set video senders to null
    this.peers.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(null);
      }
    });

    // Broadcast cam state
    socket.emit('cam-state', {
      senderId: socket.id,
      username: socket.username || 'Pasangan',
      isVideoActive: false,
    });

    this._notifyStateChange();
  }

  async flipCamera() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    if (this.isVideoActive) {
      await this.startVideo();
    }
  }

  _reconnectActivePeers() {
    const allActive = new Set([...this.activeVoiceUsers, ...this.activeCamUsers]);
    allActive.forEach((peerId) => {
      if (peerId !== socket.id) {
        const shouldInitiate = socket.id < peerId;
        if (shouldInitiate) {
          console.log(`[Call] Calling peer ${peerId}`);
          this.callPeer(peerId);
        }
      }
    });
  }

  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isActive: this.isActive,
        isMuted: this.isMuted,
        isVideoActive: this.isVideoActive,
        connectedPeers: this.peers.size,
        hasPartnerInVoice: Array.from(this.activeVoiceUsers).some((id) => id !== socket.id),
        hasPartnerInCam: Array.from(this.activeCamUsers).some((id) => id !== socket.id),
        localStream: this.localStream,
        remoteStreams: this.remoteStreams,
      });
    }
  }

  createPeerConnection(targetId) {
    if (this.peers.has(targetId)) {
      const existingPc = this.peers.get(targetId);
      if (existingPc.signalingState === 'stable') {
        return existingPc;
      }
      console.warn(`[Call] Existing PC for ${targetId} in ${existingPc.signalingState}, recreating.`);
      existingPc.close();
      this.peers.delete(targetId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
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

    // Remote track received
    pc.ontrack = (event) => {
      console.log(`[Call] Received remote track ${event.track.kind} from ${targetId}`, event);
      const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      this.remoteStreams.set(targetId, stream);
      if (event.track.kind === 'audio') {
        this.playRemoteStream(targetId, stream);
      }
      this._notifyStateChange();
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Call] ICE state for ${targetId}:`, pc.iceConnectionState);
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
      console.warn('[Call] Remote audio play error:', e);
    });
  }

  async callPeer(targetId) {
    const pc = this.createPeerConnection(targetId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { targetId, offer });
    } catch (err) {
      console.error('[Call] Error creating offer:', err);
    }
  }

  async handleOffer(data) {
    const { senderId, offer } = data;
    if (!senderId || !offer) return;

    if (this.peers.has(senderId)) {
      const oldPc = this.peers.get(senderId);
      if (oldPc.signalingState !== 'stable') {
        oldPc.close();
        this.peers.delete(senderId);
      }
    }

    const pc = this.createPeerConnection(senderId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      this._drainCandidateQueue(senderId, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: senderId, answer });
    } catch (err) {
      console.error('[Call] Error handling offer:', err);
    }
  }

  async handleAnswer(data) {
    const { senderId, answer } = data;
    if (!senderId || !answer) return;

    const pc = this.peers.get(senderId);
    if (pc && pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        this._drainCandidateQueue(senderId, pc);
      } catch (err) {
        console.error('[Call] Error handling answer:', err);
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
        console.error('[Call] Error adding ICE candidate:', err);
      }
    } else {
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
          console.error('[Call] Error draining queued candidate:', e);
        }
      }
      this.candidateQueues.delete(senderId);
    }
  }

  handleVoiceState(data) {
    const { senderId, username, isActive } = data;
    if (!senderId || senderId === socket.id) return;

    if (isActive) {
      this.activeVoiceUsers.add(senderId);
      if (this.isActive || this.isVideoActive) {
        const shouldInitiate = socket.id < senderId;
        if (shouldInitiate) {
          this.callPeer(senderId);
        }
      }
      if (this.onPartnerVoiceStatus) {
        this.onPartnerVoiceStatus({ senderId, username, isActive: true });
      }
    } else {
      this.activeVoiceUsers.delete(senderId);
      if (!this.activeCamUsers.has(senderId)) {
        this.cleanupPeer(senderId);
      }
      if (this.onPartnerVoiceStatus) {
        this.onPartnerVoiceStatus({ senderId, username, isActive: false });
      }
    }
    this._notifyStateChange();
  }

  handleCamState(data) {
    const { senderId, username, isVideoActive } = data;
    if (!senderId || senderId === socket.id) return;

    console.log(`[Call] Partner ${username || senderId} cam state:`, isVideoActive);

    if (isVideoActive) {
      this.activeCamUsers.add(senderId);
      if (this.isActive || this.isVideoActive) {
        const shouldInitiate = socket.id < senderId;
        if (shouldInitiate) {
          this.callPeer(senderId);
        }
      }
      if (this.onPartnerCamStatus) {
        this.onPartnerCamStatus({ senderId, username, isVideoActive: true });
      }
    } else {
      this.activeCamUsers.delete(senderId);
      if (!this.activeVoiceUsers.has(senderId)) {
        this.cleanupPeer(senderId);
      }
      if (this.onPartnerCamStatus) {
        this.onPartnerCamStatus({ senderId, username, isVideoActive: false });
      }
    }
    this._notifyStateChange();
  }

  handleUserJoined({ username, users }) {
    if (this.isActive || this.isVideoActive) {
      if (this.isActive) {
        socket.emit('voice-state', {
          senderId: socket.id,
          username: socket.username || 'Pasangan',
          isActive: true,
        });
      }
      if (this.isVideoActive) {
        socket.emit('cam-state', {
          senderId: socket.id,
          username: socket.username || 'Pasangan',
          isVideoActive: true,
        });
      }
    }
  }

  handleUserLeft({ username }) {
    this.peers.forEach((pc, targetId) => {
      this.cleanupPeer(targetId);
    });
  }

  cleanupPeer(targetId) {
    const pc = this.peers.get(targetId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      this.peers.delete(targetId);
    }
    this.remoteStreams.delete(targetId);
    const audio = this.remoteAudioElements.get(targetId);
    if (audio) {
      audio.srcObject = null;
      if (audio.parentNode) audio.parentNode.removeChild(audio);
      this.remoteAudioElements.delete(targetId);
    }
    this.candidateQueues.delete(targetId);
    this._notifyStateChange();
  }
}

export const voiceChat = new CallManager();
