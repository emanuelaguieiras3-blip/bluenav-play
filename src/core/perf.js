// Desempenho: perfil por aparelho, resolução dinâmica estável e limite de 60 fps em celular.
export function detectDevice() {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900);
  const mem = navigator.deviceMemory || (mobile ? 3 : 8), cores = navigator.hardwareConcurrency || 4;
  const lowEnd = mem <= 3 || cores <= 4;
  return { mobile, lowEnd };
}

export class Perf {
  constructor(app) {
    this.app = app;
    const d = detectDevice();
    this.mobile = d.mobile; this.lowEnd = d.lowEnd;
    const dpr = window.devicePixelRatio || 1;
    // Celular: começa nítido o bastante para o VR Box (cada olho recebe metade da tela)
    this.maxRatio = Math.min(dpr, this.mobile ? (this.lowEnd ? 1.5 : 2) : 2);
    this.minRatio = this.mobile ? 0.8 : 0.75;
    this.ratio = Math.min(this.maxRatio, this.mobile ? (this.lowEnd ? 1.1 : 1.4) : 1.5);
    this.fps = 60; this.frameMs = 16.7;
    this._acc = 0; this._n = 0; this._good = 0; this._cooldown = 2;
    // telas de 90/120 Hz: limita a 60 fps no celular (metade do calor e da bateria, sem travadas)
    this.capFps = this.mobile ? 60 : 0;
    this._lastFrame = 0;
    app.renderer.setPixelRatio(this.ratio);
  }

  // devolve false se este quadro deve ser pulado (limite de fps)
  shouldRender(t) {
    if (!this.capFps || this.app.renderer.xr.isPresenting) return true;
    const interval = 1000 / this.capFps;
    if (!this._started || t - this._lastFrame > interval * 3) {
      this._started = true; this._lastFrame = t; return true;
    }
    if (t - this._lastFrame < interval - 0.75) return false;
    // Preserva a fase: em telas de 90 Hz, pular sempre um quadro limitava a 45 FPS.
    this._lastFrame += interval;
    return true;
  }

  update(dt) {
    this._acc += dt; this._n++;
    this._cooldown -= dt;
    if (this._acc < 0.75) return;
    this.fps = this._n / this._acc; this.frameMs = (this._acc / this._n) * 1000;
    this._acc = 0; this._n = 0;
    if (this.app.renderer.xr.isPresenting || this._cooldown > 0) return;
    let r = this.ratio;
    // cai rápido quando trava; sobe devagar e só depois de vários períodos bons (sem ficar oscilando)
    if (this.fps < 45) { r = Math.max(this.minRatio, r - 0.15); this._good = 0; }
    else if (this.fps < 54) { r = Math.max(this.minRatio, r - 0.05); this._good = 0; }
    else if (this.fps > 58) { this._good++; if (this._good >= 4) { r = Math.min(this.maxRatio, r + 0.1); this._good = 0; } }
    if (Math.abs(r - this.ratio) > 0.001) {
      this.ratio = r; this._cooldown = 1.5;
      this.app.renderer.setPixelRatio(r); this.app.resize();
    }
  }
}
