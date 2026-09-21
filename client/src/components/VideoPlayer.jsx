import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getYouTubeId, isYouTubeUrl, isHlsUrl } from '../utils/youtube';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Film } from 'lucide-react';

export default function VideoPlayer({
  videoUrl,
  roomId,
  socket,
  onActivity,
}) {
  const isYouTube = isYouTubeUrl(videoUrl);
  const ytVideoId = isYouTube ? getYouTubeId(videoUrl) : null;

  // Refs for state lock
  const isRemoteUpdateRef = useRef(false);
  const isSeekingRef = useRef(false);

  // HTML5 Video refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // YouTube Player refs
  const ytPlayerRef = useRef(null);
  const ytContainerRef = useRef(null);
  const [isYtReady, setIsYtReady] = useState(false);

  // Local UI status
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Tersinkronisasi 🟢');

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Safe seek helper for HTML5 video on mobile/Android WebView
  const applyVideoSeek = useCallback((video, targetTime) => {
    if (!video || typeof targetTime !== 'number' || isNaN(targetTime)) return;
    if (video.readyState >= 1) {
      video.currentTime = targetTime;
    } else {
      const handleLoaded = () => {
        try {
          video.currentTime = targetTime;
        } catch {
          // ignore
        }
        video.removeEventListener('loadedmetadata', handleLoaded);
      };
      video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    }
  }, []);

  const showSyncNotice = (text) => {
    setSyncStatus(text);
    setTimeout(() => setSyncStatus('Tersinkronisasi 🟢'), 3000);
  };

  // ----------------------------------------------------
  // YouTube IFrame API Initialization
  // ----------------------------------------------------
  useEffect(() => {
    if (!isYouTube || !ytVideoId) return;

    let destroyed = false;

    const initYouTubePlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      // Clean up previous instance
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }

      ytPlayerRef.current = new window.YT.Player('youtube-player-container', {
        videoId: ytVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          playsinline: 1,
          ...(isLocalhost ? {} : { origin: window.location.origin }),
        },
        events: {
          onReady: (event) => {
            if (destroyed) return;
            setIsYtReady(true);
            setDuration(event.target.getDuration() || 0);
          },
          onStateChange: (event) => {
            if (destroyed) return;

            // Prevent event feedback loop if triggered remotely
            if (isRemoteUpdateRef.current) {
              isRemoteUpdateRef.current = false;
              return;
            }

            const player = event.target;
            const time = player.getCurrentTime();

            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              socket.emit('video-play', { roomId, currentTime: time });
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              socket.emit('video-pause', { roomId, currentTime: time });
            }
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = () => {
        initYouTubePlayer();
      };
      document.body.appendChild(tag);
    } else {
      initYouTubePlayer();
    }

    return () => {
      destroyed = true;
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [isYouTube, ytVideoId, roomId, socket]);

  // ----------------------------------------------------
  // HTML5 Video & HLS Stream Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (isYouTube) return;
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (isHlsUrl(videoUrl)) {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoUrl;
        video.load();
      }
    } else {
      video.src = videoUrl;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl, isYouTube]);

  // ----------------------------------------------------
  // HTML5 Event Handlers (Local User Actions)
  // ----------------------------------------------------
  const handleHtml5Play = () => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    setIsPlaying(true);
    if (videoRef.current) {
      socket.emit('video-play', {
        roomId,
        currentTime: videoRef.current.currentTime,
      });
    }
  };

  const handleHtml5Pause = () => {
    if (isRemoteUpdateRef.current || isSeekingRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    setIsPlaying(false);
    if (videoRef.current) {
      socket.emit('video-pause', {
        roomId,
        currentTime: videoRef.current.currentTime,
      });
    }
  };

  const handleHtml5Seeked = () => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    isSeekingRef.current = false;
    if (videoRef.current) {
      socket.emit('video-seek', {
        roomId,
        currentTime: videoRef.current.currentTime,
      });
    }
  };

  const handleHtml5TimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  // ----------------------------------------------------
  // Remote Socket Listeners (Partner Actions)
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    // 1. Partner played video
    const handleRemotePlay = ({ currentTime: remoteTime, by }) => {
      setIsPlaying(true);
      showSyncNotice(`▶️ ${by || 'Pasangan'} memutar video`);
      if (onActivity) onActivity(`${by || 'Pasangan'} memutar video`);

      if (isYouTube && ytPlayerRef.current?.playVideo) {
        isRemoteUpdateRef.current = true;
        if (Math.abs((ytPlayerRef.current.getCurrentTime() || 0) - remoteTime) > 1.5) {
          ytPlayerRef.current.seekTo(remoteTime, true);
        }
        ytPlayerRef.current.playVideo();
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
      } else if (videoRef.current) {
        let changed = false;
        if (Math.abs(videoRef.current.currentTime - remoteTime) > 1.5) {
          applyVideoSeek(videoRef.current, remoteTime);
          changed = true;
        }
        if (videoRef.current.paused) {
          changed = true;
          videoRef.current.play().catch(() => {
            // Autoplay blocked by browser
            isRemoteUpdateRef.current = false;
          });
        }
        if (changed) {
          isRemoteUpdateRef.current = true;
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
        }
      }
    };

    // 2. Partner paused video
    const handleRemotePause = ({ currentTime: remoteTime, by }) => {
      setIsPlaying(false);
      showSyncNotice(`⏸️ ${by || 'Pasangan'} menjeda video`);
      if (onActivity) onActivity(`${by || 'Pasangan'} menjeda video`);

      if (isYouTube && ytPlayerRef.current?.pauseVideo) {
        isRemoteUpdateRef.current = true;
        if (Math.abs((ytPlayerRef.current.getCurrentTime() || 0) - remoteTime) > 1.5) {
          ytPlayerRef.current.seekTo(remoteTime, true);
        }
        ytPlayerRef.current.pauseVideo();
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
      } else if (videoRef.current) {
        let changed = false;
        if (Math.abs(videoRef.current.currentTime - remoteTime) > 1.5) {
          applyVideoSeek(videoRef.current, remoteTime);
          changed = true;
        }
        if (!videoRef.current.paused) {
          changed = true;
          videoRef.current.pause();
        }
        if (changed) {
          isRemoteUpdateRef.current = true;
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
        }
      }
    };

    // 3. Partner seeked
    const handleRemoteSeek = ({ currentTime: remoteTime, by }) => {
      showSyncNotice(`⏩ ${by || 'Pasangan'} menggeser durasi`);
      if (onActivity) onActivity(`${by || 'Pasangan'} menggeser video ke ${formatTime(remoteTime)}`);

      if (isYouTube && ytPlayerRef.current?.seekTo) {
        isRemoteUpdateRef.current = true;
        ytPlayerRef.current.seekTo(remoteTime, true);
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
      } else if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - remoteTime) > 1.5) {
          isRemoteUpdateRef.current = true;
          applyVideoSeek(videoRef.current, remoteTime);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
        }
      }
    };

    // 4. Initial room sync state
    const handleRoomState = ({ isPlaying: remoteIsPlaying, currentTime: remoteTime }) => {
      if (isYouTube && ytPlayerRef.current?.seekTo) {
        isRemoteUpdateRef.current = true;
        ytPlayerRef.current.seekTo(remoteTime, true);
        if (remoteIsPlaying) ytPlayerRef.current.playVideo();
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
      } else if (videoRef.current) {
        let changed = false;
        if (Math.abs(videoRef.current.currentTime - (remoteTime || 0)) > 1.5) {
          applyVideoSeek(videoRef.current, remoteTime || 0);
          changed = true;
        }
        if (remoteIsPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          changed = true;
        }
        if (changed) {
          isRemoteUpdateRef.current = true;
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 800);
        }
      }
    };

    socket.on('video-play', handleRemotePlay);
    socket.on('video-pause', handleRemotePause);
    socket.on('video-seek', handleRemoteSeek);
    socket.on('room-state', handleRoomState);

    return () => {
      socket.off('video-play', handleRemotePlay);
      socket.off('video-pause', handleRemotePause);
      socket.off('video-seek', handleRemoteSeek);
      socket.off('room-state', handleRoomState);
    };
  }, [socket, isYouTube, onActivity]);

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
      {/* Sync Badge */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/90">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        {syncStatus}
      </div>

      {/* Video Content */}
      <div className="w-full h-full flex items-center justify-center relative">
        {isYouTube ? (
          <div className="w-full h-full flex items-center justify-center">
            <div id="youtube-player-container" className="w-full h-full aspect-video"></div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain max-h-[78vh]"
            controls
            playsInline
            webkit-playsinline="true"
            preload="auto"
            crossOrigin="anonymous"
            onPlay={handleHtml5Play}
            onPause={handleHtml5Pause}
            onSeeking={() => { isSeekingRef.current = true; }}
            onSeeked={handleHtml5Seeked}
            onTimeUpdate={handleHtml5TimeUpdate}
          />
        )}
      </div>
    </div>
  );
}
