// Uma única câmera para tudo: passthrough (ver o mundo real) e rastreamento das mãos.
let feed = null;
let pending = null;
let generation = 0;

export async function getCamera(facing = 'environment', { width = 960, height = 540 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera exige HTTPS ou localhost e permissão do navegador.');
  if (feed && feed.facing === facing && feed.stream.getVideoTracks().some(track => track.readyState === 'live')) {
    await feed.video.play();
    return feed.video;
  }
  if (pending) {
    if (pending.facing === facing) return pending.promise;
    await pending.promise.catch(() => {});
    return getCamera(facing, { width, height });
  }
  const requestedGeneration = generation;
  const promise = (async () => {
    if (feed) {
      feed.stream.getTracks().forEach(track => track.stop());
      feed.video.srcObject = null;
      feed = null;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 60, max: 60 } },
      audio: false,
    });
    if (requestedGeneration !== generation) { stream.getTracks().forEach(track => track.stop()); throw new Error('Solicitação de câmera cancelada.'); }
    const v = document.createElement('video');
    v.playsInline = true; v.muted = true; v.setAttribute('playsinline', ''); v.srcObject = stream;
    try {
      await v.play();
      if (!v.videoWidth || !v.videoHeight) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('A câmera abriu, mas não enviou imagens.')), 8000);
          v.addEventListener('loadeddata', () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
    } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
    if (requestedGeneration !== generation) { stream.getTracks().forEach(track => track.stop()); throw new Error('Solicitação de câmera cancelada.'); }
    feed = { facing, video: v, stream };
    return v;
  })();
  pending = { facing, promise };
  try { return await promise; } finally { if (pending?.promise === promise) pending = null; }
}

export function currentCamera() { return feed; }
export function releaseCamera() {
  generation++;
  pending = null;
  if (!feed) return;
  feed.stream.getTracks().forEach(track => track.stop());
  feed.video.srcObject = null;
  feed = null;
}
