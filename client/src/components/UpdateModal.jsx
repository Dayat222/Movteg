import React from 'react';
import { X, ArrowUpCircle, Download, Check, Sparkles, ExternalLink } from 'lucide-react';

export default function UpdateModal({
  isOpen,
  onClose,
  updateInfo,
}) {
  if (!isOpen || !updateInfo) return null;

  const handleDownload = () => {
    if (updateInfo.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* Top Decorative Glow */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500"></div>

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">Pembaruan Tersedia!</h3>
              <p className="text-[11px] text-zinc-400">Versi baru siap dipasang</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Version Badge Box */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div>
              <span className="text-[11px] text-zinc-400 block">Versi Baru:</span>
              <span className="text-base font-bold text-rose-400 font-mono">
                v{updateInfo.latestVersion}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-zinc-400 block">Versi Anda Saat Ini:</span>
              <span className="text-xs font-medium text-zinc-400 font-mono">
                v{updateInfo.currentVersion}
              </span>
            </div>
          </div>

          {/* Title */}
          {updateInfo.title && (
            <h4 className="text-xs font-semibold text-zinc-200">
              {updateInfo.title}
            </h4>
          )}

          {/* Changelog */}
          {updateInfo.changelog && updateInfo.changelog.length > 0 && (
            <div className="bg-zinc-950/60 rounded-xl p-3.5 border border-zinc-800/80 space-y-2">
              <span className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Catatan Pembaruan:
              </span>
              <ul className="space-y-1.5 text-xs text-zinc-300">
                {updateInfo.changelog.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleDownload}
              className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Pembaruan APK</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
            <button
              onClick={onClose}
              className="w-full bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
