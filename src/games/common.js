// Ferramentas compartilhadas pelos jogos
import * as THREE from 'three';
import { detectDevice } from '../core/perf.js';

const glowCache = new Map();
// Textura redonda e suave (partículas, brilhos, chamas)
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const k = inner + outer + size;
  if (glowCache.has(k)) return glowCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.shared = true;
  glowCache.set(k, t);
  return t;
}

// Sistema de partículas simples (poeira, faíscas, bolhas, fumaça)
export class Particles {
  constructor(parent, { max = 300, size = 0.05, texture = glowTexture(), blending = THREE.NormalBlending, sizeAttenuation = true } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max * 4); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({ size, map: texture, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.i = 0;
  }

  spawn(p, v, { life = 1, color = [1, 1, 1, 1], drag = 0, gravity = 0 } = {}) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = life; this.maxLife[i] = life; this.base.set(color, i * 4); this.drag[i] = drag; this.grav[i] = gravity;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, t * 2.5);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// Locomoção por agarrar com uma ou duas mãos (escalar galhos, rochas, nadar):
// cada mão que está segurando puxa o corpo; com as duas, vale a média.
export class GrabMover {
  constructor(ctx) { this.ctx = ctx; this.grips = new Map(); this.vel = new THREE.Vector3(); }
  get active() { return this.grips.size > 0; }
  _local(p) { return this.ctx.rig.worldToLocal(p.handPos.clone()).applyQuaternion(this.ctx.rig.quaternion); }
  start(p) { if (p) this.grips.set(p.id, { p, last: this._local(p) }); }
  stop(p) { if (p) this.grips.delete(p.id); else this.grips.clear(); }
  holding(p) { return this.grips.has(p.id); }
  // devolve o deslocamento aplicado ao corpo
  update(_unused, dt, scale = 1) {
    const d = new THREE.Vector3();
    if (!this.grips.size) return d;
    for (const g of this.grips.values()) {
      const now = this._local(g.p);
      d.add(g.last.clone().sub(now));
      g.last.copy(now);
    }
    d.multiplyScalar(scale / this.grips.size);
    if (d.length() > 0.4) d.setLength(0.4);
    this.ctx.rig.position.add(d);
    this.vel.copy(d).divideScalar(Math.max(dt, 1e-3));
    return d;
  }
}

// Ponteiros (mãos) disponíveis; com uma mão só, devolve só ela
export function pointers(ctx) { return (ctx.input.pointers || []).filter((p) => !p.system); }
// mão dominante (direita) e a outra; com uma mão só, a dominante é ela e a outra é null
export function hands2(ctx) {
  const ps = pointers(ctx);
  if (ps.length < 2) return { main: ps[0] || null, off: null };
  const right = ps.find((p) => p.side === 'right') || ps[0];
  return { main: right, off: ps.find((p) => p !== right) };
}

export function raycast(ctx, objects, recursive = true) {
  const rc = new THREE.Raycaster(); rc.ray.copy(ctx.input.ray); rc.far = 40;
  return rc.intersectObjects(objects, recursive)[0] || null;
}

// Nível de detalhe: perto = malha detalhada, longe = simples
export function lod(near, far, dist = 18) {
  const l = new THREE.LOD(); l.addLevel(near, 0); l.addLevel(far, dist); l.autoUpdate = true; return l;
}

// Material padrão dos jogos. No celular vira Lambert: bem mais barato por pixel
// (a tela inteira é desenhada duas vezes no VR Box), com a mesma cor e textura.
const MOBILE = detectDevice().mobile;
const PBR_ONLY = ['roughness', 'metalness', 'roughnessMap', 'metalnessMap', 'clearcoat', 'clearcoatRoughness', 'envMapIntensity', 'transmission', 'ior', 'thickness'];
export function std(opts = {}) {
  if (!MOBILE) return new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...opts });
  const o = { ...opts };
  // metal sem reflexo de ambiente fica escuro no Lambert: clareia um pouco
  if (o.metalness > 0.5 && !o.map) o.color = new THREE.Color(o.color ?? '#ffffff').multiplyScalar(1.15);
  for (const k of PBR_ONLY) delete o[k];
  return new THREE.MeshLambertMaterial(o);
}
export const IS_MOBILE = MOBILE;
// Vidro/verniz no computador; no celular, o mesmo material leve do std()
export function phys(opts = {}) { return MOBILE ? std(opts) : new THREE.MeshPhysicalMaterial(opts); }

export function shake(obj, amount, t) {
  obj.position.x += (Math.sin(t * 91) * 0.5 + Math.sin(t * 57) * 0.5) * amount;
  obj.position.y += (Math.cos(t * 83) * 0.5 + Math.sin(t * 37) * 0.5) * amount;
}
