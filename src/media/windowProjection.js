// CSS perspective mapping for the official cross-origin iframe. No pixel capture.
export function quadTransform(width, height, points) {
  if (!(width > 0 && height > 0) || points.length !== 4 || points.some(p => !p.every(Number.isFinite))) return null;
  const source = [[0, 0], [width, 0], [width, height], [0, height]];
  const rows = source.flatMap(([x, y], i) => {
    const [u, v] = points[i];
    return [[x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]];
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const value = rows[col][col]; if (Math.abs(value) < 1e-9) return null;
    for (let c = col; c < 9; c++) rows[col][c] /= value;
    for (let r = 0; r < 8; r++) if (r !== col) {
      const factor = rows[r][col]; for (let c = col; c < 9; c++) rows[r][c] -= factor * rows[col][c];
    }
  }
  const [a, b, c, d, e, f, g, h] = rows.map(row => row[8]);
  return [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];
}

export function videoRect(width, height) {
  const w = width - 60, h = Math.min(w * 9 / 16, height - 240);
  return { x: 30, y: 92, w, h };
}
