// Mãos no estilo Meta Quest: silhueta clara e translúcida (ossos contínuos),
// ponta do polegar e do indicador acendem conforme a força da pinça, e um ícone
// de menu aparece perto da palma quando ela está virada para você.
import * as THREE from 'three';
import { BONES } from './handCorrector.js';
import { drawIcon } from '../ui/theme.js';

const RADIUS = [0.011, 0.009, 0.008, 0.007, 0.0065, 0.009, 0.0075, 0.0068, 0.006, 0.009, 0.0078, 0.007, 0.0062, 0.0088, 0.0074, 0.0066, 0.0058, 0.0085, 0.0068, 0.006, 0.0054];

export class HandView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.visible = true;
    const boneGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0);
    const jointGeo = new THREE.SphereGeometry(1, 12, 8);
    this.views = [0, 1].map(() => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xe9ecf2, transparent: true, opacity: 0.32, depthWrite: false });
      const bones = new THREE.InstancedMesh(boneGeo, mat, BONES.length);
      const joints = new THREE.InstancedMesh(jointGeo, mat, 21);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const tips = [4, 8].map(() => { const m = new THREE.Mesh(jointGeo, tipMat); m.scale.setScalar(0.009); return m; });
      for (const o of [bones, joints, ...tips]) { o.frustumCulled = false; o.renderOrder = 60; }
      const g = new THREE.Group(); g.add(bones, joints, ...tips); g.visible = false;
      this.group.add(g);
      return { g, bones, joints, mat, tipMat, tips };
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
    const up = new THREE.Vector3(0, 1, 0);
    this.views.forEach((v, i) => {
      const h = hands[i];
      v.g.visible = !!h && this.visible;
      if (!h) return;
      const P = h.points;
      BONES.forEach(([a, b], k) => {
        const d = this._v.copy(P[b]).sub(P[a]); const L = d.length();
        this._q.setFromUnitVectors(up, d.normalize());
        const r = (RADIUS[a] + RADIUS[b]) * 0.5 * 0.85;
        v.bones.setMatrixAt(k, this._m.compose(P[a], this._q, this._s.set(r, L, r)));
      });
      for (let j = 0; j < 21; j++) v.joints.setMatrixAt(j, this._m.compose(P[j], this._q.identity(), this._s.setScalar(RADIUS[j])));
      v.bones.instanceMatrix.needsUpdate = true; v.joints.instanceMatrix.needsUpdate = true;
      const st = h.pinchStrength || 0;
      v.tips[0].position.copy(P[4]); v.tips[1].position.copy(P[8]);
      v.tipMat.opacity = st * st * 0.9;
      // sobre o mundo real a mão fica mais discreta (só um contorno claro em cima da mão de verdade)
      const real = input.app.passthrough?.covering;
      v.mat.opacity = (h === input.systemHand ? 0.22 : 0.32) * (real ? 0.7 : 1);
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
