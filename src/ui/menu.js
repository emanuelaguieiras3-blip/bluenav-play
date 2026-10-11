// Menu no estilo Meta Quest:
// - Barra universal embaixo (relógio + ícones), como a do Horizon OS
// - Biblioteca em painel curvo com páginas de até nove jogos
import * as THREE from 'three';
import { makeButton, makeLabel } from './widgets.js';
import { GAMES } from '../games/index.js';
import { T } from './theme.js';
import { DEG } from '../core/util.js';
import { fitText } from '../core/textures.js';
import { OFFICIAL_GAMES } from '../media/officialGames.js';

const R = 0.64;              // biblioteca ao alcance do dedo
const PANEL_WIDTH = 0.82;
const COLS = 3;
const PAGE_SIZE = 9;

// Arte de cada bloco: a própria textura do jogo (ou um desenho simples)
const ART = {
  sandbox: 'metalPanel', jobs: 'woodLight', tactical: 'brushedMetal',
  racing: 'road', ski: 'snow', motorbike: 'asphalt', jungle: 'barkMoss', arena: 'stoneTiles', archery: 'target', kingdom: 'blockGrassTop',
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
    const pal = { rhythm: ['#0e1016', '#1a1d26'], puzzle: ['#e9ecf1', '#c9ced6'], dive: ['#3fc2d8', '#0b4a6e'], night: ['#0b0f1a', '#020305'], physics: ['#ffffff', '#dfe3e8'], shiftworld: ['#b765bc', '#32234e'] }[id] || ['#333', '#111'];
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

    // Floating window with tabs and a separate universal dock, within reach.
    const lib = new THREE.Group(); this.lib = lib; this.group.add(lib);
    const H = 0.76;
    const pc = document.createElement('canvas'); pc.width = 1200; pc.height = Math.round(1200 * H / PANEL_WIDTH);
    const px = pc.getContext('2d');
    px.fillStyle = T.panel; px.beginPath(); px.roundRect(0, 0, pc.width, pc.height, 46); px.fill();
    px.fillStyle = T.text; px.font = `600 42px ${T.font}`; px.textBaseline = 'middle'; px.fillText('Biblioteca', 52, 68);
    px.fillStyle = T.textDim; px.font = `500 26px ${T.font}`; px.textAlign = 'right'; px.fillText('BlueNav Play', pc.width - 54, 68);
    px.strokeStyle = T.line; px.lineWidth = 2; px.beginPath(); px.moveTo(52, 108); px.lineTo(pc.width - 52, 108); px.stroke();
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 4;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH, H), new THREE.MeshBasicMaterial({ map: ptex, transparent: true, depthWrite: false }));
    panel.position.z = -R - 0.04;
    lib.add(panel);

    const step = 0.245, tileW = 0.223, tileH = 0.139;
    const own = new THREE.Group(); this.own = own; lib.add(own);
    this.libraryKind = 'own';
    const ownTab = makeButton(app, { w: 0.26, h: 0.055, label: 'Jogos BlueNav', onClick: () => this.showLibrary('own'), fontSize: 0.32 });
    const officialTab = makeButton(app, { w: 0.26, h: 0.055, label: 'Jogos oficiais', onClick: () => this.showLibrary('official'), fontSize: 0.32 });
    ownTab.position.set(-0.145, 0.285, -R + 0.01); officialTab.position.set(0.145, 0.285, -R + 0.01);
    this.libraryTabs = [ownTab, officialTab]; lib.add(ownTab, officialTab);
    this.libraryPage = 0;
    this.libraryPageCount = Math.ceil(GAMES.length / PAGE_SIZE);
    this.libraryTiles = [];
    GAMES.forEach((g, i) => {
      const page = Math.floor(i / PAGE_SIZE), index = i % PAGE_SIZE;
      const r = Math.floor(index / COLS), c = index % COLS;
      const rowCount = Math.min(COLS, GAMES.length - page * PAGE_SIZE - r * COLS);
      const x = (c - (rowCount - 1) / 2) * step;
      const y = 0.155 - r * (tileH + 0.025);
      const tile = this._tile(g, tileW, tileH);
      tile.position.set(x, y, -R);
      own.add(tile);
      this.libraryTiles.push(tile);
    });
    const previous = makeButton(app, { w: 0.12, h: 0.055, label: 'Anterior', onClick: () => this.showPage(this.libraryPage - 1), fontSize: 0.32 });
    const next = makeButton(app, { w: 0.12, h: 0.055, label: 'Próxima', onClick: () => this.showPage(this.libraryPage + 1), fontSize: 0.32 });
    previous.position.set(-0.18, -0.30, -R); next.position.set(0.18, -0.30, -R);
    this.pageLabel = makeLabel('', { w: 0.10, h: 0.05, bg: T.surface, fg: T.text, size: 0.48 });
    this.pageLabel.position.set(0, -0.30, -R + 0.025);
    own.add(previous, next, this.pageLabel);
    this.showPage(0);
    const official = new THREE.Group(); this.official = official; lib.add(official);
    OFFICIAL_GAMES.forEach((game, i) => {
      const card = makeButton(app, { w: 0.70, h: 0.115, label: game.name, sub: game.platform, icon: 'play', fontSize: 0.30,
        onClick: () => app.openExternalApps(game.id) });
      card.position.set(0, 0.13 - i * 0.14, -R); official.add(card);
    });
    const externalHint = makeLabel('Abre o site oficial. Instale no dispositivo compatível.', { w: 0.70, h: 0.045, size: 0.30, bg: 'rgba(0,0,0,0)', fg: T.textDim });
    externalHint.position.set(0, -0.33, -R); official.add(externalHint);
    this.showLibrary('own');
    lib.position.y = 0.08;

    // Ajustes rápidos permanecem dentro do VR, no mesmo alcance da biblioteca.
    const quick = new THREE.Group(); this.quick = quick; quick.visible = false;
    quick.position.set(0, 0.08, -0.60); this.group.add(quick);
    quick.add(makeLabel('', { w: 0.68, h: 0.68, bg: T.panel, radius: 0.12 }));
    const title = makeLabel('Ajustes rápidos', { w: 0.57, h: 0.065, bg: 'rgba(0,0,0,0)', size: 0.46 });
    title.position.set(0, 0.17, 0.003); quick.add(title);
    const options = [
      { label: 'Mundo real', icon: 'eye', fn: () => this.toggleCamera() },
      { label: 'Recentralizar', icon: 'recenter', fn: () => app.recenter() },
      { label: 'Teclado', icon: 'keyboard', fn: () => app.keyboard.show('', null) },
      { label: 'Segurança', icon: 'eye', fn: () => app.openSecurity() },
      { label: 'Objetos físicos', icon: 'block', fn: () => app.togglePhysics() },
    ];
    options.forEach((it, i) => {
      const b = makeButton(app, { w: 0.28, h: 0.09, label: it.label, icon: it.icon, onClick: it.fn, fontSize: 0.28 });
      b.position.set(i % 2 ? 0.155 : -0.155, 0.055 - Math.floor(i / 2) * 0.115, 0.005);
      quick.add(b); if (!i) this.cameraButton = b;
    });
    this.aiStatus = makeLabel('', { w: 0.60, h: 0.045, bg: 'rgba(0,0,0,0)', size: 0.34, fg: T.textDim });
    this.aiStatus.position.set(0, -0.30, 0.003); quick.add(this.aiStatus);

    // ---- barra universal ----
    const bar = new THREE.Group(); this.bar = bar; this.group.add(bar);
    const pill = makeLabel('', { w: 0.78, h: 0.09, bg: 'rgba(24,25,28,0.96)' });
    bar.add(pill);
    this.clock = makeLabel('', { w: 0.1, h: 0.05, bg: 'rgba(0,0,0,0)', size: 0.5 });
    this.clock.position.set(-0.315, 0, 0.002); bar.add(this.clock);
    this.tip = makeLabel('', { w: 0.18, h: 0.042, bg: 'rgba(242,243,245,0.96)', fg: T.textOnLight, size: 0.48 });
    this.tip.visible = false; bar.add(this.tip);
    const items = [
      { icon: 'home', tip: 'Início', fn: () => app.loadGame('lobby') },
      { icon: 'grid', tip: 'Biblioteca', panel: 'library', fn: () => this.showPanel('library') },
      { icon: 'play', tip: 'YouTube', fn: () => app.openYouTube() },
      { icon: 'block', tip: 'Jogos externos', fn: () => app.openExternalApps() },
      { icon: 'keyboard', tip: 'Teclado', fn: () => app.keyboard.show('', null) },
      { icon: 'settings', tip: 'Ajustes rápidos', panel: 'quick', fn: () => this.showPanel('quick') },
      { icon: 'close', tip: 'Fechar menu', fn: () => this.toggle(false) },
    ];
    this.dockButtons = [];
    items.forEach((it, i) => {
      const b = makeButton(app, {
        w: 0.072, h: 0.072, icon: it.icon, variant: 'ghost', round: true, onClick: it.fn,
        onHover: (on) => { this.tip.visible = on; if (on) { this.tip.userData.set(it.tip); this.tip.position.set(b.position.x, 0.075, 0.004); } },
      });
      b.position.set(-0.21 + i * 0.085, 0, 0.004);
      bar.add(b);
      this.dockButtons.push({ button: b, panel: it.panel });
    });
    bar.position.set(0, -0.33, -0.58);
    bar.rotation.x = -0.15;
    this.showPanel('library');
    // The system menu must remain visible over nearby game geometry.
    this.group.traverse(o => {
      if (!o.isMesh) return;
      o.renderOrder = o.userData.ui ? 310 : 300;
      o.material.depthTest = false; o.material.depthWrite = false; o.material.toneMapped = false;
    });
    for (const label of [this.clock, this.tip, title, this.aiStatus, this.pageLabel]) label.renderOrder = 320;
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
    const badge = art.getContext('2d');
    badge.fillStyle = g.color;
    badge.beginPath(); badge.arc(34, 34, 23, 0, Math.PI * 2); badge.fill();
    badge.strokeStyle = '#f4f8ff'; badge.lineWidth = 3;
    badge.beginPath(); badge.moveTo(34, 16); badge.lineTo(39, 29); badge.lineTo(52, 34); badge.lineTo(39, 39); badge.lineTo(34, 52); badge.lineTo(29, 39); badge.lineTo(16, 34); badge.lineTo(29, 29); badge.closePath(); badge.stroke();
    badge.fillStyle = '#fff'; badge.font = 'bold 14px sans-serif'; badge.textAlign = 'center'; badge.textBaseline = 'middle';
    badge.fillText(g.name[0].toUpperCase(), 34, 34);
    const draw = () => {
      x.clearRect(0, 0, CW, CH);
      x.save(); x.beginPath(); x.roundRect(4, 4, CW - 8, IH - 8, 22); x.clip(); x.drawImage(art, 0, 0); x.restore();
      if (hover) { x.strokeStyle = '#ffffff'; x.lineWidth = 6; x.beginPath(); x.roundRect(4, 4, CW - 8, IH - 8, 22); x.stroke(); }
      x.fillStyle = hover ? T.text : T.textDim; x.font = `600 30px ${T.font}`; x.textAlign = 'left'; x.textBaseline = 'middle';
      fitText(x, g.name, 10, IH + (CH - IH) / 2, CW - 20);
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
      onHover: (on) => { hover = on; inner.scale.setScalar(on ? 1.035 : 1); draw(); },
    });
    return outer;
  }

  toggle(open = !this.open) {
    this.open = open;
    if (open) {
      const c = this.app.camera.position, yaw = this.app.headYaw();
      this.group.position.set(c.x, c.y - 0.1, c.z);
      this.group.rotation.set(0, yaw, 0);
      this.showPanel('library');
      this.group.visible = true;
      this._tick();
    }
  }

  showPanel(panel) {
    this.lib.visible = panel === 'library'; this.quick.visible = panel === 'quick';
    this.dockButtons?.forEach(({ button, panel: item }) => button.userData.setActive(item === panel));
  }

  showLibrary(kind) {
    this.libraryKind = kind === 'official' ? 'official' : 'own';
    this.own.visible = this.libraryKind === 'own'; this.official.visible = !this.own.visible;
    this.libraryTabs.forEach((tab, index) => tab.userData.setActive(index === (this.own.visible ? 0 : 1)));
  }

  showPage(page) {
    this.libraryPage = Math.max(0, Math.min(this.libraryPageCount - 1, page));
    this.libraryTiles.forEach((tile, i) => { tile.visible = Math.floor(i / PAGE_SIZE) === this.libraryPage; });
    this.pageLabel.userData.set(`${this.libraryPage + 1}/${this.libraryPageCount}`);
  }

  async toggleCamera() {
    if (this._cameraBusy) return;
    if (this.app.passthrough.available) { this.app.passthrough.toggle(); return; }
    this._cameraBusy = true; this.cameraButton.userData.setLabel('Abrindo câmera…');
    try {
      const { getCamera } = await import('../core/cameraFeed.js');
      const tracker = this.app.hands;
      const video = tracker?.video || await getCamera('environment');
      this.app.passthrough.attach(video, !!tracker?.mirror);
      this.app.passthrough.toggle(true); this._cameraError = false;
    } catch { this._cameraError = true; }
    finally { this._cameraBusy = false; }
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
    if (this.quick.visible) {
      this.cameraButton.userData.setActive(this.app.passthrough.available && !!this.app.passthrough.on);
      if (!this._cameraBusy) this.cameraButton.userData.setLabel(this.app.passthrough.available ? 'Mundo real' : this._cameraError ? 'Câmera bloqueada' : 'Ativar câmera');
      const ai = this.app.hands?.gemini;
      const status = !ai?.enabled ? 'IA: desligada · toque ativo' : ai.status.startsWith('ok') ? 'IA: calibração ativa' : ai.status.startsWith('erro') || ai.status.includes('esgotado') || ai.status === 'sem chave' ? 'IA: indisponível · toque ativo' : 'IA: aguardando · toque ativo';
      this.aiStatus.userData.set(status);
    }
    if ((this._clockT += dt) > 5) { this._clockT = 0; this._tick(); }
  }
}
