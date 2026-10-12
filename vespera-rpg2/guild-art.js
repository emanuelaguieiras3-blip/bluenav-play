'use strict';
// Guild of the Wayfarers pixel art: the hall in the village (facade with swinging sign, waving banners and a
// notice board whose papers flutter), its interior, the receptionist scene for the guild window, and the
// small world effects for finished contracts and arriving letters. Static parts are cached canvases.
window.GuildArt = (() => {
  const R = (g, x, y, w, h, c) => { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const cache = new Map();
  const canvas = (key, w, h, draw) => { let c = cache.get(key); if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g); cache.set(key, c); } return c; };
  const BLUE = '#2f4f7a', BLUE_D = '#223a5c', GOLD = '#e8c14a', GOLD_D = '#b8862e', WOOD = '#6b4a2e', WOOD_D = '#4a3220', WOOD_L = '#8a6440';

  function emblem(g, x, y, s = 1) { // shield with crossed swords
    R(g, x - 7 * s, y - 8 * s, 14 * s, 11 * s, GOLD_D); R(g, x - 6 * s, y - 7 * s, 12 * s, 10 * s, BLUE); R(g, x - 4 * s, y + 3 * s, 8 * s, 2 * s, BLUE); R(g, x - 2 * s, y + 5 * s, 4 * s, 2 * s, BLUE);
    for (let i = -4; i <= 4; i++) { R(g, x + i * s, y - 4 * s + Math.abs(i) * 0 + i * s * .7, s, s, '#e8f0f8'); R(g, x - i * s, y - 4 * s + i * s * .7, s, s, '#e8f0f8'); }
    R(g, x - 5 * s, y + 2 * s, 3 * s, s, GOLD); R(g, x + 2 * s, y + 2 * s, 3 * s, s, GOLD);
  }

  // ---------- Hall facade (6×4 tiles) ----------
  function hallBody(w, lit) {
    return canvas('hall' + w + lit, w + 40, 230, g => {
      const x = 20, base = 222, wallTop = base - 92, roofTop = wallTop - 70, cx = x + w / 2;
      g.fillStyle = '#1c2a2244'; g.beginPath(); g.ellipse(cx + 10, base + 2, w * .6, 11, 0, 0, Math.PI * 2); g.fill();
      // Stone ground floor, plaster and timber upper floor.
      R(g, x, base - 40, w, 40, '#8b8577'); for (let r = 0; r < 5; r++) for (let c = 0; c < w / 14 + 1; c++) { const bx = x + c * 14 - (r % 2 ? 7 : 0); if (bx < x || bx + 12 > x + w) continue; R(g, bx + 1, base - 39 + r * 8, 12, 7, (c + r) % 3 ? '#a39d8d' : '#b3ad9d'); R(g, bx + 1, base - 33 + r * 8, 12, 1, '#7d776a'); }
      R(g, x, wallTop, w, 52, '#e9dfc7'); R(g, x + w - 18, wallTop, 18, 52, '#d3c7aa');
      for (const bx of [x, x + w * .25, x + w * .5 - 3, x + w * .75, x + w - 6]) R(g, bx, wallTop, 6, 52, WOOD);
      R(g, x, wallTop, w, 5, WOOD); R(g, x, wallTop + 26, w, 4, WOOD); R(g, x - 3, base - 42, w + 6, 4, WOOD_D);
      for (let i = 0; i < 4; i++) { const bx = x + 14 + i * (w - 40) / 3; R(g, bx - 1, wallTop + 7, 20, 17, WOOD_D); R(g, bx, wallTop + 8, 18, 15, lit ? '#ffd98a' : '#3a5578'); if (!lit) R(g, bx + 2, wallTop + 9, 5, 4, '#7fa6c9'); R(g, bx + 8, wallTop + 8, 2, 15, WOOD_D); R(g, bx, wallTop + 15, 18, 2, WOOD_D); R(g, bx - 3, wallTop + 24, 24, 3, WOOD_L); }
      // Roof with central gable and round window.
      for (let r = 0; r < 70; r += 2) { const inset = r * .62, y = wallTop + 2 - r; R(g, x - 12 + inset, y, w + 24 - inset * 2, 2, r % 8 < 2 ? BLUE_D : BLUE); if (r % 6 === 0) for (let k = x - 8 + inset + (r % 12 ? 0 : 6); k < x + w + 8 - inset; k += 12) R(g, k, y, 1, 3, BLUE_D); }
      R(g, x - 14, wallTop + 1, w + 28, 4, '#1b2d48');
      const gx = cx; for (let r = 0; r < 44; r += 2) { const hw = 34 - r * .75; R(g, gx - hw, wallTop - 8 - r, hw * 2, 2, '#e9dfc7'); } R(g, gx - 36, wallTop - 8, 72, 4, WOOD);
      for (let r = 0; r < 12; r++) { const hw = Math.round(Math.sqrt(Math.max(0, 36 - (r - 6) * (r - 6))) * 1.3); R(g, gx - hw, wallTop - 42 + r * 2, hw * 2, 2, WOOD_D); } for (let r = 0; r < 10; r++) { const hw = Math.round(Math.sqrt(Math.max(0, 25 - (r - 5) * (r - 5))) * 1.2); R(g, gx - hw, wallTop - 40 + r * 2, hw * 2, 2, lit ? '#ffd98a' : '#4a6a92'); }
      R(g, gx - 1, wallTop - 42, 2, 20, WOOD_D); R(g, gx - 8, wallTop - 33, 16, 2, WOOD_D);
      for (let r = 0; r < 26; r += 2) { const hw = 40 - r * 1.5; R(g, gx - hw - 4, wallTop - 52 - r, 8, 2, BLUE); R(g, gx + hw - 4, wallTop - 52 - r, 8, 2, BLUE); }
      R(g, x + w - 40, roofTop + 6, 14, 30, '#8b7a6a'); R(g, x + w - 42, roofTop + 4, 18, 4, '#a39282');
      R(g, gx - 1, roofTop - 12, 2, 12, GOLD_D); R(g, gx - 4, roofTop - 14, 8, 3, GOLD);
      // Double door with iron bands, lanterns.
      R(g, cx - 18, base - 38, 36, 38, '#5e5446'); R(g, cx - 15, base - 35, 30, 35, '#6b3f22'); for (let i = -12; i <= 12; i += 6) R(g, cx + i, base - 35, 2, 35, '#57321b'); R(g, cx - 1, base - 35, 2, 35, '#3a2212');
      R(g, cx - 15, base - 26, 30, 2, '#2e2a2a'); R(g, cx - 15, base - 12, 30, 2, '#2e2a2a'); R(g, cx - 5, base - 20, 2, 3, GOLD); R(g, cx + 3, base - 20, 2, 3, GOLD);
      for (const lx of [cx - 26, cx + 22]) { R(g, lx, base - 44, 4, 3, '#2f3440'); R(g, lx - 1, base - 41, 6, 8, '#2f3440'); R(g, lx, base - 40, 4, 6, lit ? '#ffe7a0' : '#d8cfa8'); }
      // Barrels and crates.
      for (const [bx, k] of [[x + 6, 0], [x + 18, 1]]) { R(g, bx, base - 14, 11, 14, k ? '#7a5230' : '#8a5a34'); R(g, bx, base - 11, 11, 2, '#3a3440'); R(g, bx, base - 4, 11, 2, '#3a3440'); R(g, bx + 2, base - 14, 2, 14, '#a8784a'); }
      R(g, x + w - 26, base - 16, 18, 16, '#9a7048'); R(g, x + w - 26, base - 16, 18, 2, '#b88a58'); R(g, x + w - 26, base - 9, 18, 1, '#6b4a2e'); R(g, x + w - 18, base - 16, 2, 16, '#6b4a2e');
    });
  }
  const GA = n => window.GameAssets?.get('guild-' + n), GP = (g, n, cx, base, w, flip) => !!window.GameAssets?.place(g, 'guild-' + n, cx, base, w, flip);
  function exterior(g, b, sx, sy, time, night) {
    const w = b.w * 32, h = b.h * 32, base = sy + h, lit = night > .12, cx = sx + w / 2;
    // Painted facade: four frames (banners, sign and notices move), a still frame with reduced motion.
    if (GA('facade0')) { const still = window.Experience?.settings?.reducedMotion, f = still ? 0 : Math.floor(time * 3) % 4; R(g, sx - 6, base - 6, w + 12, 8, '#1c2a2244'); GP(g, 'facade' + f, cx, base + 6, w + 44);
      if (lit && window.WorldTown?.glow) { for (const lx of [cx - 40, cx + 40]) window.WorldTown.glow(g, lx, base - 34, 26, '#ffc46a', night * 2.4); window.WorldTown.glow(g, cx, base - 70, 20, '#ffd98a', night * 1.6); } return; }
    g.drawImage(hallBody(w, lit), Math.round(sx - 20), Math.round(base - 222));
    // Swinging sign above the door.
    const sw = Math.sin(time * 1.6) * .06, sy2 = base - 56; R(g, cx - 24, sy2 - 2, 48, 3, WOOD_D);
    g.save(); g.translate(cx, sy2); g.rotate(sw); R(g, -22, 2, 44, 18, WOOD_D); R(g, -20, 4, 40, 14, '#c8a26a'); R(g, -20, 4, 40, 2, '#e0c088'); emblem(g, -11, 13, 1); g.fillStyle = '#3a2412'; g.font = 'bold 6px monospace'; g.textBaseline = 'middle'; g.fillText('GUILDA', -2, 11); g.restore();
    // Banners waving on both sides.
    for (const [bx, ph] of [[sx + 6, 0], [sx + w - 16, 1.7]]) { R(g, bx - 1, base - 124, 12, 3, GOLD_D); for (let i = 0; i < 26; i += 2) { const off = Math.round(Math.sin(time * 3 + ph - i * .35) * 1.5 * (i / 26)); R(g, bx + off, base - 121 + i, 10, 2, i % 6 < 2 ? BLUE_D : BLUE); } R(g, bx + 3, base - 112, 4, 6, GOLD); R(g, bx + 2 + Math.round(Math.sin(time * 3 + ph) * 1.5), base - 96, 6, 3, BLUE); }
    // Notice board with fluttering contracts.
    const nx = sx + w - 62, ny = base - 36; R(g, nx - 2, ny - 26, 3, 30, WOOD_D); R(g, nx + 27, ny - 26, 3, 30, WOOD_D); R(g, nx - 4, ny - 26, 36, 22, '#7a5230'); R(g, nx - 2, ny - 24, 32, 18, '#a8784a');
    for (let i = 0; i < 5; i++) { const px = nx + 1 + (i % 3) * 10, py = ny - 23 + Math.floor(i / 3) * 9, fl = Math.round(Math.sin(time * 4 + i * 1.3) * .8); R(g, px, py + fl, 8, 7, i % 2 ? '#efe1b8' : '#e2cf9c'); R(g, px + 1, py + 2 + fl, 6, 1, '#b8a070'); R(g, px + 1, py + 4 + fl, 4, 1, '#b8a070'); R(g, px + 3, py, 2, 2, ['#c0304a', '#3f6f8f', '#e8c14a'][i % 3]); }
    if (lit && window.WorldTown?.glow) { for (const lx of [cx - 24, cx + 24]) window.WorldTown.glow(g, lx, base - 38, 26, '#ffc46a', night * 2.4); }
  }

  // ---------- Interior ----------
  function interior(g, b, x, y, time) {
    const w = b.w * 32, h = b.h * 32;
    if (GA('board')) { interiorArt(g, b, x, y, time, w, h); return; }
    R(g, x, y, w, h, '#6b4a2e'); for (let r = 0; r < h; r += 8) { R(g, x, y + r, w, 1, '#58391f'); for (let c = (r / 8 % 2) * 20; c < w; c += 40) R(g, x + c, y + r, 1, 8, '#58391f'); }
    R(g, x, y - 26, w, 34, '#5a3a26'); for (let i = 0; i < w; i += 10) R(g, x + i, y - 26, 1, 34, '#4a2e1c'); R(g, x, y - 26, w, 3, '#3a2414');
    R(g, x + w / 2 - 34, y + 38, 68, 36, '#8a2a2a'); R(g, x + w / 2 - 31, y + 41, 62, 30, '#a83a34'); emblem(g, x + w / 2, y + 57, 2);
    // Mission board on the wall.
    R(g, x + 10, y - 22, 44, 26, '#7a5230'); R(g, x + 12, y - 20, 40, 22, '#a8784a'); for (let i = 0; i < 8; i++) { const fl = Math.round(Math.sin(time * 3 + i) * .6); R(g, x + 14 + (i % 4) * 9, y - 18 + Math.floor(i / 4) * 10 + fl, 7, 8, i % 3 ? '#efe1b8' : '#e2cf9c'); R(g, x + 16 + (i % 4) * 9, y - 18 + Math.floor(i / 4) * 10 + fl, 2, 2, '#c0304a'); }
    // Counter along the back wall with the receptionist.
    const cx = x + w * .62; drawReceptionist(g, cx, y + 16, time, .55); R(g, x + w * .4, y + 10, w * .5, 14, WOOD_L); R(g, x + w * .4, y + 10, w * .5, 2, '#b07a48'); R(g, x + w * .4, y + 22, w * .5, 2, WOOD_D);
    R(g, cx + 24, y + 6, 6, 5, '#d8b04a'); R(g, cx - 30, y + 5, 10, 6, '#efe1b8'); R(g, cx - 29, y + 3, 10, 6, '#f6ecd0');
    // Tables with mugs.
    for (const [tx, ty] of [[x + 22, y + 88], [x + w - 46, y + 84]]) { R(g, tx, ty, 26, 10, WOOD_L); R(g, tx, ty, 26, 2, '#b07a48'); R(g, tx + 3, ty + 10, 3, 8, WOOD_D); R(g, tx + 20, ty + 10, 3, 8, WOOD_D); R(g, tx + 6, ty - 5, 5, 6, '#d8d0bc'); R(g, tx + 7, ty - 4, 3, 1, '#f0e8c8'); R(g, tx + 15, ty - 4, 5, 5, '#c89a58'); }
    // Trophy head.
    R(g, x + w - 40, y - 20, 22, 18, WOOD_D); R(g, x + w - 36, y - 16, 14, 11, '#8a8f9a'); R(g, x + w - 38, y - 18, 4, 5, '#8a8f9a'); R(g, x + w - 24, y - 18, 4, 5, '#8a8f9a'); R(g, x + w - 33, y - 12, 2, 2, '#ff5a4a'); R(g, x + w - 27, y - 12, 2, 2, '#ff5a4a'); R(g, x + w - 31, y - 8, 6, 3, '#eceff4');
  }

  // Interior with the painted furniture: floor and wall stay drawn, every piece of furniture is a sprite.
  function interiorArt(g, b, x, y, time, w, h) {
    R(g, x, y, w, h, '#6b4a2e'); for (let r = 0; r < h; r += 8) { R(g, x, y + r, w, 1, '#58391f'); for (let c = (r / 8 % 2) * 20; c < w; c += 40) R(g, x + c, y + r, 1, 8, '#58391f'); }
    R(g, x, y - 26, w, 34, '#5a3a26'); for (let i = 0; i < w; i += 10) R(g, x + i, y - 26, 1, 34, '#4a2e1c'); R(g, x, y - 26, w, 3, '#3a2414');
    R(g, x + w / 2 - 34, y + 38, 68, 36, '#8a2a2a'); R(g, x + w / 2 - 31, y + 41, 62, 30, '#a83a34'); emblem(g, x + w / 2, y + 57, 2);
    // Wall: quest board, rank plaque, guild banner, trophy head; shelves of records in the corner.
    GP(g, 'board', x + 34, y + 8, 50); GP(g, 'ranks', x + 74, y + 2, 20); GP(g, 'banner', x + w * .5, y + 4, 20); GP(g, 'trophy', x + w - 28, y + 0, 24); GP(g, 'records', x + 12, y + 30, 22);
    // Counter with Mirela, the bell and the ledger.
    const cx = x + w * .62; GP(g, 'counter', cx - 4, y + 32, 62); drawReceptionist(g, cx, y + 10, time, .55); g.save(); g.beginPath(); g.rect(cx - 40, y + 6, 80, 40); g.clip(); GP(g, 'counter', cx - 4, y + 32, 62); g.restore(); GP(g, 'bell', cx + 22, y + 10, 10);
    // Floor: map tables, bench, appraisal orb, reward chest, plants; a chandelier overhead.
    GP(g, 'maptable', x + 36, y + 104, 40); GP(g, 'maptable', x + w - 34, y + 100, 40); GP(g, 'bench', x + 36, y + 122, 34); GP(g, 'orb', x + w - 16, y + 60, 18);
    const glow = .5 + Math.sin(time * 2) * .2; g.fillStyle = `rgba(120,200,255,${glow * .25})`; g.beginPath(); g.arc(x + w - 16, y + 44, 12, 0, Math.PI * 2); g.fill();
    GP(g, 'goldchest', x + 14, y + 124, 24); GP(g, 'tub', x + w - 12, y + 126, 18); GP(g, 'letters', x + w * .4, y + 30, 16); GP(g, 'chandelier', x + w / 2, y + 28 + Math.round(Math.sin(time * 1.2)), 38);
  }

  // ---------- Receptionist (Mirela) ----------
  // Drawn around (cx, top) at scale k; breathing, blinking and a stamp every few seconds.
  const mirelaArt = typeof Image === 'function' ? new Image() : {}; mirelaArt.src = 'assets/mirela-anim.png';
  function drawReceptionist(g, cx, top, time, k = 1) {
    // Painted Mirela: 8 frames (4 idle, 4 stamping in sync with the "TUM!" every 5.2 s); counter top at 86 of 100.
    if (mirelaArt.complete && mirelaArt.naturalWidth) {
      const fw = mirelaArt.naturalWidth / 8, fh = mirelaArt.naturalHeight, still = window.Experience?.settings?.reducedMotion, ph = time % 5.2;
      const frame = still ? 0 : ph < .8 ? 4 + Math.min(3, Math.floor(ph / .2)) : Math.floor(time * 3) % 4;
      const w = Math.round(fw * k), h = Math.round(fh * k);
      g.drawImage(mirelaArt, frame * fw, 0, fw, fh, Math.round(cx - w / 2), Math.round(top + 38 * k - 86 * k), w, h);
      return;
    }
    const P = (x, y, w, h, c) => R(g, cx + x * k, top + y * k, Math.max(1, w * k), Math.max(1, h * k), c);
    const breathe = Math.sin(time * 2.2) > .2 ? 1 : 0, blink = (time % 3.7) < .13, stampPhase = (time % 5.2), stamp = stampPhase < .5, arm = stamp ? (stampPhase < .25 ? -6 : 0) : -3;
    const skin = '#f2c9a4', skinD = '#d9a882', hair = '#6b3a24', hairL = '#8a4e2e', vest = '#2f5a4a', vestD = '#224438', shirt = '#f4efe6';
    P(-6, -26 + breathe, 12, 10, hair); P(-4, -30 + breathe, 8, 6, hair); P(-2, -31 + breathe, 4, 2, hairL); P(3, -33 + breathe, 1, 6, '#e8d8b0');
    P(-14, -16 + breathe, 28, 26, hair); P(-12, -14 + breathe, 24, 22, skin); P(-12, -14 + breathe, 24, 7, hair); P(-12, -8 + breathe, 3, 12, hair); P(9, -8 + breathe, 3, 12, hair); P(-8, -9 + breathe, 16, 2, hairL);
    P(-9, -3 + breathe, 8, 6, '#3a2a2a'); P(1, -3 + breathe, 8, 6, '#3a2a2a'); P(-8, -2 + breathe, 6, 4, blink ? skin : '#e8f4ff'); P(2, -2 + breathe, 6, 4, blink ? skin : '#e8f4ff');
    if (!blink) { P(-6, -1 + breathe, 3, 3, '#2a4a3a'); P(4, -1 + breathe, 3, 3, '#2a4a3a'); P(-5, -1 + breathe, 1, 1, '#fff'); P(5, -1 + breathe, 1, 1, '#fff'); } else { P(-8, 0 + breathe, 6, 1, '#3a2a2a'); P(2, 0 + breathe, 6, 1, '#3a2a2a'); }
    P(-1, -3 + breathe, 2, 1, '#3a2a2a'); P(-11, 3 + breathe, 3, 2, '#f0a0a0'); P(8, 3 + breathe, 3, 2, '#f0a0a0'); P(-3, 5 + breathe, 6, 1, '#b85a4a'); P(-2, 6 + breathe, 4, 1, '#d88070');
    P(-4, 10 + breathe, 8, 4, skinD);
    P(-20, 13 + breathe, 40, 34, shirt); P(-18, 14 + breathe, 12, 33, vest); P(6, 14 + breathe, 12, 33, vest); P(-18, 14 + breathe, 3, 33, vestD); P(-4, 13 + breathe, 8, 5, '#e0d8c8'); P(-1, 18 + breathe, 2, 2, GOLD); P(-1, 24 + breathe, 2, 2, GOLD); P(-1, 30 + breathe, 2, 2, GOLD);
    P(-15, 20 + breathe, 6, 6, GOLD); P(-14, 21 + breathe, 4, 4, '#fff0b8');
    P(-26, 20 + breathe, 7, 22, shirt); P(-26, 40 + breathe, 8, 6, skin); P(19, 18 + breathe + arm, 7, 20, shirt); P(19, 36 + breathe + arm, 8, 6, skin); P(18, 40 + breathe + arm, 10, 5, '#8a5a34'); P(20, 45 + breathe + arm, 6, 3, '#b8302a');
  }

  // ---------- Guild window scene (200×160, shown scaled up) ----------
  function scene(g, time, W = 200, H = 160) {
    g.imageSmoothingEnabled = false;
    // Painted reception hall: Mirela is drawn between the hall and the counter (the counter strip is redrawn over her).
    const bg = GA('scene');
    if (bg) { g.drawImage(bg, 0, 0, W, H); g.save(); g.scale(W / 200, H / 160);
      for (let i = 0; i < 9; i++) { const k = (time * .05 + i / 9) % 1; R(g, 30 + k * 40 + Math.sin(time + i) * 4, 30 + k * 70, 1, 1, '#fff6d890'); }
      drawReceptionist(g, 100, 74, time, 1); g.restore();
      const cut = .665; g.drawImage(bg, 0, bg.height * cut, bg.width, bg.height * (1 - cut), 0, H * cut, W, H * (1 - cut));
      const ph = time % 5.2; if (ph < .35) { g.fillStyle = '#fff'; g.font = `bold ${Math.round(7 * W / 200)}px monospace`; g.fillText('TUM!', 126 * W / 200, (104 - ph * 10) * H / 160); } return; }
    if (W !== 200) { g.save(); g.scale(W / 200, H / 160); scene(g, time, 200, 160); g.restore(); return; }
    g.drawImage(canvas('scene-bg', W, H, s => {
      R(s, 0, 0, W, H, '#5a3a26'); for (let i = 0; i < W; i += 12) { R(s, i, 0, 1, H, '#4a2e1c'); R(s, i + 5, 0, 1, H, '#63412b'); } R(s, 0, 0, W, 6, '#3a2414');
      R(s, 150, 18, 38, 40, '#3a2414'); R(s, 152, 20, 34, 36, '#9fd0e4'); R(s, 152, 42, 34, 14, '#7aa860'); R(s, 168, 20, 2, 36, '#3a2414'); R(s, 152, 36, 34, 2, '#3a2414'); R(s, 148, 58, 42, 4, WOOD_L);
      for (const sy of [38, 66]) { R(s, 6, sy, 70, 4, WOOD_L); R(s, 6, sy + 4, 70, 2, WOOD_D); }
      const books = ['#8a2a2a', '#2f4f7a', '#4f7a45', '#8a6a2f', '#5c4a86', '#9a3b3b'];
      books.forEach((c, i) => { R(s, 10 + i * 5, 24 + (i % 2) * 2, 4, 14 - (i % 2) * 2, c); R(s, 10 + i * 5, 27, 4, 1, '#e8c14a'); });
      for (let i = 0; i < 3; i++) { R(s, 44 + i * 9, 29, 6, 9, ['#c0304a', '#3a7fd0', '#4f9a5a'][i]); R(s, 45 + i * 9, 26, 4, 3, '#d8d0bc'); R(s, 45 + i * 9, 31, 2, 3, '#ffffff66'); }
      for (let i = 0; i < 4; i++) { R(s, 10 + i * 15, 56, 13, 10, '#efe1b8'); R(s, 10 + i * 15, 56, 3, 10, '#d8c090'); R(s, 20 + i * 15, 57, 2, 8, '#c0304a'); }
      R(s, 88, 12, 26, 24, WOOD_D); R(s, 92, 16, 18, 14, '#8a8f9a'); R(s, 90, 13, 5, 6, '#8a8f9a'); R(s, 107, 13, 5, 6, '#8a8f9a'); R(s, 96, 21, 2, 2, '#ff5a4a'); R(s, 104, 21, 2, 2, '#ff5a4a'); R(s, 98, 26, 6, 4, '#eceff4');
      R(s, 124, 10, 18, 44, BLUE); for (let i = 0; i < 18; i += 3) R(s, 124 + i, 54, 2, 3 + (i % 2) * 2, BLUE); emblem(s, 133, 28, 1); R(s, 122, 8, 22, 3, GOLD_D);
      R(s, 0, 112, W, 48, '#6b4a2e'); R(s, 0, 112, W, 4, '#b07a48'); R(s, 0, 116, W, 3, '#8a5a34'); for (let i = 0; i < W; i += 20) R(s, i, 119, 2, 41, '#4a3220'); R(s, 0, 132, W, 2, '#4a3220');
      R(s, 30, 102, 24, 12, '#efe1b8'); R(s, 28, 100, 24, 12, '#f6ecd0'); for (let i = 0; i < 4; i++) R(s, 31, 103 + i * 2, 16, 1, '#b8a070');
      R(s, 60, 104, 8, 8, '#2a2a3a'); R(s, 66, 94, 1, 12, '#f4efe6'); R(s, 64, 92, 3, 4, '#f4efe6');
      R(s, 146, 106, 16, 7, '#3a3440'); R(s, 148, 104, 12, 3, '#b8302a'); R(s, 172, 100, 12, 13, '#d8b04a'); R(s, 176, 97, 4, 3, '#b8862e'); R(s, 172, 111, 12, 2, '#8a6a2e');
      R(s, 12, 96, 7, 16, '#efe8d8'); R(s, 10, 110, 11, 3, '#b8862e');
    }), 0, 0);
    // Light beam from the window with drifting dust.
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,236,190,.07)'; g.beginPath(); g.moveTo(152, 20); g.lineTo(186, 20); g.lineTo(140, 112); g.lineTo(96, 112); g.closePath(); g.fill(); g.restore();
    for (let i = 0; i < 9; i++) { const k = (time * .05 + i / 9) % 1; R(g, 150 - k * 40 + Math.sin(time + i) * 4, 24 + k * 84, 1, 1, '#fff6d890'); }
    // Swinging lamp and candle.
    const sw = Math.sin(time * 1.3) * 4; R(g, 70, 0, 1, 18, '#2f3440'); R(g, 66 + sw, 18, 10, 3, '#2f3440'); R(g, 67 + sw, 21, 8, 8, '#ffe7a0'); R(g, 66 + sw, 29, 10, 2, '#2f3440');
    const fl = Math.sin(time * 11) > 0 ? 1 : 0; R(g, 14, 90 - fl, 3, 6 + fl, '#ffb45a'); R(g, 15, 92 - fl, 1, 3, '#fff2c0');
    drawReceptionist(g, 100, 74, time, 1);
    R(g, 0, 112, 200, 4, '#b07a48'); R(g, 0, 116, 200, 3, '#8a5a34');
    const ph = time % 5.2; if (ph < .35) { g.fillStyle = '#fff'; g.font = 'bold 7px monospace'; g.fillText('TUM!', 126, 104 - ph * 10); }
  }

  // ---------- Board in the square: fluttering papers and a marker when something waits for you ----------
  function board(g, x, y, time, p) {
    for (let i = 0; i < 4; i++) { const fl = Math.round(Math.sin(time * 4 + i * 1.7) * .8); R(g, x - 15 + (i % 2) * 17, y - 31 + Math.floor(i / 2) * 9 + fl, 12, 8, i % 2 ? '#efe1b8' : '#e2cf9c'); R(g, x - 10 + (i % 2) * 17, y - 31 + Math.floor(i / 2) * 9 + fl, 2, 2, '#c0304a'); }
    const ready = p?.guildQuests?.active?.some(q => q.ready || q.noted), unread = p?.letters?.some(l => !l.read);
    if (ready || unread) { const b = Math.round(Math.sin(time * 4) * 2); R(g, x - 4, y - 66 + b, 8, 10, ready ? '#ffd86a' : '#ff9ecb'); R(g, x - 1, y - 64 + b, 2, 5, '#3a2412'); R(g, x - 1, y - 58 + b, 2, 2, '#3a2412'); }
  }

  // ---------- World effects ----------
  const LIFE = { questDone: 1.8, letter: 2.2, questAccept: 1.2 };
  function effects(g, world, ox, oy, time) {
    for (const e of world.events || []) {
      const life = LIFE[e.type]; if (!life) continue; const age = world.time - e.time; if (age < 0 || age > life) continue;
      const x = Math.round(e.x * 32 + ox), y = Math.round(e.y * 32 + oy), k = age / life; g.save(); g.globalAlpha = k < .8 ? 1 : (1 - k) / .2;
      if (e.type === 'questDone') for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (i / 13 - .5) * 1.8, v = 40 + (i % 3) * 14, t = age * 1.4, cx = x + Math.cos(a) * v * t, cy = y - 24 + Math.sin(a) * v * t + 60 * t * t; R(g, cx - 2, cy - 2, 5, 5, '#b8862e'); R(g, cx - 1, cy - 2, 3, 4, GOLD); R(g, cx, cy - 1, 1, 1, '#fff6c0'); }
      if (e.type === 'letter') { const fy = y - 50 - Math.sin(Math.min(1, k * 2) * Math.PI / 2) * 16, fx = x + Math.sin(age * 3) * 3; R(g, fx - 9, fy - 6, 18, 12, '#f4ecd6'); R(g, fx - 9, fy - 6, 18, 1, '#c8b890'); for (let i = 0; i < 9; i++) R(g, fx - 9 + i, fy - 6 + i * .6, 1, 1, '#c8b890'); for (let i = 0; i < 9; i++) R(g, fx + 8 - i, fy - 6 + i * .6, 1, 1, '#c8b890'); R(g, fx - 3, fy - 1, 6, 5, e.color || '#b8302a'); R(g, fx - 1, fy + 1, 2, 1, '#ffffff88'); }
      if (e.type === 'questAccept') { g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.arc(x, y - 24, 8 + k * 20, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
  }
  return { exterior, interior, scene, board, effects, drawReceptionist };
})();
