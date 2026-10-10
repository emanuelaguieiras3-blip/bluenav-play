// Giroscópio do celular -> rotação da câmera (modo papelão / janela mágica)
import * as THREE from 'three';

const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const UP = new THREE.Vector3(0, 1, 0);
const D2R = Math.PI / 180;

export class OrientationControls {
  constructor(object) {
    this.object = object;
    this.data = null;
    this.enabled = false;
    this.yawOffset = 0;
    this.manualYaw = 0;
    this.needsRecenter = true;
    this._qYaw = new THREE.Quaternion();
    this._onDO = (e) => { if (e.alpha != null) this.data = e; };
  }

  async connect() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return false;
      }
    } catch { return false; }
    window.addEventListener('deviceorientation', this._onDO);
    this.enabled = true;
    return true;
  }

  get active() { return this.enabled && !!this.data; }

  update() {
    if (!this.active) return false;
    const d = this.data;
    const orient = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0) * D2R;
    euler.set(d.beta * D2R, d.alpha * D2R, -d.gamma * D2R, 'YXZ');
    const q = this.object.quaternion;
    q.setFromEuler(euler); q.multiply(q1); q.multiply(q0.setFromAxisAngle(zee, -orient));
    if (this.needsRecenter) { this.yawOffset = -yawOf(q); this.needsRecenter = false; }
    q.premultiply(this._qYaw.setFromAxisAngle(UP, this.yawOffset + this.manualYaw));
    return true;
  }

  recenter() { this.needsRecenter = true; this.manualYaw = 0; }
}

export function yawOf(q) {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  return Math.atan2(-f.x, -f.z);
}
