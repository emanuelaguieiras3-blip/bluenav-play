// Audio timing and scoring stay independent of rendering and hand tracking.
export const RHYTHM_TRACKS = [
  { id: 'neon', name: 'Pulso Neon', bpm: 110, duration: 120, scale: [220, 277, 330, 440], seed: 17 },
  { id: 'drive', name: 'Hyperdrive', bpm: 140, duration: 120, scale: [165, 196, 247, 330], seed: 71 },
  { id: 'aurora', name: 'Aurora', bpm: 90, duration: 120, scale: [261, 330, 392, 523], seed: 31 },
];
export const CUT_DIRECTIONS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, Math.SQRT1_2]];
export function arrowRotation(direction) {
  const axis = CUT_DIRECTIONS[direction]; return axis ? Math.atan2(axis[0], -axis[1]) : 0;
}

export function makeChart(times, difficulty = 'normal', seed = 17) {
  let n = seed >>> 0;
  const random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  const notes = [];
  let previous = -Infinity;
  for (const at of times) {
    if (!Number.isFinite(at) || at < 0 || at - previous < (difficulty === 'easy' ? 0.48 : difficulty === 'expert' ? 0.14 : 0.26)) continue;
    const side = notes.length % 2;
    notes.push({ at, side, x: (side ? 1 : -1) * (random() < 0.7 ? 0.24 : 0.65), y: [0.95, 1.25, 1.55][Math.floor(random() * 3)],
      direction: difficulty === 'easy' ? null : Math.floor(random() * 8) });
    if (difficulty === 'expert' && notes.length % 12 === 0) {
      const first = notes[notes.length - 1];
      notes.push({ at, side: 1 - side, x: -first.x, y: first.y,
        direction: first.direction === 2 ? 3 : first.direction === 3 ? 2 : first.direction });
    }
    previous = at;
  }
  return notes;
}

export function presetChart(track, difficulty) {
  const times = [];
  for (let t = 0.5; t < track.duration - 0.5; t += 60 / track.bpm / (difficulty === 'expert' ? 2 : 1)) times.push(t);
  return makeChart(times, difficulty, track.seed);
}

const BEAT_SABER_DIRECTIONS = [1, 0, 2, 3, 6, 7, 4, 5, null];
const laneX = (x) => (x - 1.5) * 0.48;
const layerY = (y) => 0.95 + y * 0.30;

