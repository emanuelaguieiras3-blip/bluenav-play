// Corretor de rastreamento de mãos — implementa localmente (em todo frame, < 1 ms)
// as regras do "corretor BlueNav Play": suavização, validação anatômica e gestos estáveis.
// Saída idêntica ao formato pedido: { pontosCorrigidos, gesto, confianca }.
import { CONFIG } from '../../config.js';

export const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
// Cadeias dos dedos: [pai, articulações...]
const CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]];
const PALM = new Set([0, 1, 5, 9, 13, 17]);
const NEIGHBORS = Array.from({ length: 21 }, () => []);
for (const [a, b] of BONES) { NEIGHBORS[a].push(b); NEIGHBORS[b].push(a); }
const BONE_INDEX = new Map(BONES.map(([a, b], k) => [a + '-' + b, k]));

// --- vetores em arrays [x,y,z] ---
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dist = (a, b) => len(sub(a, b));
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));
const DEG = Math.PI / 180;

export class HandCorrector {
  constructor() { this.reset(); }

  reset() {
    this.prev = null;          // último resultado filtrado
    this.prevRaw = null;
    this.boneLen = null;       // comprimentos de referência (calibrados)
    this.flexSign = 0;         // lado da palma (aprendido)
    this.candidate = 'indefinida';
    this.candTime = 0;
    this.gesture = 'indefinida';
    this.notPinchTime = 0;
    this.jumpFrames = 0;
    this.outCount = new Array(21).fill(0);
    this.pinchDist = 1;
    this.pinchStrength = 0;
    this.pinching = false;
    this.shape = 'indefinida';
    this.palmFacing = 0;
    this.frames = 0;
  }

  // raw: 21 pontos [x,y,z] em metros (espaço da câmera); dt em s; score: confiança do MediaPipe
  // chir: +1 mão direita, -1 esquerda (no espaço 3D da câmera); 0 = desconhecido
  process(raw, dt, score = 1, chir = 0) {
    if (!Array.isArray(raw) || raw.length !== 21 || !raw.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) || !Number.isFinite(score) || dist(raw[0], raw[9]) < 0.02) {
      return { pontosCorrigidos: this.prev, gesto: 'indefinida', confianca: 0 };
    }
    dt = Number.isFinite(dt) ? Math.min(Math.max(dt, 1 / 120), 0.2) : 1 / 60;
    this.frames++;
    if (!this.prev) {
      if (BONES.some(([a, b]) => dist(raw[a], raw[b]) < 0.003))
        return { pontosCorrigidos: null, gesto: 'indefinida', confianca: 0 };
      this.prev = raw.map((p) => p.slice());
      this.prevRaw = raw;
      this.boneLen = BONES.map(([a, b]) => Math.max(0.004, dist(raw[a], raw[b])));
      return { pontosCorrigidos: raw, gesto: 'indefinida', confianca: 0.2 * score };
    }
    // Sem certeza: devolve os pontos originais com confiança baixa
    if (score < 0.5) {
      this.prevRaw = raw;
      return { pontosCorrigidos: this.prev, gesto: this.gesture, confianca: 0.15 * score };
    }

    const prev = this.prev;
    const palm = Math.max(0.03, dist(prev[0], prev[9]));

    // 1) Movimento global da mão (mediana dos deslocamentos)
    const moves = raw.map((p, i) => sub(p, prev[i]));
    const g = [0, 1, 2].map((k) => median(moves.map((m) => m[k])));
    const gSpeed = len(g) / dt;

    // Salto impossível da mão inteira (> 6 m/s): interpola; aceita após 3 frames seguidos (re-detecção)
    let gMove = g;
    if (gSpeed > 6) { this.jumpFrames++; if (this.jumpFrames < 3) gMove = mul(g, 0.35); }
    else this.jumpFrames = 0;

    // 2) Pontos isolados fora do lugar: média de vizinhos + frame anterior
    //    Um salto isolado é filtrado; se o ponto ficar parado no lugar novo por 2 frames,
    //    o movimento é real (abrir a mão de uma vez, soltar a pinça) e é aceito.
    const pts = new Array(21);
    const oc = this.outCount;
    let outliers = 0;
    for (let i = 0; i < 21; i++) {
      const pred = add(prev[i], gMove);
      const r = gMove === g ? raw[i] : add(prev[i], mul(moves[i], 0.35));
      if (dist(r, pred) > palm * 0.65) {
        const steady = this.prevRaw && dist(raw[i], add(this.prevRaw[i], g)) < palm * 0.3;
        if (oc[i] >= 1 && steady) { oc[i] = 0; pts[i] = r; continue; }
        oc[i]++;
        outliers++;
        let acc = pred.slice(), n = 1;
        for (const nb of NEIGHBORS[i]) {
          if (dist(raw[nb], add(prev[nb], gMove)) < palm * 0.65) { acc = add(acc, add(raw[nb], sub(prev[i], prev[nb]))); n++; }
        }
        pts[i] = mul(acc, 1 / n);
      } else { oc[i] = 0; pts[i] = r; }
    }

