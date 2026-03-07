export function isValidYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    const validDomains = [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'music.youtube.com'
    ];

    const isValidDomain = validDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    if (!isValidDomain) return false;

    if (hostname === 'youtu.be') {
      return pathname && pathname.length > 1 && pathname !== '/';
    }

    if (pathname.includes('/watch') && searchParams.has('v')) return true;
    if (pathname.includes('/playlist') && searchParams.has('list')) return true;
    if (pathname.startsWith('/shorts/') && pathname.length > 8) return true;
    if (pathname.startsWith('/live/') && pathname.length > 6) return true;
    if (pathname.startsWith('/embed/') && pathname.length > 7) return true;
    if (searchParams.has('list')) return true;

    return false;
  } catch {
    return false;
  }
}
