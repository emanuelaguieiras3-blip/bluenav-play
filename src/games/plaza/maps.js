// 500 salas BlueNav geradas por semente: cada índice gera sempre o mesmo mapa.
// Dados puros (sem Three.js) para validar todos os mapas nos testes.

export const MAP_COUNT = 500;

export const THEMES = [
  { id: 'cidade', name: 'Cidade', ground: 'asphalt', groundColor: '#8c9096', palette: ['#d8dde3', '#9fb4c8', '#f2c14e', '#e86a50', '#5b6b7a'], sky: ['#6fa1d6', '#d6e6f4', '#4e5a63'], fog: '#cfdbe6' },
  { id: 'deserto', name: 'Deserto', ground: 'sand', groundColor: '#e3c48f', palette: ['#d9a35f', '#b9774a', '#f1dcb0', '#8a5a3b', '#e7b86f'], sky: ['#5f9fd8', '#f6dfb4', '#9a7a52'], fog: '#efd9b0' },
  { id: 'neve', name: 'Neve', ground: 'snow', groundColor: '#f2f6fa', palette: ['#dfe9f2', '#9cc3e0', '#e05a5a', '#6a8fb0', '#ffffff'], sky: ['#88b4dc', '#eef5fb', '#a8bccd'], fog: '#e6eff7' },
  { id: 'floresta', name: 'Floresta', ground: 'forestFloor', groundColor: '#9aa66e', palette: ['#6b4f35', '#4f7a3a', '#9c7b52', '#3d5c2c', '#c9a46a'], sky: ['#6aa3d0', '#d7ead0', '#3a4a2a'], fog: '#cfe2c6' },
  { id: 'espaco', name: 'Estação Espacial', ground: 'metalPanel', groundColor: '#aeb8c4', palette: ['#c9d3de', '#4fd1ff', '#7a5cff', '#2c3442', '#ff5fa2'], sky: ['#05060f', '#1c2240', '#04050a'], fog: '#141a30', gravity: 4.5 },
  { id: 'vulcao', name: 'Vulcão', ground: 'roughStone', groundColor: '#5a4a44', palette: ['#3a2d2a', '#ff6a2b', '#8a3b22', '#ffb347', '#5e5550'], sky: ['#3a1a14', '#d4683a', '#1a0d0a'], fog: '#7a3a24' },
  { id: 'praia', name: 'Praia', ground: 'sand', groundColor: '#f0dcae', palette: ['#4fb6c9', '#f7d26b', '#ff7f6a', '#ffffff', '#3d8a6a'], sky: ['#4ea3e0', '#e9f6ff', '#d9c08a'], fog: '#dff0f7' },
  { id: 'neon', name: 'Neon', ground: 'stoneTiles', groundColor: '#2a2c3a', palette: ['#ff3ea5', '#36e3ff', '#a35bff', '#1b1c26', '#ffe14d'], sky: ['#0b0820', '#3b1f5c', '#08060f'], fog: '#2a1640', emissive: true },
  { id: 'castelo', name: 'Castelo', ground: 'stoneTiles', groundColor: '#a8a29a', palette: ['#8e8579', '#6b6157', '#c9b98f', '#7a2f2f', '#4a5a7a'], sky: ['#7aa2c8', '#e2e8ee', '#5a5a52'], fog: '#d2d8de' },
  { id: 'ilha', name: 'Ilha Tropical', ground: 'grass', groundColor: '#7fb05a', palette: ['#d9b77a', '#3f9a5a', '#4fb6c9', '#a86b3a', '#f2e2a8'], sky: ['#55a8e6', '#e6f6ff', '#4a8a5a'], fog: '#d6eef6' },
];

export const MODES = [
  { id: 'corrida', name: 'Corrida', icon: '🏎️', goal: 'Complete 3 voltas passando pelos anéis em ordem.' },
  { id: 'paintball', name: 'Paintball', icon: '🎨', goal: 'Primeiro time a 10 pontos vence.' },
  { id: 'parkour', name: 'Parkour', icon: '🧗', goal: 'Chegue à bandeira sem cair.' },
  { id: 'encontro', name: 'Encontro', icon: '🎉', goal: 'Passeie, dirija e brinque com os objetos.' },
];

