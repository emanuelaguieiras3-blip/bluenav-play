import * as THREE from 'three';
import { TexLib } from './core/textures.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { OrientationControls, yawOf } from './core/orientation.js';
import { StereoRenderer } from './core/stereo.js';
import { Environment } from './core/env.js';
import { Perf, detectDevice } from './core/perf.js';
import { disposeTree, DEG, clamp } from './core/util.js';
import { UI } from './ui/ui.js';
import { makeButton, makeLabel } from './ui/widgets.js';
import { WindowManager, angDiff } from './ui/windows.js';
import { VirtualKeyboard } from './ui/keyboard.js';
import { ArcMenu } from './ui/menu.js';
import { Teleport } from './ui/teleport.js';
import { Passthrough } from './core/passthrough.js';
import { HandView } from './hands/handView.js';
import { VideoLayer, CatalogContent, PlayerContent } from './media/youtube.js';
import { loadGameModule } from './games/index.js';
import { HAND_CONTROLS } from './games/handControls.js';
import { createGameGraphics } from './games/graphics.js';
import { createExternalApps } from './media/externalApps.js';
import { createSecurityPanel } from './security/securityAssist.js';

// Barra que acompanha o corpo devagar (embaixo da visão): início, menu e placar
class HudBar {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group(); this.group.visible = false;
    app.rig.add(this.group);
    // pílula de vidro com dois ícones e o placar
    const bg = makeLabel('', { w: 0.62, h: 0.075, bg: 'rgba(24,25,28,0.9)' });
    const home = makeButton(app, { w: 0.055, h: 0.055, icon: 'home', variant: 'ghost', round: true, onClick: () => app.loadGame('lobby') });
    const menu = makeButton(app, { w: 0.055, h: 0.055, icon: 'grid', variant: 'ghost', round: true, onClick: () => app.menu.toggle() });
    home.position.set(-0.27, 0, 0.003); menu.position.set(-0.205, 0, 0.003);
    this.label = makeLabel('', { w: 0.44, h: 0.07, size: 0.4, bg: 'rgba(0,0,0,0)' });
    this.label.position.set(0.075, 0, 0.003);
    this.group.add(bg, home, menu, this.label);
    this.guide = new THREE.Group();
    const guideBg = makeLabel('', { w: 0.86, h: 0.23, bg: 'rgba(16,20,28,0.94)' });
    this.guideTitle = makeLabel('', { w: 0.8, h: 0.055, size: 0.42, fg: '#87bdff', bg: 'rgba(0,0,0,0)' });
    this.guideAction = makeLabel('', { w: 0.8, h: 0.07, size: 0.32, bg: 'rgba(0,0,0,0)' });
    this.guideTip = makeLabel('', { w: 0.8, h: 0.065, size: 0.29, bg: 'rgba(0,0,0,0)' });
    this.guideTitle.position.set(0, 0.074, 0.003);
    this.guideAction.position.z = 0.003;
    this.guideTip.position.set(0, -0.07, 0.003);
    this.guide.add(guideBg, this.guideTitle, this.guideAction, this.guideTip);
    this.guide.position.y = 0.18;
    const help = makeButton(app, { w: 0.055, h: 0.055, label: '?', variant: 'accent', round: true, onClick: () => { this.guide.visible = !this.guide.visible; } });
    help.position.set(0.35, 0, 0.003);
    this.group.add(this.guide, help);
    this.yaw = 0;
    this.pitch = -34 * DEG; this.dist = 0.85;
  }
  pose(pitch = -34, dist = 0.85) { this.pitch = pitch * DEG; this.dist = dist; }
  set(text, sub = null) {
    this.pendingText = text;
    this.instruction = sub;
  }
  controls(id) { this.controlId = id; this.guide.visible = !!HAND_CONTROLS[id]; }
  update(dt) {
    this.textTime = (this.textTime || 0) - dt;
    if (this.pendingText !== undefined && this.textTime <= 0) {
      this.label.userData.set(this.pendingText); this.pendingText = undefined; this.textTime = 0.12;
    }
    const input = this.app.input;
    const active = input.pointers.filter((p) => !p.system && !p.stale);
    const hands = active.filter((p) => p.source === 'hand');
    const tracking = this.app.hands?.running;
    const state = hands.length ? (hands.some((p) => p.pinch) ? 'PINÇA' : hands.some((p) => p.fingerAim) ? 'APONTANDO' : 'MÃOS ATIVAS') : tracking ? 'MOSTRE AS MÃOS À CÂMERA' : input.source === 'xr' ? 'CONTROLES VR' : 'MOUSE / TOQUE';
    if (this.guide.visible) {
      this.guideTitle.userData.set(state);
      const controls = HAND_CONTROLS[this.controlId];
      this.guideAction.userData.set(controls?.[hands.length >= 2 ? 1 : 0] || '');
      this.guideTip.userData.set(this.instruction || (hands.length ? 'Botões: toque com indicador ou pince e solte.' : 'Ative as mãos para jogar com gestos.'));
    }
    const c = this.app.camera.position, hy = this.app.headYaw();
    this.yaw += angDiff(hy, this.yaw) * Math.min(1, dt * 1.2);
    const d = this.dist, p = this.pitch;
    this.group.position.set(c.x - Math.sin(this.yaw) * Math.cos(p) * d, c.y + Math.sin(p) * d, c.z - Math.cos(this.yaw) * Math.cos(p) * d);
    this.group.rotation.set(p, this.yaw, 0, 'YXZ'); // inclinada para os olhos
  }
}

