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

  // Refs for state lock & play queue
  const isRemoteUpdateRef = useRef(false);
  const programmaticSeekRef = useRef(false);
  const isSeekingRef = useRef(false);
  const shouldBePlayingRef = useRef(false);
  const targetSeekTimeRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

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

  // Web Audio Volume Booster (up to 300% to overcome OS call ducking)
  const [boostLevel, setBoostLevel] = useState(1);
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);

  const cycleBoost = () => {
    const nextBoost = boostLevel === 1 ? 2 : boostLevel === 2 ? 3 : 1;
    applyBoost(nextBoost);
  };

  const applyBoost = (multiplier) => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        showSyncNotice('⚠️ Browser tidak mendukung Web Audio');
        return;
      }

      if (!audioCtxRef.current) {
        if (!video.crossOrigin) {
          video.crossOrigin = 'anonymous';
        }
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();
        gain.gain.value = multiplier;
        source.connect(gain);
        gain.connect(ctx.destination);
        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
      } else {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = multiplier;
        }
      }
      setBoostLevel(multiplier);
      showSyncNotice(`🔊 Suara Film di-boost ${multiplier * 100}%!`);
    } catch (e) {
      console.warn('[AudioBooster] Error:', e);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = multiplier;
        setBoostLevel(multiplier);
        showSyncNotice(`🔊 Suara Film di-boost ${multiplier * 100}%!`);
      } else {
        showSyncNotice('⚠️ Format video ini diproteksi oleh browser');
      }
    }
  };

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

  const [isUiVisible, setIsUiVisible] = useState(false);
  const uiTimeoutRef = useRef(null);

  const showUi = useCallback(() => {
    setIsUiVisible(true);
    if (uiTimeoutRef.current) {
      clearTimeout(uiTimeoutRef.current);
    }
    uiTimeoutRef.current = setTimeout(() => {
      setIsUiVisible(false);
    }, 3000);
  }, []);

  const showSyncNotice = useCallback((text) => {
    setSyncStatus(text);
    showUi();
    setTimeout(() => setSyncStatus('Tersinkronisasi 🟢'), 3000);
  }, [showUi]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, []);

  // ----------------------------------------------------
  // YouTube IFrame API Initialization
  // ----------------------------------------------------
  useEffect(() => {
    if (!isYouTube || !ytVideoId) return;

    // If YouTube Player is already initialized, just load the new video without tearing down DOM!
    if (ytPlayerRef.current && isYtReady && typeof ytPlayerRef.current.loadVideoById === 'function') {
      try {
        ytPlayerRef.current.loadVideoById(ytVideoId);
        return;
      } catch (e) {
        console.warn('loadVideoById failed, recreating player:', e);
      }
    }

    let destroyed = false;

    const initYouTubePlayer = () => {
      if (!window.YT || !window.YT.Player || !ytContainerRef.current) return;

      // Clean up previous instance safely
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {}
      }

      // Recreate mount node inside container so React ref remains stable
      ytContainerRef.current.innerHTML = '';
      const mountNode = document.createElement('div');
      mountNode.className = 'w-full h-full aspect-video';
      ytContainerRef.current.appendChild(mountNode);

      ytPlayerRef.current = new window.YT.Player(mountNode, {
        videoId: ytVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (destroyed) return;
            setIsYtReady(true);
            setDuration(event.target.getDuration ? (event.target.getDuration() || 0) : 0);
          },
          onStateChange: (event) => {
            if (destroyed) return;

            // Prevent event feedback loop if triggered remotely
            if (isRemoteUpdateRef.current) return;

            const player = event.target;
            const time = player.getCurrentTime ? player.getCurrentTime() : 0;

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
    };
  }, [isYouTube, ytVideoId, roomId, socket]);

  // ----------------------------------------------------
  // HTML5 Video & HLS Stream Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (isYouTube) return;
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    let hasRetriedWithProxy = false;

    // Fallback handler for native <video> errors (e.g. CORS block on iOS Safari / Android)
    video.onerror = () => {
      const err = video.error;
      console.warn('[Video] Native playback error:', err?.message || err?.code);
      if (!hasRetriedWithProxy && !video.src.includes('/api/proxy')) {
        hasRetriedWithProxy = true;
        console.log('[Video] Retrying via CORS Proxy...');
        showSyncNotice('🔄 Memutar via jalur bypass CORS...');
        video.src = `/api/proxy?url=${encodeURIComponent(videoUrl)}`;
        video.load();
        video.play().catch(() => {});
      }
    };

    if (isHlsUrl(videoUrl)) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // iOS Safari native HLS (faster, hardware accelerated, reliable)
        video.src = videoUrl;
        video.load();
      } else if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({ 
          enableWorker: true,
          manifestLoadingMaxRetry: 1,
          levelLoadingMaxRetry: 1
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn('[HLS] Error details:', data.type, data.details);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!hasRetriedWithProxy) {
                  hasRetriedWithProxy = true;
                  console.log('[HLS] Network/CORS error detected. Switching to CORS Proxy...');
                  showSyncNotice('🔄 Memutar via jalur bypass CORS...');
                  hls.loadSource(`/api/proxy?url=${encodeURIComponent(videoUrl)}`);
                  hls.startLoad();
                } else {
                  console.error('[HLS] Fatal network error after proxy retry');
                  hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (shouldBePlayingRef.current && video) {
            if (targetSeekTimeRef.current !== null) {
              applyVideoSeek(video, targetSeekTimeRef.current);
            }
            video.play().then(() => {
              setAutoplayBlocked(false);
            }).catch(() => setAutoplayBlocked(true));
          }
        });

        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      }
    } else {
      video.src = videoUrl;
      video.load();
    }

    const handleAutoResume = () => {
      if (shouldBePlayingRef.current && video) {
        if (targetSeekTimeRef.current !== null) {
          applyVideoSeek(video, targetSeekTimeRef.current);
        }
        video.play().then(() => {
          setAutoplayBlocked(false);
        }).catch((err) => {
          console.warn('[Video] Auto-resume blocked by browser:', err);
          setAutoplayBlocked(true);
        });
      }
    };
    video.addEventListener('canplay', handleAutoResume);
    video.addEventListener('loadeddata', handleAutoResume);

    return () => {
      if (video) {
        video.onerror = null;
        video.removeEventListener('canplay', handleAutoResume);
        video.removeEventListener('loadeddata', handleAutoResume);
      }
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
    if (isRemoteUpdateRef.current) return;
    
    setIsPlaying(true);
    shouldBePlayingRef.current = true;
    setAutoplayBlocked(false);
    if (videoRef.current) {
      socket.emit('video-play', {
        roomId,
        currentTime: videoRef.current.currentTime,
        sentAt: Date.now(),
      });
    }
  };

  const handleHtml5Pause = () => {
    if (isRemoteUpdateRef.current || isSeekingRef.current) return;

    setIsPlaying(false);
    shouldBePlayingRef.current = false;
    targetSeekTimeRef.current = null;
    setAutoplayBlocked(false);
    if (videoRef.current) {
      socket.emit('video-pause', {
        roomId,
        currentTime: videoRef.current.currentTime,
        sentAt: Date.now(),
      });
    }
  };

  const handleHtml5Seeking = () => {
    isSeekingRef.current = true;
    if (isRemoteUpdateRef.current) {
      programmaticSeekRef.current = true;
    }
  };

  const handleHtml5Seeked = () => {
    isSeekingRef.current = false;
    
    if (programmaticSeekRef.current) {
      programmaticSeekRef.current = false;
      return;
    }
    
    if (isRemoteUpdateRef.current) return;

    if (videoRef.current) {
      socket.emit('video-seek', {
        roomId,
        currentTime: videoRef.current.currentTime,
        sentAt: Date.now(),
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

    // 1. Partner played video (High Precision + Latency Compensation + Ready Queue)
    const handleRemotePlay = ({ currentTime: remoteTime, sentAt, by }) => {
      setIsPlaying(true);
      shouldBePlayingRef.current = true;
      setAutoplayBlocked(false);
      showSyncNotice(`▶️ ${by || 'Pasangan'} memutar video`);
      if (onActivity) onActivity(`${by || 'Pasangan'} memutar video`);

      const transitLag = sentAt ? Math.max(0, (Date.now() - sentAt) / 1000) : 0;
      const targetTime = remoteTime + (transitLag < 2.0 ? transitLag : 0);
      targetSeekTimeRef.current = targetTime;

      if (isYouTube && ytPlayerRef.current?.playVideo) {
        isRemoteUpdateRef.current = true;
        const cur = ytPlayerRef.current.getCurrentTime() || 0;
        if (Math.abs(cur - targetTime) > 0.3) {
          ytPlayerRef.current.seekTo(targetTime, true);
        }
        ytPlayerRef.current.playVideo();
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      } else if (videoRef.current) {
        const video = videoRef.current;
        isRemoteUpdateRef.current = true;

        if (Math.abs(video.currentTime - targetTime) > 0.2) {
          applyVideoSeek(video, targetTime);
        }

        if (video.readyState >= 2) {
          video.play().then(() => {
            setAutoplayBlocked(false);
          }).catch((err) => {
            console.warn('[RemotePlay] Autoplay blocked by browser:', err);
            setAutoplayBlocked(true);
          });
        } else {
          console.log('[RemotePlay] Video not ready yet (readyState', video.readyState, '). Queuing play...');
          const onReady = () => {
            if (shouldBePlayingRef.current && video) {
              if (targetSeekTimeRef.current !== null) {
                applyVideoSeek(video, targetSeekTimeRef.current);
              }
              video.play().then(() => {
                setAutoplayBlocked(false);
              }).catch(() => setAutoplayBlocked(true));
            }
          };
          video.addEventListener('canplay', onReady, { once: true });
          video.addEventListener('loadedmetadata', onReady, { once: true });
        }

        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      }
    };

    // 2. Partner paused video (Snap to Exact Same Frame)
    const handleRemotePause = ({ currentTime: remoteTime, by }) => {
      setIsPlaying(false);
      shouldBePlayingRef.current = false;
      targetSeekTimeRef.current = null;
      setAutoplayBlocked(false);
      showSyncNotice(`⏸️ ${by || 'Pasangan'} menjeda video`);
      if (onActivity) onActivity(`${by || 'Pasangan'} menjeda video`);

      if (isYouTube && ytPlayerRef.current?.pauseVideo) {
        isRemoteUpdateRef.current = true;
        ytPlayerRef.current.seekTo(remoteTime, true);
        ytPlayerRef.current.pauseVideo();
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      } else if (videoRef.current) {
        isRemoteUpdateRef.current = true;
        applyVideoSeek(videoRef.current, remoteTime);
        if (!videoRef.current.paused) {
          videoRef.current.pause();
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      }
    };

    // 3. Partner seeked (Strict Alignment)
    const handleRemoteSeek = ({ currentTime: remoteTime, by }) => {
      showSyncNotice(`⏩ ${by || 'Pasangan'} menggeser durasi`);
      if (onActivity) onActivity(`${by || 'Pasangan'} menggeser video ke ${formatTime(remoteTime)}`);

      if (isYouTube && ytPlayerRef.current?.seekTo) {
        isRemoteUpdateRef.current = true;
        ytPlayerRef.current.seekTo(remoteTime, true);
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      } else if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - remoteTime) > 0.1) {
          isRemoteUpdateRef.current = true;
          applyVideoSeek(videoRef.current, remoteTime);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
        }
      }
    };

    // 4. Periodic Drift Correction (Continuous Lockstep & Auto-Wake)
    const handleSyncHeartbeat = ({ currentTime: remoteTime, isPlaying: remoteIsPlaying, sentAt }) => {
      if (isRemoteUpdateRef.current || isSeekingRef.current) return;
      if (!remoteIsPlaying) return;

      shouldBePlayingRef.current = true;
      const transitLag = sentAt ? Math.max(0, (Date.now() - sentAt) / 1000) : 0;
      const targetTime = remoteTime + (transitLag < 1.5 ? transitLag : 0);
      targetSeekTimeRef.current = targetTime;

      if (isYouTube && ytPlayerRef.current) {
        const playerState = ytPlayerRef.current.getPlayerState?.();
        if (playerState !== 1 && typeof ytPlayerRef.current.playVideo === 'function') {
          console.log('[Heartbeat] Partner is playing YouTube, auto-starting...');
          isRemoteUpdateRef.current = true;
          ytPlayerRef.current.seekTo(targetTime, true);
          ytPlayerRef.current.playVideo();
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
          return;
        }

        const cur = ytPlayerRef.current.getCurrentTime() || 0;
        const drift = Math.abs(cur - targetTime);
        if (drift > 0.35) {
          isRemoteUpdateRef.current = true;
          ytPlayerRef.current.seekTo(targetTime, true);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        }
      } else if (videoRef.current) {
        const video = videoRef.current;

        // If partner is playing but my video is paused, AUTO-WAKE UP!
        if (video.paused) {
          console.log('[Heartbeat] Partner is playing! Waking up local video at', targetTime);
          isRemoteUpdateRef.current = true;
          applyVideoSeek(video, targetTime);
          video.play().then(() => {
            setAutoplayBlocked(false);
          }).catch((err) => {
            console.warn('[Heartbeat] Autoplay blocked by browser:', err);
            setAutoplayBlocked(true);
          });
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
          return;
        }

        // Both are playing, correct any drift
        const cur = video.currentTime;
        const drift = Math.abs(cur - targetTime);
        if (drift > 0.25) {
          isRemoteUpdateRef.current = true;
          applyVideoSeek(video, targetTime);
          setTimeout(() => { isRemoteUpdateRef.current = false; }, 300);
        }
      }
    };

    // 5. Initial room sync state
    const handleRoomState = ({ isPlaying: remoteIsPlaying, currentTime: remoteTime }) => {
      if (isYouTube && ytPlayerRef.current?.seekTo) {
        isRemoteUpdateRef.current = true;
        ytPlayerRef.current.seekTo(remoteTime, true);
        if (remoteIsPlaying) ytPlayerRef.current.playVideo();
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      } else if (videoRef.current) {
        const video = videoRef.current;
        isRemoteUpdateRef.current = true;
        if (Math.abs(video.currentTime - (remoteTime || 0)) > 0.25) {
          applyVideoSeek(video, remoteTime || 0);
        }
        if (remoteIsPlaying) {
          shouldBePlayingRef.current = true;
          targetSeekTimeRef.current = remoteTime || 0;
          if (video.readyState >= 2) {
            video.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
          } else {
            const onReady = () => {
              if (shouldBePlayingRef.current) {
                video.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
              }
            };
            video.addEventListener('canplay', onReady, { once: true });
            video.addEventListener('loadeddata', onReady, { once: true });
          }
        } else {
          shouldBePlayingRef.current = false;
          if (!video.paused) {
            video.pause();
          }
        }
        setTimeout(() => { isRemoteUpdateRef.current = false; }, 400);
      }
    };

    // Heartbeat emitter every 3.5 seconds
    const heartbeatTimer = setInterval(() => {
      if (!socket || !roomId) return;
      const isCurrentlyPlaying = isYouTube
        ? (ytPlayerRef.current?.getPlayerState?.() === 1)
        : (videoRef.current && !videoRef.current.paused);

      if (isCurrentlyPlaying) {
        const curTime = isYouTube
          ? (ytPlayerRef.current?.getCurrentTime?.() || 0)
          : (videoRef.current?.currentTime || 0);

        if (curTime > 0) {
          socket.emit('sync-heartbeat', {
            roomId,
            currentTime: curTime,
            isPlaying: true,
            sentAt: Date.now(),
          });
        }
      }
    }, 3500);

    socket.on('video-play', handleRemotePlay);
    socket.on('video-pause', handleRemotePause);
    socket.on('video-seek', handleRemoteSeek);
    socket.on('sync-heartbeat', handleSyncHeartbeat);
    socket.on('room-state', handleRoomState);

    return () => {
      clearInterval(heartbeatTimer);
      socket.off('video-play', handleRemotePlay);
      socket.off('video-pause', handleRemotePause);
      socket.off('video-seek', handleRemoteSeek);
      socket.off('sync-heartbeat', handleSyncHeartbeat);
      socket.off('room-state', handleRoomState);
    };
  }, [socket, isYouTube, onActivity, roomId]);

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800"
      onClick={showUi}
      onMouseMove={showUi}
      onTouchStart={showUi}
    >
      {/* Sync Badge */}
      <div className={`absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium text-white/90 transition-opacity duration-300 ${isUiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        {syncStatus}
      </div>

      {/* Top Right: Volume Booster */}
      {!isYouTube && (
        <button
          onClick={(e) => { e.stopPropagation(); cycleBoost(); }}
          title="Penguat Suara Film (Web Audio Boost)"
          className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition-all duration-300 cursor-pointer ${
            boostLevel > 1
              ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950 animate-pulse'
              : 'bg-black/60 text-zinc-300 border-white/10 hover:bg-zinc-800 hover:text-white'
          } ${isUiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Boost Film: {boostLevel * 100}%</span>
        </button>
      )}

      {/* Autoplay Blocked Tap-to-Play Overlay */}
      {autoplayBlocked && (
        <div 
          onClick={() => {
            setAutoplayBlocked(false);
            shouldBePlayingRef.current = true;
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
            if (isYouTube && ytPlayerRef.current?.playVideo) {
              ytPlayerRef.current.playVideo();
            }
          }}
          className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center cursor-pointer animate-fade-in select-none"
        >
          <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center mb-3 shadow-lg shadow-rose-950 animate-bounce">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">Pasangan Sedang Memutar Film</h4>
          <p className="text-xs text-zinc-300">Ketuk di mana saja untuk mulai menonton bersama!</p>
        </div>
      )}

      {/* Video Content */}
      <div className="w-full h-full flex items-center justify-center relative">
        {isYouTube ? (
          <div className="w-full h-full flex items-center justify-center">
            <div ref={ytContainerRef} className="w-full h-full aspect-video flex items-center justify-center"></div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full object-contain max-h-[78vh]"
            controls
            playsInline
            webkit-playsinline="true"
            crossOrigin="anonymous"
            preload="auto"
            onPlay={handleHtml5Play}
            onPause={handleHtml5Pause}
            onSeeking={handleHtml5Seeking}
            onSeeked={handleHtml5Seeked}
            onTimeUpdate={handleHtml5TimeUpdate}
          />
        )}
      </div>
    </div>
  );
}
