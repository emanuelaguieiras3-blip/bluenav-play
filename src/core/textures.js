// Texturas procedurais desenhadas em canvas (nada é baixado).
// Carregamento progressivo: gera 64px na hora e troca por 256px quando o navegador fica ocioso.
import * as THREE from 'three';
import { rng, clamp } from './util.js';

const MAX = 256;
const LOW = 64;
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 30));

// ---------- utilidades de pintura ----------
export const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Campo de ruído fbm que se repete sem emenda (tileable)
function field(S, R, fx = 4, fy = fx, oct = 4, gain = 0.5) {
  const out = new Float32Array(S * S);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const px = fx << o, py = fy << o;
    const g = new Float32Array(px * py);
    for (let i = 0; i < g.length; i++) g[i] = R();
    for (let y = 0; y < S; y++) {
      const gy = (y / S) * py, y0 = Math.floor(gy), ty = gy - y0, sy = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % py) * px, r1 = ((y0 + 1) % py) * px;
      for (let x = 0; x < S; x++) {
        const gx = (x / S) * px, x0 = Math.floor(gx), tx = gx - x0, sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % px, c1 = (x0 + 1) % px;
        const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx;
        const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
        out[y * S + x] += (a + (b - a) * sy) * amp;
      }
    }
    tot += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function paint(c, S, fn) {
  const img = c.createImageData(S, S), d = img.data, o = [0, 0, 0, 255];
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) {
    o[3] = 255; fn(x, y, i, o);
    const k = i * 4; d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = o[3];
  }
  c.putImageData(img, 0, 0);
}

function walkLine(c, S, R, x, y, steps, len, ang, jitter, color, width) {
  c.strokeStyle = color; c.lineWidth = width * S / 256; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x * S, y * S);
  for (let i = 0; i < steps; i++) {
    ang += (R() - 0.5) * jitter;
    x += Math.cos(ang) * len; y += Math.sin(ang) * len;
    c.lineTo(x * S, y * S);
  }
  c.stroke();
}

function dots(c, S, R, n, rmin, rmax, colorFn) {
  const k = (S / 256) * (S / 256);
  const count = Math.max(4, Math.round(n * k));
  for (let i = 0; i < count; i++) {
    const x = R() * S, y = R() * S, r = (rmin + R() * (rmax - rmin)) * S / 256;
    c.fillStyle = colorFn(R, i);
    c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); c.fill();
  }
}

