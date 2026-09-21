import React, { useState, useEffect } from 'react';
import { Film, Heart, Sparkles, LogIn, PlusCircle } from 'lucide-react';

export default function JoinRoomModal({
  isOpen,
  initialRoomId = '',
  onJoin,
}) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [mode, setMode] = useState(initialRoomId ? 'join' : 'create');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('movteg_username');
    if (savedName) setUsername(savedName);
  }, []);

  useEffect(() => {
    if (initialRoomId) {
      setRoomId(initialRoomId);
      setMode('join');
    }
  }, [initialRoomId]);

  if (!isOpen) return null;

  const generateRoomId = () => {
    const adjectives = ['cozy', 'sweet', 'warm', 'star', 'cine', 'love', 'chill'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${adj}-${num}`;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!username.trim()) {
      setError('Masukkan nama panggilan kamu terlebih dahulu');
      return;
    }

    let targetRoomId = roomId.trim();
    if (mode === 'create' && !targetRoomId) {
      targetRoomId = generateRoomId();
    }

    if (!targetRoomId) {
      setError('Masukkan kode room');
      return;
    }

    localStorage.setItem('movteg_username', username.trim());
    setError('');
    onJoin(targetRoomId, username.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative">
        {/* Decorative Glow */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-lg shadow-rose-900/40 mb-3">
            <Film className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
            Movteg <Heart className="w-5 h-5 text-rose-500 fill-current animate-pulse" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Nonton film bareng pasangan jarak jauh dengan sinkronisasi waktu nyata.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Nama Panggilan Kamu
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder="Misal: Ayang, Dinda, Budi"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          {/* Mode Switcher */}
          {!initialRoomId && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`py-2 rounded-lg font-medium transition-all ${
                  mode === 'create'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Buat Room Baru
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className={`py-2 rounded-lg font-medium transition-all ${
                  mode === 'join'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Gabung Room
              </button>
            </div>
          )}

          {/* Room ID input if in Join mode */}
          {mode === 'join' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Kode Room
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setError('');
                }}
                placeholder="Misal: cozy-4821"
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors font-mono"
              />
            </div>
          )}

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-medium py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-rose-950 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {mode === 'create' ? (
              <>
                <PlusCircle className="w-4 h-4" />
                Buat Ruangan Bioskop
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Masuk ke Ruangan
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
