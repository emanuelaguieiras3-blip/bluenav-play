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
import { AURA_GAMES, auraUrl } from '../media/auraGames.js';
import { APP_ART, CATEGORIES, gameCover, loadCatalogImage, drawCover } from './catalogArt.js';
import { createSpaceDecor, paintSpacePanel } from './spaceDecor.js';

const R = 0.64;              // biblioteca ao alcance do dedo
const PANEL_WIDTH = 0.82;
const COLS = 3;
const PAGE_SIZE = 9;

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
    paintSpacePanel(px, pc.width, pc.height, 46);
    px.fillStyle = T.text; px.font = `600 34px ${T.font}`; px.textBaseline = 'middle'; px.fillText('BlueNav / Biblioteca', 98, 42);
    loadCatalogImage('assets/bluenav-mark.svg').then(image => { if (image) { px.drawImage(image, 34, 20, 44, 44); ptex.needsUpdate = true; } });
    px.fillStyle = T.textDim; px.font = `500 26px ${T.font}`; px.textAlign = 'right';
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
    const library = [...GAMES, ...AURA_GAMES];
    this.libraryPageCount = Math.ceil(library.length / PAGE_SIZE);
    this.libraryTiles = [];
    library.forEach((g, i) => {
      const page = Math.floor(i / PAGE_SIZE), index = i % PAGE_SIZE;
      const r = Math.floor(index / COLS), c = index % COLS;
      const rowCount = Math.min(COLS, library.length - page * PAGE_SIZE - r * COLS);
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
    const vespera = makeButton(app, { w: 0.30, h: 0.045, label: 'V\u00e9spera RPG2 VR', icon: 'play', fontSize: 0.30,
      onClick: async () => {
        await app.renderer.xr.getSession()?.end();
        window.location.assign(new URL('vespera-rpg2/?mode=vr', document.baseURI).href);
      } });
    vespera.position.set(0.22, 0.335, -R); lib.add(vespera);
    this.vesperaButton = vespera;
    const official = new THREE.Group(); this.official = official; lib.add(official);
    OFFICIAL_GAMES.forEach((game, i) => {
      const card = this._appTile(game);
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
      { label: 'Rastrear mãos', icon: 'hand', fn: () => app.toggleHands() },
    ];
    options.forEach((it, i) => {
      const b = makeButton(app, { w: 0.28, h: 0.09, label: it.label, icon: it.icon, onClick: it.fn, fontSize: 0.28 });
      b.position.set(i % 2 ? 0.155 : -0.155, 0.055 - Math.floor(i / 2) * 0.115, 0.005);
      quick.add(b); if (!i) this.cameraButton = b;
    });
    this.aiStatus = makeLabel('', { w: 0.60, h: 0.045, bg: 'rgba(0,0,0,0)', size: 0.34, fg: T.textDim });
    this.aiStatus.position.set(0, -0.30, 0.003); quick.add(this.aiStatus);
    this.handStatus = makeLabel('', { w: 0.60, h: 0.045, bg: 'rgba(0,0,0,0)', size: 0.32, fg: T.textDim });
    this.handStatus.position.set(0, -0.25, 0.003); quick.add(this.handStatus);

    // ---- barra universal ----
    const bar = new THREE.Group(); this.bar = bar; this.group.add(bar);
    const pill = makeLabel('', { w: 0.78, h: 0.09, bg: T.panel });
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
        hint: it.tip, onHover: (on) => { this.tip.visible = on; if (on) { this.tip.userData.set(it.tip); this.tip.position.set(b.position.x, 0.075, 0.004); } },
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
    // Added after the overlay pass: the decor keeps its own lower render order.
    this.decor = createSpaceDecor({ lowEnd: !!(app.perf?.lowEnd || app.perf?.mobile) });
    this.group.add(this.decor.root);
    this._clockT = 0;
  }

  _tile(g, w, h) {
    const app = this.app, CW = 360, CH = Math.round(CW * h / w), IH = Math.round(CH * .65);
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const x = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    let hover = false, image = null;
    const draw = () => {
      x.clearRect(0, 0, CW, CH); x.save(); x.beginPath(); x.roundRect(2, 2, CW - 4, CH - 4, 18); x.clip();
      x.fillStyle = hover ? T.surfaceHover : T.surface; x.fillRect(0, 0, CW, CH);
      if (image) drawCover(x, image, 0, 0, CW, IH);
      else { x.fillStyle = g.color; x.fillRect(0, 0, CW, IH); }
      x.fillStyle = T.text; x.font = `600 24px ${T.font}`; x.textAlign = 'left'; x.textBaseline = 'middle';
      const words = g.name.split(' '), lines = []; let line = '';
      for (const word of words) { const next = line ? line + ' ' + word : word; if (line && x.measureText(next).width > CW - 30) { lines.push(line); line = word; } else line = next; }
      lines.push(line);
      lines.slice(0, 2).forEach((text, i) => fitText(x, text, 14, IH + 20 + i * 24, CW - 28));
      if (lines.length === 1) { x.font = `500 15px ${T.font}`; x.fillStyle = T.textDim; x.fillText(g.aura ? `AuraOS XR · ${g.category}` : CATEGORIES[g.id] || 'BlueNav', 14, IH + 46); }
      x.restore();
      if (hover) { x.strokeStyle = T.accent; x.lineWidth = 3; x.beginPath(); x.roundRect(2, 2, CW - 4, CH - 4, 18); x.stroke(); }
      tex.needsUpdate = true;
    };
    draw(); loadCatalogImage(gameCover(g.id)).then(next => { image = next; draw(); });
    const inner = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .02 })); inner.add(mesh);
    const outer = new THREE.Group(); outer.add(inner);
    outer.userData.cover = gameCover(g.id);
    app.ui.add(mesh, { owner: 'ui', press: inner, label: g.name, onClick: g.aura ? () => this.openAura(g) : () => app.loadGame(g.id),
      onHover: on => { hover = on; inner.scale.setScalar(on ? 1.025 : 1); draw(); } });
    return outer;
  }

  async openAura(g) {
    await this.app.renderer.xr.getSession()?.end();
    window.location.assign(auraUrl(g.exp));
  }

  _appTile(game) {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 166;
    const context = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    let image = null, hover = false;
    const draw = () => {
      context.clearRect(0, 0, 1000, 166); context.save(); context.beginPath(); context.roundRect(2, 2, 996, 162, 18); context.clip();
      context.fillStyle = hover ? T.surfaceHover : T.surface; context.fillRect(0, 0, 1000, 166);
      if (image) drawCover(context, image, 0, 0, 300, 166);
      context.textBaseline = 'middle'; context.textAlign = 'left'; context.fillStyle = T.text; context.font = `600 36px ${T.font}`;
      context.fillText(game.name, 333, 59); context.fillStyle = T.textDim; context.font = `500 22px ${T.font}`;
      fitText(context, game.platform, 333, 110, 620); context.restore(); texture.needsUpdate = true;
    };
    draw(); loadCatalogImage(APP_ART[game.id]).then(next => { image = next; draw(); });
    const card = new THREE.Group(), mesh = new THREE.Mesh(new THREE.PlaneGeometry(.70, .115), new THREE.MeshBasicMaterial({ map: texture, transparent: true })); card.add(mesh);
    this.app.ui.add(mesh, { owner: 'ui', press: card, label: game.name, onClick: () => this.app.openExternalApps(game.id), onHover: on => { hover = on; draw(); } });
    return card;
  }

  toggle(open = !this.open) {
    this.open = open;
    if (open) {
      const c = this.app.camera.position, yaw = this.app.headYaw();
      this.group.position.set(c.x, c.y - 0.06, c.z);
      const pitch = new THREE.Euler().setFromQuaternion(this.app.camera.quaternion, 'YXZ').x;
      this.group.rotation.set(pitch, yaw, 0, 'YXZ');
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
    this.decor.update(dt);
    if (this.quick.visible) {
      this.cameraButton.userData.setActive(this.app.passthrough.available && !!this.app.passthrough.on);
      if (!this._cameraBusy) this.cameraButton.userData.setLabel(this.app.passthrough.available ? 'Mundo real' : this._cameraError ? 'Câmera bloqueada' : 'Ativar câmera');
      const ai = this.app.hands?.gemini;
      const tracking = this.app.hands;
      this.handStatus.userData.set(tracking ? `Mãos: ${tracking.status || 'ativas'}` : this.app._handsBusy ? 'Mãos: carregando modelo' : this.app.handError ? `Câmera: ${this.app.handError}` : 'Mãos: desativadas');
      const status = !ai?.enabled ? 'IA: desligada · toque ativo' : ai.status.startsWith('ok') || ai.buttons?.status.startsWith('ok') ? 'IA: calibração e botões ativos' : ai.status.includes('API Vertex desativada') ? 'IA: habilite API Vertex' : ai.status.startsWith('erro') || ai.status.includes('esgotado') || ai.status === 'sem chave' ? 'IA: indisponível · toque ativo' : 'IA: aguardando · toque ativo';
      this.aiStatus.userData.set(status);
    }
    if ((this._clockT += dt) > 5) { this._clockT = 0; this._tick(); }
  }
}
