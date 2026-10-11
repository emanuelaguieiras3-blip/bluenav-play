// MediaPipe Hands (21 pontos por mão) via câmera do celular, carregado só quando necessário.
import { CONFIG } from '../../config.js';
import { HandCorrector } from './handCorrector.js';
import { GeminiAssist } from './geminiAssist.js';
import { getCamera } from '../core/cameraFeed.js';

const MP = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${CONFIG.MEDIAPIPE_VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const HFOV = CONFIG.CAMERA_HFOV * Math.PI / 180; // campo de visão horizontal da câmera do celular

export class HandTracker {
  constructor() {
    this.video = null;
    this.landmarker = null;
    this.running = false;
    this.mirror = false;
    this.slots = null;           // até 2 mãos rastreadas por posição (não pelo rótulo)
    this.hands = [];          // [{label, pontos:[[x,y,z]], gesto, confianca, pinchDist}] espaço da câmera
    this.lastVideoTime = -1;
    this.lastT = 0;
    this.history = [];        // janela de frames crus para o Gemini
    this.gemini = new GeminiAssist();
    this.detectMs = 0;
    this.minInterval = 0;
    this._lastDetect = 0;
    this.worker = null; this.busy = false; this.mode = null;
  }

  async start({ facing = 'environment', onStatus = () => {} } = {}) {
    onStatus('Abrindo a câmera…');
    // A mesma câmera e o mesmo quadro para passthrough e detecção.
    this.video = await getCamera(facing);
    this.mirror = facing === 'user';
    onStatus('Carregando rastreamento de mãos…');
    // 1º: worker (não trava a renderização). 2º: thread principal, se o navegador não suportar.
    try { await this._startWorker(); this.mode = 'worker'; }
    catch (e) {
      console.warn('Worker de mãos indisponível, usando a thread principal:', e);
      const vision = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.35,
      });
      try { this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
      catch { this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
      this.mode = 'main';
    }
    this.running = true;
    onStatus('Mãos prontas.');
  }

  _startWorker() {
    if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return Promise.reject(new Error('sem suporte'));
    return new Promise((resolve, reject) => {
      const w = new Worker(new URL('./handWorker.js', import.meta.url));
      const timer = setTimeout(() => { w.terminate(); reject(new Error('tempo esgotado')); }, 30000);
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'ready') { clearTimeout(timer); this.worker = w; this.delegate = m.delegate; resolve(); }
        else if (m.type === 'error') { clearTimeout(timer); w.terminate(); reject(new Error(m.message)); }
        else if (m.type === 'result') this._onResult(m);
      };
      w.onerror = (e) => { clearTimeout(timer); w.terminate(); reject(e); };
      w.postMessage({ type: 'init', base: MP, model: MODEL });
    });
  }

  _onResult(m) {
    this.busy = false;
    if (!this.running || performance.now() - m.t > 200 || !m.res) { m.bitmap?.close(); return; }
    this.detectMs = this.detectMs * 0.85 + m.ms * 0.15;
    // acompanha até 60 Hz; se o celular não der conta, espaça só o necessário
    this.minInterval = Math.max(15, Math.min(50, this.detectMs * 0.85));
    const dt = this.lastT ? (m.t - this.lastT) / 1000 : 1 / 30;
    this.lastT = m.t;
    try {
      this._process(m.res, dt, m.t, m.bitmap ? m.bitmap.height / m.bitmap.width : undefined);
      if (m.bitmap) this.onFrame?.(m.bitmap);
    } finally { m.bitmap?.close(); }
  }

  stop() {
    this.running = false;
    this.worker?.terminate();
    this.worker = null; this.busy = false; this.hands = []; this.history = []; this.slots = null;
    this.landmarker?.close(); this.landmarker = null;
    this.gemini.cancel();
    this.onFrame?.(null);
    // A câmera pertence ao feed compartilhado com o passthrough.
  }
  displayPoints(hand) {
    if (!hand.imageLandmarks) return hand.pontos;
    const focal = 1 / (2 * Math.tan((this.hfovProvider?.() || HFOV) / 2));
    const sign = this.mirror ? -1 : 1;
    return hand.imageLandmarks.map((p, i) => {
      const depth = -hand.pontos[i][2];
      return [sign * (p.x - 0.5) * depth / focal, -(p.y - 0.5) * hand.imageAspect * depth / focal, -depth];
    });
  }

  update(now) {
    if (this.slots) this.hands = this.hands.filter((h) => now - this.slots[h.id].lastSeen < 150)
      .map((h) => now - this.slots[h.id].lastSeen > 80 && !h.stale ? { ...h, stale: true } : h);
    if (!this.running || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    if (now - this._lastDetect < this.minInterval) return;
    if (this.mode === 'worker') {
      if (this.busy) return; // um quadro por vez: nunca acumula fila
      this.busy = true;
      this.lastVideoTime = this.video.currentTime;
      this._lastDetect = now;
      const worker = this.worker;
      createImageBitmap(this.video).then((bmp) => {
        if (!this.running || this.worker !== worker) { bmp.close(); return; }
        try { worker.postMessage({ type: 'frame', bitmap: bmp, t: now }, [bmp]); }
        catch (e) { bmp.close(); throw e; }
      }).catch(() => { this.busy = false; });
      return;
    }
    // reserva: thread principal
    this.lastVideoTime = this.video.currentTime;
    const t0 = performance.now();
    let res;
    const frame = this.frameCanvas || (this.frameCanvas = document.createElement('canvas'));
    if (frame.width !== this.video.videoWidth || frame.height !== this.video.videoHeight) {
      frame.width = this.video.videoWidth; frame.height = this.video.videoHeight;
    }
    frame.getContext('2d').drawImage(this.video, 0, 0);
    try { res = this.landmarker.detectForVideo(frame, now); } catch { return; }
    this.detectMs = this.detectMs * 0.9 + (performance.now() - t0) * 0.1;
    this.minInterval = Math.max(33, this.detectMs * 2);
    this._lastDetect = now;
    const dt = this.lastT ? (now - this.lastT) / 1000 : 1 / 30;
    this.lastT = now;
    this._process(res, dt, now, frame.height / frame.width);
    this.onFrame?.(frame);
  }

  _process(res, dt, now, frameAspect) {
    const vw = this.video.videoWidth || 640, vh = this.video.videoHeight || 480;
    const ar = frameAspect || vh / vw;
    // Campo de visão usado na conversão: o MESMO com que a imagem da câmera aparece no passthrough.
    // Assim a mão virtual fica exatamente em cima da mão real vista nos óculos.
    const hfov = (this.hfovProvider && this.hfovProvider()) || HFOV;
    const f = 1 / (2 * Math.tan(hfov / 2)); // focal em unidades da largura da imagem
    const sx = this.mirror ? -1 : 1;
    const n = res.landmarks ? res.landmarks.length : 0;
    const dets = [];
    for (let h = 0; h < n; h++) {
      const lm = res.landmarks[h], wl = res.worldLandmarks?.[h];
      if (!lm || !wl || lm.length !== 21 || wl.length !== 21 ||
          ![...lm, ...wl].every((p) => [p.x, p.y, p.z].every(Number.isFinite))) continue;
      const cat = res.handednesses?.[h]?.[0] || res.handedness?.[h]?.[0] || { categoryName: 'Right', score: 0.8 };
      // Profundidade: compara o tamanho real (metros) com o tamanho na imagem
      let wSum = 0, iSum = 0;
      for (const [a, b] of [[0, 5], [0, 17], [5, 17], [0, 9]]) {
        wSum += Math.hypot(wl[a].x - wl[b].x, wl[a].y - wl[b].y);
        iSum += Math.hypot(lm[a].x - lm[b].x, (lm[a].y - lm[b].y) * ar);
      }
      // Depth comes from the physical camera lens, not the enlarged display.
      // Changing passthrough fill must not move the hand toward/away from buttons.
      const physicalFocal = 1 / (2 * Math.tan(HFOV / 2));
      const d = Math.min(1.2, Math.max(0.18, (physicalFocal * wSum) / Math.max(1e-4, iSum)));
      // posição aproximada do pulso só para associar a detecção à mão certa
      const guess = [sx * ((lm[0].x - 0.5) * d) / f, -((lm[0].y - 0.5) * ar * d) / f, -d];
      // O MediaPipe supõe imagem espelhada (selfie); nossos quadros não são espelhados,
      // e a câmera frontal é espelhada por nós em 3D. Daí a mão "real" no nosso espaço:
      const effRight = (cat.categoryName === 'Left') !== this.mirror;
      dets.push({ lm, wl, d, guess, score: cat.score ?? 0.9, effRight });
    }

    // Associa cada detecção à mão rastreada mais próxima (o rótulo esquerda/direita
    // do MediaPipe pisca entre frames e não serve para isso)
    const slots = this.slots || (this.slots = [0, 1].map((id) => ({ id, corrector: new HandCorrector(), lastSeen: -1e9, wrist: null, d: 0, vote: 0, out: null })));
    const used = new Set();
    const pairs = [];
    for (const det of dets) for (const sl of slots) {
      if (!sl.wrist || now - sl.lastSeen > 400) continue;
      pairs.push([Math.hypot(det.guess[0] - sl.wrist[0], det.guess[1] - sl.wrist[1], det.guess[2] - sl.wrist[2]), det, sl]);
    }
    pairs.sort((x, y) => x[0] - y[0]);
    const associationLimit = dets.length === 1 && slots.filter(sl => now - sl.lastSeen < 400).length === 1 ? 0.5 : 0.25;
    for (const [dist, det, sl] of pairs) {
      if (det.slot || used.has(sl) || dist > associationLimit) continue;
      det.slot = sl; used.add(sl);
    }
    for (const det of dets) {
      if (det.slot) continue;
      const sl = slots.filter((x) => !used.has(x)).sort((x, y) => x.lastSeen - y.lastSeen)[0];
      if (!sl) continue;
      sl.corrector.reset(); sl.d = 0; sl.vote = 0; sl.out = null; sl.generation = (sl.generation || 0) + 1;
      det.slot = sl; used.add(sl);
    }

    for (const det of dets) {
      const sl = det.slot; if (!sl) continue;
      const { lm, wl } = det;
      // Profundidade suavizada: o ruído da profundidade também mexia a mão para os lados
      if (!sl.d) sl.d = det.d;
      else { const jump = Math.abs(det.d - sl.d); sl.d += (det.d - sl.d) * (jump > 0.12 ? 0.6 : 0.22); }
      const d = sl.d;
      // cada ponto sai do próprio pixel da imagem (alinha com a mão real); a profundidade de cada
      // junta vem do modelo 3D do MediaPipe em relação ao pulso
      const pts = new Array(21);
      for (let i = 0; i < 21; i++) {
        const di = Math.max(0.1, d + (wl[i].z - wl[0].z));
        pts[i] = [sx * ((lm[i].x - 0.5) * di) / f, -((lm[i].y - 0.5) * ar * di) / f, -di];
      }
      // lado da mão por votação (estável mesmo se o rótulo piscar)
      sl.vote = sl.vote * 0.85 + (det.effRight ? 0.15 : -0.15);
      const chir = sl.vote >= 0 ? 1 : -1;
      const r = sl.corrector.process(pts, dt, det.score, chir);
      if (!r.pontosCorrigidos || r.confianca === 0) continue;
      sl.lastSeen = now; sl.wrist = pts[0];
      const c = sl.corrector;
      // Anatomy correction remains for gestures. Visible joints stay on the
      // observed image rays: bone constraints must never shift their pixels.
      sl.out = { id: sl.id, label: chir > 0 ? 'Right' : 'Left', pontos: pts, imageAligned: true, imageLandmarks: lm, imageAspect: ar, gesto: r.gesto, confianca: r.confianca, pinchDist: c.pinchDist, pinchStrength: c.pinchStrength, palmFacing: c.palmFacing, touchProfile: this.gemini.enabled ? c.touchProfile : null, raw: pts, stale: false };
    }

    // Perda de rastreamento por instantes (mão passa rápido, borrão): mantém a última pose
    // por até 150 ms para não soltar a pinça nem "clicar" sem querer
    const out = [];
    for (const sl of slots) {
      if (!sl.out) continue;
      const age = now - sl.lastSeen;
      if (age === 0) out.push(sl.out);
      else if (age < 150) out.push({ ...sl.out, stale: true });
      else sl.out = null;
    }
    this.hands = out;

    // Janela de ~0,5s da mão principal para o Gemini (calibração em segundo plano)
    const main = out.find((o) => !o.stale);
    if (main) {
      const slot = slots[main.id], generation = slot.generation;
      const historyKey = main.id + ':' + generation;
      if (this.historyKey !== historyKey) { this.history = []; this.historyKey = historyKey; }
      this.history.push({ t: now, pontos: main.raw });
      while (this.history.length && now - this.history[0].t > 500) this.history.shift();
      const corr = slots[main.id].corrector;
      this.gemini.maybeSend(performance.now(), this.history.slice(), main.gesto, (res2) => {
        if (this.running && slot.generation === generation && performance.now() - slot.lastSeen < 200) {
          corr.applyReference(res2.pontosCorrigidos, res2.confianca);
          corr.applyTouchReference(res2.toque, res2.confianca);
        }
      });
    }
  }
}
