import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

export default function ReactionsOverlay({ reactions = [] }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (reactions.length === 0) return;

    const latest = reactions[reactions.length - 1];
    if (!latest) return;

    // Trigger confetti for love / heart
    if (latest.emoji === '❤️' || latest.emoji === '💖') {
      try {
        confetti({
          particleCount: 25,
          spread: 60,
          origin: { y: 0.85, x: 0.8 },
          colors: ['#ff4d6d', '#ff758f', '#ff8fa3', '#c9184a'],
          shapes: ['circle'],
          scalar: 1.2,
        });
      } catch {
        // ignore if canvas not ready
      }
    }

    // Add floating bubbles
    const newParticles = Array.from({ length: 4 }).map((_, i) => ({
      id: `${latest.id}-${i}-${Math.random()}`,
      emoji: latest.emoji,
      sender: latest.sender,
      left: 75 + Math.random() * 20, // bottom right area
      bottom: 10 + Math.random() * 10,
      size: 24 + Math.random() * 16,
      duration: 2.2 + Math.random() * 1.2,
      delay: i * 0.15,
    }));

    setParticles((prev) => [...prev, ...newParticles]);

    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)));
    }, 4000);

    return () => clearTimeout(timer);
  }, [reactions]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-float-up opacity-0 flex flex-col items-center select-none"
          style={{
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            fontSize: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          <span>{p.emoji}</span>
          {p.sender && (
            <span className="text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded-full backdrop-blur-xs mt-1 whitespace-nowrap">
              {p.sender}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
