// Sons sintetizados com WebAudio (sem arquivos para baixar).
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.loops = new Set();
    this._noise = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      // Eco leve usado por arenas e masmorras
      this.reverbIn = this.ctx.createGain(); this.reverbIn.gain.value = 0;
      const d = this.ctx.createDelay(1); d.delayTime.value = 0.18;
      const fb = this.ctx.createGain(); fb.gain.value = 0.35;
      const lp = this.ctx.createBiquadFilter(); lp.frequency.value = 1800;
      this.reverbIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  setEcho(amount) { if (this.reverbIn) this.reverbIn.gain.setTargetAtTime(amount, this.t, 0.1); }

  noiseBuffer() {
    if (!this._noise) {
      const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this._noise = b;
    }
    return this._noise;
  }

  _out(node, vol, echo = false) {
    const g = this.ctx.createGain(); g.gain.value = vol; node.connect(g); g.connect(this.master);
    if (echo && this.reverbIn) g.connect(this.reverbIn);
    return g;
  }

  // Tom com envelope
  tone({ freq = 440, to = null, dur = 0.15, type = 'sine', vol = 0.2, attack = 0.005, delay = 0, echo = false } = {}) {
    if (!this.ctx) return;
    const t = this.t + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this._out(g, 1, echo); o.start(t); o.stop(t + dur + 0.05);
  }

  // Rajada de ruído filtrado (impactos, passos, cortes)
  noise({ dur = 0.12, freq = 1200, q = 1, type = 'bandpass', vol = 0.25, delay = 0, to = null, echo = false } = {}) {
    if (!this.ctx) return;
    const t = this.t + delay, s = this.ctx.createBufferSource(); s.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); this._out(g, 1, echo);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // Som de clique: suave e grave
  click() { this.tone({ freq: 150, to: 70, dur: 0.14, vol: 0.28 }); this.noise({ dur: 0.04, freq: 400, vol: 0.05 }); }
  keyTap() { this.tone({ freq: 220, to: 120, dur: 0.07, vol: 0.14 }); }
  hover() { this.tone({ freq: 520, dur: 0.05, vol: 0.025 }); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.35, vol: 0.12, delay: i * 0.09, type: 'triangle' })); }
  metal() { [880, 1320, 2210].forEach((f) => this.tone({ freq: f, to: f * 0.96, dur: 0.6, vol: 0.07, type: 'triangle', echo: true })); this.tone({ freq: 110, to: 60, dur: 0.3, vol: 0.3, echo: true }); this.noise({ dur: 0.08, freq: 3000, vol: 0.2 }); }
  thud() { this.tone({ freq: 90, to: 45, dur: 0.18, vol: 0.35 }); this.noise({ dur: 0.08, freq: 500, vol: 0.18, type: 'lowpass' }); }

  // Som contínuo de ruído filtrado: vento, água, fogo
  noiseLoop({ freq = 600, q = 0.7, type = 'bandpass', vol = 0.1 } = {}) {
    if (!this.ctx) return null;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuffer(); s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    const h = { source: s, filter: f, gain: g, stop: () => { try { g.gain.setTargetAtTime(0, this.t, 0.15); s.stop(this.t + 0.6); } catch { /* já parado */ } this.loops.delete(h); } };
    this.loops.add(h); return h;
  }

  // Oscilador contínuo (motor, zumbido)
  oscLoop({ freq = 80, type = 'sawtooth', vol = 0.1, lp = 900 } = {}) {
    if (!this.ctx) return null;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
    const g = this.ctx.createGain(); g.gain.value = vol;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
    const h = { osc: o, filter: f, gain: g, stop: () => { try { g.gain.setTargetAtTime(0, this.t, 0.1); o.stop(this.t + 0.5); } catch { /* já parado */ } this.loops.delete(h); } };
    this.loops.add(h); return h;
  }

  stopAll() { for (const h of [...this.loops]) h.stop(); this.setEcho(0); }
}
