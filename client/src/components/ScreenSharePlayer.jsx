import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Volume2, VolumeX, MonitorOff, Tv } from 'lucide-react';

export default function ScreenSharePlayer({
  stream,
  isPresenter,
  sharerName,
  onStopSharing,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(isPresenter); // Presenter is muted by default to prevent echo
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      // Presenter must be muted to avoid feedback loop
      video.muted = isPresenter || isMuted;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('[ScreenSharePlayer] Autoplay prevented, waiting for user click:', err);
            setIsPlaying(false);
          });
      }
    } else {
      video.srcObject = null;
      setIsPlaying(false);
    }
  }, [stream, isPresenter, isMuted]);

  const [isCssFullscreen, setIsCssFullscreen] = useState(false);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || isCssFullscreen));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isCssFullscreen]);

  const toggleFullscreen = () => {
    const video = videoRef.current;
    const container = containerRef.current;

    // 1. If currently in CSS fullscreen, exit it
    if (isCssFullscreen) {
      setIsCssFullscreen(false);
      setIsFullscreen(false);
      return;
    }

    // 2. If currently in native browser fullscreen, exit it
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      setIsFullscreen(false);
      return;
    }

    // 3. Try iOS WebKit native video fullscreen
    if (video && typeof video.webkitEnterFullscreen === 'function') {
      try {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn('[ScreenSharePlayer] webkitEnterFullscreen failed, falling back:', err);
      }
    }

    // 4. Try standard HTML5 Container / Video requestFullscreen
    const targetEl = container || video;
    if (targetEl && (targetEl.requestFullscreen || targetEl.webkitRequestFullscreen)) {
      const requestMethod = targetEl.requestFullscreen || targetEl.webkitRequestFullscreen;
      requestMethod.call(targetEl)
        .then(() => setIsFullscreen(true))
        .catch((err) => {
          console.warn('[ScreenSharePlayer] Native requestFullscreen failed, using CSS fallback:', err);
          setIsCssFullscreen(true);
          setIsFullscreen(true);
        });
    } else {
      // 5. Fallback for mobile WebViews that block native fullscreen: CSS Fullscreen
      setIsCssFullscreen(true);
      setIsFullscreen(true);
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (isPresenter) return; // Presenter stays muted locally
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => setIsPlaying(true));
    }
  };

  return (
    <div
      ref={containerRef}
      className={
        isCssFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen bg-black flex items-center justify-center group select-none overflow-hidden'
          : 'relative w-full h-full bg-black flex items-center justify-center group select-none overflow-hidden'
      }
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain cursor-pointer"
        onClick={handleManualPlay}
      />

      {/* Fallback Tap to Unmute / Play Prompt if Autoplay was blocked */}
      {!isPlaying && stream && !isPresenter && (
        <button
          onClick={handleManualPlay}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
            <Tv className="w-8 h-8 animate-pulse" />
          </div>
          <span className="mt-3 text-sm font-semibold text-white drop-shadow-md">
            Ketuk untuk Memutar Siaran Layar
          </span>
        </button>
      )}

      {/* Top Overlay Badge */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700/80 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          <span className="text-xs font-semibold text-white tracking-wide">
            {isPresenter ? '🔴 Kamu sedang membagikan layar' : `🔴 Siaran Layar: ${sharerName || 'Pasangan'}`}
          </span>
        </div>

        {/* Presenter Quick Stop Button */}
        {isPresenter && (
          <button
            onClick={onStopSharing}
            className="pointer-events-auto flex items-center gap-1.5 bg-rose-600/90 hover:bg-rose-700 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md transition-all cursor-pointer"
          >
            <MonitorOff className="w-3.5 h-3.5" />
            <span>Berhenti Berbagi</span>
          </button>
        )}
      </div>

      {/* Bottom Floating Controls Bar (Shows on Hover or on Mobile) */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {/* Audio Controls for Viewers */}
          {!isPresenter && (
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-lg backdrop-blur-md">
              <button
                onClick={toggleMute}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Nyalakan Suara Layar' : 'Bisukan Suara Layar'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
          )}

          {isPresenter && (
            <span className="text-[11px] text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
              Audio layar otomatis dibisukan di sisi Anda untuk mencegah gaung.
            </span>
          )}
        </div>

        {/* Fullscreen Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/80 backdrop-blur-md transition-colors cursor-pointer"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
