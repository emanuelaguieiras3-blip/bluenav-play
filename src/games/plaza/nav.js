// Navegação dos bots: grade de ocupação + A* com 8 vizinhos e atalho por
// linha de visão. Puro (sem Three.js) para testar.

export function buildGrid(boxes, half, { cell = 0.5, margin = 0.35, minHeight = 0.6 } = {}) {
  const size = Math.ceil((half * 2) / cell), blocked = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -half + (i + 0.5) * cell, z = -half + (j + 0.5) * cell;
    if (Math.abs(x) > half - 0.6 || Math.abs(z) > half - 0.6) { blocked[j * size + i] = 1; continue; }
    for (const b of boxes) if (b.maxY > minHeight && x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) { blocked[j * size + i] = 1; break; }
  }
  return { size, cell, half, blocked };
}

const toCell = (g, x, z) => [Math.max(0, Math.min(g.size - 1, Math.floor((x + g.half) / g.cell))), Math.max(0, Math.min(g.size - 1, Math.floor((z + g.half) / g.cell)))];
const toWorld = (g, i, j) => [-g.half + (i + 0.5) * g.cell, -g.half + (j + 0.5) * g.cell];
export function isFree(g, x, z) { const [i, j] = toCell(g, x, z); return !g.blocked[j * g.size + i]; }

// Nearest free cell (spiral) so a start or goal inside a margin still works.
function nearestFree(g, i, j) {
  if (!g.blocked[j * g.size + i]) return [i, j];
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= g.size || b >= g.size) continue;
    if (!g.blocked[b * g.size + a]) return [a, b];
  }
  return null;
}

function lineFree(g, a, b) {
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (g.cell * 0.5));
  for (let k = 1; k < steps; k++) { const t = k / steps; if (!isFree(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
  return true;
}

// Returns [[x, z], ...] from start to goal, or null when unreachable.
export function findPath(g, from, to, maxNodes = 20000) {
  const s0 = toCell(g, from[0], from[1]), g0 = toCell(g, to[0], to[1]);
  const s = nearestFree(g, ...s0), goal = nearestFree(g, ...g0); if (!s || !goal) return null;
  const N = g.size, key = (i, j) => j * N + i, start = key(...s), end = key(...goal);
  const gScore = new Float32Array(N * N).fill(Infinity), came = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
  const open = [start]; gScore[start] = 0;
  const h = k => Math.hypot(k % N - goal[0], Math.floor(k / N) - goal[1]);
  let visited = 0;
  while (open.length && visited++ < maxNodes) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (gScore[open[k]] + h(open[k]) < gScore[open[bi]] + h(open[bi])) bi = k;
    const cur = open.splice(bi, 1)[0]; if (cur === end) break; if (closed[cur]) continue; closed[cur] = 1;
    const ci = cur % N, cj = Math.floor(cur / N);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = key(ni, nj); if (g.blocked[nk] || closed[nk]) continue;
      if (di && dj && (g.blocked[key(ci + di, cj)] || g.blocked[key(ci, cj + dj)])) continue; // no corner cutting
      const cost = gScore[cur] + (di && dj ? 1.4142 : 1);
      if (cost < gScore[nk]) { gScore[nk] = cost; came[nk] = cur; open.push(nk); }
    }
  }
  if (gScore[end] === Infinity) return null;
  const cells = []; for (let k = end; k !== -1; k = came[k]) cells.push(toWorld(g, k % N, Math.floor(k / N)));
  cells.reverse();
  // String-pull: keep only points needed to stay in line of sight.
  const path = [cells[0]];
  for (let k = 1; k < cells.length; k++) if (!lineFree(g, path[path.length - 1], cells[k])) path.push(cells[k - 1]);
  path.push(cells[cells.length - 1]);
  return path;
}
