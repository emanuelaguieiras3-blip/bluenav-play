// YouTube Data API v3 (busca, em alta, 360°/180°, recomendações) + player embutido.
// O player do YouTube é um iframe: o navegador não deixa desenhá-lo dentro do WebGL,
// então ele aparece numa camada por cima da cena (em tela dividida no modo papelão).
import { CONFIG } from '../../config.js';
import { safeStorage } from '../core/util.js';
import { wrapText, fitText, roundRect } from '../core/textures.js';
import { T, drawIcon } from '../ui/theme.js';

const API = 'https://www.googleapis.com/youtube/v3';

export async function ytSearch(q, { pageToken = '', max = 6, extra = {} } = {}) {
  const p = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: String(max), q, key: CONFIG.YOUTUBE_API_KEY, regionCode: CONFIG.YOUTUBE_REGION, relevanceLanguage: 'pt', safeSearch: 'moderate', videoEmbeddable: 'true', ...extra });
  if (pageToken) p.set('pageToken', pageToken);
  const r = await fetch(`${API}/search?${p}`);
  if (!r.ok) throw new Error(await errMsg(r));
  const j = await r.json();
  return { items: j.items.map((it) => ({ id: it.id.videoId, title: decode(it.snippet.title), channel: decode(it.snippet.channelTitle), thumb: it.snippet.thumbnails?.medium?.url })), next: j.nextPageToken, prev: j.prevPageToken };
}

export async function ytTrending({ pageToken = '', max = 6 } = {}) {
  const p = new URLSearchParams({ part: 'snippet', chart: 'mostPopular', maxResults: String(max), regionCode: CONFIG.YOUTUBE_REGION, key: CONFIG.YOUTUBE_API_KEY });
  if (pageToken) p.set('pageToken', pageToken);
  const r = await fetch(`${API}/videos?${p}`);
  if (!r.ok) throw new Error(await errMsg(r));
  const j = await r.json();
  return { items: j.items.map((it) => ({ id: it.id, title: decode(it.snippet.title), channel: decode(it.snippet.channelTitle), thumb: it.snippet.thumbnails?.medium?.url })), next: j.nextPageToken, prev: j.prevPageToken };
}

async function errMsg(r) { try { const j = await r.json(); return j.error?.message || 'HTTP ' + r.status; } catch { return 'HTTP ' + r.status; } }
function decode(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }

// Resolução adaptativa 360p–1080p conforme a conexão
export function pickQuality() {
  const c = navigator.connection;
  const type = c?.effectiveType || '4g', down = c?.downlink ?? 10;
  if (type === '4g' && down >= 6) return { q: 'hd1080', label: '1080p' };
  if (type === '4g' && down >= 3) return { q: 'hd720', label: '720p' };
  if (type === '4g' || type === '3g') return { q: 'large', label: '480p' };
  return { q: 'medium', label: '360p' };
}

// ---------- Player (camada DOM) ----------
let apiPromise = null;
function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!apiPromise) apiPromise = new Promise((res) => {
    window.onYouTubeIframeAPIReady = () => res();
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
  });
  return apiPromise;
}

export class VideoLayer {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('video-layer');
    this.slots = document.getElementById('video-slots');
    this.players = [];
    this.volume = 1;
    this.current = null;
    document.getElementById('video-close').addEventListener('click', () => this.close());
  }

  async play(video) {
    this.close();
    this.current = video;
    this.el.hidden = false;
    const stereo = this.app.mode === 'cardboard';
    this.slots.className = stereo ? 'stereo' : 'flat';
    this.slots.innerHTML = stereo ? '<div><div id="yt0"></div></div><div><div id="yt1"></div></div>' : '<div><div id="yt0"></div></div>';
    await loadYTApi();
    const quality = pickQuality();
    this.quality = quality;
    const mk = (id, muted) => new Promise((res) => {
      const p = new window.YT.Player(id, {
        videoId: video.id, width: '100%', height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, mute: muted ? 1 : 0, vq: quality.q },
        events: {
          onReady: (e) => { try { e.target.setPlaybackQuality(quality.q); e.target.setVolume(muted ? 0 : Math.round(this.volume * 100)); e.target.playVideo(); } catch { /* ok */ } res(p); },
        },
      });
    });
    this.players = [await mk('yt0', false)];
    if (stereo) {
      // segundo olho: mesmo vídeo, sem som, sincronizado
      this.players.push(await mk('yt1', true));
      this.sync = setInterval(() => {
        const [a, b] = this.players;
        try { const d = a.getCurrentTime() - b.getCurrentTime(); if (Math.abs(d) > 0.25) b.seekTo(a.getCurrentTime(), true); if (a.getPlayerState() !== b.getPlayerState()) (a.getPlayerState() === 1 ? b.playVideo() : b.pauseVideo()); } catch { /* ok */ }
      }, 1500);
    }
    const hist = safeStorage.get('bn.history', []);
    safeStorage.set('bn.history', [video, ...hist.filter((h) => h.id !== video.id)].slice(0, 20));
  }

  setVolume(v) { this.volume = v; try { this.players[0]?.setVolume(Math.round(v * 100)); } catch { /* ok */ } }
  togglePause() { const p = this.players[0]; if (!p) return; try { p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo(); } catch { /* ok */ } }

  close() {
    clearInterval(this.sync);
    for (const p of this.players) try { p.destroy(); } catch { /* ok */ }
    this.players = []; this.slots.innerHTML = ''; this.el.hidden = true;
  }
}

