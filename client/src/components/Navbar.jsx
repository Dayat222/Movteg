import React, { useState } from 'react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Film, Share2, Check, Video, VideoOff, Settings, Heart, Users, RefreshCw, Mic, MicOff, Phone, PhoneOff, MonitorUp, MonitorOff } from 'lucide-react';

export default function Navbar({
  roomId,
  username,
  users = [],
  onOpenChangeVideo,
  onOpenSettings,
  onManualSync,
  isConnected,
  isVoiceActive,
  isVoiceMuted,
  hasPartnerInVoice,
  onToggleVoice,
  onToggleMute,
  isVideoActive,
  hasPartnerInCam,
  onToggleVideo,
  isScreenSharing,
  hasActiveScreenShare,
  onToggleScreenShare,
  canShareScreen,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    const inviteUrl = `https://movteg.vercel.app/?room=${roomId}`;
    
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: 'Movteg - Nonton Film Bareng Pasangan 🍿💕',
          text: `Ayo nonton bareng aku di Movteg! Masuk ke room: ${roomId}`,
          url: inviteUrl,
          dialogTitle: 'Bagikan room Movteg'
        });
        return;
      } else if (navigator.share) {
        await navigator.share({
          title: 'Movteg - Nonton Film Bareng Pasangan 🍿💕',
          text: `Ayo nonton bareng aku di Movteg! Masuk ke room: ${roomId}`,
          url: inviteUrl,
        });
        return;
      }
    } catch (err) {
      // Fallback to clipboard if share was cancelled or failed
    }

    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const partner = users.find((u) => u.username && u.username !== username);

  return (
    <header className="h-16 px-3 md:px-6 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between z-40 sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2 md:gap-2.5">
        <div className="w-7 h-7 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950 flex-shrink-0">
          <Film className="w-3.5 h-3.5 md:w-5 md:h-5" />
        </div>
        <div className="hidden sm:block">
          <span className="font-bold text-sm md:text-base text-white tracking-tight flex items-center gap-1.5">
            Movteg <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
          </span>
          <p className="text-[10px] text-zinc-400 hidden lg:block">Watch Party Bareng Pasangan</p>
        </div>
      </div>

      {/* Center: Room Info & Partner Status */}
      <div className="flex items-center mx-1 md:mx-3 flex-shrink min-w-0">
        {roomId && (
          <div className="flex items-center gap-1.5 md:gap-2 bg-zinc-900 border border-zinc-800 px-2 md:px-3 py-1.5 rounded-full text-xs text-zinc-300 min-w-0">
            <span className="font-mono font-semibold text-rose-400">{roomId}</span>

            <span className="w-1 h-1 rounded-full bg-zinc-700 flex-shrink-0"></span>

            <div className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-[11px] whitespace-nowrap flex-shrink-0">
              <span
                className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                  users.length > 1 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              ></span>
              {users.length > 1 ? (
                <span className="text-emerald-400 font-medium">
                  <span className="hidden md:inline">{partner?.username || 'Pasangan'} Terhubung 💕</span>
                  <span className="hidden sm:inline md:hidden">Terhubung 💕</span>
                  <span className="sm:hidden">({users.length})</span>
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  <span className="hidden md:inline">Menunggu Pasangan ⏳</span>
                  <span className="hidden sm:inline md:hidden">Menunggu ⏳</span>
                  <span className="sm:hidden">⏳ ({users.length || 1})</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        {/* Voice Chat Controls */}
        {roomId && (
          <div className="flex items-center gap-0.5 md:gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 md:p-1">
            <button
              onClick={onToggleVoice}
              title={
                isVoiceActive
                  ? 'Matikan Suara'
                  : hasPartnerInVoice
                  ? 'Pasangan sedang di obrolan suara 📞 (Klik untuk bergabung)'
                  : 'Mulai Panggilan Suara'
              }
              className={`p-1.5 rounded-lg transition-all cursor-pointer relative ${
                isVoiceActive
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : hasPartnerInVoice
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse hover:bg-emerald-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {isVoiceActive ? (
                <PhoneOff className="w-3.5 h-3.5 md:w-4 md:h-4" />
              ) : (
                <Phone className="w-3.5 h-3.5 md:w-4 md:h-4" />
              )}
              {hasPartnerInVoice && !isVoiceActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              )}
            </button>
            {isVoiceActive && (
              <button
                onClick={onToggleMute}
                title={isVoiceMuted ? 'Nyalakan Mic' : 'Matikan Mic'}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isVoiceMuted ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {isVoiceMuted ? <MicOff className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              </button>
            )}

            {/* Video Call (Camera) Button */}
            <button
              onClick={onToggleVideo}
              title={
                isVideoActive
                  ? 'Matikan Kamera Wajah'
                  : hasPartnerInCam
                  ? 'Pasangan menyalakan kamera 📹 (Klik untuk buka kamera)'
                  : 'Nyalakan Kamera Wajah (Video Call)'
              }
              className={`p-1.5 rounded-lg transition-all cursor-pointer relative ${
                isVideoActive
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : hasPartnerInCam
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40 animate-pulse hover:bg-pink-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {isVideoActive ? (
                <VideoOff className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-400" />
              ) : (
                <Video className={`w-3.5 h-3.5 md:w-4 md:h-4 ${hasPartnerInCam ? 'text-pink-400' : ''}`} />
              )}
              {hasPartnerInCam && !isVideoActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-400 animate-ping"></span>
              )}
            </button>
          </div>
        )}

        {/* Sync Button */}
        {roomId && (
          <button
            onClick={onManualSync}
            title="Sinkronkan Ulang Video"
            className="hidden sm:flex p-1.5 md:p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        )}

        {/* Screen Share Button */}
        {roomId && (canShareScreen || hasActiveScreenShare) && (
          <button
            onClick={onToggleScreenShare}
            disabled={!canShareScreen && !isScreenSharing}
            className={`flex items-center justify-center p-1.5 md:px-3 md:py-2 rounded-xl transition-all cursor-pointer border ${
              isScreenSharing
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-md shadow-rose-950 animate-pulse'
                : hasActiveScreenShare
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-600/50 hover:bg-emerald-900/80'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800 hover:border-zinc-700'
            }`}
            title={
              isScreenSharing
                ? 'Hentikan Berbagi Layar'
                : hasActiveScreenShare
                ? 'Sedang Menonton Siaran Layar'
                : 'Bagikan Layar Laptop (Bebas Link Film)'
            }
          >
            {isScreenSharing ? (
              <MonitorOff className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            ) : (
              <MonitorUp
                className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
                  hasActiveScreenShare ? 'text-emerald-400' : 'text-amber-400'
                }`}
              />
            )}
            <span className="hidden md:inline ml-1.5 text-xs font-medium">
              {isScreenSharing ? 'Stop Layar' : hasActiveScreenShare ? 'Siaran Aktif' : 'Bagi Layar'}
            </span>
          </button>
        )}

        {/* Change Video Button */}
        <button
          onClick={onOpenChangeVideo}
          className="flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 p-1.5 md:px-3 md:py-2 rounded-xl transition-all cursor-pointer"
          title="Ganti Film"
        >
          <Video className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-400" />
          <span className="hidden md:inline ml-1.5 text-xs font-medium">Ganti Film</span>
        </button>

        {/* Invite Button */}
        {roomId && (
          <button
            onClick={handleCopyInvite}
            title="Undang Pasangan"
            className={`flex items-center justify-center p-1.5 md:px-3.5 md:py-2 rounded-xl transition-all shadow-md cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
            }`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
            ) : (
              <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            )}
            <span className="hidden md:inline ml-1.5 text-xs font-medium">
              {copied ? 'Disalin!' : 'Undang'}
            </span>
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Pengaturan Koneksi"
          className="p-1.5 md:p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer relative"
        >
          <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span
            className={`absolute top-1 right-1 md:top-1.5 md:right-1.5 w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </button>
      </div>
    </header>
  );
}
