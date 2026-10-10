// Sistema de janelas: no máximo 3 abertas. A 4ª minimiza a mais antiga para o canto esquerdo.
// Inclinação 15°–35° para o centro · opacidade 100/85/70% · desfoque nos planos de fundo
// · áudio -70% nas janelas de fundo · arrasto pelas bordas com inércia.
import * as THREE from 'three';
import { roundRect, fitText } from '../core/textures.js';
import { makeButton } from './widgets.js';
import { T } from './theme.js';
import { clamp, DEG } from '../core/util.js';

const MAX_OPEN = 3;
const RADIUS = 1.45;
const RANK = [
  { opacity: 1.0, blur: 0, vol: 1 },
  { opacity: 0.85, blur: 1.6, vol: 0.3 },
  { opacity: 0.7, blur: 3.2, vol: 0.3 },
];
const SLOTS = [0, 34 * DEG, -34 * DEG];

class Win {
  constructor(wm, { id, title, w = 1.0, h = 0.62, content }) {
    this.wm = wm; this.id = id; this.title = title; this.w = w; this.h = h; this.content = content;
    this.minimized = false; this.rank = 0;
    this.yaw = 0; this.pitch = 0; this.vYaw = 0; this.vPitch = 0; this.dragging = false;
    this.hoverIdx = -1; this.items = []; this.dirty = true;
    const app = wm.app;
    this.group = new THREE.Group();
    // canvas do conteúdo
    this.cw = 1024; this.ch = Math.round(1024 * h / w);
    this.src = document.createElement('canvas'); this.src.width = this.cw; this.src.height = this.ch;
    this.view = document.createElement('canvas'); this.view.width = this.cw; this.view.height = this.ch;
    this.tex = new THREE.CanvasTexture(this.view); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat);
    this.group.add(this.panel);

