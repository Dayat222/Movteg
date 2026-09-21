import React, { useState } from 'react';
import { X, Server, CheckCircle2, Wifi, Zap } from 'lucide-react';
import { SERVER_URL, updateServerUrl, resetToP2P, isP2PMode } from '../utils/socket';

export default function SettingsModal({
  isOpen,
  onClose,
  isConnected,
}) {
  const [url, setUrl] = useState(isP2PMode ? '' : SERVER_URL);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    updateServerUrl(url.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  const handleUseP2P = () => {
    resetToP2P();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-semibold text-white">Status Koneksi & Server</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status badge */}
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-medium">Mode Koneksi:</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-800/40 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                {isP2PMode ? 'P2P WebRTC Direct' : 'WebSocket Server'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
              <span className="text-xs text-zinc-400 font-medium">Status Jaringan:</span>
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Siap & Terhubung</span>
              </div>
            </div>
          </div>

          {isP2PMode && (
            <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-xl text-xs text-emerald-300/90 leading-relaxed">
              ⚡ <strong>Mode P2P Aktif</strong>: Kamu dan pasangan terhubung langsung lewat WebRTC tanpa perlu backend server terpisah. 100% Gratis dan langsung aktif di Vercel tanpa kartu kredit!
            </div>
          )}

          {/* Custom Server Configuration (Optional) */}
          <form onSubmit={handleSave} className="space-y-3 pt-2 border-t border-zinc-800">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Alamat Backend Kustom (Opsional):
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://server-kamu.com (kosongkan untuk P2P)"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isSaved ? 'Tersimpan!' : 'Gunakan Server Ini'}
              </button>
              <button
                type="button"
                onClick={handleUseP2P}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Gunakan P2P Bawaan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
