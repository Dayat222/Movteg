export const CURRENT_APP_VERSION = '1.1.0';

/**
 * Compare two semver strings (e.g. "1.2.0" vs "1.1.0")
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
 */
export function compareVersions(v1, v2) {
  const p1 = (v1 || '0').split('.').map(Number);
  const p2 = (v2 || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Check if a newer version exists on the server
 */
export async function checkForUpdates() {
  try {
    // Cache-busting query to always get fresh data
    const url = `https://movteg.vercel.app/version.json?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    const hasUpdate = compareVersions(data.version, CURRENT_APP_VERSION) > 0;

    return {
      success: true,
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: data.version,
      releaseDate: data.releaseDate,
      title: data.title || `Pembaruan Versi ${data.version}`,
      changelog: data.changelog || [],
      downloadUrl: data.downloadUrl || 'https://github.com/Dayat222/Movteg/actions',
    };
  } catch (err) {
    console.warn('[AppUpdate] Failed to check for updates:', err);
    return {
      success: false,
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      error: err.message,
    };
  }
}