// ---------- Conteúdo da janela de catálogo ----------
const TABS = [
  { id: 'trend', label: 'Em alta' },
  { id: 'v360', label: '360°' },
  { id: 'v180', label: '180°' },
  { id: 'rec', label: 'Para você' },
  { id: 'search', label: 'Buscar', icon: 'search' },
];

export class CatalogContent {
  constructor(app) {
    this.app = app; this.icon = 'YouTube'; this.glyph = 'play';
    this.tab = 'trend'; this.items = []; this.page = { next: null, prev: null, token: '' };
    this.query = ''; this.status = 'Carregando…'; this.thumbs = new Map();
  }

  attach(win) { this.win = win; this.load(); }

  async load(token = '') {
    this.status = 'Carregando…'; this.items = []; this.win.invalidate();
    try {
      let r;
      if (this.tab === 'trend') r = await ytTrending({ pageToken: token });
      else if (this.tab === 'v360') r = await ytSearch('vídeo 360 graus VR', { pageToken: token });
      else if (this.tab === 'v180') r = await ytSearch('VR180 3D', { pageToken: token });
      else if (this.tab === 'rec') {
        const h = safeStorage.get('bn.history', []);
        const words = h.slice(0, 3).map((v) => v.title.split(/\s+/).filter((w) => w.length > 3).slice(0, 2).join(' ')).join(' ');
        r = await ytSearch(words || 'realidade virtual 360', { pageToken: token });
      } else r = this.query ? await ytSearch(this.query, { pageToken: token }) : { items: [], next: null, prev: null };
      this.items = r.items; this.page = { next: r.next, prev: r.prev, token };
      this.status = this.items.length ? '' : (this.tab === 'search' ? 'Toque em "Buscar" para digitar.' : 'Nada encontrado.');
      for (const it of this.items) this._thumb(it);
    } catch (e) { this.status = 'Erro do YouTube: ' + e.message; }
    this.win.invalidate();
  }

  _thumb(it) {
    if (!it.thumb || this.thumbs.has(it.id)) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { this.thumbs.set(it.id, img); this.win.invalidate(); };
    img.onerror = () => this.thumbs.set(it.id, null);
    img.src = it.thumb;
  }

  draw(x, W, H, win) {
    // abas
    let tx = 40;
    x.font = `600 26px ${T.font}`; x.textBaseline = 'middle'; x.textAlign = 'center';
    for (const t of TABS) {
      const w = x.measureText(t.label).width + 48 + (t.icon ? 30 : 0);
      const on = t.id === this.tab;
      x.fillStyle = on ? T.surfaceActive : T.surface;
      roundRect(x, tx, 96, w, 52, 26); x.fill();
      x.fillStyle = on ? T.textOnLight : T.text;
      if (t.icon) { drawIcon(x, t.icon, tx + 34, 122, 24, x.fillStyle); x.fillText(t.label, tx + w / 2 + 14, 123); }
      else x.fillText(t.label, tx + w / 2, 123);
      const id = t.id;
      win.items.push({ x: tx, y: 96, w, h: 52, r: 26, key: 'tab' + id, onClick: () => this._tab(id) });
      tx += w + 10;
    }
    if (this.tab === 'search' && this.query) { x.textAlign = 'right'; x.fillStyle = T.textDim; x.font = `500 24px ${T.font}`; fitText(x, '“' + this.query + '”', W - 40, 123, W - tx - 50); }
    // grade 3×2
    const gx = 40, gy = 172, cw = (W - 80 - 40) / 3, chh = (H - gy - 90 - 20) / 2;
    if (this.status) { x.fillStyle = T.textDim; x.textAlign = 'center'; x.font = `500 28px ${T.font}`; wrapText(x, this.status, W / 2, H / 2, W - 120, 38, 3); }
    this.items.slice(0, 6).forEach((it, i) => {
      const cx = gx + (i % 3) * (cw + 20), cy = gy + Math.floor(i / 3) * (chh + 20);
      const th = chh - 78, img = this.thumbs.get(it.id);
      x.save(); roundRect(x, cx, cy, cw, th, 18); x.clip();
      if (img) { const s = Math.max(cw / img.width, th / img.height); x.drawImage(img, cx + (cw - img.width * s) / 2, cy + (th - img.height * s) / 2, img.width * s, img.height * s); }
      else { x.fillStyle = T.surface; x.fillRect(cx, cy, cw, th); drawIcon(x, 'play', cx + cw / 2, cy + th / 2, 44, T.textDim); }
      x.restore();
      x.fillStyle = T.text; x.textAlign = 'left'; x.font = `600 21px ${T.font}`;
      wrapText(x, it.title, cx + 4, cy + th + 22, cw - 8, 25, 2);
      x.fillStyle = T.textDim; x.font = `500 18px ${T.font}`; fitText(x, it.channel, cx + 4, cy + chh - 10, cw - 8);
      win.items.push({ x: cx, y: cy, w: cw, h: th, r: 18, key: 'v' + it.id, onClick: () => this.app.playVideo(it) });
    });
    // paginação
    const by = H - 78;
    const btn = (icon, bx, ok, fn, key) => {
      x.fillStyle = ok ? T.surface : 'rgba(255,255,255,0.03)'; x.beginPath(); x.arc(bx + 27, by + 27, 27, 0, 6.29); x.fill();
      drawIcon(x, icon, bx + 27, by + 27, 26, ok ? T.text : '#4a4d55');
      if (ok) win.items.push({ x: bx, y: by, w: 54, h: 54, r: 27, key, onClick: fn });
    };
    btn('left', W / 2 - 70, !!this.page.prev, () => this.load(this.page.prev), 'prev');
    btn('right', W / 2 + 16, !!this.page.next, () => this.load(this.page.next), 'next');
  }