    // 3) Suavização: pontoFinal = anterior × 0,85 + novo × 0,15 (mão parada).
    //    Com a mão em movimento rápido o peso do ponto novo sobe, para não atrasar.
    //    O reforço usa a velocidade da mão E a de cada ponto: dedo rápido (pinça) não atrasa.
    const base = CONFIG.SMOOTH_NEW;
    const out = pts.map((p, i) => {
      const sp = Math.max(gSpeed, dist(p, prev[i]) / dt);
      const boost = Math.min(1, Math.max(0, (sp - 0.08) / 0.9));
      const a30 = base + (0.75 - base) * boost;
      const alpha = 1 - Math.pow(1 - a30, dt * 30); // independente do fps
      return [prev[i][0] * (1 - alpha) + p[0] * alpha, prev[i][1] * (1 - alpha) + p[1] * alpha, prev[i][2] * (1 - alpha) + p[2] * alpha];
    });

    // 4) Validação anatômica: comprimentos dos ossos coerentes
    BONES.forEach(([a, b], k) => {
      const measured = dist(raw[a], raw[b]), reference = this.boneLen[k];
      if (score >= 0.7 && outliers === 0 && measured > reference * 0.7 && measured < reference * 1.3) {
        this.boneLen[k] += (measured - reference) * (1 - Math.exp(-dt * 0.6));
      }
    });
    // Uma oclusão também pode juntar as bases de dois dedos. Mantém separação
    // da palma dentro da anatomia calibrada antes de reconstruir os dedos.
    for (let pass = 0; pass < 3; pass++) {
      for (let k = 0; k < BONES.length; k++) {
        const [a, b] = BONES[k];
        if (!PALM.has(a) || !PALM.has(b)) continue;
        const reference = this.boneLen[k];
        let segment = sub(out[b], out[a]), measured = len(segment);
        const wanted = Math.max(reference * 0.8, Math.min(reference * 1.2, measured));
        if (Math.abs(wanted - measured) < 1e-6) continue;
        if (measured < 0.001) segment = sub(prev[b], prev[a]);
        const delta = mul(norm(segment), wanted - measured);
        const moveBase = (joint, movement) => {
          const chain = CHAINS.find((ch) => ch[1] === joint);
          for (const index of chain?.slice(1) || [joint]) out[index] = add(out[index], movement);
        };
        if (a === 0) moveBase(b, delta);
        else { moveBase(a, mul(delta, -0.5)); moveBase(b, mul(delta, 0.5)); }
      }
    }
    for (const ch of CHAINS) {
      for (let j = 1; j < ch.length; j++) {
        const p = ch[j - 1], c = ch[j];
        if (PALM.has(c) && c !== 1) continue; // base da palma fica como está
        const L = this.boneLen[BONE_INDEX.get(p + '-' + c)];
        let segment = sub(out[c], out[p]);
        if (len(segment) < L * 0.35 || dist(raw[c], raw[p]) < L * 0.35) segment = sub(prev[c], prev[p]);
        if (len(segment) < 0.001) segment = [0, 1, 0];
        const dir = norm(segment);
        const fixed = add(out[p], mul(dir, L));
        const delta = sub(fixed, out[c]);
        for (let k = j; k < ch.length; k++) out[ch[k]] = add(out[ch[k]], delta);
      }
    }

    // 5) Dedo não pode se curvar para trás
    // A dobra de cada junta é medida como rotação em torno do eixo de flexão do dedo
    // (perpendicular à palma e ao dedo). Isso vale mesmo com o dedo bem curvado.
    const flexAxes = (P, nrm) => CHAINS.map((ch) => norm(cross(norm(sub(P[ch[1]], P[0])), nrm)));
    const bendSign = (P, axes, f, j) => {
      const ch = CHAINS[f];
      const u = sub(P[ch[j]], P[ch[j - 1]]), v = sub(P[ch[j + 1]], P[ch[j]]);
      return { u, v, ang: angle(u, v), sgn: Math.sign(dot(cross(u, v), axes[f])) };
    };
    const n = norm(cross(sub(out[5], out[0]), sub(out[17], out[0])));
    // Evidência medida nos pontos que chegaram (antes de qualquer correção, para não se auto-confirmar):
    // dobras fortes são quase sempre flexão, então indicam de que lado fica a palma
    const nRaw = norm(cross(sub(pts[5], pts[0]), sub(pts[17], pts[0])));
    const axRaw = flexAxes(pts, nRaw);
    let acc = 0;
    for (let f = 1; f < 5; f++) for (let j = 1; j < 4; j++) {
      const b = bendSign(pts, axRaw, f, j);
      if (b.ang > 35 * DEG) acc += b.sgn;
    }
    this.flexSign = Math.max(-1, Math.min(1, this.flexSign * 0.9 + acc * 0.05));
    // Lado da palma: pela geometria da mão (direita/esquerda) — estável desde o 1º frame.
    // Só se as dobras fortes dos dedos discordarem com insistência é que elas mandam.
    let s = chir || (this.flexSign >= 0 ? 1 : -1), sure = !!chir || Math.abs(this.flexSign) > 0.3;
    if (Math.abs(this.flexSign) > 0.6 && Math.sign(this.flexSign) !== s) { s = Math.sign(this.flexSign); sure = true; }
    this.side = s;
    // se neste frame 3+ juntas dobram fortemente "contra" o lado esperado, quem está errado é o lado, não o dedo
    if (sure && acc * s > -3) {
      const axes = flexAxes(out, mul(n, s)); // eixo orientado: dobra positiva = em direção à palma
      for (let f = 1; f < 5; f++) {
        const ch = CHAINS[f];
        for (let j = 1; j < 4; j++) {
          const b = bendSign(out, axes, f, j);
          const maxBack = (j === 1 ? 35 : 15) * DEG; // folga para a hiperextensão natural
          if (b.sgn < 0 && b.ang > maxBack) {
            // gira o segmento de volta até o limite, no mesmo plano da dobra
            const uh = norm(b.u), k = norm(cross(b.u, b.v)), L = len(b.v);
            const nv = mul(add(mul(uh, Math.cos(maxBack)), mul(cross(k, uh), Math.sin(maxBack))), L);
            const delta = sub(add(out[ch[j]], nv), out[ch[j + 1]]);
            for (let q = j + 1; q < ch.length; q++) out[ch[q]] = add(out[ch[q]], delta);
          }
        }
      }
    }

