// Teleporte: apontar para o chão -> círculo cresce -> 0,65s -> escurece e troca de lugar.
// Sem movimento de câmera, sem enjoo.
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

export class Teleport {
  constructor(app) {
    this.app = app;
    this.enabled = false;
    this.floorY = 0;
    this.check = null; // (ponto) => bool
    this.t = 0;
    this.spot = new THREE.Vector3();
    this.fade = 0; this.fadeDir = 0; this.pending = null;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.3, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(0.26, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
    this.marker = new THREE.Group(); this.marker.add(ring, fill); this.fill = fill;
    this.marker.visible = false;
    app.scene.add(this.marker);
    // esfera preta em volta da câmera para a transição escurecida (funciona em VR também)
    this.shade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
    this.shade.renderOrder = 1000;
    app.camera.add(this.shade);
    // arco do teleporte (como no Quest): parábola da mão até o ponto no chão
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(25 * 3), 3));
    const ac = []; for (let i = 0; i < 25; i++) ac.push(1, 1, 1, 0.15 + 0.6 * (i / 24));
    ag.setAttribute('color', new THREE.Float32BufferAttribute(ac, 4));
    this.arc = new THREE.Line(ag, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.arc.frustumCulled = false; this.arc.visible = false;
    app.scene.add(this.arc);
    this.aimT = -1;
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._p = new THREE.Vector3();
  }

  configure({ enabled = false, floorY = 0, check = null } = {}) { this.enabled = enabled; this.floorY = floorY; this.check = check; this.t = 0; this.marker.visible = false; }

  floorHit(ray) {
    this._plane.constant = -this.floorY;
    if (ray.direction.y > -0.05) return null;
    if (!ray.intersectPlane(this._plane, this._p)) return null;
    if (this._p.distanceTo(ray.origin) > 12) return null;
    if (this.check && !this.check(this._p)) return null;
    return this._p;
  }

  go(point) {
    if (this.pending) return;
    this.pending = point.clone(); this.fadeDir = 1;
    this.app.audio.tone({ freq: 200, to: 120, dur: 0.2, vol: 0.08 });
  }

  _drawArc(a, b) {
    const pos = this.arc.geometry.attributes.position;
    const h = Math.max(0.25, a.distanceTo(b) * 0.25);
    for (let i = 0; i < 25; i++) {
      const t = i / 24;
      pos.setXYZ(i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * h * (1 - t * 0.6), a.z + (b.z - a.z) * t);
    }
    pos.needsUpdate = true;
    this.arc.visible = true;
  }

  update(dt, input, uiBusy) {
    // transição escurecida
    if (this.fadeDir) {
      this.fade += this.fadeDir * dt / 0.09;
      if (this.fade >= 1 && this.pending) {
        this.fade = 1;
        const cam = new THREE.Vector3(); this.app.camera.getWorldPosition(cam);
        const rig = this.app.rig;
        rig.position.x += this.pending.x - cam.x;
        rig.position.z += this.pending.z - cam.z;
        rig.position.y = this.pending.y - this.floorY + this.floorY;
        this.pending = null; this.fadeDir = -1;
        this.app.onTeleport?.();
      }
      if (this.fade <= 0) { this.fade = 0; this.fadeDir = 0; }
    }
    this.shade.material.opacity = this.fade;
    this.shade.visible = this.fade > 0.001;

    this.arc.visible = false;
    if (!this.enabled || uiBusy) { this.marker.visible = false; this.t = 0; this.aimT = -1; return; }
    // qualquer mão pode apontar para teleportar (a outra fica livre)
    const ptrs = input.pointers || [];
    const keys = input.keys;
    const aimP = this.app.usePointTeleport ? ptrs.find((q) => q.source === 'hand' && q.gesture === 'apontando' && !q.uiBusy && !q.system) : null;
    if (aimP) input = aimP;
    const pointing = !!aimP;
    // Quest: aponte para mirar e "estale" polegar no indicador (pinça) para ir
    const snap = ptrs.find((q) => q.source === 'hand' && q.pinchDown && (!this.aimId || q.id === this.aimId));
    if (snap && performance.now() - this.aimT < 350) { this.go(this.spot); this.aimT = -1; this.marker.visible = false; return; }
    const keyPoint = keys?.has('ShiftLeft') || keys?.has('ShiftRight');
    const hit = (pointing || keyPoint || input.source === 'gaze' || input.source === 'mouse' || input.source === 'xr') ? this.floorHit(input.ray) : null;
    if (!hit) { this.marker.visible = false; this.t = 0; return; }
    if (pointing || keyPoint) {
      if (this.spot.distanceTo(hit) > 0.35) { this.spot.copy(hit); this.t = 0; }
      this.aimT = performance.now(); this.aimId = input.id;
      this._drawArc(input.origin, this.spot);
      this.t += dt;
      const k = Math.min(1, this.t / CONFIG.DWELL_TIME);
      this.marker.visible = true;
      this.marker.position.copy(this.spot).y += 0.01;
      this.marker.scale.setScalar(0.3 + 0.7 * k);
      this.fill.material.opacity = 0.15 + 0.5 * k;
      if (k >= 1) { this.go(this.spot); this.t = -0.6; }
    } else {
      // toque/clique no chão também teleporta
      this.marker.visible = true;
      this.marker.position.copy(hit).y += 0.01;
      this.marker.scale.setScalar(0.6);
      this.fill.material.opacity = 0.12;
      if (input.pinchDown) this.go(hit);
    }
  }
}
