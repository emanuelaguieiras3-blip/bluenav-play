'use strict';
// Isekai pixel art for the world canvas: race features drawn over the hero sprite (ears, horns, tail,
// beard), tamed companions with their pact seal, titles above heads, the Appraisal scanner and the
// animated effects for level up, magic circles, pacts, evolution, rebirth and guild rank up.
// Everything is rects on whole pixels; text and heavy shapes are cached.
window.IsekaiArt = (() => {
  const V = window.Vespera, I = V.isekai;
  const R = (g, x, y, w, h, c) => { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const OWN = new Set(['level', 'circle', 'tame', 'evolve', 'rebirth', 'rankup', 'system']);
  const LIFE = { level: 2, circle: 1.1, tame: 1.9, evolve: 2.3, rebirth: 2.6, rankup: 2.2 };

  // ---------- Text stamps ----------
  const stamps = new Map();
  function label(g, text, x, y, color = '#ffe7a8', size = 6, bold = true, shadow = '#1a1420') {
    const k = text + '|' + color + '|' + size + bold; let s = stamps.get(k);
    if (!s) { if (stamps.size > 300) stamps.clear(); const font = (bold ? 'bold ' : '') + size + 'px monospace', m = document.createElement('canvas').getContext('2d'); m.font = font; const w = Math.ceil(m.measureText(text).width) + 4;
      s = document.createElement('canvas'); s.width = w; s.height = size + 6; const t = s.getContext('2d'); t.font = font; t.textBaseline = 'top'; t.fillStyle = shadow; t.fillText(text, 3, 3); t.fillStyle = color; t.fillText(text, 2, 2); stamps.set(k, s); }
    g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
  }

  // ---------- Head finder: where the hero's head is in each sprite frame (cached per canvas) ----------
  const heads = new WeakMap();
  function head(art) {
    let h = heads.get(art); if (h) return h;
    let d; try { d = art.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, art.width, art.height).data; } catch { h = { top: 4, cx: art.width / 2, half: 7, hair: '#a8342c', skin: '#eab893' }; heads.set(art, h); return h; }
    const W = art.width, A = (x, y) => d[(y * W + x) * 4 + 3] > 110; let top = 0;
    outer: for (let y = 0; y < art.height; y++) for (let x = 0; x < W; x++) if (A(x, y)) { top = y; break outer; }
    let sx = 0, n = 0; for (let y = top; y < top + 6; y++) for (let x = 0; x < W; x++) if (A(x, y)) { sx += x; n++; }
    const cx = n ? sx / n : W / 2, row = Math.min(art.height - 1, top + 10); let l = cx, r = cx; for (let x = 0; x < W; x++) if (A(x, row)) { l = Math.min(l, x); r = Math.max(r, x); }
    const px = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join(''); };
    h = { top, cx, half: Math.max(5, Math.min(10, (r - l) / 2)), hair: px(cx, top + 2), skin: px(cx, Math.min(art.height - 1, top + 13)) }; heads.set(art, h); return h;
  }
  const shade = (c, a) => { const n = parseInt(c.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, v + a)).toString(16).padStart(2, '0')).join(''); };

  // ---------- Race features, drawn in the sprite's own coordinates (after it is drawn) ----------
  function race(g, q, art, time) {
    const s = q.isekai; if (!s?.chosen || s.race === 'humano') return;
    const hd = head(art), ox = -art.width / 2, oy = -art.height + 4, top = oy + hd.top, cx = ox + hd.cx, dir = q.dir || 0, side = dir === 1 || dir === 2, flip = dir === 1 ? -1 : 1;
    const skin = /^#[0-9a-f]{6}$/.test(hd.skin) && hd.skin !== '#000000' ? hd.skin : '#eab893', hair = /^#[0-9a-f]{6}$/.test(hd.hair) && hd.hair !== '#000000' ? hd.hair : '#a8342c';
    if (s.race === 'elfo') {
      const ear = (x, sgn) => { const o = '#5a3024'; R(g, x, top + 10, 2 * sgn, 3, o); R(g, x + sgn * 2, top + 8, 2 * sgn, 3, o); R(g, x + sgn * 4, top + 6, 2 * sgn, 2, o); R(g, x + sgn * 5, top + 4, 1 * sgn, 2, o);
        R(g, x, top + 10, 2 * sgn, 2, skin); R(g, x + sgn * 2, top + 8, 2 * sgn, 2, skin); R(g, x + sgn * 4, top + 6, 1 * sgn, 2, skin); R(g, x + sgn, top + 11, sgn, 1, shade(skin, -30)); };
      const L = cx - hd.half, Rr = cx + hd.half;
      if (side) ear(dir === 2 ? cx - 2 : cx + 2, dir === 2 ? -1 : 1); else { ear(L, -1); ear(Rr, 1); }
      if ((time * 1.3) % 6 < .12) R(g, cx - 1, top - 3, 2, 2, '#fff6d0');
    }
    if (s.race === 'fera') {
      const twitch = (time * 2.2 + q.x) % 5 < .15 ? 1 : 0, inner = '#f2c3a8';
      const ear = (x, t) => { R(g, x - 3, top + 1, 7, 3, hair); R(g, x - 2, top - 2 - t, 5, 3, hair); R(g, x - 1, top - 5 - t, 3, 3, hair); R(g, x, top - 7 - t, 1, 2, hair); R(g, x - 1, top - 2 - t, 3, 3, inner); R(g, x - 3, top + 3, 7, 1, shade(hair, -30)); };
      if (side) ear(cx - flip * 2, twitch); else { ear(cx - 5, twitch); ear(cx + 5, 0); }
      // Tail sways behind the hero; from the front it peeks out at the side.
      const sway = Math.sin(time * 5 + q.x) * 3, wy = oy + art.height * .6, bx = dir === 3 ? cx : side ? cx - flip * 7 : cx + 7;
      for (let i = 0; i < 6; i++) { const t = i / 5, tx = bx + (dir === 3 ? sway * t : (side ? -flip : 1) * (i * 1.6) + sway * t * .6), ty = wy - i * 1.4 + (dir === 3 ? i * .2 : 0), w = i < 4 ? 4 : 3; R(g, tx - w / 2, ty, w, 3, i === 5 ? '#f4efe6' : i > 3 ? shade(hair, 20) : hair); }
    }
    if (s.race === 'anao') {
      if (q.appearance === 'male') { if (dir !== 3) { const bw = side ? 6 : 10, bx = side ? cx + flip * 1 - bw / 2 : cx - bw / 2; R(g, bx, top + 14, bw, 7, '#9c4a24'); R(g, bx + 1, top + 21, bw - 2, 3, '#7e3a1c'); R(g, bx + bw / 2 - 1, top + 24, 2, 3, '#9c4a24'); R(g, bx + 1, top + 15, 2, 4, '#c26a38'); R(g, bx + bw / 2 - 1, top + 26, 2, 1, '#e8c14a'); } }
      else for (const sg of side ? [-flip] : [-1, 1]) { const bx = cx + sg * (hd.half + 1); R(g, bx - 1, top + 9, 3, 12, hair); R(g, bx - 1, top + 12, 3, 1, shade(hair, -35)); R(g, bx - 1, top + 16, 3, 1, shade(hair, -35)); R(g, bx - 1, top + 21, 3, 2, '#e8c14a'); }
    }
    if (s.race === 'demonio') {
      const horn = (x, sgn) => { R(g, x, top + 1, 3, 3, '#2b2130'); R(g, x + sgn, top - 2, 3, 3, '#2b2130'); R(g, x + sgn * 3, top - 4, 2, 3, '#2b2130'); R(g, x + sgn * 4, top - 6, 2, 2, '#3a2c40'); R(g, x + (sgn > 0 ? 1 : 1), top, 1, 3, '#6d5a78'); R(g, x + sgn * 3 + 1, top - 4, 1, 2, '#8b7898'); };
      if (side) horn(cx - flip * 1, -flip); else { horn(cx - 6, -1); horn(cx + 4, 1); }
      const sway = Math.sin(time * 3.3 + q.x) * 2.5, wy = oy + art.height * .6, bx = dir === 3 ? cx : side ? cx - flip * 6 : cx + 6;
      for (let i = 0; i < 7; i++) R(g, bx + (dir === 3 ? 0 : (side ? -flip : 1) * i * 1.3) + sway * i / 6, wy - i * 1.1, 2, 2, '#2b2130');
      const tx = bx + (dir === 3 ? 0 : (side ? -flip : 1) * 9) + sway, ty = wy - 8; R(g, tx - 2, ty - 1, 5, 2, '#b0303a'); R(g, tx - 1, ty - 3, 3, 2, '#b0303a'); R(g, tx, ty - 4, 1, 1, '#ff7070');
    }
  }

  function title(g, q, x, y, isMe) {
    const s = q.isekai; if (!s?.chosen || !s.title) return; const t = I.titleById[s.title]; if (!t) return;
    label(g, '「' + t.name + '」', x, y - (isMe ? 44 : 51), s.title === 'rank-s' || s.title === 'lendario' ? '#ffd86a' : '#bfe8ff', 5, true);
  }

  // ---------- Companions ----------
  function companionLayers(layers, world, me, here, ox, oy, time, drawMonster, bounds) {
    for (const q of Object.values(world.players)) {
      const s = q.isekai; if (!s?.companions?.length || q.online === false && q.id !== me) continue;
      for (const c of s.companions) {
        if (V.dungeonAt(c.x, c.y) !== here || c.x < bounds.left - 2 || c.x > bounds.right + 2 || c.y < bounds.top - 2 || c.y > bounds.bottom + 3) continue;
        layers.push({ y: c.y, draw() {
          const x = Math.round(c.x * 32 + ox), y = Math.round(c.y * 32 + oy), k = [.74, .88, 1.02][c.stage || 0], hue = c.stage >= 2 ? '#ffd86a' : c.stage ? '#9fe8ff' : '#ff9ecb';
          // Pact seal: a flattened ring of runes turning under the companion.
          for (let i = 0; i < 8; i++) { const a = time * 1.6 + i * Math.PI / 4; R(g0(), x + Math.cos(a) * 11 - 1, y + 2 + Math.sin(a) * 3.5, 2, 1, i % 2 ? hue : '#ffffff99'); }
          if (c.stage) { const pulse = .35 + Math.sin(time * 3 + c.x) * .15; ctx().globalAlpha = pulse; R(g0(), x - 9, y - 26 * k, 18, 24 * k, hue + '55'); ctx().globalAlpha = 1; }
          const g = ctx(); g.save(); g.translate(x, y); g.scale(k, k); drawMonster({ id: c.id, kind: c.kind, x: c.x, y: c.y, homeX: c.x * 7, homeY: c.y, hp: 1, maxHp: 1, tier: c.tier || 0, hurtAt: -5, attackAt: c.attackAt ?? -5, dir: c.dir || 0, enraged: false }, 0, 0, time); g.restore();
          if (c.stage >= 2) for (let i = 0; i < 3; i++) R(g, x - 5 + i * 4, y - 40 * k - (i === 1 ? 3 : 0), 2, 3, '#ffd86a');
          if (c.stage >= 1) { const a = time * 2 + c.x; R(g, x + Math.cos(a) * 12, y - 18 + Math.sin(a) * 6, 1, 1, '#ffffff'); }
          label(g, (c.named ? c.name : I.stageName ? c.name : c.name) + ' · Nv.' + c.level, x, y - 34 * k - 6, hue, 5, true);
        } });
      }
    }
  }
  let _ctx = null; const ctx = () => _ctx, g0 = () => _ctx;

  // ---------- Appraisal (Olhos da Análise) ----------
  function appraisal(g, world, me, ox, oy, time) {
    const p = world.players[me]; if (!p?.isekai?.chosen || p.isekai.unique !== 'analise' || p.dead) return;
    const m = V.combatTarget(world, p); if (!m || m.hp <= 0) return;
    const spec = V.monsterTypes[m.kind]; if (!spec) return;
    const x = Math.round(m.x * 32 + ox), y = Math.round(m.y * 32 + oy), h = spec.boss ? 96 : 50, w = spec.boss ? 64 : 38, top = y - h, l = x - w / 2, pulse = Math.round(Math.sin(time * 6) * 1.5), c = '#7ff0ff';
    for (const [cx, cy, sx, sy] of [[l, top, 1, 1], [l + w, top, -1, 1], [l, y + 4, 1, -1], [l + w, y + 4, -1, -1]]) { R(g, cx - sx * pulse, cy - sy * pulse, 7 * sx, 2 * sy, c); R(g, cx - sx * pulse, cy - sy * pulse, 2 * sx, 7 * sy, c); }
    const scan = top + ((time * 40) % (h + 4)); g.globalAlpha = .45; R(g, l, scan, w, 1, c); g.globalAlpha = 1;
    const info = [spec.name + ' · Nv.' + (m.tier + 1), 'PV ' + Math.max(0, Math.ceil(m.hp)) + '/' + m.maxHp + '  ATQ ' + (spec.atk + m.tier * 2), (spec.ranged || ['wisp', 'necromancer', 'ember'].includes(m.kind) ? 'à distância' : 'corpo a corpo') + ' · ' + (spec.speed > 2 ? 'rápido' : spec.speed < 1.4 ? 'lento' : 'normal'), '+' + (spec.xp + m.tier * 2) + ' EXP · ' + (V.items[spec.drop]?.name || spec.drop)];
    const px = l + w + 8, py = top; g.fillStyle = '#081a24d9'; g.fillRect(px - 2, py - 2, 98, info.length * 8 + 6); R(g, px - 2, py - 2, 98, 1, c); R(g, px - 2, py - 2, 1, info.length * 8 + 6, c);
    info.forEach((t, i) => label(g, t, px + 47, py + 9 + i * 8, i ? '#cfeff5' : '#7ff0ff', 5, i === 0, '#081a24'));
  }

  // ---------- Effects ----------
  function effects(g, world, me, ox, oy, time, quality) {
    const lite = quality === 'leve';
    for (const e of world.events || []) {
      const life = LIFE[e.type]; if (!life) continue; const age = world.time - e.time; if (age < 0 || age > life) continue;
      const x = Math.round(e.x * 32 + ox), y = Math.round(e.y * 32 + oy), k = age / life, fade = k < .15 ? k / .15 : 1 - Math.max(0, (k - .6) / .4);
      g.save(); g.globalAlpha = Math.max(0, fade);
      if (e.type === 'level' || e.type === 'rebirth') {
        const big = e.type === 'rebirth', col = big ? '#fff2c0' : '#ffd86a', w = big ? 30 : 18, hgt = big ? 260 : 150;
        g.globalCompositeOperation = 'lighter'; R(g, x - w / 2, y - hgt, w, hgt, col + '33'); R(g, x - w / 4, y - hgt, w / 2, hgt, col + '55'); R(g, x - 2, y - hgt, 4, hgt, '#ffffffaa'); g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < (lite ? 6 : 14); i++) { const t = (age * 1.4 + i / 14) % 1; R(g, x + Math.sin(i * 2.4) * (w * .6 + t * 6), y - t * hgt, 2, 2, i % 3 ? col : '#ffffff'); }
        const r = 10 + k * (big ? 60 : 36); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; R(g, x + Math.cos(a) * r, y + Math.sin(a) * r * .35, 2, 1, col); }
        if (big) for (const sg of [-1, 1]) for (let i = 0; i < 6; i++) R(g, x + sg * (14 + i * 5), y - 70 + i * 6 - Math.sin(age * 4) * 4, 5, 2, '#fff8dc');
        label(g, big ? 'RENASCIMENTO' : 'NÍVEL ↑', x, y - 70 - k * 20, big ? '#fff2c0' : '#ffd86a', 8, true, '#3a2410');
      }
      if (e.type === 'circle') {
        const col = e.color || '#bfe8ff', r = 13 + Math.min(1, k * 3) * 6, rot = time * 2.4;
        for (const [rr, n, sp] of [[r, 20, 1], [r * .62, 12, -1.4]]) for (let i = 0; i < n; i++) { const a = rot * sp + i / n * Math.PI * 2; R(g, x + Math.cos(a) * rr, y + 2 + Math.sin(a) * rr * .38, 2, 1, col); }
        for (let i = 0; i < 6; i++) { const a = -rot + i * Math.PI / 3, rx = x + Math.cos(a) * r * .82, ry = y + 2 + Math.sin(a) * r * .31; R(g, rx - 1, ry - 1, 3, 1, '#ffffff'); R(g, rx, ry - 2, 1, 3, col); }
        g.globalAlpha *= .5; R(g, x - 1, y - 30 * (1 - k), 2, 30 * (1 - k), col); g.globalAlpha = Math.max(0, fade);
      }
      if (e.type === 'tame') {
        const r = 26 - k * 12; for (let i = 0; i < 16; i++) { const a = time * 3 + i / 16 * Math.PI * 2; R(g, x + Math.cos(a) * r, y + Math.sin(a) * r * .4, 2, 2, i % 2 ? '#ff9ecb' : '#9fe8ff'); }
        for (let i = 0; i < 5; i++) { const t = (age * .9 + i / 5) % 1, hx = x - 12 + i * 6, hy = y - 20 - t * 40; R(g, hx, hy, 2, 2, '#ff6fa8'); R(g, hx + 3, hy, 2, 2, '#ff6fa8'); R(g, hx - 1, hy + 1, 7, 2, '#ff6fa8'); R(g, hx, hy + 3, 5, 1, '#ff6fa8'); R(g, hx + 1, hy + 4, 3, 1, '#ff6fa8'); R(g, hx + 2, hy + 5, 1, 1, '#ff6fa8'); }
        label(g, 'PACTO!', x, y - 50 - k * 12, '#ff9ecb', 8, true, '#3a1028');
      }
      if (e.type === 'evolve') {
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < (lite ? 8 : 16); i++) { const a = i / 16 * Math.PI * 2 + age * 1.5, len = 10 + k * 60; for (let j = 0; j < 4; j++) R(g, x + Math.cos(a) * (len - j * 6), y - 16 + Math.sin(a) * (len - j * 6) * .7, 2, 2, j ? '#9fe8ff66' : '#ffffff'); }
        if (k < .25) { g.globalAlpha = (1 - k / .25) * .8; R(g, x - 40, y - 60, 80, 70, '#ffffff'); }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.max(0, fade); label(g, 'EVOLUÇÃO!', x, y - 56 - k * 16, '#9fe8ff', 8, true, '#0a2430');
      }
      if (e.type === 'rankup') {
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + age; const r = 8 + k * 46; R(g, x + Math.cos(a) * r - 1, y - 20 + Math.sin(a) * r * .6 - 1, 3, 3, i % 2 ? '#ffd86a' : '#9fe8ff'); }
        label(g, 'RANK ' + e.text, x, y - 62 - k * 18, '#ffd86a', 9, true, '#2a1a08');
      }
      g.restore();
    }
  }

  function begin(g) { _ctx = g; }
  return { race, title, companionLayers, appraisal, effects, owns: t => OWN.has(t), begin, head };
})();