// Importa somente dados de mapa do usuário; áudio e BPM são fornecidos à parte.
// v2 usa _notes/_obstacles; v3 usa coleções diretas; v4 separa metadados.
export function importBeatmap(data, bpm, duration) {
  if (!data || typeof data !== 'object' || !Number.isFinite(bpm) || bpm < 60 || bpm > 300 ||
      !Number.isFinite(duration) || duration < 2 || duration > 600) throw new Error('BPM ou duração inválidos.');
  const isV2 = Array.isArray(data._notes);
  const isV4 = !isV2 && (String(data.version || '').startsWith('4.') || Array.isArray(data.colorNotesData));
  const raw = isV2 ? data._notes : data.colorNotes;
  if (!Array.isArray(raw) || raw.length > 5000) throw new Error('Mapa inválido ou com notas demais.');
  const chart = [], bombs = [], obstacles = [];
  const resolveV4 = (items, name) => {
    if (!isV4 || !items.length) return items;
    const metadata = data[`${name}Data`];
    if (!Array.isArray(metadata) || metadata.length > 5000) throw new Error(`Metadados v4 de ${name} inválidos.`);
    return items.map(item => {
      if (!Number.isInteger(item?.i) || item.i < 0 || item.i >= metadata.length ||
          !metadata[item.i] || typeof metadata[item.i] !== 'object') throw new Error(`Índice v4 de ${name} inválido.`);
      return { ...metadata[item.i], b: item.b, r: item.r };
    });
  };
  let bpmEvents = data.bpmEvents ?? [];
  if (!Array.isArray(bpmEvents) || bpmEvents.length > 1000) throw new Error('Mudanças de BPM inválidas.');
  if (isV2 && data._events != null) {
    if (!Array.isArray(data._events) || data._events.length > 20000) throw new Error('Eventos v2 inválidos.');
    bpmEvents = [...bpmEvents, ...data._events.filter(event => event?._type === 100)
      .map(event => ({ b: event._time, m: event._floatValue }))];
  }
  if (bpmEvents.length > 1000 || bpmEvents.some(event =>
    !Number.isFinite(event?.b) || event.b < 0 || event.b > 10000 ||
    !Number.isFinite(event?.m) || event.m < 30 || event.m > 400)) throw new Error('Mudanças de BPM inválidas.');
  const tempo = [{ beat: 0, time: 0, bpm }];
  for (const event of [...bpmEvents].sort((a, b) => a.b - b.b)) {
    const last = tempo[tempo.length - 1];
    if (event.b === last.beat) { last.bpm = event.m; continue; }
    tempo.push({ beat: event.b, time: last.time + (event.b - last.beat) * 60 / last.bpm, bpm: event.m });
  }
  const toTime = beat => {
    if (!Number.isFinite(beat)) return NaN;
    let low = 0, high = tempo.length - 1;
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (tempo[mid].beat <= beat) low = mid; else high = mid - 1; }
    const segment = tempo[low];
    return segment.time + (beat - segment.beat) * 60 / segment.bpm;
  };
  const validCell = (x, y) => Number.isInteger(x) && x >= 0 && x < 4 && Number.isInteger(y) && y >= 0 && y < 3;
  const addNote = (beat, x, y, side, direction) => {
    const at = toTime(beat);
    if (!Number.isFinite(at) || at < 0 || at >= duration || !validCell(x, y) || ![0, 1].includes(side) ||
        !Number.isInteger(direction) || direction < 0 || direction > 8) return;
    chart.push({ at, x: laneX(x), y: layerY(y), side, direction: BEAT_SABER_DIRECTIONS[direction] });
  };
  const addBomb = (beat, x, y) => {
    const at = toTime(beat);
    if (Number.isFinite(at) && at >= 0 && at < duration && validCell(x, y))
      bombs.push({ at, x: laneX(x), y: layerY(y), wall: false });
  };
  if (isV2) for (const note of raw) {
    if (note?._type === 3) addBomb(note._time, note._lineIndex, note._lineLayer);
    else addNote(note?._time, note?._lineIndex, note?._lineLayer, note?._type, note?._cutDirection);
  }
  else for (const note of resolveV4(raw, 'colorNotes')) addNote(note?.b, note?.x, note?.y, note?.c, note?.d);
  if (!isV2 && data.bombNotes != null && (!Array.isArray(data.bombNotes) || data.bombNotes.length > 1000))
    throw new Error('Bombas inválidas.');
  if (!isV2) for (const bomb of resolveV4(data.bombNotes || [], 'bombNotes')) addBomb(bomb?.b, bomb?.x, bomb?.y);
  const rawWalls = isV2 ? data._obstacles : data.obstacles;
  if (rawWalls != null && (!Array.isArray(rawWalls) || rawWalls.length > 1000)) throw new Error('Obstáculos inválidos.');
  for (const wall of resolveV4(rawWalls || [], 'obstacles')) {
    const beat = isV2 ? wall?._time : wall?.b;
    const lane = isV2 ? wall?._lineIndex : wall?.x;
    const width = isV2 ? wall?._width : wall?.w;
    const beats = (isV2 ? wall?._duration : wall?.d) ?? 0;
    const type = isV2 ? wall?._type ?? 0 : 2;
    const layer = isV2 ? type === 1 ? 2 : type === 2 ? wall?._lineLayer : 0 : wall?.y ?? 0;
    const height = isV2 ? type === 1 ? 3 : type === 2 ? wall?._height : 5 : wall?.h ?? 5;
    const at = toTime(beat);
    if (!Number.isFinite(at) || at < 0 || at >= duration || !Number.isInteger(lane) || lane < 0 || lane > 3 ||
        !Number.isInteger(width) || width < 1 || width > 4 || lane + width > 4 ||
        ![0, 1, 2].includes(type) || !Number.isInteger(layer) || layer < 0 || layer > 4 ||
        !Number.isInteger(height) || height < 1 || height > 5 || layer + height > 5 ||
        !Number.isFinite(beats) || beats < 0 || beats > 16) continue;
    obstacles.push({ at, x: laneX(lane + (width - 1) / 2), y: (layer + height / 2) * 0.44,
      wall: true, width, height: height * 0.44, crouch: layer >= 2,
      duration: Math.min(8, toTime(beat + beats) - at, duration - at) });
  }
  chart.sort((a, b) => a.at - b.at);
  const hazards = [...bombs, ...obstacles].sort((a, b) => a.at - b.at);
  if (!chart.length) throw new Error('Mapa sem blocos válidos para cortar.');
  return { chart, obstacles: hazards };
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

export function cutResult({ side, noteSide, twoHands, motionX, motionY, motionZ = 0, speed, direction, timing, centerError = 0 }) {
  if (!Number.isFinite(timing) || Math.abs(timing) > 0.16) return { hit: false, reason: 'Fora do tempo' };
  if (!Number.isFinite(speed) || speed < 0.65) return { hit: false, reason: 'Mova o sabre para cortar' };
  if (twoHands && side !== noteSide) return { hit: false, penalty: true, reason: 'Cor errada' };
  let alignment = 1;
  if (direction !== null && direction !== undefined) {
    const axis = CUT_DIRECTIONS[direction];
    const length = Math.hypot(motionX, motionY);
    if (length / Math.max(1e-6, Math.hypot(length, motionZ)) < 0.45) return { hit: false, penalty: true, reason: 'Corte de lado, não empurre' };
    alignment = axis && length > 0.001 ? (motionX * axis[0] + motionY * axis[1]) / length : -1;
    if (alignment < 0.65) return { hit: false, penalty: true, reason: 'Direção errada' };
  }
  const quality = (value) => Math.max(0, Math.min(1, value));
  const accuracy = quality((alignment - 0.65) / 0.35);
  const center = quality(1 - centerError / 0.145);
  const beat = quality(1 - Math.abs(timing) / 0.16);
  const strength = quality((speed - 0.65) / 2.35);
  const points = Math.round(20 + 30 * accuracy + 35 * center + 20 * beat + 10 * strength);
  return { hit: true, points, perfect: points >= 105 };
}