    // 6) Gestos no estilo Meta Quest
    const shape = this._classify(out);
    // Pinça: instantânea como no Quest, com força contínua 0–1 e histerese para não piscar
    const pd = this.pinchDist;
    this.pinchStrength = Math.max(0, Math.min(1, (1.0 - pd) / 0.72));
    if (this.pinching) { if (pd > 0.5) this.pinching = false; } else if (pd < 0.3) this.pinching = true;
    // Formas da mão (aberta, apontando): confirmadas após 0,4s estáveis
    if (shape === this.candidate) this.candTime += dt; else { this.candidate = shape; this.candTime = 0; }
    if (this.candTime >= CONFIG.GESTURE_HOLD) this.shape = this.candidate;
    this.gesture = this.pinching ? 'pinça' : (this.shape || 'indefinida');
    // Palma virada para o usuário (gesto do menu do sistema no Quest)
    const palmDir = mul(n, s), toCam = norm(mul(out[0], -1));
    this.palmFacing = sure ? dot(palmDir, toCam) : 0;

    const stable = this.pinching || this.candidate === this.shape ? Math.min(1, 0.6 + this.candTime + (this.pinching ? 0.4 : 0)) : 0.55;
    const confianca = Math.max(0, Math.min(1, score * stable * (1 - (outliers / 21) * 0.8) * Math.min(1, this.frames / 8)));

    this.prev = out; this.prevRaw = raw;
    return { pontosCorrigidos: out, gesto: this.gesture, confianca: Math.round(confianca * 100) / 100 };
  }

  _classify(p) {
    const palm = Math.max(0.03, dist(p[0], p[9]));
    this.pinchDist = dist(p[4], p[8]) / palm;
    const ext = (ch) => {
      const [, m, a, b, t] = ch;
      const straight = angle(sub(p[a], p[m]), sub(p[b], p[a])) + angle(sub(p[b], p[a]), sub(p[t], p[b])) < 65 * DEG;
      return straight && dist(p[t], p[0]) > dist(p[a], p[0]) * 1.12;
    };
    const idx = ext(CHAINS[1]), mid = ext(CHAINS[2]), rin = ext(CHAINS[3]), pin = ext(CHAINS[4]);
    const thumb = dist(p[4], p[5]) > palm * 0.5 && dist(p[4], p[17]) > palm * 0.9;
    if (this.pinchDist < 0.5) return 'indefinida'; // perto de pinçar: não é forma aberta/apontando
    if (idx && mid && rin && pin && thumb) return 'aberta';
    if (idx && !mid && !rin && !pin) return 'apontando';
    return 'indefinida';
  }

  // Calibração vinda do Gemini (pontos corrigidos de uma janela de frames)
  applyReference(points, confianca) {
    if (!this.boneLen || !Array.isArray(points) || points.length !== 21 || !Number.isFinite(confianca) || confianca < 0.6 || confianca > 1) return false;
    const ok = points.every((p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite));
    if (!ok) return false;
    const lengths = BONES.map(([a, b]) => dist(points[a], points[b]));
    if (lengths.some((L, k) => L < 0.004 || L > 0.15 || L < this.boneLen[k] * 0.7 || L > this.boneLen[k] * 1.3)) return false;
    lengths.forEach((L, k) => { this.boneLen[k] = this.boneLen[k] * 0.95 + L * 0.05; });
    return true;
  }
}

function median(arr) { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; }
