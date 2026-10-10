// Menu no estilo Meta Quest:
// - Barra universal embaixo (relógio + ícones), como a do Horizon OS
// - Biblioteca em painel curvo (arco suave a ~1 m) com os 16 jogos em blocos com arte
import * as THREE from 'three';
import { makeButton, makeLabel } from './widgets.js';
import { GAMES } from '../games/index.js';
import { T } from './theme.js';
import { DEG } from '../core/util.js';

const R = 1.1;               // raio do arco
const SPAN = 62 * DEG;       // largura angular da biblioteca
const COLS = 6;

// Arte de cada bloco: a própria textura do jogo (ou um desenho simples)
const ART = {
  racing: 'road', jungle: 'barkMoss', arena: 'stoneTiles', archery: 'target', kingdom: 'blockGrassTop',
  dungeon: 'dungeonWall', galaxy: 'earth', climb: 'rockStrata', cook: 'marble', tablegames: 'cardBack', blocks: 'mcGrassSide',
};
function drawArt(app, id, x, X, Y, W, H) {
  const name = ART[id];
  if (name) {
    const src = app.tex.drawCanvas(name, 128);
    x.imageSmoothingEnabled = name.startsWith('mc') ? false : true;
    const s = Math.max(W, H);
    x.drawImage(src, X + (W - s) / 2, Y + (H - s) / 2, s, s);
    x.imageSmoothingEnabled = true;
  } else {
    const g = x.createLinearGradient(X, Y, X, Y + H);
    const pal = { rhythm: ['#0e1016', '#1a1d26'], puzzle: ['#e9ecf1', '#c9ced6'], dive: ['#3fc2d8', '#0b4a6e'], night: ['#0b0f1a', '#020305'], physics: ['#ffffff', '#dfe3e8'] }[id] || ['#333', '#111'];
    g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); x.fillStyle = g; x.fillRect(X, Y, W, H);
    if (id === 'rhythm') ['#4aa3ff', '#ff5fa8', '#ffcf4a'].forEach((c, i) => { x.fillStyle = c; x.shadowColor = c; x.shadowBlur = 18; x.beginPath(); x.roundRect(X + W * (0.22 + i * 0.22), Y + H * (0.35 + (i % 2) * 0.12), W * 0.13, W * 0.13, 6); x.fill(); });
    if (id === 'puzzle') { x.fillStyle = '#f7f9fc'; x.strokeStyle = '#8a93a3'; x.lineWidth = 2; for (const [a, b] of [[0.38, 0.3], [0.52, 0.3], [0.38, 0.5]]) { x.beginPath(); x.roundRect(X + W * a, Y + H * b, W * 0.14, W * 0.14, 5); x.fill(); x.stroke(); } }
    if (id === 'dive') { x.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(X + W * (0.2 + (i * 0.37) % 0.7), Y + H * (0.25 + (i * 0.23) % 0.6), 3 + (i % 3) * 2, 0, 6.29); x.fill(); } }
    if (id === 'night') { x.fillStyle = '#dfe6ff'; x.beginPath(); x.arc(X + W * 0.7, Y + H * 0.3, H * 0.12, -1, 1.2); x.lineWidth = 6; x.strokeStyle = '#dfe6ff'; x.stroke(); x.fillStyle = 'rgba(255,240,190,0.35)'; x.beginPath(); x.moveTo(X + W * 0.2, Y + H); x.lineTo(X + W * 0.45, Y + H * 0.45); x.lineTo(X + W * 0.6, Y + H); x.fill(); }
    if (id === 'physics') { x.fillStyle = '#1b1c1f'; x.beginPath(); x.arc(X + W * 0.5, Y + H * 0.42, H * 0.16, 0, 6.29); x.fill(); x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(X + W * 0.5, Y + H * 0.82, H * 0.18, H * 0.05, 0, 0, 6.29); x.fill(); }
  }
  // leve escurecimento embaixo para dar profundidade
  const v = x.createLinearGradient(X, Y + H * 0.5, X, Y + H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
  x.fillStyle = v; x.fillRect(X, Y, W, H);
}

export class ArcMenu {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.open = false;
    this.anim = 0;
    app.rig.add(this.group);

