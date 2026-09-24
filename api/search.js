import ytSearch from 'yt-search';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const result = await ytSearch(q);
    const videos = result.videos.slice(0, 10).map(v => ({
      id: v.videoId,
      title: v.title,
      url: v.url,
      thumbnail: v.thumbnail,
      timestamp: v.timestamp,
      author: v.author.name,
      views: v.views
    }));
    
    return res.status(200).json({ videos });
  } catch (error) {
    console.error('YouTube search error:', error);
    return res.status(500).json({ error: 'Failed to search YouTube' });
  }
}
