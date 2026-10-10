// Audio timing and scoring stay independent of rendering and hand tracking.
export const RHYTHM_TRACKS = [
  { id: 'neon', name: 'Pulso Neon', bpm: 110, duration: 120, scale: [220, 277, 330, 440], seed: 17 },
  { id: 'drive', name: 'Hyperdrive', bpm: 140, duration: 120, scale: [165, 196, 247, 330], seed: 71 },
  { id: 'aurora', name: 'Aurora', bpm: 90, duration: 120, scale: [261, 330, 392, 523], seed: 31 },
];

export function makeChart(times, difficulty = 'normal', seed = 17) {
  let n = seed >>> 0;
  const random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  const notes = [];
  let previous = -Infinity;
  for (const at of times) {
    if (!Number.isFinite(at) || at < 0 || at - previous < (difficulty === 'easy' ? 0.48 : 0.26)) continue;
    const side = notes.length % 2;
    notes.push({ at, side, x: side ? 0.32 : -0.32, y: random() < 0.5 ? 1.15 : 1.48,
      direction: difficulty === 'easy' ? null : [0, 1, 2, 3][Math.floor(random() * 4)] });
    previous = at;
  }
  return notes;
}

export function presetChart(track, difficulty) {
  const times = [];
  for (let t = 0.5; t < track.duration - 0.5; t += 60 / track.bpm) times.push(t);
  return makeChart(times, difficulty, track.seed);
}

// Approximate onset detection, not an authored Beat Saber beatmap.
// Decimate each 20 ms window so long files don't block on every PCM sample.
export function detectOnsets(buffer) {
  const data = buffer.getChannelData(0), rate = buffer.sampleRate;
  const hop = Math.max(1, Math.floor(rate * 0.02)), energy = [];
  for (let i = 0; i < data.length; i += hop) {
    let sum = 0, count = 0;
    for (let j = i; j < Math.min(data.length, i + hop); j += 8) { sum += data[j] * data[j]; count++; }
    energy.push(Math.sqrt(sum / Math.max(1, count)));
  }
  const times = [];
  let last = -1;
  for (let i = 2; i < energy.length - 1; i++) {
    let mean = 0;
    const from = Math.max(0, i - 25);
    for (let j = from; j < i; j++) mean += energy[j];
    mean /= i - from;
    const t = i * hop / rate;
    if (energy[i] > 0.012 && energy[i] > mean * 1.35 && energy[i] >= energy[i - 1] && energy[i] > energy[i + 1] && t - last >= 0.26) {
      times.push(t); last = t;
    }
  }
  return times;
}

export function cutResult({ side, noteSide, twoHands, motionX, motionY, speed, direction, timing }) {
  if (twoHands && side !== noteSide) return { hit: false, reason: 'Cor errada' };
  if (speed < 0.28) return { hit: false, reason: 'Mova o sabre para cortar' };
  if (direction !== null && direction !== undefined) {
    const axis = [[0, -1], [0, 1], [-1, 0], [1, 0]][direction];
    const length = Math.hypot(motionX, motionY);
    if (!axis || length < 0.001 || (motionX * axis[0] + motionY * axis[1]) / length < 0.45) return { hit: false, reason: 'Siga a seta' };
  }
  const quality = Math.max(0, 1 - Math.abs(timing) / 0.18);
  return { hit: true, points: 60 + Math.round(quality * 40), perfect: quality >= 0.75 };
}
