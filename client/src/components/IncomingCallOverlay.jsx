import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Volume2 } from 'lucide-react';
import { ringtonePlayer } from '../utils/ringtonePlayer';

export default function IncomingCallOverlay({ callerName, onAccept, onDecline }) {
  useEffect(() => {
    ringtonePlayer.play();
    return () => {
      ringtonePlayer.stop();
    };
  }, []);

  const handleOverlayTouch = () => {
    // If browser suspended audio due to autoplay restrictions, a tap resumes it immediately
    ringtonePlayer.play();
  };

  return (
    <div 
      onClick={handleOverlayTouch}
      onTouchStart={handleOverlayTouch}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div className="flex flex-col items-center max-w-sm w-full mx-4">
        {/* Pulsing Avatar/Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center border-4 border-zinc-900 shadow-2xl">
            <span className="text-4xl font-bold text-white">
              {callerName ? callerName.charAt(0).toUpperCase() : '?'}
            </span>
          </div>
        </div>
        
        {/* Caller Info */}
        <h2 className="text-2xl font-bold text-white mb-1">{callerName || 'Pasangan'}</h2>
        <p className="text-zinc-400 text-sm mb-3">Panggilan Video Masuk</p>

        {/* Ringing Sound Indicator */}
        <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3.5 py-1.5 rounded-full mb-10 shadow-lg shadow-rose-950/40">
          <Volume2 className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="font-medium animate-pulse">Berdering & Bergetar...</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-12 w-full">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onDecline}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
            <span className="text-xs font-semibold text-zinc-400">Tolak</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/50 transition-transform hover:scale-110 active:scale-95 animate-bounce"
            >
              <Video className="w-8 h-8" />
            </button>
            <span className="text-xs font-semibold text-zinc-300">Terima</span>
          </div>
        </div>
      </div>
    </div>
  );
}