// ---------- definições ----------
const DEFS = {
  asphalt: { repeat: [4, 4], draw(c, S, R) {
    const n = field(S, R, 8, 8, 5), p = field(S, R, 3, 3, 2);
    paint(c, S, (x, y, i, o) => {
      const v = 34 + n[i] * 42 + (R() - 0.5) * 30 + ss(0.6, 0.66, p[i]) * 18;
      o[0] = v; o[1] = v; o[2] = v + 2;
    });
    for (let k = 0; k < 7; k++) walkLine(c, S, R, R(), R(), 22, 0.012, R() * 6.28, 1.4, 'rgba(12,12,12,.75)', 1);
    for (let k = 0; k < 3; k++) { c.fillStyle = 'rgba(8,8,8,.16)'; c.fillRect((0.2 + R() * 0.6) * S, 0, S * 0.05, S); }
    dots(c, S, R, 5, 8, 22, () => 'rgba(6,6,12,.32)');
  } },
  road: { repeat: [1, 8], draw(c, S, R) {
    DEFS.asphalt.draw(c, S, R);
    const w = field(S, R, 4, 16, 3);
    for (const x0 of [0.045, 0.915]) {
      for (let y = 0; y < S; y++) {
        const a = clamp((w[y * S + Math.floor(x0 * S)] - 0.25) * 1.6, 0, 0.92);
        c.fillStyle = `rgba(232,232,226,${a})`; c.fillRect(x0 * S, y, S * 0.04, 1);
      }
    }
  } },
  dirt: { repeat: [1, 8], draw(c, S, R) {
    const n = field(S, R, 6, 6, 5);
    const a = hex('#7a3e26'), b = hex('#a0603a');
    paint(c, S, (x, y, i, o) => {
      const u = x / S, rut = Math.exp(-((u - 0.3) ** 2) / 0.002) + Math.exp(-((u - 0.7) ** 2) / 0.002);
      const col = mixc(a, b, n[i]); const k = 1 - rut * 0.35 + (R() - 0.5) * 0.12;
      o[0] = col[0] * k; o[1] = col[1] * k; o[2] = col[2] * k;
    });
    dots(c, S, R, 240, 1.2, 3.2, (R) => { const g = 150 + R() * 60; return `rgb(${g},${g},${g - 6})`; });
  } },
  leather: { repeat: [8, 1], draw(c, S, R) {
    const n = field(S, R, 16, 16, 3);
    paint(c, S, (x, y, i, o) => { const v = 18 + n[i] * 16 + (R() < 0.06 ? -8 : 0); o[0] = v; o[1] = v; o[2] = v + 2; });
    c.strokeStyle = '#c9b48a'; c.lineWidth = S / 64; c.setLineDash([S / 24, S / 40]);
    for (const y of [0.08, 0.92]) { c.beginPath(); c.moveTo(0, y * S); c.lineTo(S, y * S); c.stroke(); }
    c.setLineDash([]);
  } },
  fabric: { repeat: [4, 4], draw(c, S, R) {
    const n = field(S, R, 8, 8, 2), cell = Math.max(1, S / 64);
    paint(c, S, (x, y, i, o) => {
      const t = ((Math.floor(x / cell) + Math.floor(y / cell)) % 4) < 2 ? 1 : 0;
      const v = 46 + t * 12 + n[i] * 10; o[0] = v; o[1] = v; o[2] = v + 3;
    });
  } },
  tire: { repeat: [6, 1], draw(c, S, R) {
    paint(c, S, (x, y, i, o) => {
      const g = (Math.abs(((x / S) * 8 + Math.sin((y / S) * 25) * 0.15) % 1 - 0.5) < 0.08) ? -12 : 0;
      const v = 24 + g + (R() - 0.5) * 10; o[0] = v; o[1] = v; o[2] = v;
    });
  } },
  bark: { repeat: [2, 3], draw(c, S, R) { drawBark(c, S, R, false); } },
  barkMoss: { repeat: [2, 3], draw(c, S, R) { drawBark(c, S, R, true); } },
  leaf: { alpha: true, draw(c, S, R) {
    c.clearRect(0, 0, S, S);
    const cx = S / 2; c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = t * Math.PI * 2;
      const prof = Math.sin(Math.acos(Math.cos(a))) ** 0.9;
      const r = (0.42 + (R() - 0.5) * 0.03) * S;
      const x = cx + Math.sin(a) * prof * r * 0.55, y = S / 2 - Math.cos(a) * r;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#5fbf3c'); g.addColorStop(1, '#2f8a2a');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(25,70,20,.65)'; c.lineWidth = S / 90;
    c.beginPath(); c.moveTo(cx, S * 0.92); c.lineTo(cx, S * 0.1); c.stroke();
    c.lineWidth = S / 200;
    for (let k = 0; k < 7; k++) { const y = S * (0.22 + k * 0.1); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx, y); c.quadraticCurveTo(cx + s * S * 0.1, y - S * 0.03, cx + s * S * 0.2, y - S * 0.08); c.stroke(); } }
  } },
  forestFloor: { repeat: [8, 8], draw(c, S, R) {
    const n = field(S, R, 6, 6, 4);
    paint(c, S, (x, y, i, o) => { const v = n[i]; o[0] = 40 + v * 30; o[1] = 27 + v * 20; o[2] = 18 + v * 12; });
    const cols = ['#9a6a2d', '#7a5222', '#b0803c', '#8a5c26', '#c79a52'];
    const count = Math.round(320 * (S / 256) ** 2);
    for (let k = 0; k < count; k++) {
      c.save(); c.translate(R() * S, R() * S); c.rotate(R() * 6.28);
      const l = (6 + R() * 8) * S / 256;
      c.fillStyle = cols[Math.floor(R() * cols.length)];
      c.beginPath(); c.ellipse(0, 0, l, l * 0.42, 0, 0, 6.28); c.fill();
      c.strokeStyle = 'rgba(60,35,15,.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-l, 0); c.lineTo(l, 0); c.stroke();
      c.restore();
    }
  } },
  steel: { draw(c, S, R) {
    const rows = new Float32Array(S).map(() => R());
    paint(c, S, (x, y, i, o) => { const v = 150 + rows[y] * 26 + (R() - 0.5) * 8; o[0] = v; o[1] = v + 2; o[2] = v + 6; });
    for (let k = 0; k < 30; k++) { c.strokeStyle = R() < 0.5 ? 'rgba(255,255,255,.25)' : 'rgba(60,60,70,.25)'; c.lineWidth = 0.6; const x = R() * S, y = R() * S, l = R() * S * 0.25; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + (R() - 0.5) * l * 0.4); c.stroke(); }
  } },
  woodMedium: { draw(c, S, R) { drawWood(c, S, R, '#6e4325', '#8f5a32', 10, 3); } },
  bowWood: { repeat: [1, 1], draw(c, S, R) { drawWood(c, S, R, '#a8703f', '#c48a52', 18, 1.5); } },
  woodLight: { draw(c, S, R) { drawWood(c, S, R, '#a77a4c', '#c79a68', 12, 2); } },
  tableWood: { draw(c, S, R) { drawWood(c, S, R, '#6f4426', '#9a6a40', 9, 2.5); } },
  stoneTiles: { repeat: [6, 6], draw(c, S, R) {
    const n = field(S, R, 8, 8, 4), N = 4, tw = S / N;
    const tint = Array.from({ length: N * N }, () => R() * 22);
    paint(c, S, (x, y, i, o) => {
      const tx = Math.floor(x / tw), ty = Math.floor(y / tw), fx = (x % tw) / tw, fy = (y % tw) / tw;
      const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
      const joint = edge < 0.025 ? 1 : 0, dust = ss(0.12, 0, edge) * 0.4;
      let v = 176 + tint[ty * N + tx] + n[i] * 26 + (R() - 0.5) * 10;
      v = joint ? 70 : v * (1 - dust * 0.25);
      o[0] = v + dust * 20; o[1] = v + dust * 14; o[2] = v;
    });
    for (let k = 0; k < 6; k++) walkLine(c, S, R, R(), R(), 10, 0.01, R() * 6.28, 1.2, 'rgba(70,70,72,.6)', 0.8);
  } },
  roughStone: { repeat: [6, 2], draw(c, S, R) {
    const n = field(S, R, 6, 6, 5), m = field(S, R, 3, 3, 3);
    paint(c, S, (x, y, i, o) => {
      const crack = Math.abs(m[i] - 0.5) < 0.012 ? 0.45 : 1;
      const v = (52 + n[i] * 60 + (R() - 0.5) * 14) * crack; o[0] = v; o[1] = v; o[2] = v + 3;
    });
  } },
  sand: { repeat: [6, 6], draw(c, S, R) {
    const n = field(S, R, 4, 4, 4);
    paint(c, S, (x, y, i, o) => {
      const rip = Math.sin((y / S) * 40 + n[i] * 8) * 0.5 + 0.5;
      const k = 0.88 + rip * 0.08 + (R() - 0.5) * 0.12;
      o[0] = 214 * k; o[1] = 192 * k; o[2] = 142 * k;
    });
  } },
  string: { repeat: [20, 1], draw(c, S, R) {
    paint(c, S, (x, y, i, o) => { const t = ((x + y) % (S / 8)) < S / 16 ? 245 : 205; const v = t + (R() - 0.5) * 12; o[0] = v; o[1] = v; o[2] = v - 6; });
  } },
  feather: { alpha: true, draw(c, S, R) {
    c.clearRect(0, 0, S, S);
    const cx = S / 2;
    for (let k = 0; k < 90; k++) {
      const t = k / 90, y = S * (0.05 + t * 0.9), w = Math.sin(t * Math.PI) * S * 0.38 + S * 0.03;
      const g = 140 + R() * 40; c.strokeStyle = `rgb(${g},${g * 0.72},${g * 0.45})`; c.lineWidth = Math.max(1, S / 140);
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx, y); c.quadraticCurveTo(cx + s * w * 0.6, y - S * 0.01, cx + s * w, y - S * 0.05); c.stroke(); }
    }
    c.strokeStyle = '#e8dcc2'; c.lineWidth = S / 50; c.beginPath(); c.moveTo(cx, S * 0.98); c.lineTo(cx, S * 0.03); c.stroke();
  } },
  target: { draw(c, S, R) {
    const rings = ['#f3efe6', '#c8322d', '#f3efe6', '#c8322d', '#e9b934'];
    paint(c, S, (x, y, i, o) => {
      const dx = x / S - 0.5, dy = y / S - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
      const idx = clamp(Math.floor((1 - r) * 5), 0, 4), col = r > 1 ? hex('#d9c8a2') : hex(rings[idx]);
      const wear = idx === 4 ? 0.82 + R() * 0.18 : 0.94 + R() * 0.06;
      o[0] = col[0] * wear; o[1] = col[1] * wear; o[2] = col[2] * wear;
    });
    dots(c, S, R, 40, 0.8, 1.8, () => 'rgba(40,25,10,.6)');
  } },
  grass: { repeat: [30, 30], draw(c, S, R) {
    const n = field(S, R, 4, 4, 3);
    paint(c, S, (x, y, i, o) => { const v = n[i]; o[0] = 62 + v * 26; o[1] = 128 + v * 40; o[2] = 44 + v * 16; });
    const count = Math.round(900 * (S / 256) ** 2);
    for (let k = 0; k < count; k++) {
      const x = R() * S, y = R() * S, g = 120 + R() * 70;
      c.strokeStyle = `rgba(${g * 0.45},${g},${g * 0.32},.8)`; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 3, y - (2 + R() * 4) * S / 256); c.stroke();
    }
  } },
  // ---- Construtor de Reinos (liso, aconchegante) ----
  blockStone: { draw(c, S, R) {
    const n = field(S, R, 6, 6, 5);
    paint(c, S, (x, y, i, o) => { const e = edgeShade(x, y, S); const v = (110 + n[i] * 55 + (R() - 0.5) * 16) * e; o[0] = v; o[1] = v; o[2] = v + 4; });
  } },
  blockWood: { draw(c, S, R) {
    const n = field(S, R, 2, 8, 4);
    paint(c, S, (x, y, i, o) => {
      const e = edgeShade(x, y, S), g = Math.sin((y / S) * 38 + n[i] * 9) * 0.5 + 0.5;
      const col = mixc(hex('#8a5a32'), hex('#b07a46'), g); o[0] = col[0] * e; o[1] = col[1] * e; o[2] = col[2] * e;
    });
  } },
  blockGrassTop: { draw(c, S, R) {
    const n = field(S, R, 6, 6, 3);
    paint(c, S, (x, y, i, o) => { const e = edgeShade(x, y, S), v = n[i]; o[0] = (70 + v * 30) * e; o[1] = (170 + v * 40) * e; o[2] = (50 + v * 20) * e; });
    const count = Math.round(500 * (S / 256) ** 2);
    for (let k = 0; k < count; k++) { const x = R() * S, y = R() * S; c.fillStyle = R() < 0.5 ? 'rgba(130,220,90,.7)' : 'rgba(40,110,35,.6)'; c.fillRect(x, y, S / 128, S / 48); }
  } },
  blockGrassSide: { draw(c, S, R) {
    const n = field(S, R, 6, 6, 3);
    paint(c, S, (x, y, i, o) => {
      const e = edgeShade(x, y, S), edge = 0.24 + Math.sin((x / S) * 30) * 0.03 + n[i] * 0.05;
      const col = y / S < edge ? [80 + n[i] * 30, 172 + n[i] * 30, 55] : [118 + n[i] * 30, 78 + n[i] * 20, 48];
      o[0] = col[0] * e; o[1] = col[1] * e; o[2] = col[2] * e;
    });
  } },
  blockWater: { draw(c, S, R) {
    const n = field(S, R, 4, 4, 3);
    paint(c, S, (x, y, i, o) => { const w = Math.sin((x / S + n[i] * 0.4) * 18) * 0.5 + 0.5; o[0] = 110 + w * 40; o[1] = 185 + w * 30; o[2] = 235; });
  } },
  blockCloud: { alpha: true, draw(c, S) {
    const g = c.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(245,248,255,.9)'); g.addColorStop(1, 'rgba(235,242,255,.55)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  } },
  // ---- Masmorra ----
  dungeonWall: { repeat: [3, 2], draw(c, S, R) {
    const n = field(S, R, 8, 8, 5), m = field(S, R, 4, 4, 3);
    const rows = 6, bh = S / rows;
    paint(c, S, (x, y, i, o) => {
      const row = Math.floor(y / bh), off = (row % 2) * 0.5, bw = S / 3;
      const fx = ((x / bw + off) % 1), fy = (y % bh) / bh;
      const edge = Math.min(fx, 1 - fx, fy * 0.5, (1 - fy) * 0.5);
      let v = 58 + n[i] * 34 + (R() - 0.5) * 10;
      if (edge < 0.03) v = 24;
      const moss = ss(0.58, 0.72, m[i]) * ss(0.2, 0.0, edge);
      o[0] = v * (1 - moss * 0.4); o[1] = v + moss * 40; o[2] = v * (1 - moss * 0.5);
    });
    for (let k = 0; k < 5; k++) walkLine(c, S, R, R(), R(), 14, 0.014, R() * 6.28, 1.0, 'rgba(5,5,5,.85)', 1.3);
  } },
  dungeonFloor: { repeat: [6, 6], seed: 'dungeonFloor', draw(c, S, R) {
    const n = field(S, R, 8, 8, 4), p = field(S, R, 3, 3, 3);
    paint(c, S, (x, y, i, o) => {
      const joint = (x % (S / 2) < S / 128) || (y % (S / 2) < S / 128);
      const puddle = ss(0.36, 0.28, p[i]);
      let v = 70 + n[i] * 26 + (R() - 0.5) * 10; if (joint) v = 34;
      v = v * (1 - puddle * 0.65);
      o[0] = v; o[1] = v + 2; o[2] = v + 5;
    });
  } },
  dungeonFloorRough: { repeat: [6, 6], seed: 'dungeonFloor', srgb: false, draw(c, S, R) {
    field(S, R, 8, 8, 4); const p = field(S, R, 3, 3, 3);
    paint(c, S, (x, y, i, o) => { const v = 235 - ss(0.36, 0.28, p[i]) * 215; o[0] = o[1] = o[2] = v; });
  } },
  runes: { alpha: true, draw(c, S, R) {
    c.clearRect(0, 0, S, S);
    c.strokeStyle = '#ffcf6a'; c.lineWidth = S / 64; c.lineCap = 'round';
    for (let g = 0; g < 6; g++) {
      const gx = (g % 3) * S / 3 + S / 6, gy = Math.floor(g / 3) * S / 2 + S / 4;
      c.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = R() * 6.28, r = S * 0.1;
        c.moveTo(gx + Math.cos(a) * r * R(), gy + Math.sin(a) * r * R());
        c.lineTo(gx + Math.cos(a + 2) * r, gy + Math.sin(a + 2) * r);
      }
      c.stroke();
    }
  } },
  // ---- Galáxia ----
  metalPanel: { draw(c, S, R) {
    const n = field(S, R, 6, 6, 3);
    paint(c, S, (x, y, i, o) => { const v = 52 + n[i] * 18 + (R() - 0.5) * 6; o[0] = v; o[1] = v + 2; o[2] = v + 6; });
    c.strokeStyle = 'rgba(15,16,20,.9)'; c.lineWidth = Math.max(1, S / 160);
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(0, k * S / 4); c.lineTo(S, k * S / 4); c.stroke(); }
    for (let k = 0; k < 8; k++) { const x = Math.floor(R() * 4) * S / 4 + S / 8, y = Math.floor(R() * 4) * S / 4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + S / 4); c.stroke(); }
    dots(c, S, R, 60, 1, 1.6, () => 'rgba(120,125,135,.8)');
  } },
  panelGlow: { draw(c, S) {
    c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
    c.strokeStyle = '#3fb6ff'; c.lineWidth = S / 40; c.strokeRect(S / 80, S / 80, S - S / 40, S - S / 40);
    c.lineWidth = S / 128; c.beginPath(); c.moveTo(0, S / 2); c.lineTo(S, S / 2); c.stroke();
  } },
  earth: { draw(c, S, R) {
    const n = field(S, R, 4, 2, 6), cl = field(S, R, 6, 3, 4);
    paint(c, S, (x, y, i, o) => {
      const lat = Math.abs(y / S - 0.5) * 2;
      let col = n[i] > 0.54 ? mixc(hex('#3f7d3a'), hex('#8a7a4a'), ss(0.54, 0.7, n[i])) : mixc(hex('#0f3d8c'), hex('#1d63b8'), n[i]);
      if (lat > 0.86) col = [235, 240, 248];
      const cloud = ss(0.55, 0.72, cl[i]);
      col = mixc(col, [250, 252, 255], cloud * 0.9);
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
    });
  } },
  // ---- Mergulho ----
  coral: { repeat: [2, 2], draw(c, S, R) {
    const n = field(S, R, 8, 8, 4);
    paint(c, S, (x, y, i, o) => { const v = 205 + n[i] * 45; o[0] = v; o[1] = v; o[2] = v; });
    dots(c, S, R, 500, 1.2, 3.5, (R) => `rgba(110,90,100,${0.35 + R() * 0.4})`);
  } },
  turtleShell: { draw(c, S, R) {
    const pts = Array.from({ length: 13 }, () => [R() * S, R() * S, 0.75 + R() * 0.25]);
    paint(c, S, (x, y, i, o) => {
      let d1 = 1e9, d2 = 1e9, k = 0;
      for (let j = 0; j < pts.length; j++) {
        for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
          const d = (x - pts[j][0] - ox) ** 2 + (y - pts[j][1] - oy) ** 2;
          if (d < d1) { d2 = d1; d1 = d; k = j; } else if (d < d2) d2 = d;
        }
      }
      const border = Math.sqrt(d2) - Math.sqrt(d1) < S / 60;
      const t = pts[k][2] * (1 - Math.sqrt(d1) / (S * 0.5) * 0.4) + (R() - 0.5) * 0.06;
      const col = border ? [58, 38, 18] : [150 * t + 20, 112 * t + 10, 50 * t];
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
    });
  } },
  fishScale: { repeat: [3, 2], draw(c, S, R) {
    const r = S / 10;
    c.fillStyle = '#d8dde3'; c.fillRect(0, 0, S, S);
    for (let y = -1; y < 12; y++) for (let x = -1; x < 11; x++) {
      const cx = x * r + (y % 2) * r / 2, cy = y * r * 0.6;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
      g.addColorStop(0, '#f4f6f9'); g.addColorStop(1, '#a6aeb8');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * 0.58, 0, Math.PI); c.fill();
    }
  } },
  // ---- Montanha ----
  rockStrata: { repeat: [4, 8], draw(c, S, R) {
    const n = field(S, R, 6, 6, 5), m = field(S, R, 4, 4, 3);
    paint(c, S, (x, y, i, o) => {
      const band = Math.sin((y / S) * 28 + n[i] * 5) * 0.5 + 0.5;
      const crack = Math.abs(m[i] - 0.5) < 0.01 ? 0.4 : 1;
      const v = (112 + band * 26 + n[i] * 30 + (R() - 0.5) * 14) * crack;
      o[0] = v; o[1] = v + 1; o[2] = v + 5;
    });
  } },
  valley: { repeat: [6, 6], draw(c, S, R) {
    const n = field(S, R, 4, 4, 4), f = field(S, R, 8, 8, 1);
    paint(c, S, (x, y, i, o) => {
      const col = mixc(hex('#4b7a3a'), hex('#8a8a50'), ss(0.4, 0.7, f[i]) * 0.7 + n[i] * 0.3);
      o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
    });
  } },
  // ---- Cozinha ----
  marble: { repeat: [2, 1], draw(c, S, R) {
    const n = field(S, R, 4, 4, 6);
    paint(c, S, (x, y, i, o) => {
      const v = Math.abs(Math.sin((x / S) * 6 + (y / S) * 3 + n[i] * 12));
      const vein = ss(0.08, 0.0, v);
      const base = 236 + (R() - 0.5) * 4;
      o[0] = base - vein * 70; o[1] = base - vein * 68; o[2] = base - vein * 62;
    });
  } },
  brushedMetal: { draw(c, S, R) {
    const rows = new Float32Array(S).map(() => R());
    paint(c, S, (x, y, i, o) => { const v = 182 + rows[y] * 30 + (R() - 0.5) * 8; o[0] = v; o[1] = v + 2; o[2] = v + 5; });
  } },
  onionSkin: { draw(c, S, R) {
    const n = field(S, R, 2, 8, 4);
    paint(c, S, (x, y, i, o) => { const l = Math.sin((x / S) * 40 + n[i] * 6) * 0.5 + 0.5; o[0] = 150 + l * 40; o[1] = 100 + l * 25; o[2] = 55 + l * 15; });
  } },
  carrot: { draw(c, S, R) {
    const n = field(S, R, 2, 6, 3);
    paint(c, S, (x, y, i, o) => { const l = (Math.sin((y / S) * 50 + n[i] * 4) * 0.5 + 0.5) * 0.15; o[0] = 238 - l * 120; o[1] = 120 - l * 80; o[2] = 30; });
  } },
  // ---- Sala de jogos ----
  cardBack: { draw(c, S) {
    c.fillStyle = '#f2ead8'; c.fillRect(0, 0, S, S);
    c.fillStyle = '#16245a'; c.fillRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
    c.strokeStyle = 'rgba(214,176,90,.55)'; c.lineWidth = Math.max(1, S / 180);
    for (let k = -8; k < 16; k++) {
      c.beginPath(); c.moveTo(S * 0.06 + k * S / 8, S * 0.06); c.lineTo(S * 0.06 + (k + 8) * S / 8, S * 0.94); c.stroke();
      c.beginPath(); c.moveTo(S * 0.06 + k * S / 8, S * 0.94); c.lineTo(S * 0.06 + (k + 8) * S / 8, S * 0.06); c.stroke();
    }
    c.strokeStyle = '#d6b05a'; c.lineWidth = S / 64; c.strokeRect(S * 0.1, S * 0.1, S * 0.8, S * 0.8);
  } },
  rubber: { draw(c, S, R) { paint(c, S, (x, y, i, o) => { const v = 20 + (R() < 0.08 ? 10 : 0) + (R() - 0.5) * 6; o[0] = v; o[1] = v; o[2] = v + 1; }); } },
};

