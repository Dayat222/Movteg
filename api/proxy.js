export default async function handler(req, res) {
  // Always set permissive CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  let targetUrl;
  try {
    targetUrl = decodeURIComponent(url);
    new URL(targetUrl); // Validate URL format
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  try {
    // Forward range header if present for seeking/buffering
    const fetchHeaders = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };

    if (req.headers.range) {
      fetchHeaders['Range'] = req.headers.range;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow'
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isM3U8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('application/x-mpegurl');

    if (isM3U8) {
      const text = await upstreamRes.text();
      const baseUrl = new URL(targetUrl);

      // Rewrite every segment/nested playlist line to route through this proxy
      const rewritten = text
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            // Check if #EXT-X-KEY contains a URI
            if (trimmed.startsWith('#EXT-X-KEY:') && trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                const absUri = new URL(uri, baseUrl).toString();
                return `URI="/api/proxy?url=${encodeURIComponent(absUri)}"`;
              });
            }
            return line;
          }

          // Line is a media URL (either absolute or relative)
          try {
            const absoluteUrl = new URL(trimmed, baseUrl).toString();
            return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
          } catch {
            return line;
          }
        })
        .join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(rewritten);
    }

    // Binary media / segment streaming
    res.status(upstreamRes.status);
    if (upstreamRes.headers.get('content-type')) {
      res.setHeader('Content-Type', upstreamRes.headers.get('content-type'));
    }
    if (upstreamRes.headers.get('content-length')) {
      res.setHeader('Content-Length', upstreamRes.headers.get('content-length'));
    }
    if (upstreamRes.headers.get('content-range')) {
      res.setHeader('Content-Range', upstreamRes.headers.get('content-range'));
    }
    if (upstreamRes.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', upstreamRes.headers.get('accept-ranges'));
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('CORS Proxy error for URL:', targetUrl, err);
    return res.status(502).json({ error: 'Proxy fetch failed', details: err.message });
  }
}
