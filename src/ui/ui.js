// Interação no estilo Meta Quest, com as DUAS mãos (cada uma com raio, cursor e clique próprios):
// - mãos/controles/mouse: pinçar = pressiona, soltar em cima = clica; pinçar e arrastar = rolar/mover
// - toque direto (poke): a ponta do indicador encosta no botão
// - olhar (papelão sem mãos): parar o olhar 0,65s ou tocar na tela
// Cursor em anel que se fecha conforme a força da pinça; raio claro que some em direção ao alvo.
import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const SWIPE_ANGLE = 0.11; // ~6° de movimento antes de virar arrasto

export class UI {
  constructor(app) {
    this.app = app;
    this.targets = [];
    this.raycaster = new THREE.Raycaster();
    this.states = new Map();     // um estado por ponteiro (mão)
    this.hoverCount = new Map(); // dois ponteiros sobre o mesmo alvo
    this.presses = [];
    this.hovering = false;
    this.drag = null;            // algum arrasto em andamento (compatibilidade)
    this.hitPoint = new THREE.Vector3();
  }

  // opts: { onClick, dwell, resolve(hit)->sub, onHover(on, sub), drag:{start,move,end}, onSwipe, press:obj, sound, owner }
  add(mesh, opts = {}) {
    mesh.userData.ui = { dwell: CONFIG.DWELL_TIME, sound: true, ...opts };
    this.targets.push(mesh);
    return mesh;
  }

  remove(mesh) { this.removeWhere((m) => m === mesh); }
  removeWhere(fn) {
    this.targets = this.targets.filter((m) => !fn(m));
    for (const s of this.states.values()) {
      if (s.hoverMesh && fn(s.hoverMesh)) this._clearHover(s);
      if (s.press && fn(s.press.mesh)) s.press = null;
      if (s.dragMesh && fn(s.dragMesh)) { s.drag = null; s.dragMesh = null; }
    }
  }