// Mão simulada para testar a interface sem câmera (?fakehand=palm | point | pinch)
function fakeHands(kind) {
  const P = [[0, 0, 0]];
  const fx = [-0.035, -0.02, 0, 0.018, 0.034];
  for (let f = 0; f < 5; f++) {
    let x = fx[f], y = 0.0, z = 0; const ang = f === 0 ? -0.7 : (f - 2) * 0.08;
    const curl = kind === 'point' ? (f === 1 ? 0.05 : 1.3) : 0.12;
    for (let j = 0; j < 4; j++) {
      const L = [0.04, 0.035, 0.025, 0.022][j] * (f === 0 ? 0.8 : 1);
      const b = j ? curl * j * 0.6 : 0;
      x += Math.sin(ang) * L; y += Math.cos(ang) * L * Math.cos(b); z += L * Math.sin(b);
      P.push([x, y, z]);
    }
  }
  if (kind === 'pinch') P[4] = [P[8][0] + 0.004, P[8][1], P[8][2]];
  const mk = (dx, label, id) => {
    const base = [dx, -0.18, -0.42];
    const pts = P.map(([x, y, z]) => [x * (label === 'Left' ? -1 : 1) + base[0], y + base[1], (kind === 'palm' ? z : -z) + base[2]]);
    return { id, label, pontos: pts, gesto: kind === 'pinch' ? 'pinça' : kind === 'point' ? 'apontando' : 'aberta', confianca: 0.95, pinchStrength: kind === 'pinch' ? 1 : 0.2, palmFacing: kind === 'palm' ? 0.9 : -0.8 };
  };
  // ?fakehand=two → duas mãos abertas; ?fakehand=point etc → uma mão direita
  const hands = kind === 'two' ? [mk(0.16, 'Right', 0), mk(-0.16, 'Left', 1)] : [mk(0.12, 'Right', 0)];
  if (kind === 'two') hands.forEach((h) => { h.gesto = 'aberta'; h.palmFacing = -0.8; });
  return { running: true, hands, gemini: { status: 'simulado' }, detectMs: 0, update() {} };
}

export class App {
  constructor() {
    const dev = detectDevice();
    // MSAA é quase grátis em GPUs de celular (renderização por blocos); só os mais fracos ficam sem
    const r = new THREE.WebGLRenderer({ antialias: !dev.lowEnd || !dev.mobile, powerPreference: 'high-performance', alpha: false, stencil: false });
    r.setSize(window.innerWidth, window.innerHeight);
    r.xr.enabled = true;
    r.shadowMap.enabled = !dev.mobile; // sombras em tempo real ficam só no computador
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    document.body.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.03, 1200);
    this.rig = new THREE.Group();
    this.rig.add(this.camera);
    this.camera.position.set(0, 1.6, 0);
    this.scene.add(this.rig);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.mode = 'flat';
    this.look = { yaw: 0, pitch: 0 };
    this.clock = new THREE.Clock();
    this.pointerHit = null;

    this.tex = new TexLib(r);
    this.audio = new Audio();
    this.env = new Environment(this);
    this.input = new Input(this);
    this.input.bindXR(r);
    this.orientation = new OrientationControls(this.camera);
    this.stereo = new StereoRenderer(r);
    this.ui = new UI(this);
    this.wm = new WindowManager(this);
    this.keyboard = new VirtualKeyboard(this);
    this.menu = new ArcMenu(this);
    this.teleport = new Teleport(this);
    this.hud = new HudBar(this);
    this.handView = new HandView(this.scene);
    this.video = new VideoLayer(this);
    this.perf = new Perf(this);
    this.passthrough = new Passthrough(this);
    this.hands = null;
    this.walk = false;
    this.externalApps = createExternalApps(this);
    this.securityPanel = createSecurityPanel(this);