function drawBark(c, S, R, moss) {
  const n = field(S, R, 16, 2, 4), m = field(S, R, 3, 3, 3);
  const a = hex('#33221a'), b = hex('#6b4a32');
  paint(c, S, (x, y, i, o) => {
    let col = mixc(a, b, n[i]);
    const k = 0.9 + (R() - 0.5) * 0.2; col = [col[0] * k, col[1] * k, col[2] * k];
    if (moss) col = mixc(col, hex('#7fae4c'), ss(0.58, 0.72, m[i]) * 0.85);
    o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
  });
  for (let k = 0; k < 9; k++) walkLine(c, S, R, R(), 0, 26, 0.04, Math.PI / 2, 0.5, 'rgba(18,10,6,.85)', 1.6);
}

function drawWood(c, S, R, ca, cb, freq, warp) {
  const n = field(S, R, 2, 8, 4);
  const a = hex(ca), b = hex(cb);
  paint(c, S, (x, y, i, o) => {
    const g = Math.sin((y / S) * freq * 6.28 / 2 + n[i] * warp * 4) * 0.5 + 0.5;
    const col = mixc(a, b, g * 0.8 + (R() - 0.5) * 0.08);
    o[0] = col[0]; o[1] = col[1]; o[2] = col[2];
  });
}

