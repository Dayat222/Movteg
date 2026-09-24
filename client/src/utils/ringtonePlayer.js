/**
 * Robust Ringtone & Vibration Player for In-App Calls
 * Supports Audio element, Web Audio API fallback, and Haptic Vibration
 */
class RingtonePlayer {
  constructor() {
    this.audio = null;
    this.audioCtx = null;
    this.oscInterval = null;
    this.vibrateInterval = null;
    this.isPlaying = false;
  }

  init() {
    if (!this.audio && typeof window !== 'undefined') {
      try {
        let el = document.getElementById('movteg-ringtone-audio');
        if (!el) {
          el = document.createElement('audio');
          el.id = 'movteg-ringtone-audio';
          el.src = '/ringtone.wav';
          el.loop = true;
          el.preload = 'auto';
          el.style.display = 'none';
          document.body.appendChild(el);
        }
        this.audio = el;
        this.audio.volume = 1.0;
      } catch (e) {
        console.warn('[Ringtone] HTML Audio init failed:', e);
      }
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.init();

    // 1. Try playing local WAV file
    let audioPlayed = false;
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play()
        .then(() => {
          audioPlayed = true;
          console.log('[Ringtone] Playing via HTML Audio');
        })
        .catch((err) => {
          console.warn('[Ringtone] HTML Audio play error/blocked, falling back to Web Audio synth:', err);
          this.startSynth();
        });
    } else {
      this.startSynth();
    }

    // 2. Start Haptic Vibration (repeats every 2.5s)
    this.startVibration();
  }

  startSynth() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const playToneBurst = () => {
        if (!this.isPlaying || !this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(880, now);
        osc2.frequency.setValueAtTime(1108, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gain.gain.setValueAtTime(0.4, now + 0.6);
        gain.gain.linearRampToValueAtTime(0, now + 0.7);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.75);
        osc2.stop(now + 0.75);
      };

      // Play pattern immediately, then repeat
      playToneBurst();
      this.oscInterval = setInterval(() => {
        if (this.isPlaying) {
          playToneBurst();
          setTimeout(() => {
            if (this.isPlaying) playToneBurst();
          }, 800);
        }
      }, 2500);
    } catch (e) {
      console.warn('[Ringtone] Synth failed:', e);
    }
  }

  startVibration() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([500, 250, 500, 250, 1000]);
        this.vibrateInterval = setInterval(() => {
          if (this.isPlaying && navigator.vibrate) {
            navigator.vibrate([500, 250, 500, 250, 1000]);
          }
        }, 2500);
      } catch (e) {
        console.warn('[Ringtone] Vibration error:', e);
      }
    }
  }

  stop() {
    this.isPlaying = false;

    // Stop HTML Audio
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (e) {}
    }

    // Stop Web Audio Synth
    if (this.oscInterval) {
      clearInterval(this.oscInterval);
      this.oscInterval = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.suspend();
      } catch (e) {}
    }

    // Stop Vibration
    if (this.vibrateInterval) {
      clearInterval(this.vibrateInterval);
      this.vibrateInterval = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }
}

export const ringtonePlayer = new RingtonePlayer();
