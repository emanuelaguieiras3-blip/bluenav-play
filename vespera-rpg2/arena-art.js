'use strict';
// Arena das Três Coroas: pixel art of the MOBA mode. The map (meadow, jungle, stone lanes, the river
// with its bridge and fords, the bases and the guardian's island) is painted once per match into one
// canvas; trees, structures, troops, jungle creatures and heroes are small cached sprites drawn in
// depth order every frame. Allies are always blue and rivals red, as in the big mobile arenas.
window.ArenaArt = (() => {
  const T = 24, MW = 84, MH = 48, W = MW * T, H = MH * T;
  const cache = new Map();
  const people = () => window.WorldPeople, core = () => window.ArenaCore;
  function surface(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function hash(x, y, s = 0) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 982451653); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function css(v) { return `rgb(${v[0] | 0},${v[1] | 0},${v[2] | 0})`; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function shade(c, k) { return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]; }
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function sprite(key, w, h, paint) { let c = cache.get(key); if (!c) { c = surface(w, h); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; paint(g, c); cache.set(key, c); } return c; }
  function disc(g, cx, cy, rx, ry, color) { g.fillStyle = color; for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  function dots(g, cx, cy, r, color, n, turn = 0, size = 1) { g.fillStyle = color; for (let i = 0; i < n; i++) { const a = turn + i / n * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), size, size); } }
  // One-pixel dark outline around everything already drawn on a sprite (reads its alpha once).
  function outline(g, w, h, color = [30, 26, 34]) { const img = g.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 40) continue; const near = (x > 0 && d[i - 1] > 40) || (x < w - 1 && d[i + 7] > 40) || (y > 0 && d[i - w * 4 + 3] > 40) || (y < h - 1 && d[i + w * 4 + 3] > 40); if (near) { out[i] = color[0]; out[i + 1] = color[1]; out[i + 2] = color[2]; out[i + 3] = 255; } } img.data.set(out); g.putImageData(img, 0, 0); }

  // Relation palettes: 0 = my team (blue), 1 = rivals (red).
  const SIDE = [
    { main: '#49b6e8', dark: '#1d5f8a', deep: '#10324d', light: '#c4f1ff', bar: '#3fa9ff', glow: [90, 200, 255], rgb: [73, 182, 232] },
    { main: '#ee5f50', dark: '#96302a', deep: '#4f1614', light: '#ffd4c8', bar: '#ff4a3d', glow: [255, 110, 80], rgb: [238, 95, 80] }];
  const GOLD = { main: '#f0bf4c', dark: '#8a5f1c', light: '#fff1bd', bar: '#f2c14e' }, ME_BAR = '#5fe36a';

  // ---------- Heroes: dressed by the villager painter, plus class weapons drawn on top ----------
  const LOOKS = {
    guardiao: { skin: '#d9a577', hairColor: '#6b4a2e', body: 'man', outfit: 'armor', hat: 'helmet', cape: true, main: '#5f89a8', accent: '#d9e2e8', item: 'spear', beard: 'full' },
    guerreiro: { skin: '#eec39a', hairColor: '#3a2a20', body: 'man', outfit: 'armor', hat: 'none', hair: 'spiky', main: '#b8643c', accent: '#e8c46a', item: 'sword' },
    arqueiro: { skin: '#f3d2b0', hairColor: '#c9772e', body: 'woman', outfit: 'coat', hat: 'feather', hair: 'ponytail', main: '#5f9a4a', accent: '#e8d49a', item: 'none', cape: true },
    mago: { skin: '#eec39a', hairColor: '#e8e2d0', body: 'woman', outfit: 'robe', hat: 'wizard', hair: 'long', main: '#6d4fb0', accent: '#f0c95a', item: 'staff' },
    ladino: { skin: '#d9a577', hairColor: '#20182a', body: 'woman', outfit: 'coat', hat: 'hood', hair: 'short', main: '#4a3a6a', accent: '#b07ad8', item: 'none' },
    clerigo: { skin: '#b27a50', hairColor: '#ece6d6', body: 'man', outfit: 'robe', hat: 'none', hair: 'short', main: '#efe2b8', accent: '#e0b24a', item: 'bell', beard: 'full' },
    druida: { skin: '#8a5a3a', hairColor: '#7a4a2a', body: 'woman', outfit: 'dress', hat: 'none', hair: 'braids', main: '#3f8f6a', accent: '#b7e07a', item: 'staff' },
    berserker: { skin: '#eec39a', hairColor: '#c9772e', body: 'man', outfit: 'coat', hat: 'none', hair: 'bald', main: '#a8433a', accent: '#6b4a2e', item: 'none', beard: 'full' },
    paladino: { skin: '#f3d2b0', hairColor: '#e0b060', body: 'woman', outfit: 'armor', hat: 'tiara', hair: 'bun', main: '#c9a94a', accent: '#fff1b0', item: 'sword', cape: true },
    necromante: { skin: '#d8d0c8', hairColor: '#cfd8d0', body: 'man', outfit: 'robe', hat: 'hood', hair: 'long', main: '#2f3a3f', accent: '#7fe0c0', item: 'staff' },
    bardo: { skin: '#b27a50', hairColor: '#5a3020', body: 'woman', outfit: 'noble', hat: 'feather', hair: 'curly', main: '#b86a4a', accent: '#f0d890', item: 'lute' },
    artifice: { skin: '#d9a577', hairColor: '#4a3020', body: 'man', outfit: 'apron', hat: 'cap', hair: 'short', main: '#8a7a5a', accent: '#6fb8c8', item: 'none', beard: 'goatee' }};
  // Skill glyphs shown on buttons, per kind of skill.
  const GLYPH = { line: '➶', cone: '◠', dash: '»', stun: '✶', heal: '✚', shield: '⛨', area: '✺' };
  const fallbackArt = surface(1, 1);
  function heroArt(id, dir, frame, blink) { const P = people(); if (!P) return fallbackArt; const art = P.sprite(LOOKS[id] || LOOKS.guerreiro, dir, frame, blink, 'walk'); return art || fallbackArt; }
  // Class weapons the villager painter does not have: bow, daggers, axe, crossbow, shields.
  function weapon(g, id, dir, x, y, swing) {
    const s = dir === 1 ? -1 : 1, side = dir === 1 || dir === 2, hx = side ? x + 6 * s : dir === 3 ? x - 10 : x + 10, hy = y - 25 - swing * 3;
    if (id === 'arqueiro') { const bx = side ? x + 9 * s : hx; for (let i = -10; i <= 10; i++) { const off = Math.round((1 - (i / 10) ** 2) * 4) * s * (side ? 1 : 0) + (side ? 0 : Math.round((1 - (i / 10) ** 2) * 3)); R(g, bx + off, hy + i - 4, 2, 1, i < -7 || i > 7 ? '#d9b36a' : '#7a4a24'); } R(g, bx, hy - 14, 1, 20, '#efe6cf'); }
    else if (id === 'ladino') { for (const k of side ? [s] : [-1, 1]) { const dx = side ? x + 7 * s : x + 10 * k; R(g, dx, hy - 6, 1, 7, '#e3e9ef'); R(g, dx + (k > 0 ? 1 : -1), hy - 5, 1, 5, '#9aa6b0'); R(g, dx - 1, hy + 1, 3, 1, '#b07ad8'); R(g, dx, hy + 2, 1, 2, '#3a2a40'); } }
    else if (id === 'berserker') { const ax = side ? x + 5 * s : hx; R(g, ax, hy - 22, 2, 26, '#6b4a2e'); R(g, ax, hy - 22, 1, 26, '#8a6440'); const bx = ax + (side ? 2 * s : 2); for (let i = 0; i < 9; i++) { const w = 4 + Math.round(Math.sin(i / 8 * Math.PI) * 3); R(g, side && s < 0 ? bx - w : bx, hy - 24 + i, w, 1, i === 0 || i === 8 ? '#5a6168' : '#b9c2c9'); } R(g, side && s < 0 ? bx - 7 : bx + 6, hy - 21, 1, 3, '#e8eef2'); }
    else if (id === 'artifice') { const cx = side ? x + 4 * s : hx - 3; R(g, side && s < 0 ? cx - 11 : cx, hy - 1, 11, 3, '#6b4a2e'); R(g, side && s < 0 ? cx - 11 : cx, hy - 1, 11, 1, '#9a7048'); const tip = side && s < 0 ? cx - 11 : cx + 10; R(g, tip, hy - 6, 1, 13, '#6fb8c8'); R(g, tip, hy - 6, 1, 2, '#c8f0f8'); R(g, side && s < 0 ? cx - 13 : cx + 3, hy, 9, 1, '#e8d49a'); }
    else if (id === 'guardiao' || id === 'paladino') {
      const kite = id === 'guardiao', sx = side ? x + 7 * s : dir === 3 ? x + 9 : x - 12, sy = y - 36;
      if (kite) { for (let i = 0; i < 18; i++) { const w = i < 11 ? 6 : Math.max(1, 6 - (i - 10)); R(g, sx - w, sy + i, w * 2, 1, i === 0 ? '#2a2f36' : '#5f89a8'); R(g, sx - w, sy + i, 1, 1, '#2a2f36'); R(g, sx + w - 1, sy + i, 1, 1, '#2a2f36'); } R(g, sx - 5, sy + 1, 10, 1, '#d9e2e8'); R(g, sx - 1, sy + 3, 2, 11, '#d9e2e8'); R(g, sx - 4, sy + 6, 8, 2, '#d9e2e8'); }
      else { disc(g, sx, sy + 9, 6, 6, '#6a5420'); disc(g, sx, sy + 9, 5, 5, '#c9a94a'); disc(g, sx, sy + 9, 2, 2, '#fff1b0'); dots(g, sx, sy + 9, 3.6, '#fff1b0', 8); }
    }
  }

  // ---------- Map geometry ----------
  const RIVER = [[33, -2], [36.4, 7], [39.6, 13.6], [42, 18], [42, 22], [41.6, 24.6], [42.6, 30], [45.6, 37.5], [49.6, 50]];
  const PIT = { x: 42, y: 18, r: 2.4 }, BASES = [[6, 41, 0], [78, 7, 1]];
  const riverHalf = y => 1.7 + 1.9 * Math.exp(-(((y - PIT.y) / 3.1) ** 2));
  function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
  function riverDist(x, y) { let d = 1e9; for (let i = 0; i < RIVER.length - 1; i++) { const p = RIVER[i], q = RIVER[i + 1]; d = Math.min(d, segDist(x, y, p[0], p[1], q[0], q[1])); } return d; }
  function laneSegs(size) { const out = []; for (const [name, pts] of Object.entries(core().lanes)) { if (size === 3 && name !== 'mid') continue; for (let i = 0; i < pts.length - 1; i++) out.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], name]); } return out; }
  function laneDist(segs, x, y) { let d = 1e9, name = ''; for (const s of segs) { const v = segDist(x, y, s[0], s[1], s[2], s[3]); if (v < d) { d = v; name = s[4]; } } return [d, name]; }

  // ---------- Map painting ----------
  const MEADOW = [[88, 152, 76], [80, 142, 70], [97, 163, 83], [74, 134, 66]], JUNGLE = [[50, 102, 60], [45, 94, 56], [57, 112, 64], [41, 86, 52]];
  const STONE = [[192, 176, 138], [178, 160, 124], [205, 189, 151], [168, 150, 116]], MORTAR = [124, 106, 80], DIRT = [146, 122, 86];
  const DEEP = [33, 88, 126], MIDW = [43, 115, 155], SHAL = [70, 150, 178], FOAM = [196, 236, 238], SAND = [214, 194, 144], WET = [174, 158, 114];
  const MID = [36 / 39.81, -17 / 39.81];
  // Colour tables built once, so painting two million pixels allocates nothing per pixel.
  const q8 = v => Math.max(0, Math.min(7, (v * 8) | 0));
  const GRASS = Array.from({ length: 17 }, (_, q) => MEADOW.map((m, i) => { const c = mix(m, JUNGLE[i], q / 16); return [c, shade(c, 1.16), shade(c, .84)]; }));
  function grass(px, py, j) { const b = hash(px >> 2, py >> 2, 11), f = hash(px, py, 12), t = GRASS[Math.round(j * 16)][b < .3 ? 0 : b < .55 ? 1 : b < .8 ? 2 : 3]; return f > .985 ? t[1] : f < .018 ? t[2] : t[0]; }
  const cobbleSets = new Map();
  function cobbleSet(k, tint) { const key = k + (tint ? 't' : ''); let set = cobbleSets.get(key); if (!set) { const f = c => { const v = shade(c, k); return tint ? mix(v, tint, .35) : v; }; set = { mortar: f(MORTAR), stones: STONE.map(c => { const b = f(c); return [b, shade(b, 1.08), shade(b, .9)]; }) }; cobbleSets.set(key, set); } return set; }
  function cobble(px, py, k = 1, tint = null) { const set = cobbleSet(k, tint), row = (py / 5) | 0, off = (row & 1) * 3, x = (px + off) % 6, y = py % 5; if (x === 0 || y === 0) return set.mortar; const st = set.stones[(hash(((px + off) / 6) | 0, row, 21) * 4) | 0]; return y === 1 && x < 4 ? st[1] : y === 4 || x === 5 ? st[2] : st[0]; }
  const FLAG = [0, 1].map(side => Array.from({ length: 8 }, (_, l) => { const b = mix([178, 182, 186], SIDE[side].rgb, .14 + l / 8 * .1); return [b, shade(b, .64), shade(b, 1.08), shade(b, .86), shade(b, .93)]; }));
  function flag(px, py, side) { const row = (py / 12) | 0, off = (row & 1) * 6, x = (px + off) % 12, y = py % 12, t = FLAG[side][q8(hash(((px + off) / 12) | 0, row, 31))]; if (x === 0 || y === 0) return t[1]; if (y === 1 || x === 1) return t[2]; if (y === 11 || x === 11) return t[3]; return hash(px, py, 32) < .05 ? t[4] : t[0]; }
  const WATER = [DEEP, MIDW, SHAL].map(c => [c, mix(c, SHAL, .55), mix(c, FOAM, .6)]), FORD = WATER[2].map(c => mix(c, SAND, .18));
  function water(px, py, t, ford) { if (t > .94 && !ford) return FOAM; const set = ford ? FORD : WATER[t < .42 ? 0 : t < .74 ? 1 : 2]; if (hash(px, py, 43) > .992) return set[2]; if (((px + py * 3) >> 2) % 9 === 0 && hash(px >> 3, py >> 1, 42) > .72) return set[1]; return set[0]; }
  const PLANK = [[156, 108, 64], [142, 98, 58], [168, 120, 72]].map(c => [c, shade(c, 1.1), shade(c, .82)]), RAIL = [88, 58, 36], GAP = [86, 58, 36];
  function planks(px, py, dl) { if (dl > 1.18) return RAIL; const u = px * MID[0] + py * MID[1], m = ((u % 6) + 6) % 6, p = PLANK[(hash(Math.floor(u / 6), 3, 51) * 3) | 0]; if (m < 1) return GAP; if (dl > 1.02) return p[2]; return m < 2 ? p[1] : p[0]; }
  const BANK = Array.from({ length: 8 }, (_, l) => mix(SAND, WET, l / 8 * .35)), EDGE_DIRT = Array.from({ length: 8 }, (_, l) => mix(DIRT, [120, 100, 72], l / 8 * .5)), CAMP = Array.from({ length: 8 }, (_, l) => mix([140, 114, 78], [122, 98, 66], l / 8)), GROOVE = [70, 84, 86];
  const RIVER_SEGS = RIVER.slice(0, -1).map((p, i) => [p[0], p[1], RIVER[i + 1][0], RIVER[i + 1][1]]);

  let baked = null;
  function* bakeJob(a, myTeam) {
    // The map depends only on the format and which side is mine: it is reused across matches.
    const key = a.size + '|' + myTeam; if (baked && baked.key === key) return;
    const segs = laneSegs(a.size), c = surface(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const bases = BASES.map(([x, y, team]) => ({ x, y, side: team === myTeam ? 0 : 1 })), pads = a.units.filter(u => u.kind === 'tower').map(u => ({ x: u.x, y: u.y })), camps = core().camps;
    const tiles = new Array(MW * MH), within = (list, x, y, r, f) => list.filter(o => f(o, x, y) < r), pd = (o, x, y) => Math.hypot(x - o.x, y - o.y), sd = (s, x, y) => segDist(x, y, s[0], s[1], s[2], s[3]);
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const x = tx + .5, y = ty + .5, [dl] = laneDist(segs, x, y), dr = riverDist(x, y) - riverHalf(y), db = Math.min(...bases.map(b => pd(b, x, y))), dp = Math.hypot(x - PIT.x, y - PIT.y), dc = Math.min(...camps.map(k => pd(k, x, y))), dt = pads.length ? Math.min(...pads.map(k => pd(k, x, y))) : 99;
      const edge = Math.min(tx, ty, MW - 1 - tx, MH - 1 - ty);
      tiles[ty * MW + tx] = { dl, dr, db, dp, dc, dt, edge, near: dl < 2.6 || dr < 2.2 || db < 6.8 || dp < 4 || dc < 3.4 || dt < 2.4, j: edge < 2 ? 1 : Math.max(0, Math.min(1, (dl - 2.4) / 4.5)) * Math.max(0, Math.min(1, (db - 6) / 4)),
        segs: within(segs, x, y, 3.4, sd), riv: within(RIVER_SEGS, x, y, 5.8, sd), bases: within(bases, x, y, 6.6, pd), pads: within(pads, x, y, 2.6, pd), camps: within(camps, x, y, 3.3, pd), pit: dp < 3.6 };
    }
    const put = (px, py, col, k) => { const i = (py * W + px) * 4; d[i] = col[0] * k; d[i + 1] = col[1] * k; d[i + 2] = col[2] * k; d[i + 3] = 255; };
    for (let ty = 0; ty < MH; ty++) { for (let tx = 0; tx < MW; tx++) {
      const tile = tiles[ty * MW + tx], x0 = tx * T, y0 = ty * T;
      if (!tile.near) { const k = tile.edge < 2 ? .78 + tile.edge * .08 : 1; for (let py = y0; py < y0 + T; py++) for (let px = x0; px < x0 + T; px++) put(px, py, grass(px, py, tile.j), k); continue; }
      // Distances once per 2 × 2 block, against the features that can reach this tile only.
      for (let by = 0; by < T; by += 2) for (let bx = 0; bx < T; bx += 2) {
        const x = (x0 + bx + 1) / T, y = (y0 + by + 1) / T;
        let dl = 1e9, lane = ''; for (const s of tile.segs) { const v = segDist(x, y, s[0], s[1], s[2], s[3]); if (v < dl) { dl = v; lane = s[4]; } }
        let dr = 1e9; for (const s of tile.riv) { const v = segDist(x, y, s[0], s[1], s[2], s[3]); if (v < dr) dr = v; }
        let db = 1e9, side = 0; for (const b of tile.bases) { const v = Math.hypot(x - b.x, y - b.y); if (v < db) { db = v; side = b.side; } }
        let dc = 1e9; for (const k of tile.camps) dc = Math.min(dc, Math.hypot(x - k.x, y - k.y)); let dt = 1e9; for (const k of tile.pads) dt = Math.min(dt, Math.hypot(x - k.x, y - k.y));
        const dp = tile.pit ? Math.hypot(x - PIT.x, y - PIT.y) : 1e9, half = riverHalf(y), bridge = lane === 'mid' && dl < 1.42;
        for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) { const px = x0 + bx + ox, py = y0 + by + oy, n = hash(px >> 1, py >> 1, 5); let col;
          if (db < 5.3) col = flag(px, py, side);
          else if (db < 5.8) col = cobble(px, py, .72);
          else if (dp < PIT.r) col = dp > 1.72 && dp < 1.98 ? GROOVE : cobble(px, py, .86, [120, 150, 146]);
          else if (dp < PIT.r + .32) col = cobble(px, py, .62);
          else if (dr < half) col = bridge ? planks(px, py, dl) : dl < 1.3 ? water(px, py, .9, true) : water(px, py, dr / half, false);
          else if (dr < half + .6) col = bridge ? planks(px, py, dl) : dl < 1.24 ? cobble(px, py, .95) : dr < half + .22 ? WET : BANK[q8(n)];
          else if (dt < 1.45) col = cobble(px, py, 1.05);
          else if (dt < 1.65) col = cobble(px, py, .7);
          else if (dl < 1.22 + (n - .5) * .22) col = cobble(px, py);
          else if (dl < 1.58 + n * .2) col = hash(px, py, 7) < (1.6 - dl) / .36 ? EDGE_DIRT[q8(hash(px, py, 8))] : grass(px, py, 0);
          else if (dc < 2.1 + (n - .5) * .5) col = CAMP[q8(hash(px >> 1, py >> 1, 9))];
          else col = grass(px, py, tile.j);
          put(px, py, col, 1); }
      }
    } yield (ty + 1) / MH * .85; }
    g.putImageData(img, 0, 0);
    // Details: tufts, flowers, pebbles, reeds, lily pads, stepping stones, base rings, runes, camps.
    const sparkles = [], trees = [], bushes = [], rocks = [];
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const t = tiles[ty * MW + tx], ox = tx * T, oy = ty * T;
      const open = t.dl > 1.9 && t.dr > .9 && t.db > 6.2 && t.dp > 3.2 && t.dc > 2.6 && t.dt > 2;
      if (open) for (let k = 0; k < 3; k++) { const h = hash(tx, ty, 100 + k), x = ox + Math.floor(hash(tx, ty, 110 + k) * 20), y = oy + Math.floor(hash(tx, ty, 120 + k) * 20); const dark = css(shade(mix(MEADOW[1], JUNGLE[1], t.j), .72)), light = css(shade(mix(MEADOW[2], JUNGLE[2], t.j), 1.18));
        if (h < .38) { R(g, x, y + 1, 1, 3, dark); R(g, x + 2, y, 1, 4, dark); R(g, x + 4, y + 2, 1, 2, dark); R(g, x + 2, y, 1, 1, light); }
        else if (h < .43 && t.j < .7) { const petal = ['#f4e9c8', '#f3c94f', '#e98fb0', '#b9a4f0'][Math.floor(hash(tx, ty, 130 + k) * 4)]; R(g, x, y + 1, 3, 1, petal); R(g, x + 1, y, 1, 3, petal); R(g, x + 1, y + 1, 1, 1, '#f7d765'); R(g, x + 1, y + 3, 1, 2, dark); } }
      if (t.dl > 1.05 && t.dl < 1.9 && t.dr > .7 && t.db > 5.9 && hash(tx, ty, 140) < .35) { const x = ox + hash(tx, ty, 141) * 20, y = oy + hash(tx, ty, 142) * 20; R(g, x, y, 3, 2, '#8d8a80'); R(g, x, y, 2, 1, '#b8b4a8'); R(g, x, y + 2, 3, 1, '#5e5a52'); }
      if (t.dr > -.2 && t.dr < .7 && t.dl > 1.6 && t.dp > 3 && hash(tx, ty, 150) < .45) { const x = ox + hash(tx, ty, 151) * 18, y = oy + hash(tx, ty, 152) * 14; for (let k = 0; k < 3; k++) { const hgt = 5 + Math.floor(hash(tx, ty, 153 + k) * 4); R(g, x + k * 2, y + 8 - hgt, 1, hgt, '#3e6f3a'); R(g, x + k * 2, y + 8 - hgt, 1, 2, '#8a5a32'); } }
      if (t.dr < -.8 && t.dl > 2.2 && t.dp > 3.6 && hash(tx, ty, 160) < .12) { const x = ox + 4 + hash(tx, ty, 161) * 14, y = oy + 4 + hash(tx, ty, 162) * 14; disc(g, x, y, 4, 2, '#2f6a3a'); disc(g, x, y - 1, 3, 1, '#4f9a52'); R(g, x + 1, y - 2, 2, 2, '#3a7a44'); if (hash(tx, ty, 163) < .4) { R(g, x - 1, y - 2, 2, 2, '#f2a8c4'); R(g, x - 1, y - 2, 1, 1, '#fff'); } }
      if (t.dr < 0 && t.dl < 1.35 && hash(tx, ty, 170) < .9) for (let k = 0; k < 2; k++) { const x = ox + 4 + hash(tx, ty, 171 + k) * 14, y = oy + 4 + hash(tx, ty, 173 + k) * 14; disc(g, x, y + 1, 4, 2, '#5a6660'); disc(g, x, y, 4, 2, '#a4aaa4'); R(g, x - 2, y - 1, 3, 1, '#d4d8d2'); }
      if (t.dr < -.3 && hash(tx, ty, 180) < .5) for (let k = 0; k < 3; k++) sparkles.push({ x: ox + hash(tx, ty, 181 + k) * T, y: oy + hash(tx, ty, 184 + k) * T, p: hash(tx, ty, 187 + k) });
    }
    for (const b of bases) { const cx = b.x * T, cy = b.y * T, S = SIDE[b.side]; dots(g, cx, cy, 3.3 * T, S.dark, 64, 0, 2); dots(g, cx, cy, 2.2 * T, S.main, 36, .1, 2);
      for (const ang of [.5, 2.1, 3.7, 5.3]) { const x = cx + Math.cos(ang) * 4.6 * T, y = cy + Math.sin(ang) * 4.6 * T; R(g, x - 4, y - 18, 9, 20, '#3a3840'); R(g, x - 3, y - 17, 7, 18, '#a9a7ad'); R(g, x - 3, y - 17, 2, 18, '#c8c6cc'); R(g, x - 5, y - 20, 11, 3, '#3a3840'); R(g, x - 4, y - 19, 9, 1, '#d8d6dc'); R(g, x + 3, y - 16, 6, 10, S.dark); R(g, x + 3, y - 16, 5, 9, S.main); R(g, x + 4, y - 14, 3, 3, '#f3d98a'); } }
    { const cx = PIT.x * T, cy = PIT.y * T; for (let k = 0; k < 10; k++) { const ang = k / 10 * Math.PI * 2, x = Math.round(cx + Math.cos(ang) * 1.85 * T), y = Math.round(cy + Math.sin(ang) * 1.85 * T); R(g, x - 1, y - 1, 3, 3, '#5f8f90'); R(g, x, y - 1, 1, 3, '#8fd0cc'); } }
    for (const k of camps) { const cx = k.x * T, cy = k.y * T;
      if (k.buff === 'fonte') { disc(g, cx, cy + 6, 22, 10, '#5a5448'); disc(g, cx, cy + 5, 20, 9, '#2f7aa0'); disc(g, cx, cy + 4, 16, 6, '#4f9fc0'); R(g, cx - 10, cy + 2, 8, 1, '#c8f0f6'); R(g, cx + 4, cy + 7, 6, 1, '#9fdcea'); }
      else for (let s = 0; s < 5; s++) { const x = cx - 22 + s * 11 + hash(s, 1, 190) * 4, y = cy + 10 + hash(s, 2, 190) * 8; R(g, x, y - 6, 4, 7, '#c9822e'); R(g, x + 1, y - 9, 2, 4, '#f3c05a'); R(g, x + 1, y - 8, 1, 2, '#fff2c0'); R(g, x - 1, y, 6, 2, '#6a5638'); } }
    // Objects drawn in depth order with units: trees in the jungle and the forest wall, bushes, rocks.
    yield .92;
    const S = 2.4;
    for (let gy = 0; gy < MH / S; gy++) for (let gx = 0; gx < MW / S; gx++) {
      const x = (gx + .2 + hash(gx, gy, 200) * .6) * S, y = (gy + .2 + hash(gx, gy, 201) * .6) * S; if (x < .5 || y < 1 || x > MW - .5 || y > MH - .2) continue;
      const tile = tiles[Math.min(MH - 1, y | 0) * MW + Math.min(MW - 1, x | 0)], wall = tile.edge < 2;
      const [dl] = laneDist(segs, x, y), dr = riverDist(x, y) - riverHalf(y), db = Math.min(...bases.map(b => Math.hypot(x - b.x, y - b.y))), dp = Math.hypot(x - PIT.x, y - PIT.y), dc = Math.min(...camps.map(k => Math.hypot(x - k.x, y - k.y))), dt = pads.length ? Math.min(...pads.map(k => Math.hypot(x - k.x, y - k.y))) : 99;
      const free = dl > 3.1 && dr > 2.2 && db > 7.5 && dp > 4.6 && dc > 3.6 && dt > 3.2;
      if (wall || free && hash(gx, gy, 202) < .82) trees.push({ x, y, v: hash(gx, gy, 203) < .05 ? 3 : hash(gx, gy, 204) < .3 ? 2 : hash(gx, gy, 205) < .5 ? 1 : 0 });
      else if (dl > 2 && dr > 1.2 && db > 6.5 && dp > 3.4 && dc > 2.8 && dt > 2.4 && hash(gx, gy, 206) < .35) (hash(gx, gy, 207) < .7 ? bushes : rocks).push({ x, y, v: Math.floor(hash(gx, gy, 208) * 2) });
    }
    trees.sort((p, q) => p.y - q.y);
    const mini = surface(MW * 2, MH * 2), mg = mini.getContext('2d'); mg.imageSmoothingEnabled = true; mg.drawImage(c, 0, 0, MW * 2, MH * 2); mg.fillStyle = 'rgba(20,50,30,.55)'; for (const t of trees) mg.fillRect(Math.round(t.x * 2) - 1, Math.round(t.y * 2) - 2, 3, 3);
    baked = { key, canvas: c, sparkles, trees, bushes, rocks, mini, bases };
  }
  function bake(a, myTeam) { for (const _ of bakeJob(a, myTeam)); return baked; }
  // Paints the map in slices of ~12 ms so the loading screen keeps animating on slow phones.
  function prepare(a, myTeam, progress) { return new Promise(done => { const job = bakeJob(a, myTeam), step = () => { const t0 = performance.now(); let r; do { r = job.next(); if (!r.done) progress?.(r.value); } while (!r.done && performance.now() - t0 < 12); if (r.done) { progress?.(1); done(); } else setTimeout(step, 0); }; step(); }); }


  // ---------- Object sprites ----------
  const LEAF = [[[26, 70, 42], [40, 98, 54], [60, 128, 64], [104, 170, 86]], [[24, 62, 46], [34, 86, 58], [50, 112, 70], [86, 150, 94]], [[26, 64, 40], [38, 88, 46], [58, 116, 56], [98, 160, 80]], [[96, 46, 72], [156, 78, 116], [212, 122, 156], [248, 196, 212]]];
  function treeSprite(v) { return sprite('tree' + v, 64, 84, g => {
    const pal = LEAF[v], trunk = (x, y, w, h) => { R(g, x, y, w, h, '#4a3222'); R(g, x + 1, y, 2, h, '#6b4a30'); R(g, x + w - 2, y + 2, 1, h - 3, '#3a2618'); };
    trunk(28, 58, 9, 22); R(g, 24, 78, 17, 3, '#3a2618'); R(g, 23, 79, 5, 2, '#4a3222'); R(g, 37, 79, 5, 2, '#4a3222');
    const px = (x, y, light) => { const k = light > .52 ? 3 : light > .16 ? 2 : light > -.28 ? 1 : 0; g.fillStyle = css(pal[k]); g.fillRect(x, y, 1, 1); };
    if (v === 2) { for (let tier = 0; tier < 4; tier++) { const top = 4 + tier * 13, hgt = 22, half = 9 + tier * 5; for (let y = 0; y < hgt; y++) { const w = Math.round(half * (y + 2) / hgt); for (let x = -w; x <= w; x++) px(32 + x, top + y, -x / half * .8 - y / hgt * .3 + .25 + (hash(x, y + tier * 30, 7) - .5) * .4 - (y > hgt - 4 ? .5 : 0)); } } }
    else { const blobs = [[22, 40, 15, 13], [42, 40, 15, 13], [32, 27, 19, 16], [32, 48, 18, 10], [20, 30, 9, 8]]; for (const [bx, by, rx, ry] of blobs) for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const q = (x / rx) ** 2 + (y / ry) ** 2; if (q > 1) continue; px(bx + x, by + y, (-x / rx - y / ry) * .45 + (1 - q) * .3 + (hash(bx + x, by + y, v + 1) - .5) * .42 - (by > 45 ? .25 : 0)); }
      if (v === 3) for (let k = 0; k < 14; k++) { const x = 14 + Math.floor(hash(k, 1, 9) * 36), y = 14 + Math.floor(hash(k, 2, 9) * 36); R(g, x, y, 2, 2, '#fff0f4'); } else for (let k = 0; k < 6; k++) { const x = 16 + Math.floor(hash(k, 3, v) * 30), y = 18 + Math.floor(hash(k, 4, v) * 24); R(g, x, y, 2, 1, css(pal[3])); } }
    outline(g, 64, 84);
  }); }
  function bushSprite(v) { return sprite('bush' + v, 34, 22, g => { const pal = LEAF[v ? 1 : 0]; for (const [bx, by, rx, ry] of [[10, 13, 9, 7], [23, 13, 9, 7], [16, 9, 9, 7]]) for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const q = (x / rx) ** 2 + (y / ry) ** 2; if (q > 1) continue; const l = (-x / rx - y / ry) * .45 + (1 - q) * .3 + (hash(bx + x, by + y, 3) - .5) * .4; g.fillStyle = css(pal[l > .5 ? 3 : l > .12 ? 2 : l > -.3 ? 1 : 0]); g.fillRect(bx + x, by + y, 1, 1); } if (v) for (const [x, y] of [[8, 8], [20, 6], [25, 12]]) { R(g, x, y, 2, 2, '#f08aa8'); R(g, x, y, 1, 1, '#ffe0ea'); } outline(g, 34, 22); }); }
  function rockSprite(v) { return sprite('rock' + v, 22, 16, g => { disc(g, 11, 9, 9, 6, '#6d6a66'); disc(g, 10, 8, 8, 5, '#9a968e'); disc(g, 8, 6, 4, 2, '#c4c0b6'); R(g, 13, 10, 5, 2, '#5a5652'); if (v) { R(g, 4, 9, 4, 2, '#5f8a4a'); R(g, 15, 5, 3, 2, '#5f8a4a'); } outline(g, 22, 16); }); }
  function towerSprite(side) { return sprite('tower' + side, 48, 96, g => { const S = SIDE[side];
    disc(g, 24, 88, 20, 6, '#2c2a2e'); disc(g, 24, 87, 19, 5, '#77757a'); disc(g, 24, 86, 18, 4, '#8f8d92'); R(g, 8, 84, 32, 1, '#aeacb0');
    for (let y = 22; y < 86; y++) { const hw = 11 + Math.round((y - 22) / 64 * 3); for (let x = -hw; x <= hw; x++) { const row = Math.floor((y - 22) / 5), bx = Math.floor((x + hw + (row & 1) * 3) / 6), mortar = (y - 22) % 5 === 0 || (x + hw + (row & 1) * 3) % 6 === 0; let c = x < -hw / 3 ? [160, 158, 164] : x > hw / 3 ? [104, 102, 110] : [136, 134, 142]; c = shade(c, .94 + hash(bx, row, 61) * .12); if (mortar) c = shade(c, .8); if (x === -hw || x === hw) c = [40, 38, 46]; g.fillStyle = css(c); g.fillRect(24 + x, y, 1, 1); } }
    R(g, 7, 15, 34, 8, '#2a2830'); R(g, 8, 16, 32, 6, '#a4a2a8'); R(g, 8, 16, 32, 1, '#cfcdd2'); R(g, 8, 21, 32, 1, '#6e6c74');
    for (let i = 0; i < 5; i++) { R(g, 7 + i * 7, 9, 6, 7, '#2a2830'); R(g, 8 + i * 7, 10, 4, 6, '#b8b6bc'); R(g, 8 + i * 7, 10, 4, 1, '#dcdae0'); }
    R(g, 16, 28, 16, 24, S.deep); R(g, 17, 28, 14, 22, S.main); R(g, 17, 28, 14, 2, S.light); R(g, 17, 50, 5, 3, S.main); R(g, 26, 50, 5, 3, S.main); R(g, 17, 50, 1, 3, S.deep); R(g, 30, 50, 1, 3, S.deep);
    R(g, 21, 38, 6, 4, '#f3d98a'); R(g, 21, 35, 1, 3, '#f3d98a'); R(g, 23, 34, 2, 4, '#f3d98a'); R(g, 26, 35, 1, 3, '#f3d98a'); R(g, 21, 41, 6, 1, '#b8913a');
    R(g, 22, 58, 4, 9, '#1c1a20'); R(g, 23, 59, 2, 7, S.light); R(g, 18, 73, 12, 13, '#241810'); R(g, 19, 74, 10, 12, '#5a3b24'); R(g, 23, 74, 1, 12, '#3a2618'); R(g, 26, 79, 1, 2, '#e0c070');
  }); }
  function rubbleSprite() { return sprite('rubble', 52, 30, g => { disc(g, 26, 20, 23, 8, '#3a383e'); for (let k = 0; k < 16; k++) { const x = 6 + hash(k, 1, 70) * 38, y = 10 + hash(k, 2, 70) * 14, w = 4 + hash(k, 3, 70) * 6; R(g, x, y, w, 4, '#77757c'); R(g, x, y, w, 1, '#a6a4aa'); R(g, x, y + 3, w, 1, '#4e4c54'); } R(g, 20, 6, 3, 10, '#8f8d94'); R(g, 28, 9, 3, 7, '#8f8d94'); R(g, 20, 6, 1, 10, '#b8b6bc'); outline(g, 52, 30); }); }
  function pedestalSprite(side) { return sprite('pedestal' + side, 100, 52, g => { const S = SIDE[side];
    disc(g, 50, 40, 46, 11, '#2c2a30'); disc(g, 50, 39, 45, 10, '#8a8890'); disc(g, 50, 37, 45, 8, '#a6a4ac');
    disc(g, 50, 30, 34, 9, '#2c2a30'); disc(g, 50, 29, 33, 8, '#8f8d95'); disc(g, 50, 27, 33, 6, '#b4b2ba');
    disc(g, 50, 20, 22, 7, '#2c2a30'); disc(g, 50, 19, 21, 6, S.dark); disc(g, 50, 18, 20, 5, S.main); disc(g, 50, 17, 14, 3, S.light);
    for (let k = 0; k < 12; k++) { const ang = k / 12 * Math.PI * 2, x = 50 + Math.cos(ang) * 39, y = 34 + Math.sin(ang) * 7; R(g, x - 1, y - 1, 3, 2, '#f3d98a'); }
  }); }
  function minionSprite(side, ranged, frame) { return sprite(`min${side}${ranged ? 1 : 0}${frame}`, 22, 28, g => { const S = SIDE[side], O = '#1e1a22', st = frame ? 1 : 0;
    R(g, 8, 20, 3, 5 + st, O); R(g, 12, 20, 3, 6 - st, O); R(g, 9, 20, 1, 4 + st, '#5a4a3a'); R(g, 13, 20, 1, 5 - st, '#5a4a3a');
    if (!ranged) { R(g, 6, 11, 11, 10, O); R(g, 7, 12, 9, 8, S.main); R(g, 7, 12, 9, 2, S.light); R(g, 7, 18, 9, 2, S.dark); R(g, 11, 12, 1, 8, S.dark);
      R(g, 7, 3, 9, 9, O); R(g, 8, 5, 7, 6, '#e9c49a'); R(g, 7, 2, 9, 5, O); R(g, 8, 3, 7, 3, '#a9b0b8'); R(g, 8, 3, 7, 1, '#d8dde2'); R(g, 11, 0, 2, 3, S.main); R(g, 10, 7, 1, 2, O); R(g, 13, 7, 1, 2, O);
      disc(g, 5, 16, 3, 4, O); disc(g, 5, 16, 2, 3, S.main); R(g, 5, 16, 1, 1, '#f3d98a'); R(g, 18, 8, 1, 10, '#e3e9ef'); R(g, 19, 9, 1, 8, '#9aa6b0'); R(g, 16, 17, 5, 1, '#b08a4a'); R(g, 18, 18, 1, 2, '#6b4a2e'); }
    else { R(g, 6, 10, 11, 12, O); R(g, 7, 11, 9, 11, S.dark); R(g, 8, 11, 7, 10, S.main); R(g, 8, 11, 7, 1, S.light); R(g, 7, 2, 9, 9, O); R(g, 8, 3, 7, 7, S.dark); R(g, 9, 5, 5, 5, '#e9c49a'); R(g, 9, 5, 5, 1, S.deep); R(g, 10, 7, 1, 1, O); R(g, 12, 7, 1, 1, O);
      R(g, 18, 5, 1, 18, '#6b4a2e'); R(g, 17, 1, 3, 4, O); R(g, 17, 2, 3, 2, S.light); R(g, 18, 2, 1, 1, '#ffffff'); }
  }); }
  function lizardSprite(frame) { return sprite('lizard' + frame, 44, 30, g => { const b = frame ? 1 : 0;
    for (let i = 0; i < 12; i++) R(g, 2 + i, 20 - Math.round(i / 4) + (i < 3 ? 1 : 0), 2, Math.max(1, Math.round(i / 3)), '#a8601e');
    disc(g, 22, 19 - b, 12, 6, '#8a4a16'); disc(g, 22, 18 - b, 11, 5, '#d98a34'); disc(g, 22, 21 - b, 8, 2, '#f0c078');
    for (let k = 0; k < 4; k++) { const x = 15 + k * 5; R(g, x, 10 - b - (k % 2), 3, 4, '#f3c05a'); R(g, x + 1, 8 - b - (k % 2), 1, 3, '#fff0b0'); }
    disc(g, 36, 16 - b, 6, 4, '#d98a34'); R(g, 38, 14 - b, 2, 2, '#1e1a22'); R(g, 38, 14 - b, 1, 1, '#ffe070'); R(g, 40, 18 - b, 3, 1, '#8a4a16');
    for (const x of [14, 19, 26, 31]) R(g, x, 23 - b, 3, 4 + b, '#8a4a16');
    outline(g, 44, 30);
  }); }
  function spiritSprite(frame) { return sprite('spirit' + frame, 30, 38, g => { const b = frame ? 1 : 0;
    for (let y = 4; y < 30; y++) { const t = (y - 4) / 26, w = Math.round(t < .7 ? Math.sin(t / .7 * Math.PI / 2) * 9 : 9 - (t - .7) / .3 * 5); if (w <= 0) continue; R(g, 15 - w, y, w * 2, 1, y < 10 ? '#bff2ff' : '#6fcbea'); R(g, 15 - w, y, 2, 1, '#e8fbff'); }
    for (let k = 0; k < 3; k++) R(g, 9 + k * 5 + b, 30, 2, 4 + (k + b) % 2 * 2, '#6fcbea');
    disc(g, 15, 18, 4, 4, '#e8fbff'); R(g, 12, 16, 2, 3, '#1c3a4a'); R(g, 17, 16, 2, 3, '#1c3a4a'); R(g, 12, 16, 1, 1, '#ffffff'); R(g, 17, 16, 1, 1, '#ffffff');
    outline(g, 30, 38, [20, 60, 80]);
  }); }
  function guardianSprite(frame) { return sprite('guardian' + frame, 84, 66, g => { const b = frame ? 1 : 0;
    for (const x of [18, 30, 52, 62]) { R(g, x, 46, 8, 10 + b, '#4e5a52'); R(g, x + 1, 46, 3, 10 + b, '#6e7c72'); }
    disc(g, 70, 38 - b, 10, 8, '#5a6a5e'); disc(g, 71, 37 - b, 8, 6, '#7a8c7e'); R(g, 72, 34 - b, 3, 3, '#1e1a22'); R(g, 73, 35 - b, 2, 2, '#9ff4ee');
    disc(g, 40, 36, 30, 18, '#3a463e'); disc(g, 40, 35, 29, 17, '#6b7a6e'); disc(g, 36, 31, 22, 12, '#86968a');
    for (let k = 0; k < 7; k++) { const x = 16 + k * 8, y = 30 + (k % 2) * 8; R(g, x, y, 7, 1, '#4a564e'); R(g, x, y, 1, 7, '#4a564e'); }
    for (let k = 0; k < 9; k++) { const x = 14 + hash(k, 1, 80) * 50, y = 22 + hash(k, 2, 80) * 18; R(g, x, y, 4, 2, '#5f8a4a'); R(g, x + 1, y - 1, 2, 1, '#7faa5a'); }
    outline(g, 84, 66);
  }); }

  // ---------- Pixel digits for damage, heals and level badges ----------
  const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111', '+': '000010111010000', '-': '000000111000000' };
  function digits(text, color, scale = 1) { return sprite('num' + text + color + scale, (String(text).length * 4 + 1) * scale + 2, 7 * scale, g => { const s = String(text); for (const pass of [0, 1]) for (let i = 0; i < s.length; i++) { const f = FONT[s[i]]; if (!f) continue; for (let k = 0; k < 15; k++) if (f[k] === '1') { const x = 1 + i * 4 * scale + (k % 3) * scale, y = 1 + Math.floor(k / 3) * scale; if (pass === 0) { g.fillStyle = '#1a1420'; g.fillRect(x - 1, y - 1, scale + 2, scale + 2); } else { g.fillStyle = color; g.fillRect(x, y, scale, scale); } } } }); }
  function label(text, color) { return sprite('lbl' + text + color, Math.ceil(text.length * 5.2) + 6, 11, g => { g.font = 'bold 8px monospace'; g.textBaseline = 'top'; g.fillStyle = '#1a1420'; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(text, 3 + dx, 1 + dy); g.fillStyle = color; g.fillText(text, 3, 1); }); }
  // White silhouette of a sprite, for hit flashes.
  const flashes = new WeakMap();
  function flashOf(art) { let f = flashes.get(art); if (!f) { f = surface(art.width, art.height); const g = f.getContext('2d'); g.drawImage(art, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, f.width, f.height); flashes.set(art, f); } return f; }

  // ---------- Display state: smoothed positions, walk cycles, facing, hits and deaths ----------
  const state = new Map(); let fx = [], parts = [], lastEvent = 0, arenaId = '', shake = 0;
  function reset() { state.clear(); fx = []; parts = []; lastEvent = 0; shake = 0; }
  function stateOf(u) { let s = state.get(u.id); if (!s) { s = { x: u.x, y: u.y, phase: 0, moving: false, dir: 0, lastHp: u.hp, hitAt: -9, deadAt: u.hp > 0 ? null : -9, attackAt: -9, ax: 0, ay: 0, seen: 0 }; state.set(u.id, s); } return s; }
  function update(a, clock, dt, meId, mePos) {
    const k = 1 - Math.exp(-dt * 15);
    for (const u of a.units) { const s = stateOf(u); s.seen = clock; let tx = u.x, ty = u.y; if (u.id === meId && mePos) { tx = mePos.x; ty = mePos.y; }
      const dist = Math.hypot(tx - s.x, ty - s.y), px = s.x, py = s.y; if (dist > 4 || u.hp <= 0) { s.x = tx; s.y = ty; } else if (u.id === meId && mePos) { s.x = tx; s.y = ty; } else { s.x += (tx - s.x) * k; s.y += (ty - s.y) * k; }
      const mx = s.x - px, my = s.y - py, moved = Math.hypot(mx, my); s.moving = moved > .0015 || !!u.moving && dist > .02; if (s.moving) { s.phase = (s.phase + Math.max(moved, .03) * 2.6) % 6; if (moved > .004) { s.vx = mx; s.vy = my; } }
      const fxv = s.moving && s.vx !== undefined ? s.vx : u.aim?.x ?? (u.team === 1 ? -1 : 1), fyv = s.moving && s.vy !== undefined ? s.vy : u.aim?.y ?? 0; s.dir = Math.abs(fxv) > Math.abs(fyv) * .9 ? (fxv < 0 ? 1 : 2) : fyv < 0 ? 3 : 0;
      if (u.hp < s.lastHp - .5 && u.hp > 0) s.hitAt = clock;
      if (u.hp <= 0 && s.lastHp > 0) { s.deadAt = clock; death(u, s, clock); } if (u.hp > 0 && s.deadAt !== null) { s.deadAt = null; if (u.kind === 'hero') burst(s.x, s.y, '#bff2ff', 14, clock, 1.2); }
      s.lastHp = u.hp; }
    if (state.size > 400) for (const [id, s] of state) if (clock - s.seen > 3) state.delete(id);
  }
  function burst(x, y, color, n, clock, speed = 1, up = 0) { for (let i = 0; i < n; i++) { const ang = Math.random() * Math.PI * 2, v = (.6 + Math.random()) * speed; parts.push({ x, y, z: 8 + Math.random() * 10, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * .6, vz: 20 + Math.random() * 30 + up, t0: clock, life: .45 + Math.random() * .4, color, size: Math.random() < .3 ? 2 : 1 }); } }
  function death(u, s, clock) {
    if (u.kind === 'hero') { burst(s.x, s.y, '#e8e0ff', 18, clock, 1.4, 20); fx.push({ k: 'ghost', x: s.x, y: s.y, t0: clock, life: 1.3, hero: u.hero }); }
    else if (u.kind === 'tower' || u.kind === 'base') { for (let i = 0; i < 3; i++) burst(s.x + (Math.random() - .5), s.y, '#8f8d94', 16, clock + i * .08, 2.2, 30); burst(s.x, s.y, '#f3d98a', 12, clock, 1.6, 50); shake = Math.max(shake, 7); fx.push({ k: 'dust', x: s.x, y: s.y, t0: clock, life: 1.4 }); }
    else burst(s.x, s.y, u.kind === 'creep' ? '#f3c05a' : '#d8d0c0', 8, clock, .9);
  }
  function ingest(a, meId, clock) {
    if (a.id !== arenaId) { reset(); arenaId = a.id; lastEvent = Math.max(0, ...a.events.map(e => e.id)); return; }
    const byId = new Map(a.units.map(u => [u.id, u])), me = byId.get(meId);
    for (const e of a.events) { if (e.id <= lastEvent) continue; lastEvent = Math.max(lastEvent, e.id);
      const from = e.from && byId.get(e.from), sideOf = u => !u || !me ? 0 : u.team === 2 ? 2 : u.team === me.team ? 0 : 1;
      if (e.type === 'shot') { const st = from && state.get(from.id); if (st) { st.attackAt = clock; st.ax = e.tx - e.x; st.ay = e.ty - e.y; } const far = Math.hypot(e.tx - e.x, e.ty - e.y) > 2.6 || e.kind === 'tower' || e.kind === 'base';
        fx.push(far ? { k: 'bolt', x: e.x, y: e.y, to: e.to, tx: e.tx, ty: e.ty, t0: clock, life: e.kind === 'tower' || e.kind === 'base' ? .3 : .2, side: sideOf(from), big: e.kind === 'tower' || e.kind === 'base', hero: from?.hero } : { k: 'slash', x: e.tx, y: e.ty, t0: clock, life: .2, side: sideOf(from), ax: e.tx - e.x, ay: e.ty - e.y }); }
      else if (e.type === 'hit') { const mine = e.from === meId, onMe = e.to === meId; parts.push({ x: e.x, y: e.y, z: 18, vx: 0, vy: 0, vz: 0, t0: clock, life: .12, color: '#ffffff', size: 3 }); if (mine || onMe) fx.push({ k: 'num', x: e.x + (Math.random() - .5) * .6, y: e.y, t0: clock, life: .8, text: String(Math.round(e.power)), color: onMe ? '#ff6a5a' : e.power >= 150 ? '#ffd45a' : '#ffffff', scale: e.power >= 150 ? 2 : 1 }); if (onMe && e.power > 60) shake = Math.max(shake, 3); }
      else if (e.type === 'heal') { if (!me || Math.hypot(e.x - me.x, e.y - me.y) < 12) fx.push({ k: 'num', x: e.x, y: e.y, t0: clock, life: .9, text: '+' + Math.round(e.power), color: '#7cf08a', scale: 1 }); for (let i = 0; i < 6; i++) parts.push({ x: e.x + (Math.random() - .5), y: e.y + (Math.random() - .5) * .4, z: 4, vx: 0, vy: 0, vz: 30 + Math.random() * 20, t0: clock + i * .05, life: .7, color: '#8cf5a0', size: 2, plus: true }); }
      else if (e.type === 'skill') { const f = { k: 'skill', kind: e.kind, x: e.x, y: e.y, fx: e.fx ?? e.x, fy: e.fy ?? e.y, dx: e.dx ?? 1, dy: e.dy ?? 0, range: e.range || 5, radius: e.radius || 2, t0: clock, life: e.slot === 3 ? .9 : .55, color: (e.hero && core().byId[e.hero]?.color) || '#f9e4a0', ult: e.slot === 3, side: sideOf(from) }; fx.push(f);
        if (f.ult && me && Math.hypot(e.x - me.x, e.y - me.y) < 8) shake = Math.max(shake, 5); if (e.kind === 'dash' && from) { const st = state.get(from.id); if (st) { st.x = e.x; st.y = e.y; } } }
      else if (e.type === 'level') { fx.push({ k: 'level', to: e.to, x: e.x, y: e.y, t0: clock, life: 1.1, level: e.level, mine: e.to === meId }); }
      else if (e.type === 'buy' && e.to === meId) burst(e.x, e.y, '#f3d06a', 10, clock, .8, 30);
    }
  }

  // ---------- Frame ----------
  let camera = null, lastClock = 0;
  function render(g, a, opt) {
    const { width, height, meId, clock, quality = 'medio', aim = null, mePos = null, myTeam = 0 } = opt, dt = Math.min(.1, Math.max(0, clock - lastClock)); lastClock = clock;
    const map = bake(a, myTeam), P = people(); P?.frameBudget?.(quality === 'leve' ? 3 : 6, 0);
    ingest(a, meId, clock); update(a, clock, dt, meId, mePos);
    const me = a.units.find(u => u.id === meId), ms = me ? stateOf(me) : { x: 42, y: 24 };
    const lead = aim ? { x: (aim.x - ms.x) * T * .25, y: (aim.y - ms.y) * T * .25 } : { x: 0, y: 0 };
    const want = { x: ms.x * T + lead.x, y: ms.y * T - 18 + lead.y }; if (!camera || Math.hypot(want.x - camera.x, want.y - camera.y) > 12 * T) camera = { ...want }; else { const k = 1 - Math.exp(-dt * 10); camera.x += (want.x - camera.x) * k; camera.y += (want.y - camera.y) * k; }
    shake = Math.max(0, shake - dt * 22); const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake : 0;
    const ox = Math.round(Math.min(0, Math.max(width - W, width / 2 - camera.x)) + sx), oy = Math.round(Math.min(0, Math.max(height - H, height * .52 - camera.y)) + sy);
    const X = x => Math.round(x * T + ox), Y = y => Math.round(y * T + oy), left = -ox / T - 3, right = (width - ox) / T + 3, top = -oy / T - 1, bottom = (height - oy) / T + 5;
    const vis = (x, y) => x > left && x < right && y > top && y < bottom, side = u => u.team === 2 ? 2 : u.team === myTeam ? 0 : 1;
    g.imageSmoothingEnabled = false; g.fillStyle = '#233b2a'; g.fillRect(0, 0, width, height);
    g.drawImage(map.canvas, -ox, -oy, width, height, 0, 0, width, height);
    // Living ground: water glints, base healing rings, the guardian's runes.
    if (quality !== 'leve') for (const s of map.sparkles) { const x = s.x + ox, y = s.y + oy; if (x < -2 || y < -2 || x > width || y > height) continue; const ph = (clock * .8 + s.p) % 1; if (ph < .3) { g.globalAlpha = Math.sin(ph / .3 * Math.PI) * .8; R(g, x + ph * 10, y, 3, 1, '#e8fbff'); } }
    g.globalAlpha = 1;
    for (const b of map.bases) { const S = SIDE[b.side]; g.globalAlpha = .55; dots(g, X(b.x), Y(b.y), 4 * T, S.light, 48, clock * .4, 2); g.globalAlpha = 1; }
    const guardian = a.units.find(u => u.kind === 'objective' && u.hp > 0); if (guardian || a.time > 150) { g.globalAlpha = .4 + Math.sin(clock * 3) * .25; for (let k = 0; k < 10; k++) { const ang = k / 10 * Math.PI * 2; R(g, X(PIT.x) + Math.cos(ang) * 1.85 * T - 1, Y(PIT.y) + Math.sin(ang) * 1.85 * T - 1, 3, 3, '#aef8f2'); } g.globalAlpha = 1; }
    // Aim indicator (range circle, skill area or line) under everything else.
    if (aim && me && me.hp > 0) { const col = aim.cancel ? '#ff8a7a' : '#c8f6ff'; g.globalAlpha = .55; dots(g, X(ms.x), Y(ms.y), aim.range * T, col, Math.round(aim.range * 14), clock * .2, 2); g.globalAlpha = .35;
      if (aim.kind === 'line' || aim.kind === 'dash') { const dx = aim.x - ms.x, dy = aim.y - ms.y, len = Math.hypot(dx, dy) || 1, n = Math.round(len * 3); for (let i = 1; i <= n; i++) { const t = i / n; R(g, X(ms.x + dx * t) - 3, Y(ms.y + dy * t) - 3, 6, 6, col); } }
      else if (aim.kind === 'cone') { for (let r = 1; r < aim.range; r += .5) for (let k = -3; k <= 3; k++) { const base = Math.atan2(aim.y - ms.y, aim.x - ms.x), ang = base + k * .19; R(g, X(ms.x + Math.cos(ang) * r) - 1, Y(ms.y + Math.sin(ang) * r) - 1, 3, 3, col); } }
      else { disc(g, X(aim.x), Y(aim.y), aim.radius * T, aim.radius * T, col); }
      g.globalAlpha = 1; }
    // Depth-sorted scene.
    const list = [];
    for (const t of map.trees) if (vis(t.x, t.y)) list.push({ y: t.y, t: 'tree', o: t });
    for (const b of map.bushes) if (vis(b.x, b.y)) list.push({ y: b.y, t: 'bush', o: b });
    for (const r of map.rocks) if (vis(r.x, r.y)) list.push({ y: r.y, t: 'rock', o: r });
    for (const u of a.units) { const s = stateOf(u); if (!vis(s.x, s.y)) continue; if (u.hp <= 0 && (u.kind === 'minion' || u.kind === 'hero' || u.kind === 'objective' || u.kind === 'creep')) continue; list.push({ y: s.y, t: u.kind, o: u, s }); }
    list.sort((p, q) => p.y - q.y);
    const time = clock;
    for (const it of list) { const x = it.s ? X(it.s.x) : X(it.o.x), y = it.s ? Y(it.s.y) : Y(it.o.y);
      if (it.t === 'tree') { const art = treeSprite(it.o.v), hide = me && ms.y < it.o.y && ms.y > it.o.y - 3.2 && Math.abs(ms.x - it.o.x) < 1.4; if (hide) g.globalAlpha = .45; g.drawImage(art, x - 32, y - 80); g.globalAlpha = 1; }
      else if (it.t === 'bush') g.drawImage(bushSprite(it.o.v), x - 17, y - 16);
      else if (it.t === 'rock') g.drawImage(rockSprite(it.o.v), x - 11, y - 12);
      else if (it.t === 'tower') { const sd = side(it.o); if (it.o.hp <= 0) { g.drawImage(rubbleSprite(), x - 26, y - 22); continue; } g.globalAlpha = .35; disc(g, x, y + 2, 20, 6, '#10181a'); g.globalAlpha = 1; g.drawImage(towerSprite(sd), x - 24, y - 90); crystal(g, x, y - 82 + Math.round(Math.sin(time * 2 + it.o.x) * 2), 18, sd, time, false); if (it.s.hitAt > time - .1) { g.globalAlpha = .5; g.drawImage(flashOf(towerSprite(sd)), x - 24, y - 90); g.globalAlpha = 1; } }
      else if (it.t === 'base') { const sd = side(it.o); g.drawImage(pedestalSprite(sd), x - 50, y - 40); if (it.o.hp > 0) crystal(g, x, y - 26 + Math.round(Math.sin(time * 1.6) * 3), 54, sd, time, true); else { g.drawImage(rubbleSprite(), x - 26, y - 34); } }
      else if (it.t === 'minion') { const sd = side(it.o), fr = it.s.moving ? Math.floor(time * 7 + it.o.x) % 2 : 0, art = minionSprite(sd, it.o.ranged, fr), flip = it.s.dir === 1 || (it.s.dir !== 2 && (it.o.team === myTeam ? false : true)); g.globalAlpha = .3; disc(g, x, y, 6, 2, '#10181a'); g.globalAlpha = 1; const lunge = time - it.s.attackAt < .15 ? 2 : 0; g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.drawImage(art, -11 + lunge, -26); if (it.s.hitAt > time - .08) { g.globalAlpha = .7; g.drawImage(flashOf(art), -11 + lunge, -26); } g.restore(); }
      else if (it.t === 'creep') { const fr = Math.floor(time * 2.5 + it.o.x) % 2; g.globalAlpha = .3; disc(g, x, y, 12, 3, '#10181a'); g.globalAlpha = 1; if (it.o.buff === 'fonte') { const art = spiritSprite(fr), bob = Math.round(Math.sin(time * 2.4) * 2); g.globalAlpha = .88; g.drawImage(art, x - 15, y - 42 + bob); g.globalAlpha = 1; if (it.s.hitAt > time - .08) g.drawImage(flashOf(art), x - 15, y - 42 + bob); } else { const art = lizardSprite(fr), flip = it.s.dir === 1; g.save(); g.translate(x, y); if (flip) g.scale(-1, 1); g.drawImage(art, -22, -28); if (it.s.hitAt > time - .08) g.drawImage(flashOf(art), -22, -28); g.restore(); } }
      else if (it.t === 'objective') { const fr = Math.floor(time * 1.5) % 2, art = guardianSprite(fr); g.globalAlpha = .35; disc(g, x, y, 34, 8, '#10181a'); g.globalAlpha = 1; g.drawImage(art, x - 42, y - 60); g.globalAlpha = .5 + Math.sin(time * 3) * .3; for (let k = 0; k < 5; k++) R(g, x - 26 + k * 12, y - 34 + (k % 2) * 6, 4, 2, '#9ff4ee'); g.globalAlpha = 1; if (it.s.hitAt > time - .08) { g.globalAlpha = .6; g.drawImage(flashOf(art), x - 42, y - 60); g.globalAlpha = 1; } }
      else if (it.t === 'hero') hero(g, it.o, it.s, x, y, time, side(it.o), it.o.id === meId);
    }
    effects(g, a, X, Y, clock, dt, quality);
    // Bars and names above everything, as in the big arenas.
    for (const it of list) { if (!it.s) continue; const u = it.o, x = X(it.s.x), y = Y(it.s.y), sd = side(u); if (u.hp <= 0) continue;
      if (u.kind === 'hero') heroBar(g, u, x, y - 64, sd, u.id === meId);
      else if (u.kind === 'tower') bar(g, x - 20, y - 102, 40, 4, u.hp / u.maxHp, SIDE[sd].bar);
      else if (u.kind === 'base') bar(g, x - 30, y - 96, 60, 5, u.hp / u.maxHp, SIDE[sd].bar);
      else if (u.kind === 'minion' && u.hp < u.maxHp) bar(g, x - 8, y - 30, 16, 2, u.hp / u.maxHp, SIDE[sd].bar);
      else if ((u.kind === 'creep' || u.kind === 'objective') && (u.hp < u.maxHp || me && Math.hypot(u.x - ms.x, u.y - ms.y) < 6)) bar(g, x - 18, y - (u.kind === 'objective' ? 66 : 44), 36, 3, u.hp / u.maxHp, GOLD.bar); }
    for (const f of fx) if (f.k === 'num') { const age = clock - f.t0, t = age / f.life, art = digits(f.text, f.color, f.scale), pop = age < .08 ? 1 : 0; g.globalAlpha = Math.min(1, 2 - t * 2); g.drawImage(art, X(f.x) - art.width / 2, Y(f.y) - 40 - t * 22 - pop * 3); g.globalAlpha = 1; }
    // Screen feedback: low health pulse, grey world while waiting to return.
    if (me && me.hp > 0 && me.hp / me.maxHp < .3) { const grad = g.createRadialGradient(width / 2, height / 2, height * .35, width / 2, height / 2, width * .7); grad.addColorStop(0, 'rgba(160,20,20,0)'); grad.addColorStop(1, `rgba(170,20,20,${.28 + Math.sin(clock * 6) * .12})`); g.fillStyle = grad; g.fillRect(0, 0, width, height); }
    if (me && me.hp <= 0) { g.globalCompositeOperation = 'saturation'; g.fillStyle = 'hsl(0,0%,50%)'; g.fillRect(0, 0, width, height); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(10,14,24,.35)'; g.fillRect(0, 0, width, height); }
    return { ox, oy, T };
  }
  function crystal(g, x, y, h, sd, time, big) { const S = SIDE[sd], hw = Math.round(h * .3), glow = S.glow;
    g.save(); g.globalCompositeOperation = 'lighter'; const r = h * (big ? 1.2 : 1), grad = g.createRadialGradient(x, y - h * .55, 1, x, y - h * .55, r); grad.addColorStop(0, `rgba(${glow},${.45 + Math.sin(time * 3) * .1})`); grad.addColorStop(1, `rgba(${glow},0)`); g.fillStyle = grad; g.fillRect(x - r, y - h * .55 - r, r * 2, r * 2); g.restore();
    for (let i = 0; i < h; i++) { const t = i / h, w = Math.round((t < .6 ? t / .6 : (1 - t) / .4) * hw); if (w <= 0) continue; R(g, x - w, y - i, w, 1, S.light); R(g, x, y - i, w, 1, S.main); R(g, x - w, y - i, 1, 1, S.dark); R(g, x + w - 1, y - i, 1, 1, S.deep); }
    R(g, x - 2, y - h * .78, 1, h * .35, '#ffffff'); R(g, x - hw * .5, y - h * .6, 1, 1, '#ffffff');
    if (big) for (let k = 0; k < 3; k++) { const ang = time * 1.2 + k * 2.09, sx = x + Math.cos(ang) * (hw + 12), sy = y - h * .5 + Math.sin(ang) * 6; R(g, sx - 1, sy - 3, 3, 6, S.light); R(g, sx, sy - 3, 1, 6, '#ffffff'); } }
  function bar(g, x, y, w, h, frac, color, shield = 0) { x = Math.round(x); y = Math.round(y); R(g, x - 1, y - 1, w + 2, h + 2, '#141019'); R(g, x, y, w, h, '#3a2f3a'); R(g, x, y, Math.max(0, Math.round(w * Math.min(1, frac))), h, color); R(g, x, y, Math.round(w * Math.min(1, frac)), 1, 'rgba(255,255,255,.35)'); if (shield > 0) R(g, x + Math.round(w * Math.min(1, frac)), y, Math.round(w * Math.min(1 - Math.min(1, frac), shield)), h, '#f4f1e6'); }
  function heroBar(g, u, x, y, sd, mine) { const w = 36, col = mine ? ME_BAR : SIDE[sd].bar, shield = u.shieldUntil > 0 && u.shield ? u.shield / u.maxHp : 0;
    bar(g, x - w / 2 + 5, y, w, 4, u.hp / u.maxHp, col, shield); for (let k = 1; k * 250 < u.maxHp; k++) { const tx = Math.round(x - w / 2 + 5 + w * k * 250 / u.maxHp); if (tx < x + w / 2 + 5) R(g, tx, y, 1, 2, '#141019'); }
    if (mine && typeof u.mana === 'number') bar(g, x - w / 2 + 5, y + 5, w, 2, u.mana / 160, '#5aa8ff');
    R(g, x - w / 2 - 5, y - 2, 9, 9, '#141019'); R(g, x - w / 2 - 4, y - 1, 7, 7, mine ? '#2f7a3a' : SIDE[sd].dark); const lv = digits(u.level, '#fff6d8'); g.drawImage(lv, Math.round(x - w / 2 - .5 - lv.width / 2), y);
    const name = label(core().byId[u.hero]?.name || '', mine ? '#f6ffe8' : sd === 0 ? '#d6f2ff' : '#ffd6d0'); g.drawImage(name, Math.round(x - name.width / 2 + 3), y - 12); }
  function hero(g, u, s, x, y, time, sd, mine) {
    const S = SIDE[sd], frame = s.moving ? 1 + Math.floor(s.phase) : 0, blink = (time + u.id.length * .7) % 4.2 < .12, art = heroArt(u.hero, s.dir, frame, blink), foot = art.foot ?? 55, center = art.center ?? 16;
    const atk = time - s.attackAt, swing = atk < .22 ? Math.sin(atk / .22 * Math.PI) : 0, len = Math.hypot(s.ax, s.ay) || 1, lx = Math.round(s.ax / len * swing * 4), ly = Math.round(s.ay / len * swing * 2);
    g.globalAlpha = .35; disc(g, x, y + 1, 12, 4, '#0c1214'); g.globalAlpha = 1;
    g.globalAlpha = .9; dots(g, x, y + 1, 13, mine ? '#8cff96' : S.main, 30, time * (mine ? 1.2 : .6)); g.globalAlpha = 1;
    if (u.blessing?.ambar > 0) { g.globalAlpha = .6; for (let k = 0; k < 4; k++) { const ph = (time * 1.4 + k / 4) % 1; R(g, x - 10 + k * 6, y - ph * 18, 2, 3, ph < .5 ? '#ffd26a' : '#ff8a3a'); } g.globalAlpha = 1; }
    if (u.recall) { const left = Math.max(0, u.recall.ends - (window.GameSession?.world?.arena?.time ?? 0)); g.globalAlpha = .5; disc(g, x, y, 14, 5, S.light); g.globalAlpha = .25 + Math.sin(time * 8) * .1; R(g, x - 10, y - 70, 20, 70, S.light); g.globalAlpha = 1; dots(g, x, y, 16, '#ffffff', 24, time * 3); if (left >= 0) { const k = 1 - left / 4; R(g, x - 16, y + 8, 32, 3, '#141019'); R(g, x - 15, y + 9, Math.round(30 * k), 1, S.light); } }
    const back = s.dir === 3; if (back) weapon(g, u.hero, s.dir, x + lx, y + ly, swing);
    g.drawImage(art, x - center + lx, y - foot + ly);
    if (s.hitAt > time - .09) { g.globalAlpha = .75; g.drawImage(flashOf(art), x - center + lx, y - foot + ly); g.globalAlpha = 1; }
    if (!back) weapon(g, u.hero, s.dir, x + lx, y + ly, swing);
    if (u.shieldUntil > 0 && u.shield > 0) { g.globalAlpha = .28 + Math.sin(time * 5) * .08; disc(g, x, y - 26, 20, 30, '#fff6c8'); g.globalAlpha = .8; dots(g, x, y - 26, 21, '#ffffff', 18, time); g.globalAlpha = 1; }
    if (u.blessing?.fonte > 0) for (let k = 0; k < 3; k++) { const ang = time * 2 + k * 2.09; R(g, x + Math.cos(ang) * 14 - 1, y - 30 + Math.sin(ang) * 5 - 1, 3, 3, '#9fe8ff'); }
    if (u.stunUntil > 0 && u.stunUntil > (window.GameSession?.world?.arena?.time ?? 0)) for (let k = 0; k < 3; k++) { const ang = time * 6 + k * 2.09; R(g, x + Math.cos(ang) * 9 - 1, y - 66 + Math.sin(ang) * 3, 3, 3, '#ffe86a'); }
  }
  function effects(g, a, X, Y, clock, dt, quality) {
    const unit = id => a.units.find(u => u.id === id), pos = id => { const s = state.get(id); return s ? { x: s.x, y: s.y } : null; };
    fx = fx.filter(f => clock - f.t0 < f.life); if (parts.length > (quality === 'leve' ? 120 : 400)) parts.splice(0, parts.length - (quality === 'leve' ? 120 : 400));
    for (const f of fx) { const age = clock - f.t0, t = Math.min(1, age / f.life); if (age < 0) continue;
      if (f.k === 'bolt') { const target = f.to && pos(f.to) || { x: f.tx, y: f.ty }, x = f.x + (target.x - f.x) * t, y = f.y + (target.y - f.y) * t, S = f.side === 2 ? GOLD : SIDE[f.side], px = X(x), py = Y(y) - (f.big ? 50 * (1 - t) + 16 : 20);
        if (f.big) { g.globalAlpha = .5; disc(g, px, py, 5, 5, S.main); g.globalAlpha = 1; disc(g, px, py, 3, 3, S.light); R(g, px - 1, py - 1, 2, 2, '#ffffff'); if (t > .9) burst(target.x, target.y, S.light, 3, clock, .6); }
        else { const dx = target.x - f.x, dy = target.y - f.y, l = Math.hypot(dx, dy) || 1, arrow = f.hero === 'arqueiro' || f.hero === 'artifice'; for (let k = 0; k < (arrow ? 5 : 3); k++) R(g, px - dx / l * k * 2, py - dy / l * k * 2, 2, 2, arrow ? (k === 0 ? '#ffffff' : '#c9a46a') : k === 0 ? '#ffffff' : S.light); } }
      else if (f.k === 'slash') { const S = f.side === 2 ? GOLD : SIDE[f.side], base = Math.atan2(f.ay, f.ax), px = X(f.x), py = Y(f.y) - 22; g.globalAlpha = 1 - t; for (let k = -4; k <= 4; k++) { const ang = base + k * .22 + t * .8, r = 10 + Math.abs(k) * .4; R(g, px + Math.cos(ang) * r - 1, py + Math.sin(ang) * r * .7 - 1, 3, 2, k === 0 ? '#ffffff' : S.light); } g.globalAlpha = 1; }
      else if (f.k === 'skill') skillFx(g, f, t, X, Y, clock, unit);
      else if (f.k === 'ghost') { g.globalAlpha = (1 - t) * .7; const art = flashOf(heroArt(f.hero, 0, 0, true)); g.drawImage(art, X(f.x) - (art.width / 2), Y(f.y) - 58 - t * 30); g.globalAlpha = 1; }
      else if (f.k === 'dust') { g.globalAlpha = (1 - t) * .5; disc(g, X(f.x), Y(f.y) - 10 - t * 20, 30 + t * 30, 12 + t * 10, '#b8b0a0'); g.globalAlpha = 1; }
      else if (f.k === 'level') { const p = f.to && pos(f.to) || f, px = X(p.x), py = Y(p.y); g.globalAlpha = 1 - t; dots(g, px, py, 10 + t * 26, '#ffe27a', 36, t * 3, 2); if (f.mine) { const txt = label('NÍVEL ' + f.level, '#ffe27a'); g.drawImage(txt, px - txt.width / 2, py - 84 - t * 12); } g.globalAlpha = 1; } }
    parts = parts.filter(p => clock - p.t0 < p.life);
    for (const p of parts) { const age = clock - p.t0; if (age < 0) continue; const t = age / p.life, x = p.x + p.vx * age, y = p.y + p.vy * age, z = p.z + p.vz * age - 60 * age * age; g.globalAlpha = Math.min(1, (1 - t) * 1.6); if (p.plus) { R(g, X(x) - 1, Y(y) - z - 2, 2, 6, p.color); R(g, X(x) - 3, Y(y) - z, 6, 2, p.color); } else R(g, X(x), Y(y) - z, p.size, p.size, p.color); }
    g.globalAlpha = 1;
  }
  function skillFx(g, f, t, X, Y, clock, unit) {
    const col = f.color, S = SIDE[f.side === 2 ? 0 : f.side], cx = X(f.x), cy = Y(f.y), rr = f.radius * 24, big = f.ult;
    if (f.kind === 'line') { const len = f.range, head = t * 1.25, n = 10; for (let k = 0; k < n; k++) { const tt = head - k * .04; if (tt < 0 || tt > 1) continue; const x = f.fx + f.dx * len * tt, y = f.fy + f.dy * len * tt, s = k === 0 ? 5 : Math.max(1, 4 - k * .4); g.globalAlpha = 1 - k / n; R(g, X(x) - s / 2, Y(y) - 20 - s / 2, s, s, k < 2 ? '#ffffff' : col); } g.globalAlpha = 1; }
    else if (f.kind === 'cone') { const base = Math.atan2(f.dy, f.dx); g.globalAlpha = (1 - t) * .8; for (let r = 1; r < f.range; r += .45) for (let k = -5; k <= 5; k++) { if (hash(Math.round(r * 9), k + 9, 3) < .35) continue; const ang = base + k * .15 + t * .3, x = f.fx + Math.cos(ang) * r * (.4 + t * .6), y = f.fy + Math.sin(ang) * r * (.4 + t * .6); R(g, X(x) - 1, Y(y) - 12, 3, 2, k === 0 || r > f.range - 1 ? '#ffffff' : col); } g.globalAlpha = 1; }
    else if (f.kind === 'dash') { g.globalAlpha = (1 - t) * .7; const n = 8; for (let k = 0; k < n; k++) { const tt = k / n, x = f.fx + (f.x - f.fx) * tt, y = f.fy + (f.y - f.fy) * tt; disc(g, X(x), Y(y) - 20, 5, 9, col); } g.globalAlpha = 1; if (t < .2) burst(f.x, f.y, '#e8e0d0', 2, clock, .8); }
    else if (f.kind === 'stun') { g.globalAlpha = (1 - t); dots(g, cx, cy, rr * (.5 + t * .5), '#bff2ff', 28, t * 2, 2); dots(g, cx, cy, rr * (.3 + t * .3), col, 18, -t * 3, 2); for (let k = 0; k < 6; k++) { const ang = k / 6 * Math.PI * 2; R(g, cx + Math.cos(ang) * rr * .6 - 1, cy + Math.sin(ang) * rr * .6 - 10 * (1 - t) - 4, 3, 7, '#e8fbff'); } g.globalAlpha = 1; }
    else if (f.kind === 'area') { const grow = Math.min(1, t * 3); g.globalAlpha = .22 * (1 - t); disc(g, cx, cy, rr * grow, rr * grow, col); g.globalAlpha = 1 - t * .7; dots(g, cx, cy, rr * grow, '#ffffff', big ? 64 : 40, t * 2, 2); dots(g, cx, cy, rr * grow * .72, col, big ? 44 : 28, -t * 2, 2);
      const drops = big ? 14 : 8; for (let k = 0; k < drops; k++) { const ph = (t * 2 + hash(k, 1, 91)) % 1, ang = hash(k, 2, 91) * Math.PI * 2, r = Math.sqrt(hash(k, 3, 91)) * rr, x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r; R(g, x, y - (1 - ph) * 60, 2, 6, ph > .85 ? '#ffffff' : col); if (ph > .85) R(g, x - 2, y, 6, 2, '#ffffff'); } g.globalAlpha = 1; }
    else if (f.kind === 'heal') { g.globalAlpha = (1 - t) * .8; dots(g, cx, cy, rr * (.4 + t * .8), '#8cf5a0', 32, t, 2); g.globalAlpha = 1; if (t < .6 && Math.random() < .5) parts.push({ x: f.x + (Math.random() - .5) * f.radius * 1.5, y: f.y + (Math.random() - .5) * f.radius, z: 2, vx: 0, vy: 0, vz: 34, t0: clock, life: .6, color: '#8cf5a0', size: 2, plus: true }); }
    else if (f.kind === 'shield') { g.globalAlpha = (1 - t) * .9; for (let k = 0; k < 6; k++) { const ang = k / 6 * Math.PI * 2 + t, r = rr * (.4 + t * .6); R(g, cx + Math.cos(ang) * r - 3, cy + Math.sin(ang) * r - 18, 6, 6, '#fff3c0'); R(g, cx + Math.cos(ang) * r - 2, cy + Math.sin(ang) * r - 17, 4, 4, col); } dots(g, cx, cy, rr * (.5 + t * .5), '#fff3c0', 30, t, 2); g.globalAlpha = 1; }
    void S; void unit;
  }

  // ---------- Minimap and portraits ----------
  function minimap(c, a, meId, myTeam, view) { const g = c.getContext('2d'), k = c.width / MW; if (!baked) return; g.imageSmoothingEnabled = true; g.drawImage(baked.mini, 0, 0, c.width, c.height); g.imageSmoothingEnabled = false; g.fillStyle = 'rgba(8,16,20,.18)'; g.fillRect(0, 0, c.width, c.height);
    const side = u => u.team === 2 ? GOLD : u.team === myTeam ? SIDE[0] : SIDE[1];
    for (const u of a.units) { const x = Math.round(u.x * k), y = Math.round(u.y * k), S = side(u);
      if (u.kind === 'tower') { R(g, x - 3, y - 3, 7, 7, '#141019'); R(g, x - 2, y - 2, 5, 5, u.hp > 0 ? S.main : '#6a6670'); }
      else if (u.kind === 'base') { R(g, x - 4, y - 4, 9, 9, '#141019'); R(g, x - 3, y - 3, 7, 7, u.hp > 0 ? S.main : '#6a6670'); R(g, x - 1, y - 1, 3, 3, '#ffffff'); }
      else if (u.kind === 'minion' && u.hp > 0) R(g, x, y, 2, 2, S.light);
      else if ((u.kind === 'creep' || u.kind === 'objective') && u.hp > 0) { R(g, x - 2, y - 2, 5, 5, '#141019'); R(g, x - 1, y - 1, 3, 3, u.kind === 'objective' ? '#9ff4ee' : u.buff === 'fonte' ? '#7fd6ff' : '#f3b04a'); } }
    for (const u of a.units) if (u.kind === 'hero' && u.hp > 0) { const s = state.get(u.id) || u, x = Math.round(s.x * k), y = Math.round(s.y * k), me = u.id === meId; disc(g, x, y, 4, 4, me ? '#ffffff' : '#141019'); disc(g, x, y, 3, 3, me ? '#62e36b' : side(u).main); }
    if (a.ping && a.ping.until > a.time && a.ping.team === myTeam) { g.strokeStyle = '#ffe27a'; g.lineWidth = 1; g.strokeRect(Math.round(a.ping.x * k) - 4, Math.round(a.ping.y * k) - 4, 8, 8); }
    if (view) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; g.strokeRect(Math.round(-view.ox / T * k) + .5, Math.round(-view.oy / T * k) + .5, Math.round(view.w / T * k), Math.round(view.h / T * k)); } }
  // Bust (head and shoulders) of a hero for cards, kill feed and scoreboard.
  function portrait(c, id, opt = {}) { const P = people(); P?.frameBudget?.(99, 0); const art = heroArt(id, opt.dir ?? 0, opt.frame ?? 0, false); P?.frameBudget?.(3, 0); const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false; if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, c.width, c.height); }
    const foot = art.foot ?? 55, center = art.center ?? 16; if (opt.full) { const s = Math.max(1, Math.floor(Math.min(c.width / 34, c.height / 72))); g.drawImage(art, Math.round(c.width / 2 - center * s), Math.round(c.height - 2 - foot * s), art.width * s, art.height * s); if (opt.weapon !== false) { g.save(); g.translate(Math.round(c.width / 2), Math.round(c.height - 2)); g.scale(s, s); weapon(g, id, opt.dir ?? 0, 0, 0, 0); g.restore(); } return; }
    const top = Math.max(0, foot - 62), s = Math.max(1, Math.floor(c.width / 26)); g.drawImage(art, center - 13, top, 26, 30, Math.round(c.width / 2 - 13 * s), Math.round(c.height - 30 * s + 2), 26 * s, 30 * s); }
  // Paints every hero frame in slices, for the loading screen.
  function prewarmAsync(ids, progress) { return new Promise(done => { const jobs = []; for (const id of ids) for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 7; f++) jobs.push([id, dir, f]); let i = 0; const P = people(); const step = () => { const t0 = performance.now(); P?.frameBudget?.(999, 0); while (i < jobs.length && performance.now() - t0 < 12) { const [id, dir, f] = jobs[i++]; heroArt(id, dir, f, false); } P?.frameBudget?.(3, 0); progress?.(jobs.length ? i / jobs.length : 1); if (i < jobs.length) setTimeout(step, 0); else done(); }; step(); }); }
  function prewarm(ids) { const P = people(); if (!P) return; P.frameBudget?.(999, 0); for (const id of ids) for (let dir = 0; dir < 4; dir++) for (let f = 0; f < 7; f++) heroArt(id, dir, f, false); P.frameBudget?.(3, 0); }
  return { T, LOOKS, GLYPH, SIDE, render, minimap, portrait, prewarm, prewarmAsync, prepare, reset, heroArt, weapon, get baked() { return baked; } };
})();