function edgeShade(x, y, S) {
  const e = Math.min(x, y, S - 1 - x, S - 1 - y) / S;
  return 0.78 + ss(0, 0.08, e) * 0.22;
}

// ---- Minecraft: pixel art 16×16 ----
const MC = {
  mcGrassTop: (p, R) => p((x, y) => pick(R, ['#5e9d34', '#508c2d', '#6aaa3c', '#467828', '#5a9632'])),
  mcGrassSide: (p, R) => { const fr = Array.from({ length: 16 }, () => 2 + Math.floor(R() * 3)); p((x, y) => y < fr[x] ? pick(R, ['#5e9d34', '#508c2d', '#6aaa3c']) : dirtPx(R)); },
  mcDirt: (p, R) => p(() => dirtPx(R)),
  mcStone: (p, R) => p(() => pick(R, ['#7d7d7d', '#6e6e6e', '#8c8c8c', '#646464', '#7a7a7a', '#858585'])),
  mcLogSide: (p, R) => p((x) => pick(R, x % 4 === 0 ? ['#4f3a22', '#55402a'] : ['#66503a', '#6b5432', '#5c4630', '#725a38'])),
  mcLogTop: (p, R) => p((x, y) => { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); if (d > 6.5) return pick(R, ['#55402a', '#66503a']); return Math.floor(d) % 2 ? '#b8935a' : pick(R, ['#a07a46', '#aa844e']); }),
  mcPlanks: (p, R) => p((x, y) => (y % 4 === 3) ? '#7a5a30' : ((x + Math.floor(y / 4) * 7) % 16 === 0 ? '#80602f' : pick(R, ['#b08a50', '#a8834a', '#ba9458', '#9f7b44']))),
  mcLeaves: (p, R) => p(() => R() < 0.18 ? null : pick(R, ['#3e7a26', '#356b20', '#4a8a2e', '#2e5e1a'])),
  mcSand: (p, R) => p(() => pick(R, ['#dbcf95', '#d4c78a', '#e2d6a0', '#cfc183'])),
  mcWater: (p, R) => p((x, y) => ((x + y * 2) % 7 === 0) ? '#6fa6ff' : pick(R, ['#3f76e4', '#3a6fd8', '#4580ee'])),
  mcCrack1: (p, R) => crackPx(p, R, 4), mcCrack2: (p, R) => crackPx(p, R, 9),
  mcCrack3: (p, R) => crackPx(p, R, 16), mcCrack4: (p, R) => crackPx(p, R, 26),
};
const pick = (R, a) => a[Math.floor(R() * a.length)];
const dirtPx = (R) => R() < 0.08 ? '#8b8b8b' : pick(R, ['#866043', '#79553a', '#966c4b', '#644630']);
function crackPx(p, R2, n) {
  const R = rng('crack'); const on = new Set();
  let x = 8, y = 8;
  for (let k = 0; k < n; k++) { on.add(x + y * 16); x = clamp(x + Math.floor(R() * 3) - 1, 0, 15); y = clamp(y + Math.floor(R() * 3) - 1, 0, 15); if (k % 7 === 6) { x = 8; y = 8; } }
  p((x, y) => on.has(x + y * 16) ? 'rgba(0,0,0,.75)' : null);
}