    // ---- painel curvo da biblioteca ----
    const lib = new THREE.Group(); this.lib = lib; this.group.add(lib);
    const H = 0.62;
    const pc = document.createElement('canvas'); pc.width = 1400; pc.height = Math.round(1400 * H / (SPAN * R));
    const px = pc.getContext('2d');
    px.fillStyle = T.panel; px.beginPath(); px.roundRect(0, 0, pc.width, pc.height, 46); px.fill();
    px.fillStyle = T.text; px.font = `600 40px ${T.font}`; px.textBaseline = 'middle'; px.fillText('Biblioteca', 52, 62);
    px.fillStyle = T.textDim; px.font = `500 26px ${T.font}`; px.fillText(`${GAMES.length} apps`, 262, 64);
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 4;
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, H, 48, 1, true, Math.PI - SPAN / 2, SPAN), new THREE.MeshBasicMaterial({ map: ptex, transparent: true, side: THREE.BackSide, depthWrite: false }));
    // CylinderGeometry gira no sentido anti-horário visto de cima: espelha o U para o texto ficar certo
    ptex.wrapS = THREE.RepeatWrapping; ptex.repeat.x = -1;
    lib.add(panel);

    const step = (SPAN * 0.9) / COLS, tileW = step * R * 0.9, tileH = tileW * 0.82;
    GAMES.forEach((g, i) => {
      const r = Math.floor(i / COLS), c = i % COLS;
      const a = (c - (COLS - 1) / 2) * step;
      const y = 0.12 - r * (tileH + 0.025);
      const tile = this._tile(g, tileW, tileH);
      tile.position.set(Math.sin(a) * R, y, -Math.cos(a) * R);
      tile.rotation.y = -a;
      lib.add(tile);
    });
    lib.position.y = 0.08;

    // ---- barra universal ----
    const bar = new THREE.Group(); this.bar = bar; this.group.add(bar);
    const pill = makeLabel('', { w: 0.68, h: 0.085, bg: 'rgba(24,25,28,0.92)' });
    bar.add(pill);
    this.clock = makeLabel('', { w: 0.1, h: 0.05, bg: 'rgba(0,0,0,0)', size: 0.5 });
    this.clock.position.set(-0.275, 0, 0.002); bar.add(this.clock);
    this.tip = makeLabel('', { w: 0.18, h: 0.042, bg: 'rgba(242,243,245,0.96)', fg: T.textOnLight, size: 0.48 });
    this.tip.visible = false; bar.add(this.tip);
    const items = [
      { icon: 'grid', tip: 'Biblioteca', fn: () => { lib.visible = !lib.visible; } },
      { icon: 'play', tip: 'YouTube', fn: () => app.openYouTube() },
      { icon: 'keyboard', tip: 'Teclado', fn: () => app.keyboard.show('', null) },
      { icon: 'eye', tip: 'Mundo real (câmera)', fn: () => { if (!app.passthrough.available) { this.tip.userData.set('Só no modo óculos'); return; } app.passthrough.toggle(); } },
      { icon: 'recenter', tip: 'Recentralizar', fn: () => app.recenter() },
      { icon: 'home', tip: 'Início', fn: () => app.loadGame('lobby') },
      { icon: 'close', tip: 'Fechar menu', fn: () => this.toggle(false) },
    ];
    items.forEach((it, i) => {
      const b = makeButton(app, {
        w: 0.06, h: 0.06, icon: it.icon, variant: 'ghost', round: true, onClick: it.fn,
        onHover: (on) => { this.tip.visible = on; if (on) { this.tip.userData.set(it.tip); this.tip.position.set(b.position.x, 0.075, 0.004); } },
      });
      b.position.set(-0.18 + i * 0.072, 0, 0.004);
      bar.add(b);
    });
    bar.position.set(0, -0.3, -0.98);
    bar.rotation.x = -0.25;
    this._clockT = 0;
  }

  _tile(g, w, h) {
    const app = this.app;
    const CW = 300, CH = Math.round(CW * h / w), IH = Math.round(CH * 0.74);
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const x = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 1; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    let hover = false;
    const art = document.createElement('canvas'); art.width = CW; art.height = IH;
    drawArt(app, g.id, art.getContext('2d'), 0, 0, CW, IH);
    const draw = () => {
      x.clearRect(0, 0, CW, CH);
      x.save(); x.beginPath(); x.roundRect(4, 4, CW - 8, IH - 8, 22); x.clip(); x.drawImage(art, 0, 0); x.restore();
      if (hover) { x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.beginPath(); x.roundRect(4, 4, CW - 8, IH - 8, 22); x.stroke(); }
      x.fillStyle = hover ? T.text : T.textDim; x.font = `600 30px ${T.font}`; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText(g.name, 10, IH + (CH - IH) / 2);
      tex.needsUpdate = true;
    };
    draw();
    const inner = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02 }));
    inner.add(mesh);
    const outer = new THREE.Group(); outer.add(inner);
    app.ui.add(mesh, {
      owner: 'ui', press: inner,
      onClick: () => app.loadGame(g.id),
      onHover: (on) => { hover = on; inner.position.z = on ? 0.02 : 0; inner.scale.setScalar(on ? 1.06 : 1); draw(); },
    });
    return outer;
  }

  toggle(open = !this.open) {
    this.open = open;
    if (open) {
      const c = this.app.camera.position, yaw = this.app.headYaw();
      this.group.position.set(c.x, c.y - 0.1, c.z);
      this.group.rotation.set(0, yaw, 0);
      this.lib.visible = true;
      this.group.visible = true;
      this._tick();
    }
  }

  _tick() {
    const d = new Date();
    this.clock.userData.set(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  }

  update(dt) {
    const target = this.open ? 1 : 0;
    this.anim += (target - this.anim) * Math.min(1, dt * 10);
    if (!this.open && this.anim < 0.02) { this.group.visible = false; return; }
    // abre crescendo e subindo de leve, como no Quest
    this.group.scale.setScalar(0.94 + 0.06 * this.anim);
    this.lib.position.y = 0.08 - (1 - this.anim) * 0.04;
    if ((this._clockT += dt) > 5) { this._clockT = 0; this._tick(); }
  }
}
