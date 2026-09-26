import React, { useState } from 'react';
import { X, Link2, Play, Popcorn, Search, Loader2 } from 'lucide-react';
import { getYouTubeId } from '../utils/youtube';

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
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setInputUrl('');
      setError('');
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    let cleaned = inputUrl.trim();
    if (!cleaned) {
      setError('Ketik judul lagu/film atau masukkan link video!');
      return;
    }

    // Auto-normalize any mobile / messy YouTube URL to standard embeddable format
    const ytId = getYouTubeId(cleaned);
    
    // If it looks like a URL (starts with http) or has a valid YouTube ID from a link
    if (cleaned.startsWith('http') || ytId) {
      if (ytId) cleaned = `https://www.youtube.com/watch?v=${ytId}`;
      setError('');
      onSelectVideo(cleaned);
      onClose();
      return;
    }

    // Otherwise, treat as a search query!
    await performSearch(cleaned);
  };

  const performSearch = async (query) => {
    setIsSearching(true);
    setError('');
    setHasSearched(true);
    setSearchResults([]);

    try {
      // The API endpoint should match your Vercel deployment route /api/search
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.videos && data.videos.length > 0) {
        setSearchResults(data.videos);
      } else {
        setError('Tidak ada hasil yang ditemukan di YouTube.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Gagal mencari video. Coba gunakan link MP4/YouTube langsung.');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePresetSelect = (url) => {
    setInputUrl(url);
    onSelectVideo(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-semibold text-white">Cari Tontonan / Ganti Film</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex flex-col overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-3 shrink-0 mb-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Ketik Judul Lagu/Film ATAU Paste Link URL:
              </label>
              <div className="relative flex gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    setError('');
                  }}
                  placeholder="Contoh: 'Tulus Hati Hati di Jalan' atau link MP4"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-medium px-4 rounded-xl text-xs transition-colors flex items-center justify-center shadow-lg shadow-rose-950 cursor-pointer disabled:opacity-50 shrink-0 gap-1.5"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : inputUrl.trim().startsWith('http') ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Putar</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Cari</span>
                    </>
                  )}
                </button>
              </div>
              {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
            </div>
          </form>

          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin min-h-0">
            {/* Search Results */}
            {hasSearched && searchResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 mb-2">Hasil Pencarian YouTube:</h4>
                {searchResults.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => handlePresetSelect(video.url)}
                    className="flex items-start gap-3 p-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl cursor-pointer transition-all group"
                  >
                    <div className="relative w-28 h-16 shrink-0 rounded-lg overflow-hidden bg-black">
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 rounded font-medium">
                        {video.timestamp}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-rose-400 line-clamp-2 leading-tight">
                        {video.title}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">{video.author} • {video.views} views</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Default Quick Presets if not searching */}
            {!hasSearched && (
              <div>
                <div className="flex items-center gap-1.5 mb-2.5 pt-1 border-t border-zinc-800">
                  <Popcorn className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-zinc-300">
                    Contoh Tontonan:
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
