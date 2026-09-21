// Utility to extract YouTube video ID from various YouTube URL formats
export function getYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);

  return match && match[2].length === 11 ? match[2] : null;
}

export function isYouTubeUrl(url) {
  return !!getYouTubeId(url);
}

// Check if URL is HLS stream
export function isHlsUrl(url) {
  return typeof url === 'string' && url.includes('.m3u8');
}
