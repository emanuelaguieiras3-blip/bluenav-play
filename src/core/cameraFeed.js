// Uma única câmera para tudo: passthrough (ver o mundo real) e rastreamento das mãos.
let feed = null;
let pending = null;

export async function getCamera(facing = 'environment', { width = 960, height = 540 } = {}) {
  if (feed && feed.facing === facing) return feed.video;
  if (pending) return pending;
  pending = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 60, max: 60 } },
      audio: false,
    });
    const v = document.createElement('video');
    v.playsInline = true; v.muted = true; v.setAttribute('playsinline', ''); v.srcObject = stream;
    await v.play();
    feed = { facing, video: v, stream };
    return v;
  })();
  try { return await pending; } finally { pending = null; }
}

export function currentCamera() { return feed; }