    // barra de arrastar embaixo do painel (como no Quest) — pinçar e segurar move a janela
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 40;
    const drawBar = (on) => { const x = bc.getContext('2d'); x.clearRect(0, 0, 256, 40); x.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.45)'; x.beginPath(); x.roundRect(2, 8, 252, 24, 12); x.fill(); barTex.needsUpdate = true; };
    const barTex = new THREE.CanvasTexture(bc); barTex.colorSpace = THREE.SRGBColorSpace;
    drawBar(false);
    this.bar = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.04), new THREE.MeshBasicMaterial({ map: barTex, transparent: true, depthWrite: false }));
    this.bar.position.set(0, -h / 2 - 0.045, 0.005); this.group.add(this.bar);
    // área de pegar maior que o desenho, para acertar fácil
    this.barHit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
    this.barHit.position.copy(this.bar.position); this.group.add(this.barHit);
    app.ui.add(this.barHit, { owner: 'ui', sound: false, onHover: (on) => { drawBar(on); this.bar.scale.setScalar(on ? 1.15 : 1); }, drag: this._dragHandlers() });
    this.edges = [this.barHit];

    // botões brancos flutuantes no canto superior direito: minimizar e fechar
    const mk = (icon, x, fn) => {
      const b = makeButton(app, { w: 0.06, h: 0.06, icon, variant: 'light', round: true, onClick: fn });
      b.position.set(x, h / 2 + 0.05, 0.02); this.group.add(b); return b;
    };
    this.btnClose = mk('close', w / 2 - 0.03, () => wm.close(this));
    this.btnMin = mk('minus', w / 2 - 0.105, () => wm.minimize(this));

    app.ui.add(this.panel, { owner: 'ui', resolve: (hit) => this._resolve(hit) });
    wm.root.add(this.group);
    content.attach?.(this);
  }

  _resolve(hit) {
    const x = hit.uv.x * this.cw, y = (1 - hit.uv.y) * this.ch;
    const idx = this.items.findIndex((it) => x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h);
    if (idx !== this.hoverIdx) { this.hoverIdx = idx; this.dirty = true; }
    if (idx >= 0) {
      const it = this.items[idx];
      return { key: this.id + ':' + idx + ':' + (it.key || ''), dwell: it.dwell, onClick: () => { this.wm.focus(this); it.onClick?.(it); }, onSwipe: this._swipe };
    }
    return { key: this.id + ':bg', onClick: this.rank > 0 ? () => this.wm.focus(this) : null, onSwipe: this._swipe };
  }

  // pinçar e arrastar sobre o conteúdo = rolar (como no Quest)
  get _swipe() { return this.content.onSwipe ? (dx, dy) => this.content.onSwipe(dx, dy, this) : null; }

  _dragHandlers() {
    const sph = new THREE.Sphere();
    const p = new THREE.Vector3();
    let off = [0, 0], lastT = 0;
    const angles = (input) => {
      const c = this.wm.center();
      this.wm.root.localToWorld(c);
      sph.set(c, RADIUS);
      if (!input.ray.intersectSphere(sph, p)) return null;
      this.wm.root.worldToLocal(p);
      const lc = this.wm.center();
      const v = p.sub(lc);
      return [Math.atan2(-v.x, -v.z), Math.asin(clamp(v.y / RADIUS, -1, 1))];
    };
    return {
      start: (input) => { const a = angles(input); if (!a) return; off = [this.yaw - a[0], this.pitch - a[1]]; this.dragging = true; this.wm.focus(this); lastT = performance.now(); },
      move: (input) => {
        const a = angles(input); if (!a) return;
        const now = performance.now(), dt = Math.max(0.001, (now - lastT) / 1000); lastT = now;
        const ny = a[0] + off[0], np = clamp(a[1] + off[1], -50 * DEG, 50 * DEG);
        this.vYaw = (ny - this.yaw) / dt; this.vPitch = (np - this.pitch) / dt;
        // seguimento suave (inércia ao pegar)
        this.yaw += (ny - this.yaw) * 0.5; this.pitch += (np - this.pitch) * 0.5;
      },
      end: () => { this.dragging = false; },
    };
  }

  invalidate() { this.dirty = true; }

  draw() {
    const x = this.src.getContext('2d'), W = this.cw, H = this.ch;
    x.clearRect(0, 0, W, H);
    x.fillStyle = T.panel; roundRect(x, 0, 0, W, H, 40); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 2; roundRect(x, 1, 1, W - 2, H - 2, 39); x.stroke();
    x.fillStyle = T.text; x.font = `600 34px ${T.font}`; x.textAlign = 'left'; x.textBaseline = 'middle';
    fitText(x, this.title, 40, 52, W - 120);
    this.items = [];
    this.content.draw(x, W, H, this);
    // destaque de hover
    const hi = this.items[this.hoverIdx];
    if (hi && hi.onClick) { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; roundRect(x, hi.x - 4, hi.y - 4, hi.w + 8, hi.h + 8, (hi.r ?? 18) + 4); x.stroke(); }
    // composição com desfoque conforme o plano
    const v = this.view.getContext('2d');
    v.clearRect(0, 0, W, H);
    const blur = this.wm.app.perf?.mobile ? 0 : RANK[this.rank]?.blur || 0; // desfoque de canvas é caro no celular
    v.filter = blur ? `blur(${blur}px)` : 'none';
    v.drawImage(this.src, 0, 0);
    v.filter = 'none';
    this.tex.needsUpdate = true;
    this.dirty = false;
  }

  update(dt) {
    if (!this.dragging && (Math.abs(this.vYaw) > 0.001 || Math.abs(this.vPitch) > 0.001)) {
      this.yaw += this.vYaw * dt; this.pitch = clamp(this.pitch + this.vPitch * dt, -50 * DEG, 50 * DEG);
      const k = Math.exp(-5 * dt); this.vYaw *= k; this.vPitch *= k;
    }
    const c = this.wm.center();
    const cp = Math.cos(this.pitch);
    this.group.position.set(c.x - Math.sin(this.yaw) * cp * RADIUS, c.y + Math.sin(this.pitch) * RADIUS, c.z - Math.cos(this.yaw) * cp * RADIUS);
    // inclinação em direção ao centro da visão: 15°–35° (em relação ao ponto onde a janela abriu)
    const rel = angDiff(this.yaw, this.baseYaw ?? this.yaw);
    const face = Math.abs(rel) < 6 * DEG ? rel : Math.sign(rel) * clamp(Math.abs(rel), 15 * DEG, 35 * DEG);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.set(this.pitch, (this.baseYaw ?? this.yaw) + face, 0);
    const target = RANK[this.rank] || RANK[2];
    this.mat.opacity += (target.opacity - this.mat.opacity) * Math.min(1, dt * 8);
    this.content.update?.(dt, this);
    if (this.dirty) this.draw();
  }

  dispose() {
    const ui = this.wm.app.ui;
    ui.remove(this.panel); this.edges.forEach((e) => ui.remove(e));
    ui.remove(this.btnClose.userData.body); ui.remove(this.btnMin.userData.body);
    this.content.dispose?.(this);
    this.group.removeFromParent();
    this.tex.dispose(); this.mat.dispose();
  }
}