  // pinçar e arrastar = rolar a lista (como no Quest)
  onSwipe(dx) {
    if (dx < 0 && this.page.next) this.load(this.page.next);
    else if (dx > 0 && this.page.prev) this.load(this.page.prev);
  }

  _tab(id) {
    if (id === 'search') {
      this.tab = 'search';
      this.app.keyboard.show(this.query, (q) => { this.query = q; this.load(); });
      this.load();
      return;
    }
    this.tab = id; this.load();
  }
}

// ---------- Janela do player ----------
export class PlayerContent {
  constructor(app, video) { this.app = app; this.video = video; this.icon = 'Vídeo'; this.glyph = 'play'; this.img = null; }
  attach(win) {
    this.win = win;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { this.img = img; win.invalidate(); };
    img.src = this.video.thumb || '';
  }
  draw(x, W, H, win) {
    const th = H - 250;
    x.save(); roundRect(x, 30, 100, W - 60, th, 18); x.clip();
    if (this.img) { const s = Math.max((W - 60) / this.img.width, th / this.img.height); x.globalAlpha = 0.85; x.drawImage(this.img, W / 2 - this.img.width * s / 2, 100 + th / 2 - this.img.height * s / 2, this.img.width * s, this.img.height * s); x.globalAlpha = 1; }
    else { x.fillStyle = T.surface; x.fillRect(30, 100, W - 60, th); }
    x.restore();
    x.fillStyle = T.text; x.font = `600 30px ${T.font}`; x.textAlign = 'left'; wrapText(x, this.video.title, 36, 100 + th + 36, W - 72, 34, 1);
    const q = this.app.video.quality?.label || 'auto';
    const xr = this.app.renderer.xr.isPresenting;
    x.fillStyle = T.textDim; x.font = `500 22px ${T.font}`;
    fitText(x, xr ? 'No modo imersivo o YouTube não aparece dentro da cena: saia do VR para assistir.' : `Qualidade adaptativa: ${q} · 360°/180°: arraste ou gire o celular no player`, 36, 100 + th + 76, W - 72);
    const bw = 230, by = H - 74;
    const btn = (label, bx, fn, key, light) => { x.fillStyle = light ? T.surfaceActive : T.surface; roundRect(x, bx, by, bw, 54, 27); x.fill(); x.fillStyle = light ? T.textOnLight : T.text; x.textAlign = 'center'; x.font = `600 26px ${T.font}`; x.fillText(label, bx + bw / 2, by + 28); win.items.push({ x: bx, y: by, w: bw, h: 54, r: 27, key, onClick: fn }); };
    btn('Assistir', W / 2 - bw * 1.5 - 20, () => this.app.video.play(this.video), 'play', true);
    btn('Pausar', W / 2 - bw / 2, () => this.app.video.togglePause(), 'pause');
    btn('Parar', W / 2 + bw / 2 + 20, () => this.app.video.close(), 'stop');
  }
  setVolume(v) { this.app.video.setVolume(v); }
  dispose() { this.app.video.close(); }
}
