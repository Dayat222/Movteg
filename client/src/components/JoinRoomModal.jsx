import React, { useState, useEffect } from 'react';
import { Film, Heart, LogIn, PlusCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { socket } from '../utils/socket';

export default function JoinRoomModal({
  isOpen,
  initialRoomId = '',
  onJoin,
}) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId);
  const [mode, setMode] = useState(initialRoomId ? 'join' : 'create');
  const [error, setError] = useState('');
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [notFoundRoomId, setNotFoundRoomId] = useState(null);

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

  const handleSubmit = async (e) => {
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

    // If joining (or entering with initialRoomId), VALIDATE that room exists first!
    if (mode === 'join' || !!initialRoomId) {
      setIsCheckingRoom(true);
      setError('');
      setNotFoundRoomId(null);

      try {
        const check = await socket.checkRoomExists(targetRoomId, 1600);
        setIsCheckingRoom(false);

        if (!check.exists) {
          // Room does not exist! Prompt user to choose
          setNotFoundRoomId(targetRoomId);
          return;
        }
      } catch (err) {
        setIsCheckingRoom(false);
      }
    }

    localStorage.setItem('movteg_username', username.trim());
    setError('');
    setNotFoundRoomId(null);
    onJoin(targetRoomId, username.trim(), mode === 'join' || !!initialRoomId);
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
                onClick={() => {
                  setMode('create');
                  setError('');
                  setNotFoundRoomId(null);
                }}
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
                onClick={() => {
                  setMode('join');
                  setError('');
                  setNotFoundRoomId(null);
                }}
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
                Kode / Nomor Room
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setError('');
                  setNotFoundRoomId(null);
                }}
                placeholder="Misal: cozy-4821"
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 transition-colors font-mono"
              />
            </div>
          )}

          {/* Room Not Found Alert Box with Choices */}
          {notFoundRoomId && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 animate-fade-in space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm">Room Belum Ada!</p>
                  <p className="text-zinc-300 mt-1 leading-relaxed">
                    Ruangan <span className="font-mono font-bold text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded">{notFoundRoomId}</span> belum dibuat atau belum ada pasanganmu di dalamnya.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setNotFoundRoomId(null);
                    setRoomId('');
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 px-3 rounded-xl font-medium transition-colors text-center cursor-pointer"
                >
                  Coba Kode Lain
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = notFoundRoomId;
                    setNotFoundRoomId(null);
                    setMode('create');
                    setRoomId(target);
                    localStorage.setItem('movteg_username', username.trim());
                    onJoin(target, username.trim(), false);
                  }}
                  className="bg-amber-600 hover:bg-amber-500 text-white py-2 px-3 rounded-xl font-bold transition-colors text-center shadow-md shadow-amber-950/40 cursor-pointer"
                >
                  Buat Room Ini ✨
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isCheckingRoom}
            className={`w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-medium py-3 px-4 rounded-xl text-xs transition-all shadow-lg shadow-rose-950 flex items-center justify-center gap-2 cursor-pointer mt-2 ${
              isCheckingRoom ? 'opacity-80 cursor-wait' : ''
            }`}
          >
            {isCheckingRoom ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Memeriksa Ruangan...</span>
              </>
            ) : mode === 'create' ? (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Buat Ruangan Bioskop</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk ke Ruangan</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
