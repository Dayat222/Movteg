import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Minimize2, Maximize2, Heart, User } from 'lucide-react';

export default function FloatingFaceCam({
  localStream,
  remoteStreams,
  isVideoActive,
  isVoiceActive,
  isMuted,
  hasPartnerInCam,
  hasPartnerInVoice,
  partnerName,
  onToggleVideo,
  onToggleVoice,
  onToggleMute,
  onFlipCamera,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });

  // Extract first remote stream with video track
  let partnerStream = null;
  if (remoteStreams && remoteStreams.size > 0) {
    for (const [id, stream] of remoteStreams.entries()) {
      if (stream.getVideoTracks().length > 0) {
        partnerStream = stream;
        break;
      }
    }
  }

  // Bind local video stream
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream && isVideoActive && localStream.getVideoTracks().length > 0) {
        localVideoRef.current.srcObject = localStream;
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isVideoActive]);

  // Bind remote video stream
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (partnerStream) {
        remoteVideoRef.current.srcObject = partnerStream;
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [partnerStream]);

  // Only show floating card if user or partner has camera active
  if (!isVideoActive && !hasPartnerInCam) {
    return null;
  }

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging.current) return;
      // Prevent scrolling while dragging
      if (e.cancelable) e.preventDefault();
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStart.current.x;
      const dy = clientY - dragStart.current.y;
      
      const newPos = {
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy,
      };
      positionRef.current = newPos;
      setPosition(newPos);
    };

    const handleUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
    };
  }, []);

  const handleStart = (e) => {
    if (e.target.closest('button')) return;
    isDragging.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY };
    positionStart.current = { ...positionRef.current };
  };

  return (
    <div 
      className="fixed bottom-16 right-3 md:bottom-6 md:right-6 z-40 select-none animate-fade-in touch-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <div
        className={`bg-zinc-950/90 border border-rose-500/40 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 ${
          isMinimized ? 'w-36 h-12' : 'w-56 md:w-64'
        }`}
      >
        {/* Header Bar */}
        <div className="px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0"></span>
            <span className="text-[11px] font-semibold text-white truncate">
              {partnerName || 'Pasangan'} 💕
            </span>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-zinc-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
            title={isMinimized ? 'Perbesar' : 'Minimalkan'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Video Area (Shown when not minimized) */}
        {!isMinimized && (
          <div className="relative aspect-4/3 bg-zinc-900 flex items-center justify-center overflow-hidden">
            {/* Partner Video Stream */}
            {hasPartnerInCam && partnerStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                controls={false}
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-500 p-4 text-center pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
                  <User className="w-6 h-6" />
                </div>
                <span className="text-xs text-zinc-400">
                  {hasPartnerInCam ? 'Menghubungkan kamera...' : 'Kamera pasangan mati'}
                </span>
              </div>
            )}

            {/* Self Mini-PIP Video Preview */}
            {isVideoActive && localStream && (
              <div className="absolute bottom-2 right-2 w-16 h-20 md:w-20 md:h-24 rounded-xl overflow-hidden border-2 border-rose-500 shadow-xl bg-black pointer-events-none">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
            )}

            {/* Quick Actions Hover Overlay */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10">
              <button
                onClick={onToggleVideo}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isVideoActive ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
                title={isVideoActive ? 'Matikan Kamera' : 'Nyalakan Kamera'}
              >
                {isVideoActive ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isMuted ? 'bg-amber-500/30 text-amber-400' : 'bg-zinc-800 text-zinc-300'
                }`}
                title={isMuted ? 'Nyalakan Mic' : 'Bisukan Mic'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              {isVideoActive && onFlipCamera && (
                <button
                  onClick={onFlipCamera}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  title="Ganti Kamera Depan/Belakang"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
