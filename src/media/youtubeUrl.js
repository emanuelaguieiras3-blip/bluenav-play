export function youtubeId(value) {
  const input = String(value).trim();
  if (/^[\w-]{11}$/.test(input)) return input;
  let url; try { url = new URL(input); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  let id;
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
  }
  return /^[\w-]{11}$/.test(id || '') ? id : null;
}
