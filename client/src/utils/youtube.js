// Utility to extract YouTube video ID from various YouTube URL formats
export function getYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;

  // Handles standard, short, shorts, embed, live, and messy share text from mobile
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

export function isYouTubeUrl(url) {
  return !!getYouTubeId(url);
}

// Check if URL is HLS stream
export function isHlsUrl(url) {
  return typeof url === 'string' && url.includes('.m3u8');
}