  _visible(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

  _state(p) {
    let s = this.states.get(p.id);
    if (s) return s;
    const app = this.app;
    const g = new THREE.Group();
    const mk = (geo, color, opacity) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = 999; g.add(m); return m; };
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0.6, 1, 1, 1, 0.05], 4));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthTest: false }));
    line.renderOrder = 998; line.frustumCulled = false;
    s = {
      id: p.id, cursor: g, line,
      ringC: mk(new THREE.RingGeometry(0.0115, 0.0145, 40), 0xffffff, 0.9),
      fill: mk(new THREE.CircleGeometry(0.0115, 32), 0xffffff, 0.85),
      prog: mk(new THREE.RingGeometry(0.016, 0.0185, 40, 1, Math.PI / 2, 0.0001), 0x2d88ff, 1),
      hoverKey: null, hoverSub: null, hoverMesh: null, dwellT: 0, fired: false,
      press: null, drag: null, dragMesh: null, pokeArmed: true, hitPoint: new THREE.Vector3(), pq: -1, seen: true,
    };
    app.scene.add(g, line);
    this.states.set(p.id, s);
    return s;
  }

  _hoverOn(sub, mesh) {
    const k = mesh.uuid + '|' + sub.key, n = this.hoverCount.get(k) || 0;
    this.hoverCount.set(k, n + 1);
    if (n === 0) mesh.userData.ui.onHover?.(true, sub);
  }
  _hoverOff(sub, mesh) {
    const k = mesh.uuid + '|' + sub.key, n = this.hoverCount.get(k) || 0;
    if (n <= 1) { this.hoverCount.delete(k); mesh.userData.ui.onHover?.(false, sub); } else this.hoverCount.set(k, n - 1);
  }

  _clearHover(s) {
    if (s.hoverMesh) this._hoverOff(s.hoverSub, s.hoverMesh);
    s.hoverKey = null; s.hoverSub = null; s.hoverMesh = null; s.dwellT = 0; s.fired = false;
  }

  _subFor(hit) {
    const u = hit.object.userData.ui;
    const sub = u.resolve ? u.resolve(hit) : { key: hit.object.uuid, onClick: u.onClick, dwell: u.dwell };
    if (!sub) return null;
    sub.drag = sub.drag || u.drag; sub.onSwipe = sub.onSwipe || u.onSwipe;
    return sub;
  }

  update(dt, input) {
    const vis = this.targets.filter((m) => this._visible(m));
    for (const s of this.states.values()) s.seen = false;
    let anyHover = false, anyDrag = null;
    for (const p of input.pointers || []) {
      const s = this._state(p);
      s.seen = true;
      this._updatePointer(s, p, dt, vis);
      p.uiBusy = !!(s.hoverSub || s.drag || s.press);
      anyHover = anyHover || p.uiBusy;
      anyDrag = anyDrag || s.drag;
      if (p.main) this.hitPoint.copy(s.hitPoint);
    }
    // ponteiros que sumiram (mão saiu da câmera): soltam arrasto e escondem cursor
    for (const [id, s] of this.states) {
      if (s.seen) continue;
      if (s.drag) { s.drag.end?.(s.lastP); s.drag = null; s.dragMesh = null; }
      this._clearHover(s); s.press = null;
      s.cursor.visible = false; s.line.visible = false;
      if (!input._ptrs?.has(id)) { s.cursor.removeFromParent(); s.line.removeFromParent(); this.states.delete(id); }
    }
    this.hovering = anyHover;
    this.drag = anyDrag;

    // animação "afundar" dos botões
    for (let i = this.presses.length - 1; i >= 0; i--) {
      const q = this.presses[i]; q.t += dt;
      const k = q.t < 0.07 ? q.t / 0.07 : Math.max(0, 1 - (q.t - 0.07) / 0.15);
      q.obj.position.z = q.z0 - 0.01 * k;
      if (q.t > 0.22) { q.obj.position.z = q.z0; this.presses.splice(i, 1); }
    }
  }

  _updatePointer(s, p, dt, vis) {
    const app = this.app;
    s.lastP = p;
    // arrasto em andamento (mover janela, pegar objeto) — cada mão o seu
    if (s.drag) {
      if (p.pinch) s.drag.move?.(p, dt);
      else { s.drag.end?.(p); s.drag = null; s.dragMesh = null; }
    }

    // toque direto com o dedo (perto do painel o Quest troca o raio pelo dedo)
    let hit = null, poking = false;
    if (p.pokeTip && vis.length) {
      const eye = app.camera.getWorldPosition(new THREE.Vector3());
      const dir = p.pokeTip.clone().sub(eye).normalize();
      this.raycaster.set(p.pokeTip.clone().addScaledVector(dir, -0.06), dir);
      this.raycaster.far = 0.16;
      const ph = this.raycaster.intersectObjects(vis, false)[0];
      if (ph) {
        hit = ph; poking = true;
        const depth = 0.06 - ph.distance; // >0: a ponta passou da superfície
        if (depth > -0.004 && s.pokeArmed) {
          s.pokeArmed = false;
          const sub = this._subFor(ph);
          if (sub?.onClick) this._fire(s, sub, ph.object);
        } else if (depth < -0.03) s.pokeArmed = true;
      } else s.pokeArmed = true;
    }

    if (!hit && !p.system) {
      this.raycaster.ray.copy(p.ray);
      this.raycaster.far = 30;
      hit = vis.length ? this.raycaster.intersectObjects(vis, false)[0] : null;
    }
    const sub = hit ? this._subFor(hit) : null;
    const key = sub ? sub.key : null;
    if (key !== s.hoverKey || (sub && hit.object !== s.hoverMesh)) {
      this._clearHover(s);
      if (sub) {
        s.hoverKey = key; s.hoverSub = sub; s.hoverMesh = hit.object;
        this._hoverOn(sub, hit.object);
        if (sub.onClick) app.audio.hover();
      }
    } else if (sub) s.hoverSub = sub;

    const gaze = p.source === 'gaze';
    if (!poking && !s.drag) {
      // pinça pressiona; soltar em cima clica; mover a pinça vira arrasto/rolagem
      if (p.pinchDown && sub) {
        if (sub.drag) { s.drag = sub.drag; s.dragMesh = hit.object; sub.drag.start?.(p, hit); }
        else s.press = { key, sub, mesh: hit.object, dir: p.ray.direction.clone(), swiped: false };
      }
      if (s.press) {
        const ang = s.press.dir.angleTo(p.ray.direction);
        if (!s.press.swiped && ang > SWIPE_ANGLE && s.press.sub.onSwipe) {
          const d = p.ray.direction.clone().sub(s.press.dir);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(app.camera.getWorldQuaternion(new THREE.Quaternion()));
          s.press.sub.onSwipe(d.dot(right), d.y);
          s.press.swiped = true;
        }
        if (p.pinchUp) {
          if (!s.press.swiped && s.press.key === key && sub && sub.onClick && ang < SWIPE_ANGLE * 1.5) this._fire(s, sub, hit.object);
          s.press = null;
        } else if (!p.pinch) s.press = null;
      }
      // dedo apontando para o botão: "empurrar" o dedo para frente clica na hora
      if (p.fingerAim && sub && sub.onClick) {
        const now = performance.now();
        s.tap = (s.tap || []).filter((q) => now - q[0] < 180);
        s.tap.push([now, p.tipDepth]);
        const minD = Math.min(...s.tap.map((q) => q[1]));
        if (s.tapArmed !== false && p.tipDepth - minD > 0.025) { s.tapArmed = false; this._fire(s, sub, hit.object); }
        if (p.tipDepth < (s.tapRest ?? p.tipDepth) - 0.015 || s.tapArmed === undefined) s.tapArmed = true;
        s.tapRest = s.tapArmed ? p.tipDepth : Math.max(s.tapRest ?? 0, p.tipDepth);
      } else { s.tap = null; s.tapArmed = undefined; s.tapRest = undefined; }
      // parar o olhar (papelão sem mãos) ou o dedo em cima do botão por 0,65s
      if ((gaze || p.fingerAim) && sub && sub.onClick && !s.fired && !s.press) {
        s.dwellT += dt;
        if (s.dwellT >= (sub.dwell ?? CONFIG.DWELL_TIME)) this._fire(s, sub, hit.object);
      }
    }

    // ---- cursor ----
    const strength = p.pinchStrength || 0;
    const progress = (gaze || p.fingerAim) && sub && sub.onClick && !s.fired ? Math.min(1, s.dwellT / (sub.dwell ?? CONFIG.DWELL_TIME)) : 0;
    let n = null;
    const gameHit = p.main ? app.pointerHit : null;
    if (hit) {
      s.hitPoint.copy(hit.point);
      n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : p.ray.direction.clone().negate();
      if (n.dot(p.ray.direction) > 0) n.negate();
    } else if (gameHit) s.hitPoint.copy(gameHit);
    else s.hitPoint.copy(p.ray.origin).addScaledVector(p.ray.direction, 2.2);
    const dist = p.ray.origin.distanceTo(s.hitPoint);
    s.cursor.visible = !p.system && (!!hit || !!gameHit || gaze);
    s.cursor.position.copy(s.hitPoint);
    if (n) { s.cursor.position.addScaledVector(n, 0.003); s.cursor.lookAt(s.cursor.position.clone().add(n)); }
    else s.cursor.lookAt(p.ray.origin);
    const base = Math.max(0.5, Math.min(2.2, dist * 0.85)) * (poking ? 0.6 : 1);
    s.cursor.scale.setScalar(base * (1 - strength * 0.25));
    s.fill.scale.setScalar(Math.max(0.001, strength));
    s.ringC.material.opacity = sub ? 1 : 0.55;
    const pq = Math.round(progress * 40);
    if (pq !== s.pq) {
      s.pq = pq;
      s.prog.geometry.dispose();
      s.prog.geometry = new THREE.RingGeometry(0.016, 0.0185, 40, 1, Math.PI / 2, -Math.max(0.0001, (pq / 40) * Math.PI * 2));
    }
    s.prog.visible = progress > 0;

    // ---- raio ----
    const pos = s.line.geometry.attributes.position;
    pos.setXYZ(0, p.origin.x, p.origin.y, p.origin.z);
    pos.setXYZ(1, s.hitPoint.x, s.hitPoint.y, s.hitPoint.z);
    pos.needsUpdate = true;
    const col = s.line.geometry.attributes.color;
    const near = Math.max(0, 1 - p.origin.distanceTo(s.hitPoint) / 2.5); // brilha ao aproximar
    col.setW(0, 0.45 + 0.3 * strength + 0.2 * near);
    col.setW(1, sub ? 0.25 + 0.4 * near : 0.02);
    col.needsUpdate = true;
    s.line.visible = !gaze && !poking && !p.system && !p.hideRay;
  }

  // encerra um arrasto pelo lado do jogo (ex.: peça que encaixou sozinha)
  cancelDrag(drag) {
    for (const s of this.states.values()) if (s.drag === drag) { s.drag = null; s.dragMesh = null; }
  }

  _fire(s, sub, mesh) {
    s.fired = true;
    const u = mesh.userData.ui;
    const obj = sub.press || u.press;
    if (obj && !this.presses.some((q) => q.obj === obj)) this.presses.push({ obj, t: 0, z0: obj.position.z });
    if (u.sound !== false && sub.sound !== false) (sub.keySound || u.keySound ? this.app.audio.keyTap() : this.app.audio.click());
    try { sub.onClick(sub, mesh); } catch (e) { console.error(e); }
  }
}