const ADJ = ['Veloz', 'Dourado', 'Sombrio', 'Brilhante', 'Selvagem', 'Gelado', 'Ardente', 'Secreto', 'Antigo', 'Gigante', 'Pequeno', 'Elétrico', 'Perdido', 'Real', 'Turbo', 'Cósmico', 'Azul', 'Rubro', 'Mágico', 'Louco'];
const NOUN = { corrida: ['Circuito', 'Autódromo', 'Rali', 'Pista', 'Grande Prêmio'], paintball: ['Campo', 'Fortaleza', 'Trincheira', 'Base', 'Arena'], parkour: ['Torre', 'Escalada', 'Desafio', 'Trilha', 'Salto'], encontro: ['Praça', 'Clube', 'Parque', 'Festa', 'Terraço'] };

// mulberry32: small deterministic PRNG.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (R, list) => list[Math.floor(R() * list.length) % list.length];
const round = v => Math.round(v * 100) / 100;

function block(x, y, z, w, h, d, color, extra = {}) { return { x: round(x), y: round(y), z: round(z), w: round(w), h: round(h), d: round(d), color, ...extra }; }

// ---- corrida: closed track of control points with a road width ----
function buildRace(R, theme) {
  const n = 8 + Math.floor(R() * 5), base = 38 + R() * 30, points = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, r = base * (0.72 + R() * 0.5);
    points.push([round(Math.cos(a) * r * (1.1 + R() * 0.3)), round(Math.sin(a) * r)]);
  }
  const width = round(9 + R() * 4), size = Math.ceil(base * 2.2 + 30);
  const blocks = [];
  // Scenery blocks away from the road (checked again by the validator).
  for (let i = 0; i < 26; i++) {
    const a = R() * Math.PI * 2, r = base * (R() < 0.5 ? 0.15 + R() * 0.25 : 1.75 + R() * 0.3), h = 2 + R() * 9;
    blocks.push(block(Math.cos(a) * r, h / 2, Math.sin(a) * r, 2 + R() * 5, h, 2 + R() * 5, pick(R, theme.palette), { kind: 'scenery' }));
  }
  return { points, width, size, blocks, laps: 3, bots: 3 };
}

// ---- paintball: mirrored cover (fair for both teams) ----
function buildPaintball(R, theme) {
  const half = Math.round(16 + R() * 14), blocks = [];
  const count = 6 + Math.floor(R() * 8);
  for (let i = 0; i < count; i++) {
    const x = (R() - 0.5) * (half * 1.6), z = 3 + R() * (half - 9.5), w = 0.8 + R() * 3, h = 1 + R() * 1.6, d = 0.8 + R() * 2.4, color = pick(R, theme.palette);
    const shape = R() < 0.3 ? 'cylinder' : 'box';
    blocks.push(block(x, h / 2, z, w, h, d, color, { kind: 'cover', shape }), block(-x, h / 2, -z, w, h, d, color, { kind: 'cover', shape }));
  }
  // Middle cover, then the walls around the field.
  blocks.push(block(0, 0.8, 0, 3 + R() * 3, 1.6, 0.8, pick(R, theme.palette), { kind: 'cover' }));
  for (const s of [-1, 1]) {
    blocks.push(block(s * (half + 0.5), 1.5, 0, 1, 3, half * 2 + 2, theme.palette[4], { kind: 'wall' }));
    blocks.push(block(0, 1.5, s * (half + 0.5), half * 2 + 2, 3, 1, theme.palette[4], { kind: 'wall' }));
  }
  return { half, blocks, teamSize: 3, target: 10, bases: [[0, -(half - 2.5)], [0, half - 2.5]] };
}

// ---- parkour: chain of reachable platforms ending at a flag ----
export const PARKOUR_LIMITS = { gap: 1.9, rise: 0.9 };
function buildParkour(R, theme) {
  const count = 12 + Math.floor(R() * 18), blocks = [];
  let x = 0, y = 0, z = -3, heading = 0;
  blocks.push(block(0, -0.25, 0, 6, 0.5, 6, theme.palette[0], { kind: 'platform', checkpoint: true }));
  const path = [];
  for (let i = 0; i < count; i++) {
    heading += (R() - 0.5) * 1.1;
    const size = 1.4 + R() * 1.8, gap = 0.6 + R() * (PARKOUR_LIMITS.gap - 0.6), rise = (R() - 0.25) * PARKOUR_LIMITS.rise;
    const prevHalf = i ? path[i - 1].w / 2 : 3;
    x += Math.sin(heading) * (prevHalf + gap + size / 2) * -1;
    z += -Math.cos(heading) * (prevHalf + gap + size / 2);
    y = Math.max(0, y + rise);
    const moving = i > 3 && R() < 0.18 ? { axis: R() < 0.5 ? 'x' : 'y', amp: round(0.6 + R() * 0.8), speed: round(0.5 + R() * 0.6) } : null;
    const p = block(x, y - 0.25, z, size, 0.5, size, pick(R, theme.palette), { kind: 'platform', checkpoint: i % 6 === 5, moving, gap: round(gap), rise: round(rise) });
    blocks.push(p); path.push(p);
  }
  const last = path[path.length - 1];
  return { blocks, finish: [last.x, last.y + 0.25, last.z], killY: -6 };
}

