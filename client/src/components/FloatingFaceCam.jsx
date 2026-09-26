import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Video, VideoOff, Mic, MicOff, RefreshCw, Minimize2, Maximize2, Heart, User, GripHorizontal, X, Volume2 } from 'lucide-react';

export default function FloatingFaceCam({
  localStream,
  remoteStreams,
  isVideoActive,
  isVoiceActive,
  isMuted,
  hasPartnerInCam,
  hasPartnerInVoice,
  facingMode,
  partnerName,
  onToggleVideo,
  onToggleVoice,
  onToggleMute,
  onFlipCamera,
  partnerVolume = 1,
  onChangePartnerVolume,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const nodeRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isForceClosed, setIsForceClosed] = useState(false);
  const [showVolSlider, setShowVolSlider] = useState(false);

  useEffect(() => {
    if (isVideoActive) {
      setIsForceClosed(false);
    }
  }, [isVideoActive]);

  // Extract first remote stream with active live video track
  let partnerStream = null;
  if (remoteStreams && remoteStreams.size > 0) {
    for (const [id, stream] of remoteStreams.entries()) {
      const activeVideoTracks = stream.getVideoTracks().filter(
        (track) => track.readyState === 'live' && track.enabled
      );
      if (activeVideoTracks.length > 0) {
        partnerStream = stream;
        break;
      }
    }
  }

  // Callback refs to instantly attach stream & force play the exact millisecond video elements mount into DOM
  const handleLocalVideoRef = (node) => {
    localVideoRef.current = node;
    if (node && localStream) {
      node.muted = true;
      node.defaultMuted = true;
      node.playsInline = true;
      node.setAttribute('playsinline', 'true');
      node.setAttribute('webkit-playsinline', 'true');
      if (node.srcObject !== localStream) {
        node.srcObject = localStream;
      }
      node.play().catch(() => {});
    }
  };

  const handleRemoteVideoRef = (node) => {
    remoteVideoRef.current = node;
    if (node && partnerStream) {
      node.playsInline = true;
      node.setAttribute('playsinline', 'true');
      node.setAttribute('webkit-playsinline', 'true');
      if (node.srcObject !== partnerStream) {
        node.srcObject = partnerStream;
      }
      node.play().catch(() => {});
    }
  };

  // Keep streams in sync on subsequent track changes
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream && isVideoActive && localStream.getVideoTracks().length > 0) {
        localVideoRef.current.muted = true;
        localVideoRef.current.defaultMuted = true;
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        localVideoRef.current.play().catch(() => {});
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isVideoActive]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      if (partnerStream) {
        if (remoteVideoRef.current.srcObject !== partnerStream) {
          remoteVideoRef.current.srcObject = partnerStream;
        }
        remoteVideoRef.current.play().catch(() => {});
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [partnerStream]);

  // Only show floating card if not manually closed AND (user or partner has live camera)
  const hasLivePartnerVideo = Boolean(hasPartnerInCam && partnerStream);
  if (isForceClosed || (!isVideoActive && !hasLivePartnerVideo)) {
    return null;
  }

  return (
    <Draggable nodeRef={nodeRef} handle=".drag-handle" cancel="button, .no-drag">
      <div 
        ref={nodeRef}
        className="fixed bottom-16 right-3 md:bottom-6 md:right-6 z-40 select-none"
      >
        <div
          className={`bg-zinc-950/90 border border-rose-500/40 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 animate-fade-in ${
            isMinimized ? 'w-44 h-12' : 'w-56 md:w-64'
          }`}
        >
          {/* Header Bar */}
          <div className="px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between">
            {/* Draggable Title Area */}
            <div className="drag-handle flex items-center gap-1.5 flex-1 min-w-0 cursor-move active:cursor-grabbing py-1 pr-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0"></span>
              <span className="text-[11px] font-semibold text-white truncate flex items-center gap-1 pointer-events-none">
                {partnerName || 'Pasangan'} 💕
              </span>
              <GripHorizontal className="w-3.5 h-3.5 text-zinc-500 pointer-events-none ml-auto" />
            </div>

            {/* Non-Draggable Interactive Buttons */}
            <div className="no-drag flex items-center gap-1 pl-1 flex-shrink-0 z-50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer active:scale-90"
                title={isMinimized ? 'Perbesar' : 'Minimalkan'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsForceClosed(true);
                  if (isVideoActive && onToggleVideo) {
                    onToggleVideo();
                  }
                }}
                className="text-zinc-400 hover:text-rose-400 p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer active:scale-90"
                title="Tutup Kamera Melayang"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        {/* Video Area (Shown when not minimized) */}
        {!isMinimized && (
          <div className="relative aspect-4/3 bg-zinc-900 flex items-center justify-center overflow-hidden">
            {/* Partner Video Stream */}
            {hasPartnerInCam && partnerStream ? (
              <video
                ref={handleRemoteVideoRef}
                autoPlay
                playsInline
                webkit-playsinline="true"
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
                  ref={handleLocalVideoRef}
                  autoPlay
                  playsInline
                  webkit-playsinline="true"
                  muted
                  controls={false}
                  className={`w-full h-full object-cover ${facingMode !== 'environment' ? 'scale-x-[-1]' : ''}`}
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

              {/* Partner Voice Volume Slider Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVolSlider(!showVolSlider)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    showVolSlider ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300'
                  }`}
                  title={`Volume Suara Pasangan: ${Math.round((partnerVolume !== undefined ? partnerVolume : 1) * 100)}%`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                </button>

                {showVolSlider && (
                  <div className="absolute bottom-full mb-2 left-0 bg-zinc-950/95 border border-zinc-700 rounded-xl p-2.5 shadow-2xl z-50 flex flex-col gap-1.5 w-36 backdrop-blur-md animate-fade-in">
                    <div className="flex items-center justify-between text-[10px] text-zinc-300 font-semibold">
                      <span>Suara Pasangan</span>
                      <span className="text-emerald-400">{Math.round((partnerVolume !== undefined ? partnerVolume : 1) * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={partnerVolume !== undefined ? partnerVolume : 1}
                      onChange={(e) => onChangePartnerVolume && onChangePartnerVolume(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </Draggable>
  );
}