// ---------- biblioteca ----------
export class TexLib {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = new Map();
    this.pending = []; // texturas esperando a versão 256 px
    this.aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  }

  _canvas(S) { const c = document.createElement('canvas'); c.width = c.height = S; return c; }

  get(name, opt = {}) {
    const key = name + (opt.repeat ? ':' + opt.repeat.join('x') : '');
    if (this.cache.has(key)) return this.cache.get(key);
    let tex;
    if (MC[name]) tex = this._pixel(name);
    else {
      const def = DEFS[name];
      if (!def) throw new Error('Textura desconhecida: ' + name);
      const cv = this._canvas(LOW);
      def.draw(cv.getContext('2d', { willReadFrequently: true }), LOW, rng(def.seed || name));
      tex = new THREE.CanvasTexture(cv);
      if (def.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
      const rep = opt.repeat || def.repeat;
      if (rep) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(rep[0], rep[1]); }
      tex.anisotropy = this.aniso;
      // Carregamento progressivo: melhora para 256px no tempo ocioso
      const job = () => {
        if (tex.userData.disposed || tex.userData.hi) return;
        const hi = this._canvas(MAX);
        def.draw(hi.getContext('2d', { willReadFrequently: true }), MAX, rng(def.seed || name));
        tex.image = hi; tex.userData.hi = true; tex.dispose(); tex.needsUpdate = true;
      };
      this.pending.push(job);
      idle(() => { const i = this.pending.indexOf(job); if (i >= 0) { this.pending.splice(i, 1); job(); } });
    }
    tex.userData.owner = opt.owner || 'game';
    this.cache.set(key, tex);
    return tex;
  }

  _pixel(name) {
    const cv = this._canvas(16), c = cv.getContext('2d'), R = rng(name);
    MC[name]((fn) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const col = fn(x, y); if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); } } }, R);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter;
    return tex;
  }

  // Gera agora todas as versões finais pendentes (chamado durante a tela de carregamento,
  // para não haver travadinhas no meio do jogo)
  flush() { const jobs = this.pending.splice(0); for (const j of jobs) j(); }

  // Desenha uma textura num canvas novo (arte dos blocos da biblioteca)
  drawCanvas(name, S = 128) {
    if (MC[name]) { const t = this._pixel(name); return t.image; }
    const def = DEFS[name]; const cv = this._canvas(S);
    def.draw(cv.getContext('2d', { willReadFrequently: true }), S, rng(def.seed || name));
    return cv;
  }

  // Libera as texturas de um dono (ex.: ao sair de um jogo)
  release(owner = 'game') {
    for (const [k, t] of this.cache) if (t.userData.owner === owner) { t.userData.disposed = true; t.dispose(); this.cache.delete(k); }
  }
}