// ---- encontro: plaza with benches, stage, fountain, props and a car ----
function buildHangout(R, theme) {
  const half = Math.round(18 + R() * 12), blocks = [];
  blocks.push(block(0, 0.3, 0, 4, 0.6, 4, theme.palette[0], { kind: 'fountain', shape: 'cylinder' }));
  const stageZ = -(half - 5);
  blocks.push(block(0, 0.4, stageZ, 8, 0.8, 4, theme.palette[1], { kind: 'stage' }));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + R() * 0.2, r = 7 + R() * 2;
    blocks.push(block(Math.cos(a) * r, 0.25, Math.sin(a) * r, 2, 0.5, 0.6, theme.palette[3], { kind: 'bench', yaw: round(-a) }));
  }
  for (let i = 0; i < 10; i++) {
    const a = R() * Math.PI * 2, r = half * (0.65 + R() * 0.3), h = 2 + R() * 5;
    blocks.push(block(Math.cos(a) * r, h / 2, Math.sin(a) * r, 1.5 + R() * 3, h, 1.5 + R() * 3, pick(R, theme.palette), { kind: 'scenery' }));
  }
  const props = Array.from({ length: 8 + Math.floor(R() * 8) }, () => ({ kind: pick(R, ['ball', 'crate', 'ball', 'cone', 'barrel']), x: round((R() - 0.5) * 10), z: round(4 + R() * 6) }));
  return { half, blocks, props, car: [round(half * 0.4), round(half * 0.4)], danceFloor: [round(-half * 0.4), round(-half * 0.3)] };
}

const cache = new Map();
export function generateMap(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MAP_COUNT) throw new RangeError('Mapa inexistente: ' + index);
  if (cache.has(index)) return cache.get(index);
  const theme = THEMES[index % THEMES.length], mode = MODES[Math.floor(index / THEMES.length) % MODES.length];
  const seed = (index + 1) * 2654435761, R = rng(seed);
  const name = `${pick(R, NOUN[mode.id])} ${pick(R, ADJ)}`; // theme shows on the card subtitle
  const data = mode.id === 'corrida' ? buildRace(R, theme) : mode.id === 'paintball' ? buildPaintball(R, theme) : mode.id === 'parkour' ? buildParkour(R, theme) : buildHangout(R, theme);
  const map = { index, id: `sala-${String(index + 1).padStart(3, '0')}`, name: `${name} #${index + 1}`, theme, mode, seed, ...data };
  if (mode.id === 'corrida') removeBlocksOnRoad(map);
  cache.set(index, map);
  return map;
}

// Sample the closed Catmull-Rom centre line of a race map (pure math).
export function trackPoints(map, samples = 240) {
  const P = map.points, n = P.length, out = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples * n, k = Math.floor(t), f = t - k;
    const p0 = P[(k - 1 + n) % n], p1 = P[k % n], p2 = P[(k + 1) % n], p3 = P[(k + 2) % n];
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * f + (2 * a - 5 * b + 4 * c2 - d) * f * f + (-a + 3 * b - 3 * c2 + d) * f * f * f);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}
export function distanceToTrack(points, x, z) {
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, az] = points[i], [bx, bz] = points[(i + 1) % points.length], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
function removeBlocksOnRoad(map) {
  const pts = trackPoints(map, 160);
  map.blocks = map.blocks.filter(b => distanceToTrack(pts, b.x, b.z) > map.width / 2 + Math.hypot(b.w, b.d) / 2 + 2);
}

// Search/filter for the map browser.
export function listMaps({ mode = null, theme = null, query = '' } = {}) {
  const q = query.trim().toLowerCase(), out = [];
  for (let i = 0; i < MAP_COUNT; i++) {
    const m = generateMap(i);
    if (mode && m.mode.id !== mode) continue;
    if (theme && m.theme.id !== theme) continue;
    if (q && !m.name.toLowerCase().includes(q) && String(i + 1) !== q) continue;
    out.push(m);
  }
  return out;
}
