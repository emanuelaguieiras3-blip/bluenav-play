'use strict';
// Transporte multiplayer.
// - Com o servidor Node (iniciar-mesa.cmd), usa HTTP normalmente.
// - Em hospedagem estática (Vercel), o navegador de quem cria a sala vira o
//   anfitrião: roda as mesmas regras de net-core.js e atende os amigos por WebRTC
//   (PeerJS). Os códigos de convite continuam com seis caracteres.
window.VesperaNet = (() => {
  const R = window.VesperaRooms, PREFIX = 'vespera-v1-';
  const rand = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
  const randomHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  const randomInt = (min, max) => min + Math.floor(rand() * (max - min));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : randomHex(16));
  const clone = value => JSON.parse(JSON.stringify(value));
  const failure = (message, status = 503) => Object.assign(new Error(message), { status });
  let serverMode = null;

  async function hasServer() {
    if (serverMode !== null) return serverMode;
    if (!/^https?:$/.test(location.protocol)) return (serverMode = false);
    // A slow phone connection must not decide "no server" for good: only a real answer is remembered.
    try { const r = await fetch('/api/worlds', { signal: AbortSignal.timeout(5000) }); serverMode = (r.headers.get('content-type') || '').includes('application/json'); }
    catch { return false; }
    return serverMode;
  }
  async function viaServer(kind, method, path, body, token) {
    const response = await fetch('/api/' + kind + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
    const data = await response.json().catch(() => ({ error: 'Reinicie o servidor pelo iniciar-mesa.cmd.' }));
    if (!response.ok) throw failure(data.error || 'Conexão indisponível.', response.status);
    return data;
  }
  function needPeer() { if (typeof window.Peer !== 'function') throw failure('Não foi possível carregar o módulo online. Verifique sua conexão com a internet e recarregue a página.'); }

  // ---------- Anfitrião ----------
  const hosts = {};
  function host(kind) {
    if (hosts[kind]) return hosts[kind];
    const key = 'vespera-host-' + kind;
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
    let dirty = false;
    const onChange = () => { dirty = true; };
    const service = kind === 'worlds'
      ? R.createWorldRooms({ V: window.Vespera, rng: rand, randomHex, uuid, worlds: saved, onChange })
      : R.createTableRooms({ story: { classes, origins, getScenes }, randomInt, randomHex, uuid, rooms: saved, onChange }); // globais de story.js
    const persist = () => { if (!dirty) return; try { localStorage.setItem(key, JSON.stringify(kind === 'worlds' ? service.worlds : service.rooms)); dirty = false; } catch {} };
    const h = hosts[kind] = { service, peers: new Map(), persist };
    // Saving every world is a big JSON: do it every 15 s when the page is idle, and when it is hidden.
    setInterval(() => (window.requestIdleCallback || (f => setTimeout(f, 0)))(persist, { timeout: 4000 }), 15000); addEventListener('pagehide', persist); document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    if (kind === 'worlds') {
      let last = performance.now();
      setInterval(() => { const now = performance.now(); let elapsed = Math.min(3, (now - last) / 1000); last = now; while (elapsed > 0.001) { const dt = Math.min(0.0667, elapsed); if (service.step(dt)) dirty = true; elapsed -= dt; } }, 1000 / 15);
    }
    return h;
  }
  function hasLocal(kind, code) { const h = host(kind); return !!(kind === 'worlds' ? h.service.worlds : h.service.rooms)[code]; }
  function openPeer(kind, code) {
    const h = host(kind);
    if (h.peers.has(code)) return h.peers.get(code).ready;
    needPeer();
    const peer = new Peer(PREFIX + kind + '-' + code, { debug: 0, ...(window.VESPERA_PEER_CONFIG || {}) });
    const entry = { peer };
    entry.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(failure('O serviço de conexão online não respondeu. Tente novamente em instantes.')), 12000);
      peer.on('open', () => { clearTimeout(timer); resolve(); });
      peer.on('error', e => { if (e.type === 'unavailable-id') { clearTimeout(timer); h.peers.delete(code); reject(failure('Este mundo já está aberto em outra aba ou aparelho.', 409)); } });
    });
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch {} }, 1500); });
    peer.on('connection', conn => {
      conn.on('data', async msg => {
        if (!msg || typeof msg !== 'object' || typeof msg.path !== 'string') return;
        try {
          const r = await h.service.handle(msg.method === 'POST' ? 'POST' : 'GET', '/api/' + kind + msg.path, async () => R.checkBody(msg.body), typeof msg.token === 'string' ? msg.token : '');
          conn.send({ id: msg.id, status: r.status, data: r.data });
        } catch (e) { conn.send({ id: msg.id, status: e.status || 500, error: e.status ? e.message : 'O anfitrião não conseguiu processar o pedido.' }); }
      });
    });
    h.peers.set(code, entry);
    entry.ready.catch(() => h.peers.delete(code));
    return entry.ready;
  }
  async function viaHost(kind, method, path, body, token) {
    const h = host(kind);
    const r = await h.service.handle(method, '/api/' + kind + path, async () => R.checkBody(body), token || '');
    return clone(r.data);
  }

  // ---------- Convidado ----------
  let guestPeer = null, guestReady = null, nextId = 0;
  const links = new Map(), pending = new Map();
  function guest() {
    if (guestReady) return guestReady;
    needPeer();
    guestPeer = new Peer({ debug: 0, ...(window.VESPERA_PEER_CONFIG || {}) });
    guestReady = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { guestReady = null; reject(failure('O serviço de conexão online não respondeu. Tente novamente em instantes.')); }, 12000);
      guestPeer.on('open', () => { clearTimeout(timer); resolve(guestPeer); });
      guestPeer.on('error', e => {
        if (e.type === 'peer-unavailable') { for (const [key, link] of links) if (!link.open) { links.delete(key); link.fail(failure('Nenhum anfitrião está online com este código. Peça para quem criou o mundo abrir o jogo.', 404)); } }
        else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) { clearTimeout(timer); guestReady = null; reject(failure('Sem conexão com o serviço online.')); }
      });
      guestPeer.on('disconnected', () => { if (!guestPeer.destroyed) setTimeout(() => { try { guestPeer.reconnect(); } catch {} }, 1500); });
    });
    return guestReady;
  }
  async function link(kind, code) {
    const key = kind + '-' + code;
    if (links.has(key)) return links.get(key).ready;
    const peer = await guest();
    const conn = peer.connect(PREFIX + key, { reliable: true, serialization: 'json' });
    const entry = { conn, open: false };
    entry.ready = new Promise((resolve, reject) => {
      entry.fail = reject;
      const timer = setTimeout(() => { links.delete(key); reject(failure('O anfitrião não respondeu. A rede dele pode estar bloqueando conexões diretas.')); try { conn.close(); } catch {} }, 15000);
      conn.on('open', () => { clearTimeout(timer); entry.open = true; resolve(conn); });
      conn.on('data', msg => { const job = pending.get(msg?.id); if (!job) return; pending.delete(msg.id); clearTimeout(job.timer); msg.status >= 400 ? job.reject(failure(msg.error || 'Pedido recusado.', msg.status)) : job.resolve(msg.data); });
      const drop = () => { links.delete(key); for (const [id, job] of pending) if (job.key === key) { pending.delete(id); clearTimeout(job.timer); job.reject(failure('A conexão com o anfitrião caiu.')); } };
      conn.on('close', drop); conn.on('error', drop);
    });
    entry.ready.catch(() => {});
    links.set(key, entry);
    return entry.ready;
  }
  async function viaGuest(kind, code, method, path, body, token) {
    const conn = await link(kind, code), id = ++nextId, key = kind + '-' + code;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(failure('O anfitrião demorou para responder.')); }, 8000);
      pending.set(id, { resolve, reject, timer, key });
      conn.send({ id, method, path, body: body || null, token: token || '' });
    });
  }

  async function request(kind, method, path, body, token) {
    if (await hasServer()) return viaServer(kind, method, path, body, token);
    if (method === 'POST' && path === '') {
      needPeer();
      const data = await viaHost(kind, method, path, body, token);
      const code = kind === 'worlds' ? data.code : data.room.code;
      try { await openPeer(kind, code); } catch (e) { delete (kind === 'worlds' ? host(kind).service.worlds : host(kind).service.rooms)[code]; throw e; }
      host(kind).persist();
      return data;
    }
    const code = path.match(/^\/([A-F0-9]{6})/)?.[1];
    if (!code) throw failure('Código inválido.', 400);
    if (hasLocal(kind, code)) { openPeer(kind, code).catch(() => {}); return viaHost(kind, method, path, body, token); }
    return viaGuest(kind, code, method, path, body, token);
  }
  function role(kind, code) { if (serverMode) return 'server'; return code && hosts[kind] && hasLocal(kind, code) ? 'host' : 'guest'; }
  return { request, hasServer, role };
})();
