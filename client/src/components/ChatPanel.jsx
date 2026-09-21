import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile, Heart, Popcorn, Flame, Laugh } from 'lucide-react';

const QUICK_EMOJIS = ['❤️', '🍿', '😂', '🥺', '🔥', '👏', '✨'];

export default function ChatPanel({
  roomId,
  username,
  socket,
  messages = [],
  onSendReaction,
  users = [],
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !socket) return;

    socket.emit('send-message', {
      roomId,
      text: inputText,
    });

    setInputText('');
  };

  const handleReactionClick = (emoji) => {
    if (!socket) return;
    socket.emit('send-reaction', {
      roomId,
      emoji,
    });
    if (onSendReaction) {
      onSendReaction(emoji);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
          <h2 className="text-sm font-semibold text-zinc-100">Obrolan Bioskop</h2>
        </div>
        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{users.length} Orang</span>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-700">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 text-xs px-6">
            <Popcorn className="w-8 h-8 mb-2 text-zinc-600 animate-bounce" />
            <p>Belum ada obrolan.</p>
            <p className="mt-1 text-zinc-600">Mulai kirim pesan atau kirim reaksi ❤️ ke pasanganmu!</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-1.5">
                  <span className="text-[11px] bg-zinc-800/70 text-zinc-400 px-3 py-1 rounded-full border border-zinc-700/50">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.sender === username;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} transition-all`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[11px] text-zinc-400 px-1">
                  <span className="font-medium text-zinc-300">
                    {isMe ? 'Kamu' : msg.sender}
                  </span>
                  <span className="text-[10px] text-zinc-500">{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm break-words leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-rose-600 text-white rounded-br-xs'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-xs border border-zinc-700/50'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reactions Bar */}
      <div className="px-3 py-2 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between gap-1 overflow-x-auto">
        <span className="text-[11px] text-zinc-500 font-medium mr-1 select-none">Reaksi:</span>
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className="text-base p-1.5 hover:bg-zinc-800 hover:scale-125 active:scale-95 transition-all rounded-full cursor-pointer select-none"
            title={`Kirim ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ketik pesan untuk pasanganmu..."
          className="flex-1 bg-zinc-800/90 border border-zinc-700/70 focus:border-rose-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white p-2 rounded-xl transition-all shadow-md shadow-rose-950 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
