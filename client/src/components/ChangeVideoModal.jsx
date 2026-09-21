import React, { useState } from 'react';
import { X, Link2, Play, Popcorn } from 'lucide-react';
import { isYouTubeUrl } from '../utils/youtube';

const PRESET_MOVIES = [
  {
    title: 'Big Buck Bunny (Animation Film)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'MP4 Langsung',
    desc: 'Film animasi klasik resolusi jernih untuk test nonton bareng.',
  },
  {
    title: 'Tears of Steel (Sci-Fi Short)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    type: 'MP4 Langsung',
    desc: 'Film pendek fiksi ilmiah dengan visual keren.',
  },
  {
    title: 'Sintel (Fantasy Romance Animation)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    type: 'MP4 Langsung',
    desc: 'Kisah emosional animasi petualangan.',
  },
  {
    title: 'Lofi Girl - Hip Hop Radio 🎧',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    type: 'YouTube',
    desc: 'Musik santai cocok untuk temani ngobrol berdua.',
  },
];

export default function ChangeVideoModal({
  isOpen,
  onClose,
  onSelectVideo,
  currentUrl,
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState('');

  // Reset input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setInputUrl('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputUrl.trim()) {
      setError('Masukkan link video terlebih dahulu!');
      return;
    }
    setError('');
    onSelectVideo(inputUrl.trim());
    onClose();
  };

  const handlePresetSelect = (url) => {
    setInputUrl(url);
    onSelectVideo(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-semibold text-white">Ganti Film / Video</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Masukkan Link Film (YouTube atau Direct Video MP4/m3u8):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    setError('');
                  }}
                  placeholder="https://www.youtube.com/watch?v=... atau https://site.com/film.mp4"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-medium py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-950 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Terapkan Film ke Ruangan
            </button>
          </form>

          {/* Quick Preset Movies */}
          <div className="pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Popcorn className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">
                Atau Pilih Contoh Film untuk Pengujian Cepat:
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              {PRESET_MOVIES.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handlePresetSelect(item.url)}
                  className="p-2.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-medium text-white group-hover:text-rose-400 truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-[10px] bg-zinc-800 group-hover:bg-rose-950/80 text-zinc-300 group-hover:text-rose-300 px-2 py-1 rounded-md border border-zinc-700/60 whitespace-nowrap">
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
