// Junta todas as formas de entrada num só "ponteiro":
// mãos (MediaPipe), controles WebXR, mouse/toque e olhar (centro da tela).
import * as THREE from 'three';
import { gamepadIntent } from './gamepad.js';
import { readXRHand } from './xrHands.js';

const tmp = new THREE.Vector3();

export class Input {
  constructor(app) {
    this.app = app;
    this.ray = new THREE.Ray();
    this.origin = new THREE.Vector3();     // início da linha indicativa
    this.handPos = new THREE.Vector3();    // posição da "mão" no mundo
    this.prevHandPos = new THREE.Vector3();
    this.handVel = new THREE.Vector3();
    this.pinch = false; this.pinchDown = false; this.pinchUp = false;
    this.gesture = 'indefinida';
    this.source = 'gaze';
    this.hands = [];                       // mãos no mundo
    this.keys = new Set();
    this.ndc = new THREE.Vector2();
    this.mouseActive = false;
    this.mouseDown = false;
    this.touchDown = false;
    this.xrSelect = false;
    this.menuRequest = false;
    this.lookDelta = new THREE.Vector2();
    this._ptrs = new Map();
    this.pointers = [];
    this._prevPinch = false;
    this._bind();
  }

  _bind() {
    const el = this.app.renderer.domElement;
    let dragLook = false, last = null, moved = 0, touchStart = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      this.app.audio.unlock();
      last = [e.clientX, e.clientY]; moved = 0;
      if (e.pointerType === 'mouse') {
        this.mouseActive = true; this._setNdc(e);
        if (e.button === 2) dragLook = true; else if (e.button === 0) this.mouseDown = true;
      } else {
        touchStart = performance.now();
        if (this.app.mode === 'flat') { this.mouseActive = true; this._setNdc(e); }
        this.touchDown = true;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') { this.mouseActive = true; this._setNdc(e); }
      if (last) {
        const dx = e.clientX - last[0], dy = e.clientY - last[1];
        moved += Math.abs(dx) + Math.abs(dy);
        if (dragLook || (e.pointerType !== 'mouse' && this.app.mode === 'flat' && moved > 14)) {
          this.lookDelta.x += dx; this.lookDelta.y += dy;
          if (e.pointerType !== 'mouse') { this.touchDown = false; this._setNdc(e); }
        }
        last = [e.clientX, e.clientY];
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') { if (e.button === 2) dragLook = false; else this.mouseDown = false; }
      else this.touchDown = false;
      last = null;
      void touchStart;
    });
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') this.mouseDown = true;
      if (e.code === 'KeyM' || e.code === 'Escape') this.menuRequest = true;
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Space') this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.touchDown = false; });
  }

  _setNdc(e) {
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }

  bindXR(renderer) {
    this.controllers = [0, 1].map((i) => {
      const c = renderer.xr.getController(i);
      c.userData.select = false;
      c.addEventListener('selectstart', () => { c.userData.select = true; });
      c.addEventListener('selectend', () => { c.userData.select = false; });
      c.addEventListener('connected', (e) => { c.userData.connected = true; c.userData.inputSource = e.data; c.userData.hand = !!e.data.hand; c.userData.handedness = e.data.handedness; });
      c.addEventListener('disconnected', () => { c.userData.connected = false; });
      this.app.rig.add(c);
      return c;
    });
  }

