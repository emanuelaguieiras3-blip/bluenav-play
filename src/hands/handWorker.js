// Worker clássico: o MediaPipe Hands roda fora da thread de renderização,
// então a detecção (20–60 ms em celulares) não trava mais a imagem.
/* global importScripts, exports */
var exports = {};
var module = { exports: exports };
let landmarker = null;

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    try {
      // o CDN entrega o .cjs com tipo "application/node", que o importScripts recusa:
      // baixamos o texto e carregamos como JavaScript via Blob
      const code = await (await fetch(m.base + '/vision_bundle.cjs')).text();
      const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      importScripts(blobUrl);
      URL.revokeObjectURL(blobUrl);
      const vision = module.exports;
      const fileset = await vision.FilesetResolver.forVisionTasks(m.base + '/wasm');
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: m.model, delegate },
        runningMode: 'VIDEO', numHands: 2,
        // confiança de rastreamento mais baixa: não perde a mão em movimento rápido (borrão)
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.35,
      });
      let delegate = 'GPU';
      try { landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
      catch { delegate = 'CPU'; landmarker = await vision.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
      self.postMessage({ type: 'ready', delegate });
    } catch (err) {
      self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
  } else if (m.type === 'frame') {
    const t0 = performance.now();
    let res = null;
    try { res = landmarker.detectForVideo(m.bitmap, m.t); } catch { /* quadro perdido */ }
    self.postMessage({
      type: 'result', bitmap: m.bitmap, t: m.t, ms: performance.now() - t0,
      res: res && { landmarks: res.landmarks, worldLandmarks: res.worldLandmarks, handednesses: res.handednesses || res.handedness },
    }, [m.bitmap]);
  }
};
