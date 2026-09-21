import React, { useState } from 'react';
import { Film, Share2, Check, Video, Settings, Heart, Users, RefreshCw } from 'lucide-react';

export default function Navbar({
  roomId,
  username,
  users = [],
  onOpenChangeVideo,
  onOpenSettings,
  onManualSync,
  isConnected,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const partner = users.find((u) => u.username && u.username !== username);

  return (
    <header className="h-16 px-3 md:px-6 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between z-40 sticky top-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950">
          <Film className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <div>
          <span className="font-bold text-sm md:text-base text-white tracking-tight flex items-center gap-1.5">
            Movteg <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" />
          </span>
          <p className="text-[10px] text-zinc-400 hidden sm:block">Watch Party Bareng Pasangan</p>
        </div>
      </div>

      {/* Center: Room Info & Partner Status */}
      <div className="flex items-center gap-1.5 md:gap-3">
        {roomId && (
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-2.5 md:px-3 py-1.5 rounded-full text-xs text-zinc-300">
            <span className="font-mono font-semibold text-rose-400">{roomId}</span>

            <span className="w-1 h-1 rounded-full bg-zinc-700"></span>

            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  users.length > 1 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              ></span>
              {users.length > 1 ? (
                <span className="text-emerald-400 font-medium">
                  <span className="hidden sm:inline">{partner?.username || 'Pasangan'} Terhubung 💕</span>
                  <span className="sm:hidden">Terhubung 💕</span> ({users.length})
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  <span className="hidden sm:inline">Menunggu Pasangan ⏳</span>
                  <span className="sm:hidden">Menunggu ⏳</span> ({users.length || 1})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 md:gap-2">
        {/* Sync Button */}
        {roomId && (
          <button
            onClick={onManualSync}
            title="Sinkronkan Ulang Video"
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        )}

        {/* Change Video Button */}
        <button
          onClick={onOpenChangeVideo}
          className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 px-2.5 md:px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer"
        >
          <Video className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">Ganti Film</span>
        </button>

        {/* Invite Button */}
        {roomId && (
          <button
            onClick={handleCopyInvite}
            className={`flex items-center gap-1.5 px-3 md:px-3.5 py-2 rounded-xl text-xs font-medium transition-all shadow-md cursor-pointer ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Disalin!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Undang Pasangan</span>
                <span className="sm:hidden">Undang</span>
              </>
            )}
          </button>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Pengaturan Koneksi"
          className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer relative"
        >
          <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span
            className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </button>
      </div>
    </header>
  );
}
