// Passthrough (como no Meta Quest): a imagem da câmera traseira vira o fundo.
// Fica ativo no Início, com o menu aberto e com o YouTube/teclado abertos.
// Dentro de um jogo, abrir o menu ou o YouTube pausa o jogo e mostra o mundo real.
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { safeStorage } from './util.js';

const DIST = 8; // plano de fundo; câmera monocular usa a mesma perspectiva nos dois olhos

export class Passthrough {
  constructor(app) {
    this.app = app;
    this.on = safeStorage.get('bn.passthrough', null);
    this.mesh = null;
    this.active = false;
    this.k = 0;
    this._saved = null;
  }

  get available() { return !!this.mesh; }

  attach(video, mirror = false) {
    if (this.mesh) return;
    const tex = new THREE.VideoTexture(video);
    this.liveTexture = tex;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false, transparent: true, opacity: 0, fog: false });
    this.video = video;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.mesh.position.z = -DIST;
    this.mirror = mirror;
    this.mesh.renderOrder = -1000; this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.app.camera.add(this.mesh);
    this._fit();
  }
  // Display the same exposure that produced the landmarks, not newer video.
  presentFrame(frame) {
    if (!this.mesh) return;
    if (!frame) { this.mesh.material.map = this.liveTexture; return; }
    if (!this.frameCanvas) {
      this.frameCanvas = document.createElement('canvas');
      this.frameTexture = new THREE.CanvasTexture(this.frameCanvas);
      this.frameTexture.colorSpace = THREE.SRGBColorSpace;
      this.frameTexture.minFilter = this.frameTexture.magFilter = THREE.LinearFilter;
      this.frameTexture.generateMipmaps = false;
    }
    const canvas = this.frameCanvas;
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width; canvas.height = frame.height;
    }
    canvas.getContext('2d').drawImage(frame, 0, 0);
    this.frameTexture.needsUpdate = true;
    this.mesh.material.map = this.frameTexture;
    this._fit();
  }

  // Tamanho do painel: por padrão PREENCHE a visão inteira (a câmera do celular vê ~63°, os óculos ~90°);
  // com CONFIG.PASSTHROUGH_FILL = false usa a escala real (com bordas pretas).
  _fit() {
    const cam = this.app.camera, v = this.video;
    const va = this.frameCanvas && this.mesh.material.map === this.frameTexture
      ? this.frameCanvas.width / this.frameCanvas.height : (v.videoWidth || 16) / (v.videoHeight || 9);
    const key = cam.fov + '|' + cam.aspect.toFixed(3) + '|' + va.toFixed(3);
    if (key === this._fitKey) return;
    this._fitKey = key;
    let w, h;
    if (CONFIG.PASSTHROUGH_FILL !== false) {
      const visH = 2 * DIST * Math.tan((cam.fov * Math.PI / 180) / 2) * 1.02, visW = visH * cam.aspect;
      if (visW / visH > va) { w = visW; h = w / va; } else { h = visH; w = h * va; }
    } else {
      w = 2 * DIST * Math.tan((CONFIG.CAMERA_HFOV * Math.PI / 180) / 2); h = w / va;
    }
    this.mesh.scale.set(w * (this.mirror ? -1 : 1), h, 1);
    // campo de visão horizontal com que a câmera aparece: o rastreador das mãos usa o mesmo
    this.displayHFOV = 2 * Math.atan((w / 2) / DIST);
  }

  toggle(v = !this.on) { this.on = v; safeStorage.set('bn.passthrough', v); }

  // o mundo virtual fica escondido/pausado enquanto o passthrough está ativo
  get covering() { return this.active && this.k > 0.5; }

  update(dt) {
    const app = this.app;
    if (!this.mesh) return;
    const overlayOpen = app.menu.open || !!app.screenDialog?.open || app.keyboard.group.visible || app.wm.wins.some((w) => !w.minimized);
    const want = !!this.on && !app.renderer.xr.isPresenting && (app.gameId === 'lobby' || overlayOpen);
    this.active = want;
    this.k += ((want ? 1 : 0) - this.k) * Math.min(1, dt * 8);
    if (!want && this.k < 0.01) this.k = 0;
    this.mesh.material.opacity = this.k;
    this._fit(); // barato (só recalcula se algo mudou); mantém mão e imagem alinhadas
    this.mesh.visible = this.k > 0.001;

    const scene = app.scene;
    if (this.covering) {
      if (!this._saved) this._saved = { bg: scene.background, fog: scene.fog, sky: app.env.skyHolder.visible };
      scene.background = new THREE.Color(0x000000); scene.fog = null;
      app.env.skyHolder.visible = false;
      app.root.visible = false;
    } else if (this._saved) {
      scene.background = this._saved.bg; scene.fog = this._saved.fog; app.env.skyHolder.visible = this._saved.sky;
      app.root.visible = true;
      this._saved = null;
    }
    document.getElementById('video-layer')?.classList.toggle('pt', this.active);
  }

  // ao trocar de jogo, o ambiente novo manda (descarta o que estava guardado)
  reset() { this._saved = null; this.app.root.visible = true; }
}