  update(dt, frame) {
    const app = this.app, cam = app.camera;
    cam.getWorldPosition(tmp);
    const eye = tmp.clone();
    this.hands = [];
    const session = app.renderer.xr.isPresenting ? app.renderer.xr.getSession?.() : null;
    this.gamepad = gamepadIntent(Array.from(session?.inputSources || []), session ? [] : navigator.getGamepads?.() || []);
    if (this.gamepad.menu && !this._padMenu) this.menuRequest = true;
    this._padMenu = this.gamepad.menu;

    // Mãos da câmera -> mundo
    const tracker = app.hands;
    if (tracker && tracker.running && tracker.hands.length) {
      cam.updateMatrixWorld();
      // suavização de exibição entre detecções (a detecção pode rodar a 20–30 Hz)
      const disp = this._disp || (this._disp = new Map());
      const k = 1 - Math.exp(-dt * 32);
      const seen = new Set();
      for (const h of tracker.hands) {
        const key = h.id ?? h.label; seen.add(key);
        let sm = disp.get(key);
        if (h.imageAligned || !sm || sm.age > 0.2) { sm = { p: (tracker.displayPoints?.(h) || h.pontos).map((q) => q.slice()), age: 0 }; disp.set(key, sm); }
        else for (let i = 0; i < 21; i++) for (let c = 0; c < 3; c++) sm.p[i][c] += (h.pontos[i][c] - sm.p[i][c]) * k;
        // Interpolar juntas independentemente encurta dedos durante uma dobra.
        // Reprojeta cada segmento na medida corrigida, preservando a palma.
        for (const chain of h.imageAligned ? [] : [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]) {
          for (let j = 1; j < chain.length; j++) {
            const a = chain[j - 1], b = chain[j];
            const target = h.pontos[b].map((v, c) => v - h.pontos[a][c]);
            let direction = sm.p[b].map((v, c) => v - sm.p[a][c]);
            const length = Math.max(0.004, Math.hypot(...target));
            if (Math.hypot(...direction) < 0.001) direction = target;
            const scale = length / Math.max(0.001, Math.hypot(...direction));
            for (let c = 0; c < 3; c++) sm.p[b][c] = sm.p[a][c] + direction[c] * scale;
          }
        }
        sm.age = 0;
        const pts = sm.p.map((p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(cam.matrixWorld));
        const palm = pts[0].clone().add(pts[5]).add(pts[17]).multiplyScalar(1 / 3);
        const dir = pts[9].clone().sub(pts[0]).normalize();
        this.hands.push({ id: key, label: h.label, points: pts, gesture: h.gesto, confianca: h.confianca, stale: !!h.stale, palm, dir, tip: pts[8], touchProfile: h.touchProfile, pinchStrength: h.pinchStrength ?? 0, palmFacing: h.palmFacing ?? 0 });
      }
      for (const [key, sm] of disp) if (!seen.has(key)) { sm.age += dt; if (sm.age > 0.5) disp.delete(key); }
    } else this._disp?.clear();

    if (session) {
      this.hands = [];
      app.rig.updateMatrixWorld(true);
      for (const source of session.inputSources) {
        const old = this._ptrs.get('handnative-' + source.handedness);
        const hand = readXRHand(source, frame, app.renderer.xr.getReferenceSpace(), app.rig.matrixWorld, old?.prevPinch);
        if (hand) this.hands.push(hand);
      }
    }

    // ---- ponteiros: um por mão (ou controle). Uma mão sozinha faz tudo. ----
    const active = [];
    const xrcs = app.renderer.xr.isPresenting && this.controllers ? this.controllers.filter((c) => c.userData.connected && !c.userData.hand) : [];
    if (xrcs.length) {
      this.source = 'xr';
      xrcs.forEach((c, i) => {
        const p = this._ptr('xr-' + (c.userData.handedness || i), 'xr');
        c.updateMatrixWorld();
        p.ray.origin.setFromMatrixPosition(c.matrixWorld);
        p.ray.direction.set(0, 0, -1).transformDirection(c.matrixWorld);
        p.origin.copy(p.ray.origin);
        p.handPos.copy(p.ray.origin).addScaledVector(p.ray.direction, 0.05);
        p.quaternion = c.getWorldQuaternion(p.quaternion || new THREE.Quaternion());
        const gripSpace = c.userData.inputSource?.gripSpace;
        const pose = gripSpace && frame?.getPose(gripSpace, app.renderer.xr.getReferenceSpace());
        if (pose) {
          const grip = new THREE.Matrix4().fromArray(pose.transform.matrix).premultiply(app.rig.matrixWorld);
          p.handPos.setFromMatrixPosition(grip); p.quaternion.setFromRotationMatrix(grip);
        }
        p.gamepad = c.userData.inputSource?.gamepad;
        p.rawPinch = !!c.userData.select; p.gesture = p.rawPinch ? 'pinça' : 'indefinida'; p.pinchStrength = p.rawPinch ? 1 : 0;
        p.side = c.userData.handedness === 'left' ? 'left' : c.userData.handedness === 'right' ? 'right' : (i ? 'left' : 'right');
        active.push(p);
      });
    } else if (this.hands.length) {
      this.source = 'hand';
      this._systemGesture(dt);
      const camQ = cam.getWorldQuaternion(new THREE.Quaternion());
      const invQ = camQ.clone().invert();
      for (const h of this.hands) {
        const p = this._ptr('hand' + h.id, 'hand');
        p.hand = h;
        p.stale = h.stale || h.confianca < 0.3;
        // lado: pela posição em relação à cabeça, com folga para não ficar trocando
        const lx = h.palm.clone().sub(eye).applyQuaternion(invQ).x;
        p.side = h.label === 'Right' ? 'right' : h.label === 'Left' ? 'left' : (p.side || (lx >= 0 ? 'right' : 'left'));
        // Indicador esticado: a linha segue a base e a ponta do dedo.
        const P = h.points, W = P[0], dw = (i) => P[i].distanceTo(W);
        const ri = dw(8) / Math.max(0.001, dw(6)), rm = dw(12) / Math.max(0.001, dw(10)), rr = dw(16) / Math.max(0.001, dw(14));
        // Pinçar após apontar mantém o modo de mira; trocar para o ombro no
        // meio do clique fazia o alvo escapar sem o usuário mover a mão.
        p.fingerAim = h.gesture === 'pinça' ? !!p.fingerAim : (h.gesture === 'apontando' || (ri > 1.3 && rm < 1.2 && rr < 1.2 && ri - Math.max(rm, rr) > 0.2));
        // The ray and visible fingertip share exactly the same origin.
        p.ray.origin.copy(P[8]); p.origin.copy(P[8]);
        if (!(h.gesture === 'pinça' && p.fingerAim)) {
          p.ray.direction.copy(P[8]).sub(p.fingerAim ? P[5] : eye).normalize();
        }
        p.rayDir.copy(p.ray.direction);
        p.tipDepth = P[8].distanceTo(eye);
        p.handPos.copy(h.points[4]).lerp(h.points[8], 0.5);
        p.gesture = h.gesture; p.pinchStrength = h.pinchStrength; p.pokeTip = p.stale ? null : h.tip;
        // a mão do gesto de sistema (palma virada) não aponta nem pinça no mundo
        p.system = h === this.systemHand;
        p.rawPinch = h.gesture === 'pinça' && !p.system;
        active.push(p);
      }
    } else if (this.mouseActive && app.mode === 'flat') {
      this.source = 'mouse';
      const p = this._ptr('mouse', 'mouse');
      const rc = new THREE.Raycaster(); rc.setFromCamera(this.ndc, cam);
      p.ray.copy(rc.ray);
      p.origin.copy(eye).add(new THREE.Vector3(0, -0.25, 0)).addScaledVector(p.ray.direction, 0.3);
      p.handPos.copy(p.ray.origin).addScaledVector(p.ray.direction, 0.6);
      p.gesture = 'indefinida'; p.rawPinch = false; p.side = 'right';
      active.push(p);
    } else {
      this.source = 'gaze';
      const p = this._ptr('gaze', 'gaze');
      p.ray.origin.copy(eye);
      p.ray.direction.set(0, 0, -1).transformDirection(cam.matrixWorld);
      p.origin.copy(eye).add(new THREE.Vector3(0, -0.3, 0)).addScaledVector(p.ray.direction, 0.3);
      p.handPos.copy(eye).addScaledVector(p.ray.direction, 0.6);
      p.gesture = 'indefinida'; p.rawPinch = false; p.side = 'right';
      active.push(p);
    }
    if (this.source !== 'hand') this.systemHand = null;

    // principal: continua a mesma até a outra começar a pinçar/apontar (sem ficar pulando)
    const usable = active.filter((p) => !p.system);
    const pool = usable.length ? usable : active;
    const prev = pool.find((p) => p.id === this._mainId);
    const busy = pool.find((p) => p.rawPinch) || pool.find((p) => p.gesture === 'apontando');
    const main = (prev && (prev.rawPinch || !busy)) ? prev : (busy || prev || pool.find((p) => p.side === 'right') || pool[0]);
    this._mainId = main.id;
    // toque na tela / clique / espaço = pinça da principal (VR Box sem mãos, computador)
    const screenPinch = this.mouseDown || this.touchDown || this.gamepad.select || this.keys.has('Enter');
    for (const p of active) {
      p.main = p === main;
      if (p.source !== 'hand') p.stale = p.source === 'gaze' && !!tracker?.running;
      const pinch = p.stale ? p.prevPinch : p.rawPinch || (p.main && screenPinch);
      p.pinchDown = !p.stale && pinch && !p.prevPinch; p.pinchUp = !p.stale && !pinch && p.prevPinch; p.pinch = pinch; p.prevPinch = pinch;
      if (p.source !== 'hand') { p.pokeTip = null; p.pinchStrength = pinch ? 1 : (p.pinchStrength || 0); }
      if (p.fresh || dt <= 0) p.vel.set(0, 0, 0); else p.vel.copy(p.handPos).sub(p.prevHandPos).divideScalar(dt);
      if (p.vel.length() > 30) p.vel.set(0, 0, 0);
      p.prevHandPos.copy(p.handPos);
      p.fresh = false;
    }
    // ponteiros que sumiram neste frame soltam o que estavam fazendo
    for (const [id, p] of this._ptrs) if (!active.includes(p)) { if (p.prevPinch) { p.pinchUp = true; } p.pinch = p.prevPinch = false; p.lost = (p.lost || 0) + 1; if (p.lost > 2) this._ptrs.delete(id); }
    this.pointers = active;

    // compatibilidade: os campos antigos refletem a mão principal
    this.main = main.hand || null;
    this.ray.copy(main.ray); this.origin.copy(main.origin); this.handPos.copy(main.handPos); this.handVel.copy(main.vel);
    this.gesture = main.gesture; this.pinchStrength = main.pinchStrength; this.pokeTip = main.pokeTip;
    this.pinch = main.pinch; this.pinchDown = main.pinchDown; this.pinchUp = main.pinchUp;
    this.prevHandPos.copy(this.handPos);
  }

  _ptr(id, source) {
    let p = this._ptrs.get(id);
    if (!p) {
      p = { id, source, ray: new THREE.Ray(), rayDir: new THREE.Vector3(0, 0, -1), origin: new THREE.Vector3(), handPos: new THREE.Vector3(), prevHandPos: new THREE.Vector3(), vel: new THREE.Vector3(), pinch: false, prevPinch: false, pinchDown: false, pinchUp: false, pinchStrength: 0, gesture: 'indefinida', side: null, hand: null, pokeTip: null, uiBusy: false, fresh: true, keys: this.keys };
      Object.defineProperty(p, 'handVel', { get() { return this.vel; } });
      this._ptrs.set(id, p);
    }
    p.lost = 0;
    return p;
  }

  // a outra mão (para jogos de duas mãos); null se só houver uma
  other(p) { return this.pointers.find((q) => q !== p && !q.system && q.source === p.source) || null; }
  bySide(side) { return this.pointers.find((p) => p.side === side && !p.system) || null; }

  // Gesto de sistema do Meta Quest: olhe para a palma aberta e faça pinça.
  // Pinçar e soltar = abre/fecha o menu · pinçar e segurar 1s = recentralizar a visão.
  _systemGesture(dt) {
    // a palma precisa ficar virada para você por 0,25s antes (como o ícone aparecendo no Quest);
    // durante uma pinça já iniciada, a mão continua valendo mesmo se girar um pouco
    const cand = this.hands.find((h) => !h.stale && h.confianca >= 0.45 && h.palmFacing > (this.systemBusy ? 0.35 : 0.6));
    this._palmT = cand ? (cand.gesture !== 'pinça' ? (this._palmT || 0) + dt : (this._palmT || 0)) : 0;
    const sys = cand && (this._palmT >= 0.25 || this.systemBusy) ? cand : null;
    this.systemHand = sys || null;
    if (!sys) {
      this.systemBusy = false; this._sysT = 0; this._sysFired = false; this.systemProgress = 0; return;
    }
    if (sys.gesture === 'pinça') {
      this.systemBusy = true;
      this._sysT = (this._sysT || 0) + dt;
      this.systemProgress = Math.min(1, this._sysT / 1.0);
      if (this._sysT >= 1.0 && !this._sysFired) { this._sysFired = true; this.recenterRequest = true; }
    } else {
      if (this.systemBusy && !this._sysFired && this._sysT > 0.04) this.menuRequest = true;
      this.systemBusy = false; this._sysT = 0; this._sysFired = false; this.systemProgress = 0;
    }
  }

  consumeRecenter() { const r = this.recenterRequest; this.recenterRequest = false; return r; }
  consumeMenuRequest() { const r = this.menuRequest; this.menuRequest = false; return r; }
  consumeLook() { const d = this.lookDelta.clone(); this.lookDelta.set(0, 0); return d; }
}