export class WindowManager {
  constructor(app) {
    this.app = app;
    this.root = new THREE.Group();
    app.rig.add(this.root);
    this.wins = [];          // todas
    this.focusStack = [];    // abertas, mais recente primeiro
    this.dock = new THREE.Group(); this.root.add(this.dock);
    this.icons = new Map();
  }

  center() { const c = this.app.camera.position; return new THREE.Vector3(c.x, c.y, c.z); }
  headYaw() { return this.app.headYaw(); }

  get(id) { return this.wins.find((w) => w.id === id); }

  open(spec) {
    let w = this.get(spec.id);
    if (w) { if (w.minimized) this.restore(w); else this.focus(w); return w; }
    const open = this.focusStack.filter((x) => !x.minimized);
    if (open.length >= MAX_OPEN) this.minimize(open[open.length - 1]);
    w = new Win(this, spec);
    // escolhe o encaixe livre mais próximo da direção do olhar
    const hy = this.headYaw();
    const used = this.focusStack.filter((x) => !x.minimized).map((x) => x.yaw);
    const slot = SLOTS.map((s) => hy + s).find((a) => used.every((u) => Math.abs(angDiff(u, a)) > 20 * DEG)) ?? hy;
    w.yaw = slot; w.baseYaw = hy; w.pitch = -4 * DEG;
    this.wins.push(w);
    this.focus(w);
    this.app.audio.tone({ freq: 330, to: 440, dur: 0.18, vol: 0.08 });
    return w;
  }

  focus(w) {
    this.focusStack = [w, ...this.focusStack.filter((x) => x !== w)];
    this._rerank();
  }

  _rerank() {
    let r = 0;
    for (const w of this.focusStack) {
      if (w.minimized) continue;
      const nr = Math.min(2, r++);
      if (w.rank !== nr) { w.rank = nr; w.dirty = true; }
      w.content.setVolume?.(RANK[nr].vol);
      w.group.renderOrder = 10 - nr;
    }
  }

  minimize(w) {
    if (w.minimized) return;
    w.minimized = true; w.group.visible = false;
    w.content.setVolume?.(0.3);
    const icon = makeButton(this.app, { w: 0.22, h: 0.07, label: w.content.icon || w.title, icon: w.content.glyph || 'grid', variant: 'glass', fontSize: 0.32, onClick: () => this.restore(w) });
    this.icons.set(w, icon);
    this.dock.add(icon);
    this._layoutDock();
    this._rerank();
  }

  restore(w) {
    const icon = this.icons.get(w);
    if (icon) { this.app.ui.remove(icon.userData.body); icon.removeFromParent(); this.icons.delete(w); }
    const open = this.focusStack.filter((x) => !x.minimized && x !== w);
    if (open.length >= MAX_OPEN) this.minimize(open[open.length - 1]);
    w.minimized = false; w.group.visible = true;
    w.yaw = this.headYaw(); w.baseYaw = w.yaw; w.vYaw = 0; w.vPitch = 0;
    this.focus(w);
    this._layoutDock();
  }

  close(w) {
    const icon = this.icons.get(w);
    if (icon) { this.app.ui.remove(icon.userData.body); icon.removeFromParent(); this.icons.delete(w); }
    w.dispose();
    this.wins = this.wins.filter((x) => x !== w);
    this.focusStack = this.focusStack.filter((x) => x !== w);
    this._rerank(); this._layoutDock();
  }

  _layoutDock() {
    // ícones suspensos no canto esquerdo
    let i = 0;
    for (const icon of this.icons.values()) { icon.position.set(0, 0.12 - i * 0.1, 0); i++; }
  }

  update(dt) {
    for (const w of this.wins) if (!w.minimized) w.update(dt);
    // o dock acompanha a cabeça devagar, à esquerda
    const c = this.center(), hy = this.headYaw() + 48 * DEG;
    if (this._dockYaw === undefined) this._dockYaw = hy;
    this._dockYaw += angDiff(hy, this._dockYaw) * Math.min(1, dt * 1.5);
    this.dock.position.set(c.x - Math.sin(this._dockYaw) * 1.1, c.y - 0.05, c.z - Math.cos(this._dockYaw) * 1.1);
    this.dock.rotation.set(0, this._dockYaw + 0.0, 0);
    this.dock.visible = this.icons.size > 0;
  }
}

export function angDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