// Texto em textura (rótulos de botões, placares)
export function textCanvas(text, { w = 512, h = 128, font = 600, size = 0.5, fg = '#ffffff', bg = null, radius = 0.2, align = 'center', sub = null, subColor = '#cfe0ff' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; roundRect(x, 0, 0, w, h, Math.min(w, h) * radius); x.fill(); }
  x.fillStyle = fg; x.textAlign = align; x.textBaseline = 'middle';
  const px = Math.round(h * size * (sub ? 0.8 : 1));
  x.font = `${font} ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
  const tx = align === 'center' ? w / 2 : align === 'left' ? h * 0.25 : w - h * 0.25;
  fitText(x, text, tx, sub ? h * 0.38 : h / 2, w * 0.92);
  if (sub) { x.fillStyle = subColor; x.font = `600 ${Math.round(h * 0.22)}px system-ui, sans-serif`; fitText(x, sub, tx, h * 0.76, w * 0.94); }
  return c;
}

export function textTexture(text, opt) {
  const t = new THREE.CanvasTexture(textCanvas(text, opt));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function roundRect(x, X, Y, W, H, r) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}

export function fitText(x, text, tx, ty, maxW) {
  let s = String(text);
  if (x.measureText(s).width > maxW) { while (s.length > 1 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1); s += '…'; }
  x.fillText(s, tx, ty);
}

export function wrapText(x, text, X, Y, maxW, lineH, maxLines = 3) {
  const words = String(text).split(/\s+/); let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (x.measureText(test).width > maxW && line) {
      if (n === maxLines - 1) { fitText(x, line + ' ' + words.slice(i).join(' '), X, Y + n * lineH, maxW); return n + 1; }
      x.fillText(line, X, Y + n * lineH); line = words[i]; n++;
    } else line = test;
  }
  if (line) { x.fillText(line, X, Y + n * lineH); n++; }
  return n;
}
