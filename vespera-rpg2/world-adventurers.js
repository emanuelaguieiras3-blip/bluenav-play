'use strict';
// Other adventurers of the Guild of the Wayfarers. They keep an ordinary working day: the board in the
// morning, a hunting ground that suits their rank, back at dusk to sell the haul (which moves the
// guild's prices), the tavern in the evening and a bed at the inn. Near a player they walk and really
// fight the monsters around; far away their day is resolved by the clock. Pure; world-core binds helpers.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.WorldAdventurers = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  let H = null; const bind = h => { H = h; };
  const L = (body, hair, hairColor, outfit, main, accent, hat, item, extra = {}) => ({ body, skin: extra.skin || '#eab893', hair, hairColor, beard: extra.beard || 'none', outfit, main, accent, hat, item, cape: !!extra.cape });
  // [id, name, rank, class name, party, hunting ground, look, damage per blow]
  const ROSTER = [
    ['kael', 'Kael', 'C', 'guerreiro', 'Lâmina Rubra', 'denseForest', L('man', 'short', '#2a1f1a', 'armor', '#7a3b3b', '#c9a45c', 'none', 'sword', { cape: true, beard: 'goatee' }), 22],
    ['sera', 'Sera', 'C', 'clériga', 'Lâmina Rubra', 'denseForest', L('woman', 'long', '#e0b25c', 'robe', '#f1efe6', '#c9a45c', 'hood', 'staff'), 14],
    ['ivo', 'Ivo', 'D', 'arqueiro', 'Trio do Vento', 'wetland', L('man', 'spiky', '#9a5b2e', 'tunic', '#4f7a45', '#e8d8b0', 'cap', 'spear', { skin: '#d19a6f' }), 16],
    ['mina', 'Mina', 'D', 'maga', 'Trio do Vento', 'wetland', L('woman', 'bun', '#3c4f7a', 'robe', '#5c4a86', '#e0c070', 'wizard', 'staff', { skin: '#f6d2b3' }), 18],
    ['bruno', 'Bruno', 'D', 'guardião', 'Trio do Vento', 'wetland', L('man', 'short', '#4a2f22', 'armor', '#48526e', '#b8c7d9', 'helmet', 'sword', { skin: '#8a5634', beard: 'full' }), 15],
    ['tessa', 'Tessa, a Velha', 'B', 'necromante', '', 'desert', L('woman', 'long', '#e9e6df', 'robe', '#2f5f5a', '#9ad0b0', 'hood', 'book', { skin: '#d19a6f' }), 30],
    ['yara', 'Yara', 'A', 'caçadora', '', 'frontier', L('woman', 'ponytail', '#a8342c', 'coat', '#6b3f2a', '#c9a45c', 'feather', 'spear', { skin: '#b07650', cape: true }), 40],
    ['rui', 'Rui', 'E', 'ladino', '', 'forest', L('man', 'curly', '#2a1f1a', 'coat', '#48526e', '#d9a0a0', 'bandana', 'sword', { skin: '#5f3a24' }), 11],
    ['duda', 'Duda', 'F', 'novata', '', 'forest', L('woman', 'ponytail', '#c8843e', 'tunic', '#b07a3a', '#e8d8b0', 'none', 'sword'), 8],
    ['otavio', 'Otávio', 'E', 'lanceiro', '', 'forest', L('man', 'short', '#b8b2a8', 'armor', '#6b3f2a', '#e8d8b0', 'none', 'spear', { beard: 'mustache' }), 12]
  ].map(([id, name, rank, role, party, ground, look, dmg]) => ({ id: 'adv-' + id, name, rank, role, party, ground, look, dmg }));
  // Hunting grounds (the tile is nudged to the nearest free spot the first time).
  const GROUNDS = { forest: [170, 108], wetland: [186, 172], denseForest: [48, 128], desert: [128, 212], frontier: [330, 150] };
  const HAUL = { forest: 'presa-lobo', wetland: 'cinza-fagulha', denseForest: 'osso-ritual', desert: 'carapaca', frontier: 'orelha-goblin' };
  const hashN = (s, k) => { let h = 2166136261; for (const c of s + k) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
  const spots = new Map();
  function free(w, x, y) { for (let r = 0; r < 8; r++) for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * .785) * r, py = y + Math.sin(a * .785) * r; if (H.walkable(w, px, py) && !H.dungeonAt(px, py)) return { x: px, y: py }; } return { x, y }; }
  function place(w, key, x, y) { if (!spots.has(key)) spots.set(key, free(w, x, y)); return spots.get(key); }
  // Where each adventurer should be now, by the hour.
  function plan(w, a, i) {
    const hour = (H.hour(w) + hashN(a.id, 'h') * .8) % 24, g = H.guildSpot(), inn = H.innDoor(), tav = H.tavernDoor();
    const jitter = k => (hashN(a.id, k) - .5) * 3;
    if (hour < 6 || hour >= 22) return { state: 'sleep', ...place(w, 'inn', inn.x, inn.y), inside: true };
    if (hour < 8) return { state: 'read', ...place(w, 'g' + i, g.x + jitter('gx') * 1.6, g.y + 3.6 + Math.abs(jitter('gy')) * .6) };
    if (hour < 17) { const [gx, gy] = GROUNDS[a.ground]; return { state: 'hunt', ...place(w, 'hunt' + a.ground + i, gx + jitter('hx') * 2, gy + jitter('hy') * 2) }; }
    if (hour < 19) return { state: 'sell', ...place(w, 's' + i, g.x + jitter('sx') * 1.6, g.y + 3.4 + Math.abs(jitter('sy')) * .6) };
    return { state: 'social', ...place(w, 't' + i, tav.x + jitter('tx'), tav.y + 1 + jitter('ty') * .5) };
  }
  function ensure(w) { w.adventurers ||= {}; for (const a of ROSTER) w.adventurers[a.id] ||= { x: 125.5, y: 130.5, dir: 0, state: '', haul: 0, kills: 0, sold: 0, day: 0, cd: 0 }; return w.adventurers; }
  function tick(w, dt) {
    const all = ensure(w), players = Object.values(w.players).filter(p => p.online !== false && !p.dead);
    ROSTER.forEach((a, i) => {
      const s = all[a.id], goal = plan(w, a, i), near = players.some(p => Math.hypot(p.x - s.x, p.y - s.y) < 40 || Math.hypot(p.x - goal.x, p.y - goal.y) < 40);
      if (goal.state !== s.state) {
        // Arriving at the counter after the hunt: the haul is sold and the market feels it.
        if (s.state === 'hunt' && s.haul) { H.supply(w, HAUL[a.ground], s.haul); s.sold += s.haul; s.lastSale = { n: s.haul, id: HAUL[a.ground], day: w.day || 1 }; s.haul = 0; }
        s.state = goal.state; s.inside = !!goal.inside; if (!near) { s.x = goal.x; s.y = goal.y; }
      }
      s.idle = true; s.action = goal.state === 'hunt' ? 'guard' : goal.state === 'social' ? 'social' : goal.state === 'sleep' ? 'sleep' : 'read';
      if (!near) { if (goal.state === 'hunt' && w.time > (s.cd || 0)) { s.cd = w.time + 45; s.haul++; s.kills++; } return; }
      // Hunting: go for the nearest ordinary monster around the ground and strike it.
      let target = null;
      if (goal.state === 'hunt') { let bd = 7; for (const m of Object.values(w.monsters)) { const t = H.monsterTypes[m.kind]; if (m.hp <= 0 || t?.boss || t?.inert || m.lair || H.dungeonAt(m.x, m.y)) continue; const d = Math.hypot(m.x - s.x, m.y - s.y); if (d < bd && Math.hypot(m.x - goal.x, m.y - goal.y) < 12) { bd = d; target = m; } } }
      const tx = target ? target.x : goal.x, ty = target ? target.y + .8 : goal.y, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy), stop = target ? 1.1 : .2;
      if (d > stop) { const step = Math.min(d - stop, dt * (target ? 2.6 : 2.1)), nx = s.x + dx / d * step, ny = s.y + dy / d * step;
        if (H.walkable(w, nx, ny)) { s.x = nx; s.y = ny; } else if (H.walkable(w, nx, s.y)) s.x = nx; else if (H.walkable(w, s.x, ny)) s.y = ny;
        else { s.stuck = (s.stuck || 0) + dt; if (s.stuck > .6) { s.stuck = 0; for (let k = 1.5; k <= 5; k += .5) { let hop = null; for (const side of [0, 1, -1]) { const hx = s.x + dx / d * k - dy / d * side * 1.2, hy = s.y + dy / d * k + dx / d * side * 1.2; if (H.walkable(w, hx, hy)) { hop = [hx, hy]; break; } } if (hop) { [s.x, s.y] = hop; break; } } } }
        s.idle = false; s.dir = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 2 : 1 : dy > 0 ? 0 : 3; }
      else if (target && w.time >= (s.cd || 0)) {
        s.cd = w.time + 1.15; s.action = 'smith'; s.swingAt = w.time; target.hp -= a.dmg; target.hurtAt = w.time; H.event(w, 'hit', target.x, target.y, String(a.dmg), '#bfe0ff');
        if (target.hp <= 0) { target.hp = 0; target.diedAt = w.time; target.respawn = w.time + 70; s.kills++; s.haul += (target.maxHp || 0) > 100 ? 2 : 1; }
      }
      if (s.swingAt && w.time - s.swingAt < .35) s.action = 'smith';
    });
  }
  // What they say depends on the hour, their haul and what the town says about you.
  function talk(w, a, s, p) {
    const known = p?.ledger?.notable ? (p.ledger.titles?.length ? `Você é ${p.ledger.titles.at(-1).toLowerCase().startsWith('lenda') ? 'a' : 'o'} tal «${p.ledger.titles.at(-1)}», né? A Mirela não para de falar.` : `Ouvi falar de você na guilda. ${p.ledger.best ? 'Um ' + p.ledger.best.name + ' de ' + p.ledger.best.hp + ' de vida? Respeito.' : ''}`) : '';
    const party = a.party ? ` Sou da ${a.party}.` : '';
    const sale = s.lastSale && s.lastSale.day === (w.day || 1) ? ` Vendi ${s.lastSale.n} ${H.itemName(s.lastSale.id).toLowerCase()} hoje; o preço já caiu.` : '';
    const lines = {
      sleep: 'Zzz… (está dormindo na pousada)',
      read: `Bom dia. Estou vendo o mural antes de sair.${party} Rank ${a.rank}, ${a.role}.`,
      hunt: `Trabalhando. ${s.haul ? 'Já são ' + s.haul + ' peças na bolsa.' : 'Ainda nada hoje.'} Os monstros daqui valem pouco, mas pagam o jantar.`,
      sell: `Fila do balcão.${sale || ' Vou vender o que peguei.'} Dica: não venda tudo no mesmo dia, o preço cai.`,
      social: `Dia longo.${sale} ${s.kills} abates no total. ${known}`.trim()
    };
    return (lines[s.state] || 'Que as estradas sejam gentis.') + (s.state !== 'sleep' && s.state !== 'social' && known ? ' ' + known : '');
  }
  // As villagers for the renderer and for conversations (npcsAt).
  function list(w, p) { const all = ensure(w); return ROSTER.map(a => { const s = all[a.id]; return { id: a.id, name: a.name + ' · rank ' + a.rank, role: 'talk', adventurer: true, look: a.look, x: s.x, y: s.y, dir: s.dir, idle: s.idle, state: s.action || 'read', inside: s.inside && s.state === 'sleep', emotion: s.state === 'sleep' ? 'z' : s.state === 'hunt' ? '⚔' : '', greeting: false, speed: .8, path: [[s.x, s.y]], text: talk(w, a, s, p) }; }); }
  return { bind, ROSTER, GROUNDS, ensure, tick, list };
});
