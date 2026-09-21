import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { SERVER_URL, updateServerUrl } from '../utils/socket';

export default function SettingsModal({
  isOpen,
  onClose,
  isConnected,
}) {
  const [url, setUrl] = useState(SERVER_URL);
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

  const handleResetLocal = () => {
    localStorage.removeItem('movteg_server_url');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-semibold text-white">Pengaturan Server</h3>
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
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-300 font-medium">Status WebSocket:</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Terhubung</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400">Terputus</span>
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Alamat Backend WebSocket Server:
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:4000 atau https://backend-kamu.onrender.com"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 font-mono"
              />
              <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                Jika di-deploy ke Vercel, masukkan URL backend Socket.IO yang kamu deploy di Render, Railway, atau VPS.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-medium py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                {isSaved ? 'Tersimpan!' : 'Simpan & Hubungkan'}
              </button>
              <button
                type="button"
                onClick={handleResetLocal}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Reset Default
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
