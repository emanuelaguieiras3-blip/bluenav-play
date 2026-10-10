// Teclado virtual estilo Meta Quest: teclas com 0,4s de ativação,
// arrasta segurando nas laterais.
import * as THREE from 'three';
import { CONFIG } from '../../config.js';
import { makeButton, makeLabel } from './widgets.js';
import { clamp } from '../core/util.js';

const ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKLÇ', 'ZXCVBNM,.-'];

export class VirtualKeyboard {
  constructor(app) {
    this.app = app;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.text = '';
    this.onEnter = null;
    this.vel = new THREE.Vector3();
    this.dragging = false;
    app.rig.add(this.group);
    const kw = 0.062, gap = 0.008;
    const width = 10 * (kw + gap);
    // fundo
    const bg = makeLabel('', { w: width + 0.06, h: 0.42, bg: 'rgba(24,25,28,0.94)', radius: 0.12 });
    bg.position.set(0, -0.02, -0.006); this.group.add(bg);
    this.field = makeLabel('', { w: width - 0.02, h: 0.062, bg: '#0f1012', fg: '#f2f3f5', size: 0.46 });
    this.field.position.set(0, 0.16, 0); this.group.add(this.field);
    ROWS.forEach((row, r) => {
      [...row].forEach((ch, i) => {
        const b = this._key(ch, kw, () => this._type(ch === 'Ç' ? 'ç' : ch.toLowerCase()));
        b.position.set(-width / 2 + kw / 2 + i * (kw + gap) + (r === 3 ? (kw + gap) / 2 : 0), 0.08 - r * (kw + gap), 0);
      });
    });
    const y = 0.08 - 4 * (kw + gap);
    this._key('', kw * 1.6, () => this._type('back'), 'default', 'back').position.set(-width / 2 + kw * 0.8, y, 0);
    this._key('espaço', kw * 4.6, () => this._type(' ')).position.set(-0.03, y, 0);
    this._key('', kw * 1.8, () => this._enter(), 'accent', 'enter').position.set(width / 2 - kw * 2.1, y, 0);
    this._key('', kw, () => this.hide(), 'default', 'close').position.set(width / 2 - kw * 0.5, y, 0);

    // alças laterais para arrastar
    for (const s of [-1, 1]) {
      // alças em pílula nas laterais (pinçar e segurar para mover)
      const h = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
      h.position.set(s * (width / 2 + 0.06), -0.02, 0);
      const hit = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(h.position);
      this.group.add(h, hit);
      app.ui.add(hit, { owner: 'ui', sound: false, onHover: (on) => { h.material.opacity = on ? 1 : 0.45; h.scale.x = on ? 1.4 : 1; }, drag: this._drag() });
    }
  }

  _key(label, w, fn, variant = 'default', icon = null) {
    const b = makeButton(this.app, { w, h: 0.062, label, icon, variant, fontSize: label.length > 2 ? 0.3 : 0.42, onClick: fn, dwell: CONFIG.KEY_DWELL_TIME, keySound: true });
    this.group.add(b);
    return b;
  }

  _type(ch) {
    if (ch === 'back') this.text = this.text.slice(0, -1);
    else if (this.text.length < 60) this.text += ch;
    this.field.userData.set(this.text + '|');
  }

  _enter() { const t = this.text.trim(); const cb = this.onEnter; this.hide(); if (cb && t) cb(t); }

  _drag() {
    const plane = new THREE.Plane(), p = new THREE.Vector3(), off = new THREE.Vector3(), last = new THREE.Vector3();
    let lastT = 0;
    return {
      start: (input) => {
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
        plane.setFromNormalAndCoplanarPoint(n, this.group.getWorldPosition(new THREE.Vector3()));
        if (input.ray.intersectPlane(plane, p)) { off.copy(this.group.getWorldPosition(new THREE.Vector3())).sub(p); last.copy(p); }
        this.dragging = true; lastT = performance.now();
      },
      move: (input) => {
        if (!input.ray.intersectPlane(plane, p)) return;
        const now = performance.now(), dt = Math.max(0.001, (now - lastT) / 1000); lastT = now;
        const target = p.clone().add(off);
        this.app.rig.worldToLocal(target);
        const before = this.group.position.clone();
        this.group.position.lerp(target, 0.5);
        this.vel.copy(this.group.position).sub(before).divideScalar(dt);
        this._face();
      },
      end: () => { this.dragging = false; },
    };
  }

  _face() {
    const c = this.app.camera.position;
    const dx = c.x - this.group.position.x, dz = c.z - this.group.position.z;
    this.group.rotation.set(-0.35, Math.atan2(dx, dz), 0, 'YXZ');
  }

  show(initial = '', onEnter = null) {
    this.text = initial; this.onEnter = onEnter;
    this.field.userData.set(this.text + '|');
    const c = this.app.camera.position, yaw = this.app.headYaw();
    this.group.position.set(c.x - Math.sin(yaw) * 0.7, c.y - 0.38, c.z - Math.cos(yaw) * 0.7);
    this.vel.set(0, 0, 0);
    this._face();
    this.group.visible = true;
  }

  hide() { this.group.visible = false; this.onEnter = null; }

  update(dt) {
    if (!this.group.visible || this.dragging) return;
    if (this.vel.lengthSq() > 1e-6) {
      this.group.position.addScaledVector(this.vel, dt);
      this.vel.multiplyScalar(Math.exp(-5 * dt));
      this.group.position.y = clamp(this.group.position.y, 0.4, 2.4);
      this._face();
    }
  }
}
