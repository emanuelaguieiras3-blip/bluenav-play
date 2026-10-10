// Contorno fosco da mão: palma e dedos seguem o exoesqueleto rastreado.
// Transparência fixa de 87%, sem brilho de pinça. O ícone do menu é separado.
import * as THREE from 'three';
import { BONES } from './handCorrector.js';
import { drawIcon } from '../ui/theme.js';

const PALM_LOOP = [0, 1, 5, 9, 13, 17];
const PALM_JOINTS = new Set(PALM_LOOP);
const SKIN_BONES = BONES.filter(([a, b]) => !(PALM_JOINTS.has(a) && PALM_JOINTS.has(b)));
const HAND_OPACITY = 0.13; // 87% transparency, fixed in every gesture/mode.

function palmGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36), 3));
  const indices = [];
  for (let j = 1; j < 5; j++) indices.push(0, j, j + 1, 6, j + 7, j + 6);
  for (let j = 0; j < 6; j++) {
    const next = (j + 1) % 6;
    indices.push(j, j + 6, next, next, j + 6, next + 6);
  }
  geometry.setIndex(indices);
  return geometry;
}

const RADIUS = [0.011, 0.009, 0.008, 0.007, 0.0065, 0.009, 0.0075, 0.0068, 0.006, 0.009, 0.0078, 0.007, 0.0062, 0.0088, 0.0074, 0.0066, 0.0058, 0.0085, 0.0068, 0.006, 0.0054];

export class HandView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.visible = true;
    const boneGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
    const jointGeo = new THREE.SphereGeometry(1, 12, 8);
    this.views = [0, 1].map(() => {
      // Diffuse-looking, unlit envelope: no specular reflection or pinch glow.
      const mat = new THREE.MeshBasicMaterial({ color: 0xb8bec7, transparent: true, opacity: HAND_OPACITY, depthWrite: false, toneMapped: false });
      const bones = new THREE.InstancedMesh(boneGeo, mat, SKIN_BONES.length);
      const joints = new THREE.InstancedMesh(jointGeo, mat, 21);
      const palm = new THREE.Mesh(palmGeometry(), mat);
      for (const o of [bones, joints, palm]) { o.frustumCulled = false; o.renderOrder = 60; }
      const g = new THREE.Group(); g.add(palm, bones, joints); g.visible = false;
      this.group.add(g);
      return { g, bones, joints, palm, mat };
    });
    // ícone do sistema na palma (pinçar = menu, segurar = recentralizar)
    const c = document.createElement('canvas'); c.width = c.height = 128;
    this.sysCanvas = c;
    this.sysTex = new THREE.CanvasTexture(c); this.sysTex.colorSpace = THREE.SRGBColorSpace;
    this.sys = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: this.sysTex, transparent: true, depthTest: false }));
    this.sys.renderOrder = 1001; this.sys.visible = false;
    scene.add(this.sys);
    this._lastProg = -1;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._palmNormal = new THREE.Vector3(); this._palmEdge = new THREE.Vector3();
  }

  _drawSys(prog) {
    const x = this.sysCanvas.getContext('2d');
    x.clearRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(242,243,245,0.95)'; x.beginPath(); x.arc(64, 64, 46, 0, 6.29); x.fill();
    drawIcon(x, prog > 0 ? 'recenter' : 'grid', 64, 64, 44, '#111214');
    if (prog > 0) { x.strokeStyle = '#2d88ff'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.arc(64, 64, 56, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); x.stroke(); }
    this.sysTex.needsUpdate = true;
  }

  update(input) {
    const hands = input.hands;
    const up = this._up;
    this.views.forEach((v, i) => {
      const h = hands[i];
      v.g.visible = !!h && !h.stale && this.visible;
      if (!h || h.stale) return;
      const P = h.points;
      // Envelope follows the tracked palm and finger joints, not a fixed pose.
      this._palmNormal.copy(P[5]).sub(P[0]).cross(this._palmEdge.copy(P[17]).sub(P[0])).normalize();
      const thickness = Math.min(0.006, P[5].distanceTo(P[17]) * 0.08);
      const positions = v.palm.geometry.attributes.position;
      PALM_LOOP.forEach((j, k) => {
        this._v.copy(P[j]).addScaledVector(this._palmNormal, thickness);
        positions.setXYZ(k, this._v.x, this._v.y, this._v.z);
        this._v.copy(P[j]).addScaledVector(this._palmNormal, -thickness);
        positions.setXYZ(k + 6, this._v.x, this._v.y, this._v.z);
      });
      positions.needsUpdate = true;
      SKIN_BONES.forEach(([a, b], k) => {
        const d = this._v.copy(P[b]).sub(P[a]); const L = d.length();
        this._q.setFromUnitVectors(up, d.normalize());
        // Espessura proporcional ao osso: juntas pequenas continuam distintas.
        const r = Math.min((RADIUS[a] + RADIUS[b]) * 0.5 * 0.9, L * 0.4);
        v.bones.setMatrixAt(k, this._m.compose(P[a], this._q, this._s.set(r, L, r)));
      });
      for (let j = 0; j < 21; j++) {
        let shortest = Infinity;
        for (const [a, b] of BONES) if (a === j || b === j) shortest = Math.min(shortest, P[a].distanceTo(P[b]));
        const size = Math.min(RADIUS[j] * 0.9, shortest * 0.4);
        v.joints.setMatrixAt(j, this._m.compose(P[j], this._q.identity(), this._s.setScalar(size)));
      }
      v.bones.instanceMatrix.needsUpdate = true; v.joints.instanceMatrix.needsUpdate = true;
    });
    const sh = input.systemHand;
    this.sys.visible = !!sh && this.visible;
    if (sh) {
      const cam = input.app.camera.getWorldPosition(new THREE.Vector3());
      const p = sh.palm.clone().add(sh.points[9]).multiplyScalar(0.5);
      p.add(cam.clone().sub(p).normalize().multiplyScalar(0.03));
      this.sys.position.copy(p); this.sys.lookAt(cam);
      const prog = Math.round((input.systemProgress || 0) * 30) / 30;
      if (prog !== this._lastProg) { this._lastProg = prog; this._drawSys(prog); }
      this.sys.scale.setScalar(1 + (sh.pinchStrength || 0) * 0.15);
    }
  }
}
