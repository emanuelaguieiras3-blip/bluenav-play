'use strict';
// Regras das salas multiplayer, compartilhadas entre o servidor Node (LAN) e o
// anfitrião no navegador (online pela Vercel, via WebRTC). Nenhuma E/S aqui.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VesperaRooms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const TTL = 7 * 24 * 60 * 60 * 1000;

  // ---------- Mundo aberto ----------
  function createWorldRooms({ V, rng, randomHex, uuid, worlds = {}, onChange = () => {} }) {
    // Harvested tiles near a player change slowly: rebuilt at most once a second per player.
    const nearCache = new Map();
    function nearHarvested(room, me, p) {
      const w = room.world, key = room.code + ':' + me, c = nearCache.get(key), now = Date.now();
      if (c && now - c.at < 1000 && Math.hypot(c.x - p.x, c.y - p.y) < 6) return c.list;
      const list = {}; for (const [k, expires] of Object.entries(w.harvested)) { const i = k.indexOf(','), x = +k.slice(0, i), y = +k.slice(i + 1); if (expires > w.time && Math.hypot(x - p.x, y - p.y) < 35) list[k] = expires; }
      if (nearCache.size > 400) nearCache.clear(); nearCache.set(key, { at: now, x: p.x, y: p.y, list }); return list;
    }
    // Delta mode (clients that send delta:1): parts that rarely change are sent only when they changed.
    // The explored map alone was ~80% of every reply. A full reply goes out every 60 replies or when asked.
    const QUIET_WORLD = ['harvested', 'placed', 'graves', 'raids', 'deep', 'citadel'];
    // Small, fast-changing fields always go, so the client never mixes predicted and server positions.
    const ALWAYS = new Set(['x', 'y', 'dir', 'hp', 'mana', 'dead', 'input', 'lastSeq', 'buffs', 'cooldowns', 'attackAt', 'hurtAt', 'id']);
    const sig = (k, v) => k === 'discovered' ? 'n' + Object.keys(v || {}).length : k === 'visited' ? 'n' + (v || []).length : JSON.stringify(v);
    function trim(data, member, full) {
      const w = data.world, mine = w.players[data.me] = { ...w.players[data.me] };
      if (full || !member.sent || ++member.sentCount >= 60) { member.sent = {}; member.sentCount = 0; }
      const sent = member.sent, gone = [];
      for (const k of Object.keys(mine)) { if (ALWAYS.has(k)) continue; const s = sig(k, mine[k]); if (sent['me.' + k] === s) delete mine[k]; else sent['me.' + k] = s; }
      for (const k of Object.keys(sent)) if (k.startsWith('me.') && !(k.slice(3) in w.players[data.me]) && !(k.slice(3) in mine)) { const key = k.slice(3); if (!Object.hasOwn(data.fullMe, key)) { gone.push(key); delete sent[k]; } }
      for (const k of QUIET_WORLD) { const s = JSON.stringify(w[k]); if (sent[k] === s) delete w[k]; else sent[k] = s; }
      w.delta = true; if (gone.length) w.meGone = gone; delete data.fullMe; return data;
    }
    // Villager life: only residents and animals near this player travel (the rest is computed locally),
    // without their planned routes. The full list was ~95% of every reply.
    function lifeView(life, p) {
      const near = o => Math.abs(o.x - p.x) < 30 && Math.abs(o.y - p.y) < 22, npcs = {};
      const r2 = v => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
      for (const [id, n] of Object.entries(life.npcs || {})) if (near(n)) { const { route, ...rest } = n; rest.x = r2(rest.x); rest.y = r2(rest.y); npcs[id] = rest; }
      const animals = (life.animals || []).filter(near).map(a => ({ id: a.id, kind: a.kind, x: r2(a.x), y: r2(a.y), dir: a.dir, moving: a.moving, phase: r2(a.phase) }));
      return { ...life, npcs, animals, news: (life.news || []).slice(-6) };
    }
    // Only players inside the match receive the arena, slimmed; the others get a lobby card while it runs.
    function arenaFor(w, p) {
      const a = w.arena, R = V.arenaRules; if (!a) return undefined;
      if (p.arenaActive) return R ? R.view(a, p.id) : a;
      return a.finished ? undefined : R ? R.summary(a) : a;
    }
    function snapshot(room, me, opts) {
      const w = room.world, p = w.players[me], monsters = {};
      for (const [id, m] of Object.entries(w.monsters)) if (Math.hypot(m.x - p.x, m.y - p.y) < 30) monsters[id] = m;
      const harvested = nearHarvested(room, me, p);
      const players = {};
      for (const q of Object.values(w.players)) players[q.id] = q.id === me ? q : { id: q.id, name: q.name, surname: q.surname, classId: q.classId, appearance: q.appearance || 'female', x: q.x, y: q.y, dir: q.dir, hp: q.hp, mana: q.mana, level: q.level, dead: q.dead, online: q.online, attackAt: q.attackAt, castAt: q.castAt, hurtAt: q.hurtAt, equipment: q.equipment, attributes: q.attributes || {}, buffs: q.buffs, activity:q.activity, progress:q.progress?{pet:q.progress.pet,mounted:q.progress.mounted,home:q.progress.home,decor:q.progress.decor}:undefined, isekai:q.isekai?{chosen:q.isekai.chosen,race:q.isekai.race,title:q.isekai.title,rank:q.isekai.rank,companions:(q.isekai.companions||[]).map(c=>({id:c.id,kind:c.kind,name:c.name,named:c.named,stage:c.stage,level:c.level,x:Math.round(c.x*100)/100,y:Math.round(c.y*100)/100,dir:c.dir,attackAt:c.attackAt}))}:undefined, shadows:(q.shadows||[]).map(c=>({id:c.id,kind:c.kind,boss:c.boss,tier:c.tier,x:Math.round(c.x*100)/100,y:Math.round(c.y*100)/100,dir:c.dir,attackAt:c.attackAt})) };
      const data = { code: room.code, me, world: { version: 2, seed: w.seed, time: w.time, day: w.day, arena:arenaFor(w, p), arenaSerial:w.arenaSerial, life: w.life ? (p.arenaActive ? { ...w.life, npcs: {}, animals: [], news: (w.life.news || []).slice(-6) } : lifeView(w.life, p)) : undefined, players, monsters, harvested, placed: w.placed, graves: w.graves, realmChanges:w.realmChanges||{}, chat:w.chat||[], trades:Object.fromEntries(Object.entries(w.trades||{}).filter(([,t])=>t.ids.includes(me))), raids: w.raids || {}, deep: w.deep || {}, citadel: w.citadel || {}, events: w.events.filter(e => !e.who || e.who === me || ['slash', 'projectile', 'skill'].includes(e.type)), eventId: w.eventId } };
      if (!opts?.member) return data;
      data.fullMe = p; return trim(data, opts.member, opts.full);
    }
    function player(body) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 24 || /[\x00-\x1f]/.test(body.name) || !Object.hasOwn(V.classById, body.classId)) fail('Escolha seu nome e uma classe válida.');
      if (body.appearance !== undefined && !['female', 'male'].includes(body.appearance)) fail('Aparência inválida.');
      if (body.look != null && !V.validLook(body.look)) fail('Visual de personagem inválido.');
      return V.makePlayer(body.name, body.classId, uuid(), rng, body.appearance, body.look);
    }
    function step(dt) {
      let changed = false;
      for (const room of Object.values(worlds)) {
        let online = false;
        for (const p of Object.values(room.world.players)) { p.online = Date.now() - (room.members[p.id]?.seen || 0) < 3000; if (p.online) online = true; }
        if (online) { V.tick(room.world, dt, rng); changed = true; }
      }
      return changed;
    }
    async function handle(method, pathname, readBody, token) {
      const now = Date.now();
      if (pathname === '/api/worlds' && method === 'POST') {
        const b = await readBody(), p = player(b);
        for (const [k, r] of Object.entries(worlds)) if (now - r.updated > TTL) delete worlds[k];
        if (Object.keys(worlds).length >= 100) fail('O servidor está cheio.', 503);
        let code; do { code = randomHex(3).toUpperCase(); } while (worlds[code]);
        const secret = randomHex(32), world = V.makeWorld(1 + Math.floor(rng() * 999999)); world.players[p.id] = p;
        const room = { code, world, members: { [p.id]: { token: secret, seen: now } }, updated: now }; worlds[code] = room; onChange(true);
        return { status: 201, data: { token: secret, ...snapshot(room, p.id) } };
      }
      const match = pathname.match(/^\/api\/worlds\/([A-F0-9]{6})(?:\/(join|input|leave))?$/); if (!match) fail('Mundo não encontrado.', 404);
      const room = worlds[match[1]]; if (!room) fail('Este mundo não está disponível.', 404);
      if (match[2] === 'join' && method === 'POST') {
        if (Object.keys(room.members).length >= 4) fail('Este mundo já tem quatro aventureiros.', 409);
        const b = await readBody(), p = player(b), secret = randomHex(32); room.world.players[p.id] = p; room.members[p.id] = { token: secret, seen: now }; room.updated = now; onChange(true);
        return { status: 201, data: { token: secret, ...snapshot(room, p.id) } };
      }
      const me = Object.keys(room.members).find(id => room.members[id].token === token); if (!me) fail('Seu acesso a este mundo expirou.', 401);
      const p = room.world.players[me]; room.members[me].seen = now; p.online = true;
      if (method === 'GET' && !match[2]) return { status: 200, data: snapshot(room, me) };
      if (method !== 'POST') fail('Método inválido.', 405);
      if (match[2] === 'leave') { p.online = false; p.input = { x: 0, y: 0, until: 0 }; room.members[me].seen = 0; onChange(true); return { status: 200, data: { ok: true } }; }
      if (match[2] !== 'input') fail('Rota inválida.', 404);
      const b = await readBody();
      if (!Number.isSafeInteger(b.seq) || b.seq < 0) fail('Comando inválido.');
      let actionError = p.lastActionError || null;
      if (b.seq > p.lastSeq) { actionError = null; p.lastSeq = b.seq; V.setInput(room.world, p, b.x, b.y); if(b.arenaInput) V.act(room.world,p,{type:'arenaInput',x:b.arenaInput.x,y:b.arenaInput.y,ax:b.arenaInput.ax,ay:b.arenaInput.ay},rng); if (b.action) { try { V.act(room.world, p, b.action, rng); } catch (e) { actionError = e.message; } } p.lastActionError = actionError; room.updated = now; onChange(false); }
      return { status: 200, data: { ...snapshot(room, me, b.delta === 1 ? { member: room.members[me], full: b.full === 1 } : null), actionError } };
    }
    return { handle, step, snapshot, get worlds() { return worlds; } };
  }

  // ---------- Livro clássico (mesa por turnos) ----------
  function createTableRooms({ story, randomInt, randomHex, uuid, rooms = {}, onChange = () => {} }) {
    const { classes, origins, getScenes } = story;
    const choose = list => list[randomInt(0, list.length)];
    function character(body, stranger) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 24 || /[\x00-\x1f]/.test(name) || !Object.hasOwn(classes, body.class)) fail('Informe um nome de até 24 letras e uma classe válida.');
      return { id: uuid(), token: randomHex(32), left: false, seen: Date.now(),
        state: { version: 1, name, class: body.class, origin: choose(origins), stranger, stage: 0, spirit: 4, flags: [], log: [], choice: null, result: null, wins: 0 } };
    }
    function view(room, player) {
      return { code: room.code, revision: room.revision, status: room.status, host: room.host, active: room.active, me: player.id,
        events: room.events, players: room.players.filter(p => !p.left).map(p => ({ id: p.id, online: Date.now() - p.seen < 15000, state: { ...p.state, flags: room.flags } })) };
    }
    function advance(room, current) {
      const index = room.players.findIndex(p => p.id === current);
      for (let offset = 1; offset <= room.players.length; offset++) {
        const next = room.players[(index + offset) % room.players.length];
        if (!next.left && next.state.stage < 4) { room.active = next.id; return; }
      }
      room.status = 'finished'; room.active = null;
    }
    async function handle(method, pathname, readBody, token) {
      const now = Date.now();
      if (pathname === '/api/rooms' && method === 'POST') {
        const body = await readBody();
        for (const [code, room] of Object.entries(rooms)) if (now - room.updated > TTL) delete rooms[code];
        if (Object.keys(rooms).length >= 1000) fail('Servidor cheio. Tente mais tarde.', 503);
        const player = character(body, choose(['uma criança com cabelos de prata', 'um cavaleiro sem brasão', 'uma mulher com olhos de âmbar', 'um velho que carrega flores secas']));
        let code; do { code = randomHex(4).slice(0, 6).toUpperCase(); } while (rooms[code]);
        const room = { code, revision: 1, status: 'lobby', players: [player], host: player.id, active: null, events: [], flags: [], updated: now };
        rooms[code] = room; onChange(); return { status: 201, data: { token: player.token, room: view(room, player) } };
      }
      const match = pathname.match(/^\/api\/rooms\/([A-F0-9]{6})(?:\/(join|action))?$/);
      if (!match) fail('Não encontrado.', 404);
      const room = rooms[match[1]];
      if (!room || now - room.updated > TTL) fail('Sala não encontrada ou expirada.', 404);
      if (match[2] === 'join' && method === 'POST') {
        const body = await readBody();
        if (room.status !== 'lobby') fail('Esta aventura já começou. Crie outra mesa para jogar juntos.', 409);
        if (room.players.filter(p => !p.left).length >= 4) fail('A mesa já tem quatro jogadores.', 409);
        const player = character(body, room.players[0].state.stranger);
        room.players.push(player); room.revision++; room.updated = now; onChange();
        return { status: 201, data: { token: player.token, room: view(room, player) } };
      }
      const player = room.players.find(p => p.token === token && !p.left);
      if (!player) fail('Sua entrada nesta sala não é válida.', 401);
      player.seen = now;
      if (!match[2] && method === 'GET') return { status: 200, data: { room: view(room, player) } };
      if (match[2] !== 'action' || method !== 'POST') fail('Não encontrado.', 404);
      const body = await readBody();
      if (body.revision !== room.revision) fail('A mesa mudou. Atualizando sua visão…', 409);
      const s = player.state;
      if (body.type === 'start') {
        if (room.host !== player.id || room.status !== 'lobby') fail('Só o anfitrião pode começar a mesa.', 403);
        if (room.players.filter(p => !p.left).length < 2) fail('Espere pelo menos mais um jogador.');
        room.status = 'playing'; room.active = room.players.find(p => !p.left).id;
      } else if (body.type === 'leave') {
        player.left = true;
        if (room.host === player.id) room.host = room.players.find(p => !p.left)?.id || null;
        if (room.active === player.id) advance(room, player.id);
        if (!room.host) room.status = 'finished';
      } else if (body.type === 'skip') {
        const active = room.players.find(p => p.id === room.active);
        if (room.status !== 'playing' || room.host !== player.id || !active || now - active.seen < 30000) fail('Só é possível passar a vez após 30 segundos de desconexão.', 409);
        advance(room, active.id);
      } else {
        if (room.status !== 'playing' || room.active !== player.id) fail('Espere a sua vez.', 403);
        if (body.type === 'choose') {
          if (s.choice !== null || s.result || !Number.isInteger(body.choice) || body.choice < 0 || body.choice > 2) fail('Escolha inválida.', 409);
          s.choice = body.choice;
        } else if (body.type === 'roll') {
          if (s.choice === null || s.result) fail('Este dado já foi rolado ou falta escolher uma ação.', 409);
          const action = getScenes({ ...s, flags: room.flags })[s.stage].choices[s.choice];
          const dice = Array.from({ length: action[1] === classes[s.class].talent ? 2 : 1 }, () => randomInt(1, 7));
          const success = Math.max(...dice) > 4;
          s.result = { dice, success, text: action[success ? 2 : 3] };
          if (success) { if (!room.flags.includes(action[4])) room.flags.push(action[4]); s.wins++; } else s.spirit--;
          if (s.stage === 3) { s.destination = action[4]; s.lastSuccess = success; }
          const entry = `${s.name} ${s.origin.surname}: ${action[0]} → ${dice.join(', ')}: ${success ? 'sucesso' : 'falha'}.`;
          s.log.push(entry); room.events.push(entry);
        } else if (body.type === 'continue') {
          if (!s.result) fail('Role o dado antes de continuar.', 409);
          s.stage = s.spirit === 0 ? 4 : s.stage + 1; s.choice = null; s.result = null;
          advance(room, player.id);
        } else fail('Ação desconhecida.');
      }
      room.revision++; room.updated = now; onChange();
      return { status: 200, data: { room: view(room, player) } };
    }
    return { handle, get rooms() { return rooms; } };
  }

  // Corpo JSON já decodificado (navegador) com as mesmas regras do servidor.
  function checkBody(body) { if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Pedido inválido.'); if (JSON.stringify(body).length > 4096) fail('Pedido muito grande.', 413); return body; }
  return { createWorldRooms, createTableRooms, checkBody, fail };
});
