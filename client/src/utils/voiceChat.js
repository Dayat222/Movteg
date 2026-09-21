import { socket } from './socket';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  }
];

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.peers = new Map(); // targetId -> RTCPeerConnection
    this.remoteStreams = new Map(); // targetId -> MediaStream
    this.remoteAudioElements = new Map(); // targetId -> HTMLAudioElement
    this.isMuted = false;
    this.isActive = false;
    this.onStateChange = null;

    // Listen to signaling events
    socket.on('webrtc-offer', this.handleOffer.bind(this));
    socket.on('webrtc-answer', this.handleAnswer.bind(this));
    socket.on('webrtc-ice', this.handleIceCandidate.bind(this));
    socket.on('user-left', this.handleUserLeft.bind(this));
    
    // When a new user joins, if we are active, we can proactively call them
    socket.on('user-joined', (data) => {
       if (this.isActive && data.users) {
          // Find the new user (not us) and call them if we haven't already
          const ourId = socket.id;
          data.users.forEach(u => {
              if (u.id !== ourId && !this.peers.has(u.id)) {
                  this.callPeer(u.id);
              }
          });
       }
    });
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
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.isActive = true;
      this.isMuted = false;
      this._notifyStateChange();

      // Call everyone currently in the room
      const currentUsers = Array.from(socket.usersMap.values());
      currentUsers.forEach(user => {
         if (user.id !== socket.id) {
             this.callPeer(user.id);
         }
      });
      return true;
    } catch (err) {
      console.error('[Voice] Failed to get mic', err);
      alert('Gagal mengakses mikrofon. Pastikan izin mikrofon diberikan.');
      return false;
    }
  }

  stopVoice() {
    this.isActive = false;
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Close all peer connections
    this.peers.forEach(peer => peer.close());
    this.peers.clear();
    
    // Remove all audio elements
    this.remoteAudioElements.forEach(audio => {
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) audio.parentNode.removeChild(audio);
    });
    this.remoteAudioElements.clear();
    this.remoteStreams.clear();
    
    this._notifyStateChange();
  }

  toggleMute() {
    if (this.localStream) {
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach(track => {
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
        connectedPeers: this.peers.size
      });
    }
  }

  createPeerConnection(targetId) {
    if (this.peers.has(targetId)) return this.peers.get(targetId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice', { targetId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[Voice] Received track from ${targetId}`);
      if (!this.remoteStreams.has(targetId)) {
         this.remoteStreams.set(targetId, new MediaStream());
      }
      const stream = this.remoteStreams.get(targetId);
      stream.addTrack(event.track);
      
      this.playRemoteStream(targetId, stream);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] ICE state for ${targetId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
         this.handleUserLeft({ username: 'Peer' }); // It cleans up by checking users map, but let's do explicit cleanup
         this.cleanupPeer(targetId);
      }
    };

    this.peers.set(targetId, pc);
    this._notifyStateChange();
    return pc;
  }

  playRemoteStream(targetId, stream) {
    if (this.remoteAudioElements.has(targetId)) return;
    
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    
    // Optional: Append to body to ensure it plays (some browsers require it)
    document.body.appendChild(audio);
    
    audio.play().catch(e => console.error('[Voice] Autoplay failed:', e));
    this.remoteAudioElements.set(targetId, audio);
  }

  async callPeer(targetId) {
    const pc = this.createPeerConnection(targetId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { targetId, offer });
    } catch (err) {
      console.error('[Voice] Error creating offer', err);
    }
  }

  async handleOffer(data) {
    const { senderId, targetId, offer } = data;
    // We only respond if we are active
    if (!this.isActive) return;
    
    const pc = this.createPeerConnection(senderId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: senderId, answer });
    } catch (err) {
      console.error('[Voice] Error handling offer', err);
    }
  }

  async handleAnswer(data) {
    const { senderId, answer } = data;
    const pc = this.peers.get(senderId);
    if (pc) {
      try {
         await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
         console.error('[Voice] Error handling answer', err);
      }
    }
  }

  async handleIceCandidate(data) {
    const { senderId, candidate } = data;
    const pc = this.peers.get(senderId);
    if (pc) {
       try {
         await pc.addIceCandidate(new RTCIceCandidate(candidate));
       } catch (err) {
         console.error('[Voice] Error adding ICE candidate', err);
       }
    }
  }

  cleanupPeer(targetId) {
    if (this.peers.has(targetId)) {
        this.peers.get(targetId).close();
        this.peers.delete(targetId);
    }
    if (this.remoteAudioElements.has(targetId)) {
        const audio = this.remoteAudioElements.get(targetId);
        audio.pause();
        audio.srcObject = null;
        if (audio.parentNode) audio.parentNode.removeChild(audio);
        this.remoteAudioElements.delete(targetId);
    }
    this.remoteStreams.delete(targetId);
    this._notifyStateChange();
  }

  handleUserLeft(data) {
    // data.users contains remaining users. Find out who is missing from our peers.
    // Or simpler: when someone leaves, we can just check if they are in our peers and cleanup.
    // However, data.username is provided, not data.id. 
    // We can just iterate peers and see if they exist in socket.usersMap.
    setTimeout(() => {
        this.peers.forEach((pc, targetId) => {
            if (!socket.usersMap.has(targetId)) {
                this.cleanupPeer(targetId);
            }
        });
    }, 1000);
  }
}

export const voiceChat = new VoiceChatManager();