    window.addEventListener('resize', () => this.resize());
    this.debugEl = document.getElementById('debug');
    this.debug = new URLSearchParams(location.search).has('debug');
    this.debugEl.hidden = !this.debug;
    window.addEventListener('keydown', (e) => { if (e.code === 'F2') { this.debug = !this.debug; this.debugEl.hidden = !this.debug; } });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = this.mode === 'cardboard' ? (w / 2) / h : w / h;
    this.camera.fov = this.mode === 'cardboard' ? 85 : 75;
    this.camera.updateProjectionMatrix();
  }

  headYaw() { return yawOf(this.camera.quaternion); }

  recenter() {
    this.orientation.recenter();
    this.look.yaw = 0; this.look.pitch = 0;
    this.menu.open && this.menu.toggle(true);
  }

  async start(mode, { hands = false, gemini = false, onStatus = () => {} } = {}) {
    this.mode = mode;
    this.audio.unlock();
    document.getElementById('divider').hidden = mode !== 'cardboard';
    if (mode === 'cardboard') {
      try { await document.documentElement.requestFullscreen?.(); } catch { /* ok */ }
      try { await screen.orientation?.lock?.('landscape'); } catch { /* ok */ }
    }
    if (mode === 'cardboard' || (mode === 'flat' && matchMedia('(pointer: coarse)').matches)) await this.orientation.connect();
    if (mode === 'xr') {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      this.renderer.xr.setReferenceSpaceType('local-floor');
      await this.renderer.xr.setSession(session);
      session.addEventListener('end', () => { this.mode = 'flat'; this.camera.position.set(0, 1.6, 0); this.resize(); });
    }
    this.resize();
    this.renderer.setAnimationLoop((t, frame) => this.loop(t, frame));
    const params = new URLSearchParams(location.search);
    await this.loadGame(params.get('game') || 'lobby');
    if (params.has('yt')) this.openYouTube();
    if (params.has('pitch')) this.look.pitch = parseFloat(params.get('pitch'));
    if (params.has('fakehand')) this.hands = fakeHands(params.get('fakehand'));
    if (params.has('kb')) this.keyboard.show('teste', null);
    // tela sempre acesa enquanto usa (VR não tem toque para manter a tela ligada)
    const keepAwake = async () => { try { this._wake = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte */ } };
    keepAwake();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
    // passthrough: no modo óculos de celular, a câmera traseira mostra o mundo real no Início/menu/YouTube
    if (this.passthrough.on === null) this.passthrough.on = true;
    if (mode === 'cardboard' && this.passthrough.on) {
      try {
        const { getCamera } = await import('./core/cameraFeed.js');
        onStatus('Abrindo a câmera traseira…');
        this.passthrough.attach(await getCamera('environment'), false);
      } catch (e) { console.warn('Passthrough indisponível:', e); }
    }
    if (hands && mode !== 'xr') {
      try {
        const { HandTracker } = await import('./hands/handTracker.js');
        this.hands = new HandTracker();
        this.hands.hfovProvider = () => this.passthrough.displayHFOV; // mão virtual em cima da mão real
        this.hands.gemini.enabled = gemini;
        if (gemini) this.hands.gemini.status = 'aguardando mão';
        await this.hands.start({ facing: mode === 'cardboard' ? 'environment' : 'user', onStatus });
      } catch (e) {
        console.warn('Mãos indisponíveis:', e);
        onStatus('Sem câmera — usando olhar/toque.');
        this.hands = null;
      }
    }
  }

  gameCtx() {
    const app = this;
    const disposers = [];
    return {
      THREE, app, scene: this.scene, root: this.root, rig: this.rig, camera: this.camera,
      tex: this.tex, audio: this.audio, input: this.input, env: this.env, lowEnd: this.perf.lowEnd || this.perf.mobile, mobile: this.perf.mobile,
      addUI: (mesh, opts = {}) => this.ui.add(mesh, { ...opts, owner: 'game' }),
      button: (opts) => makeButton(this, { ...opts, owner: 'game' }),
      label: makeLabel,
      hud: (t, s) => this.hud.set(t, s),
      hudPose: (pitch, dist) => this.hud.pose(pitch, dist),
      // olhar inicial um pouco para baixo (mesas, bancadas) no modo tela normal
      lookDown: (pitch = -0.35) => { if (!this.orientation.active) this.look.pitch = pitch; },
      teleport: (o) => { this.teleport.configure(o); this.walk = !!o?.walk; },
      uiBusy: (p) => (p ? !!p.uiBusy : this.ui.hovering || !!this.ui.drag),
      pointers: () => (this.input.pointers || []).filter((q) => !q.system && !q.stale && !q.uiBusy),
      setPointerHit: (p) => { this.pointerHit = p ? (this._ph || (this._ph = new THREE.Vector3())).copy(p) : null; },
      onDispose: (fn) => disposers.push(fn),
      _disposers: disposers,
      eye: () => this.camera.getWorldPosition(new THREE.Vector3()),
      forward: () => new THREE.Vector3(0, 0, -1).transformDirection(this.camera.matrixWorld),
    };
  }

  async loadGame(id) {
    if (this.loading) return;
    this.loading = true;
    this.menu.toggle(false); this.keyboard.hide();
    // tela escurecida enquanto carrega (esconde a montagem e a geração de texturas)
    this.teleport.fade = 1; this.teleport.fadeDir = 0; this.teleport.shade.visible = true; this.teleport.shade.material.opacity = 1;
    try {
      if (this.game) { try { this.game.dispose?.(); } catch (e) { console.warn(e); } this.ctx?._disposers.forEach((f) => f()); }
      this.game = null; // o jogo antigo não pode mais rodar enquanto o novo carrega
      this.graphics = null;
      this.ui.removeWhere((m) => m.userData.ui?.owner === 'game');
      disposeTree(this.root); this.root.clear();
      this.audio.stopAll(); this.tex.release('game');
      this.env.set({}); this.scene.fog = null;
      this.renderer.localClippingEnabled = false;
      this.rig.position.set(0, 0, 0); this.rig.rotation.set(0, 0, 0);
      this.teleport.configure({}); this.walk = false;
      this.pointerHit = null; this.hud.set(''); this.hud.pose();
      this.look.pitch = 0;
      this.handView.visible = true;
      const mod = await loadGameModule(id);
      this.renderer.toneMappingExposure = id === 'night' ? 1.3 : id === 'dungeon' ? 1.15 : 1.05;
      this.ctx = this.gameCtx();
      this.gameId = id;
      this.game = mod.default.create(this.ctx) || {};
      this.graphics = createGameGraphics(this.ctx, id);
      // Only bounded opaque geometry casts desktop shadows; sky/ground don't.
      if (!this.perf.mobile) this.root.traverse((o) => {
        if (!o.isMesh || !o.geometry || o.userData.ui) return;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        if (!materials.some((m) => m?.isMeshStandardMaterial || m?.isMeshLambertMaterial)) return;
        o.receiveShadow = true;
        o.geometry.computeBoundingSphere();
        o.castShadow = !materials.some((m) => m?.transparent) && o.geometry.boundingSphere.radius < 8 && (o.count === undefined || o.count < 220);
      });
      this.hud.group.visible = id !== 'lobby';
      this.hud.controls(id);
      if (id === 'lobby') this.menu.toggle(true);
      this.passthrough.reset();
      // texturas finais e shaders prontos ANTES de mostrar: nada de travadinha no primeiro minuto
      this.tex.flush();
      this.scene.updateMatrixWorld(true);
      try { if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera); else this.renderer.compile(this.scene, this.camera); } catch { /* opcional */ }
    } catch (e) {
      console.error('Falha ao carregar o jogo', id, e);
    }
    this.clock.getDelta(); // não conta o tempo de carregamento como um quadro enorme
    this.teleport.fadeDir = -1;
    this.loading = false;
  }

  openYouTube() {
    this.menu.toggle(false);
    this.wm.open({ id: 'yt-catalog', title: 'YouTube · Catálogo', w: 1.1, h: 0.7, content: new CatalogContent(this) });
  }

  openExternalApps() { this.menu.toggle(false); this.externalApps.show(); }
  openSecurity() { this.menu.toggle(false); this.securityPanel.show(); }

  playVideo(video) {
    const old = this.wm.get('yt-player');
    if (old) this.wm.close(old);
    this.wm.open({ id: 'yt-player', title: '▶ ' + video.title, w: 1.0, h: 0.62, content: new PlayerContent(this, video) });
    if (!this.renderer.xr.isPresenting) this.video.play(video);
  }

  _look(dt) {
    const d = this.input.consumeLook();
    const keys = this.input.keys;
    if (keys.has('ArrowLeft') || keys.has('KeyQ')) d.x -= 260 * dt;
    if (keys.has('ArrowRight') || keys.has('KeyE')) d.x += 260 * dt;
    if (keys.has('ArrowUp')) d.y -= 200 * dt;
    if (keys.has('ArrowDown')) d.y += 200 * dt;
    if (this.orientation.update()) { this.orientation.manualYaw -= d.x * 0.004; return; }
    this.look.yaw -= d.x * 0.004; this.look.pitch = clamp(this.look.pitch - d.y * 0.004, -1.4, 1.4);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.look.pitch, this.look.yaw, 0, 'YXZ'));
  }

  _walk(dt) {
    if (!this.walk) return;
    const k = this.input.keys;
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    if (!f && !s) return;
    const yaw = this.headYaw() + this.rig.rotation.y, sp = 1.6 * dt;
    const dx = (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp, dz = (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
    const nx = this.rig.position.x + dx, nz = this.rig.position.z + dz;
    const check = this.teleport.check;
    const p = new THREE.Vector3(nx + this.camera.position.x, this.teleport.floorY, nz + this.camera.position.z);
    if (!check || check(p)) { this.rig.position.x = nx; this.rig.position.z = nz; this.game?.onWalk?.(dt); }
  }

  loop(t) {
    if (!this.perf.shouldRender(t)) return; // limite de 60 fps no celular
    const frameDt = this.clock.getDelta();
    const dt = Math.min(0.05, frameDt);
    const now = performance.now();
    if (!this.renderer.xr.isPresenting) this._look(dt);
    if (this.hands) this.hands.update(now);
    this.camera.updateMatrixWorld(true);
    this.input.update(dt);
    if (this.input.consumeMenuRequest()) this.menu.toggle();
    if (this.input.consumeRecenter()) { this.recenter(); this.audio.success(); }
    const screenOverlay = !!this.screenDialog?.open || !!this.musicPickerOpen || !this.video.el.hidden;
    if (!screenOverlay) this._walk(dt);
    if (!screenOverlay) this.ui.update(dt, this.input);
    const trackingLost = !!this.hands?.running && !this.input.hands.some((h) => !h.stale && h.confianca >= 0.3);
    const paused = this.loading || trackingLost || screenOverlay || (this.passthrough.covering && this.gameId !== 'lobby');
    this.game?.setPaused?.(paused || this.menu.open || document.hidden);
    this.teleport.update(dt, this.input, paused || this.menu.open || (this.input.source !== 'hand' && (this.ui.hovering || !!this.ui.drag)));
    if (!paused) { try { this.game?.update?.(dt, t / 1000, this.input); } catch (e) { console.error(e); this.game = null; } }
    if (!paused) this.graphics?.update(dt);
    this.handView.update(this.input);
    this.wm.update(dt);
    this.keyboard.update(dt);
    this.menu.update(dt);
    this.passthrough.update(dt);
    if (this.hud.group.visible) this.hud.update(dt);
    this.env.update();
    this.perf.update(frameDt);
    if (this.mode === 'cardboard' && !this.renderer.xr.isPresenting) this.stereo.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
    if (this.debug) this._debug();
  }

  _debug() {
    if ((this._dbgT = (this._dbgT || 0) + 1) % 10) return;
    const i = this.input, h = this.hands;
    const main = h?.hands?.[0];
    const lines = [
      `fps ${this.perf.fps.toFixed(0)} · ratio ${this.perf.ratio.toFixed(2)} · ${this.perf.lowEnd ? 'aparelho leve' : 'normal'} · draw ${this.renderer.info.render.calls}`,
      `jogo ${this.gameId} · entrada ${i.source} · gesto ${i.gesture} · pinça ${i.pinch}`,
      h ? `mãos ${h.hands.length} · detecção ${h.detectMs.toFixed(1)}ms` : 'mãos: desligado',
      h ? `gemini: ${h.gemini.status}` : '',
      main ? JSON.stringify({ gesto: main.gesto, confianca: main.confianca, pontosCorrigidos: main.pontos.slice(0, 3).map((p) => p.map((v) => +v.toFixed(3))) }) : '',
    ];
    this.debugEl.textContent = lines.filter(Boolean).join('\n');
  }
}
