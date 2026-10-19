// Avatar e carros BlueNav. Estilo de rede social VR (corpo arredondado
// articulado, rosto expressivo e mãos rastreadas), com arte própria.
import * as THREE from 'three';
import { std, glowTexture } from '../common.js';
import { buildCar } from '../carModel.js';
import { itemOf, validLook } from './cosmetics.js';

const patternCache = new Map();
// Small canvas pattern (stripes, checker, stars, flames) tinted by the base color.
export function patternTexture(kind, color) {
  const key = kind + color; if (patternCache.has(key)) return patternCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(255,255,255,0.55)';
  if (kind === 'stripes') for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 6);
  else if (kind === 'checker') for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 8, j * 8, 8, 8);
  else if (kind === 'stars') for (let i = 0; i < 9; i++) { const cx = (i * 23) % 64, cy = (i * 37) % 64; x.beginPath?.(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.5 : 6, a = k / 10 * Math.PI * 2; x.lineTo?.(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill?.(); }
  else if (kind === 'flames') { x.fillStyle = 'rgba(255,140,30,0.85)'; for (let i = 0; i < 64; i += 10) { x.beginPath?.(); x.moveTo?.(i, 64); x.lineTo?.(i + 5, 20 + (i % 3) * 8); x.lineTo?.(i + 10, 64); x.fill?.(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.shared = true;
  patternCache.set(key, t); return t;
}

const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const geo = {
  // Bean torso: narrow neck, round shoulders, soft taper to a rounded bottom.
  torso: lathe([[0, -0.3], [0.1, -0.29], [0.17, -0.24], [0.2, -0.12], [0.205, 0.02], [0.215, 0.13], [0.2, 0.2], [0.14, 0.25], [0.07, 0.27], [0, 0.27]]),
  collar: new THREE.TorusGeometry(0.072, 0.018, 8, 24).rotateX(Math.PI / 2),
  head: new THREE.SphereGeometry(0.16, 28, 20).scale(1, 1.05, 0.98),
  sclera: new THREE.SphereGeometry(0.034, 16, 12).scale(1, 1.25, 0.45), pupil: new THREE.SphereGeometry(0.018, 12, 10).scale(1, 1.2, 0.5), shine: new THREE.SphereGeometry(0.006, 6, 4),
  brow: new THREE.CapsuleGeometry(0.008, 0.04, 3, 6).rotateZ(Math.PI / 2),
  mouthArc: new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI), mouthO: new THREE.TorusGeometry(0.018, 0.007, 6, 16), mouthFlat: new THREE.CapsuleGeometry(0.007, 0.045, 3, 6).rotateZ(Math.PI / 2),
  tongue: new THREE.SphereGeometry(0.018, 10, 8).scale(1, 0.6, 0.5), cheek: new THREE.CircleGeometry(0.022, 14),
  palm: new THREE.SphereGeometry(0.05, 16, 12).scale(1, 0.7, 1.15), thumb: new THREE.CapsuleGeometry(0.016, 0.035, 4, 8), fingers: new THREE.CapsuleGeometry(0.03, 0.03, 4, 10).rotateZ(Math.PI / 2).scale(1, 0.55, 1),
  cap: new THREE.SphereGeometry(0.168, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), curl: new THREE.SphereGeometry(0.05, 10, 8), ridge: new THREE.CapsuleGeometry(0.03, 0.16, 4, 8).rotateX(Math.PI / 2),
  bun: new THREE.SphereGeometry(0.06, 14, 10), tail: new THREE.CapsuleGeometry(0.035, 0.14, 4, 10), fringe: new THREE.SphereGeometry(0.17, 24, 8, -1.4, 2.8, 0.25, 0.55), afro: new THREE.SphereGeometry(0.21, 20, 14),
  brim: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), tall: new THREE.CylinderGeometry(0.12, 0.13, 0.22, 20), crown: new THREE.CylinderGeometry(0.14, 0.12, 0.09, 8, 1, true), ring: new THREE.TorusGeometry(0.14, 0.015, 8, 32),
  ear: new THREE.SphereGeometry(0.06, 12, 8).scale(0.6, 1.4, 0.3), horn: new THREE.ConeGeometry(0.03, 0.12, 10), lens: new THREE.TorusGeometry(0.038, 0.008, 6, 18), bar: new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6).rotateZ(Math.PI / 2),
  nose: new THREE.SphereGeometry(.023, 10, 8).scale(.8, 1, 1.1),
  neck: new THREE.CylinderGeometry(.052, .065, .12, 12),
  armSegment: new THREE.CylinderGeometry(.036, .042, 1, 10),
  elbow: new THREE.SphereGeometry(.041, 10, 8),
  leg: new THREE.CapsuleGeometry(.064, .18, 4, 10),
  shoe: new THREE.SphereGeometry(.077, 12, 8).scale(1, .65, 1.7),
  visor: new THREE.SphereGeometry(0.168, 20, 8, -0.9, 1.8, 1.1, 0.6), mask: new THREE.SphereGeometry(0.17, 20, 8, -1.1, 2.2, 1.6, 0.5), mustache: new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI),
  lensDisc: new THREE.CircleGeometry(0.037, 16), shadow: new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2),
};
Object.values(geo).forEach(g => { g.userData.shared = true; });
let shadowMat = null;

function hand(skin, side) {
  const h = new THREE.Group();
  h.add(new THREE.Mesh(geo.palm, skin));
  const fingers = new THREE.Mesh(geo.fingers, skin); fingers.position.set(0, 0, -0.055); h.add(fingers);
  const thumb = new THREE.Mesh(geo.thumb, skin); thumb.position.set(-side * 0.045, 0.005, -0.015); thumb.rotation.set(0.4, 0, side * 0.9); h.add(thumb);
  return h;
}

// Returns a group with userData.hands [left, right], head, body, eyes and mouth.
export function buildAvatar(lookIn, { tint = null, shadow = true } = {}) {
  const at = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
  const look = validLook(lookIn), g = new THREE.Group(); g.name = 'avatar';
  const skin = std({ color: itemOf('skin', look.skin).value, roughness: 0.55 });
  const shirt = itemOf('shirt', look.shirt), shirtColor = tint || shirt.value;
  const cloth = std({ color: shirt.pattern ? '#ffffff' : shirtColor, map: shirt.pattern ? patternTexture(shirt.pattern, shirtColor) : null, roughness: 0.75 });
  const body = new THREE.Group(); body.position.y = 1.0; g.add(body);
  body.add(new THREE.Mesh(geo.torso, cloth));
  const collar = new THREE.Mesh(geo.collar, std({ color: new THREE.Color(shirtColor).multiplyScalar(0.7), roughness: 0.7 })); collar.position.y = 0.26; body.add(collar);
  const head = new THREE.Group(); head.position.y = 1.47; g.add(head);
  head.add(new THREE.Mesh(geo.head, skin));
  at(head, new THREE.Mesh(geo.nose, skin), 0, -.018, -.163);
  for (const s of [-1, 1]) at(head, new THREE.Mesh(geo.ear, skin), s * .157, -.005, .005).scale.set(.55, .38, .75);
  at(g, new THREE.Mesh(geo.neck, skin), 0, 1.31, 0);
  const white = std({ color: '#ffffff', roughness: 0.3 }), dark = std({ color: '#1b1d22', roughness: 0.35 });
  const hairColor = itemOf('hairColor', look.hairColor).value, hairMat = std({ color: hairColor, roughness: 0.85 });
  const face = itemOf('face', look.face).value, eyes = [];
  for (const s of [-1, 1]) {
    const eye = at(head, new THREE.Group(), s * 0.055, 0.025, -0.14);
    eye.add(new THREE.Mesh(geo.sclera, white));
    at(eye, new THREE.Mesh(geo.pupil, face === 'stareyes' ? std({ color: '#ffcc33', emissive: '#806010' }) : dark), 0, 0, -0.012);
    at(eye, new THREE.Mesh(geo.shine, white), 0.006, 0.01, -0.02);
    at(head, new THREE.Mesh(geo.brow, hairMat), s * 0.058, 0.085, -0.135).rotation.z = s * -0.12;
    const cheek = at(head, new THREE.Mesh(geo.cheek, new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.35, depthWrite: false })), s * 0.085, -0.03, -0.138); cheek.rotation.y = Math.PI + s * 0.5;
    eyes.push({ eye });
  }
  const mouthKind = itemOf('mouth', look.mouth).value, mouth = at(head, new THREE.Group(), 0, -0.06, -0.152), mouthMat = std({ color: '#5a1d1d', roughness: 0.5 });
  if (mouthKind === 'smile' || mouthKind === 'grin' || mouthKind === 'tongue') { const arc = new THREE.Mesh(geo.mouthArc, mouthMat); arc.rotation.z = Math.PI; arc.scale.set(mouthKind === 'grin' ? 1.25 : 0.9, mouthKind === 'grin' ? 0.9 : 0.6, 1); mouth.add(arc); }
  if (mouthKind === 'flat') mouth.add(new THREE.Mesh(geo.mouthFlat, mouthMat));
  if (mouthKind === 'o') mouth.add(new THREE.Mesh(geo.mouthO, mouthMat));
  if (mouthKind === 'tongue') at(mouth, new THREE.Mesh(geo.tongue, std({ color: '#ff6f86' })), 0, -0.025, 0);
  const hair = itemOf('hair', look.hair).value;
  if (hair && hair !== 'afro') at(head, new THREE.Mesh(geo.cap, hairMat), 0, 0.01, 0.005);
  if (hair === 'curly') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; at(head, new THREE.Mesh(geo.curl, hairMat), Math.cos(a) * 0.12, 0.1 + (i % 2) * 0.03, Math.sin(a) * 0.12); }
  if (hair === 'mohawk') at(head, new THREE.Mesh(geo.ridge, hairMat), 0, 0.17, 0.01).scale.set(1, 1.6, 1.2);
  if (hair === 'ponytail') { at(head, new THREE.Mesh(geo.bun, hairMat), 0, 0.06, 0.15).scale.setScalar(0.7); at(head, new THREE.Mesh(geo.tail, hairMat), 0, -0.05, 0.19).rotation.x = 0.35; }
  if (hair === 'bun') at(head, new THREE.Mesh(geo.bun, hairMat), 0, 0.17, 0.04);
  if (hair === 'fringe') at(head, new THREE.Mesh(geo.fringe, hairMat), 0, 0.02, 0).rotation.y = Math.PI / 2;
  if (hair === 'afro') at(head, new THREE.Mesh(geo.afro, hairMat), 0, 0.07, 0.02);
  if (face === 'glasses' || face === 'shades') {
    const frame = std({ color: face === 'shades' ? '#111' : '#3a3f4a', roughness: 0.3, metalness: 0.5 });
    for (const s of [-1, 1]) { at(head, new THREE.Mesh(geo.lens, frame), s * 0.055, 0.025, -0.158); if (face === 'shades') at(head, new THREE.Mesh(geo.lensDisc, dark), s * 0.055, 0.025, -0.162).rotation.y = Math.PI; }
    at(head, new THREE.Mesh(geo.bar, frame), 0, 0.03, -0.162);
  }
  if (face === 'mustache') at(head, new THREE.Mesh(geo.mustache, hairMat), 0, -0.035, -0.156);
  if (face === 'visor') head.add(new THREE.Mesh(geo.visor, std({ color: '#36e3ff', emissive: '#0a6a80', roughness: 0.1, metalness: 0.4 })));
  if (face === 'mask') head.add(new THREE.Mesh(geo.mask, std({ color: '#e8e8ea', roughness: 0.7 })));
  const hat = itemOf('hat', look.hat);
  if (hat.value) {
    const mat = std({ color: hat.value, roughness: 0.5, metalness: hat.name === 'Coroa' || hat.name === 'Halo' ? 0.7 : 0, emissive: hat.name === 'Halo' ? '#8a7a20' : '#000000' });
    const lift = hair === 'afro' ? 0.1 : hair === 'bun' || hair === 'mohawk' ? 0.03 : 0;
    switch (hat.name) {
      case 'Boné': at(head, new THREE.Mesh(geo.cap, mat), 0, 0.03 + lift, 0).scale.setScalar(1.04); at(head, new THREE.Mesh(geo.brim, mat), 0, 0.06 + lift, -0.13).scale.set(0.7, 1, 0.7); break;
      case 'Gorro': at(head, new THREE.Mesh(geo.cap, mat), 0, 0.04 + lift, 0).scale.set(1.08, 1.15, 1.08); break;
      case 'Cartola': at(head, new THREE.Mesh(geo.brim, mat), 0, 0.14 + lift, 0); at(head, new THREE.Mesh(geo.tall, mat), 0, 0.26 + lift, 0); break;
      case 'Coroa': at(head, new THREE.Mesh(geo.crown, mat), 0, 0.2 + lift, 0); break;
      case 'Capacete': at(head, new THREE.Mesh(geo.cap, mat), 0, 0.01, 0).scale.setScalar(1.15); break;
      case 'Chapéu de praia': at(head, new THREE.Mesh(geo.brim, mat), 0, 0.11 + lift, 0).scale.set(1.6, 1, 1.6); at(head, new THREE.Mesh(geo.cap, mat), 0, 0.08 + lift, 0).scale.set(0.82, 0.6, 0.82); break;
      case 'Orelhas': for (const s of [-1, 1]) at(head, new THREE.Mesh(geo.ear, mat), s * 0.1, 0.17 + lift, 0); break;
      case 'Halo': at(head, new THREE.Mesh(geo.ring, mat), 0, 0.29 + lift, 0).rotation.x = Math.PI / 2; break;
      case 'Chifres': for (const s of [-1, 1]) at(head, new THREE.Mesh(geo.horn, mat), s * 0.09, 0.17 + lift, 0).rotation.z = -s * 0.4; break;
    }
  }
  const hands = [-1, 1].map(s => at(g, hand(skin, s), s * 0.3, 0.92, -0.16));
  const trousers = std({ color: '#34433e', roughness: .9 }), soles = std({ color: '#e0d7c5', roughness: .85 });
  for (const s of [-1, 1]) {
    at(g, new THREE.Mesh(geo.leg, trousers), s * .085, .53, .01);
    at(g, new THREE.Mesh(geo.leg, trousers), s * .085, .245, .01);
    at(g, new THREE.Mesh(geo.shoe, soles), s * .085, .065, -.045);
  }
  const arms = [-1, 1].map(s => ({
    shoulder: new THREE.Vector3(s * .19, 1.18, .02),
    upper: at(g, new THREE.Mesh(geo.armSegment, cloth), 0, 0, 0),
    lower: at(g, new THREE.Mesh(geo.armSegment, skin), 0, 0, 0),
    elbow: at(g, new THREE.Mesh(geo.elbow, skin), 0, 0, 0),
  }));
  if (shadow) {
    shadowMat ||= new THREE.MeshBasicMaterial({ map: glowTexture('rgba(0,0,0,1)'), transparent: true, opacity: 0.32, depthWrite: false });
    const sh = at(g, new THREE.Mesh(geo.shadow, shadowMat), 0, 0.02, 0); sh.userData.noCollide = true; g.userData.shadow = sh;
  }
  Object.assign(g.userData, { hands, head, body, arms, look, eyes, mouth, blinkAt: 1 + Math.random() * 3 });
  updateAvatarArms(g);
  return g;
}

// Idle life: blinking and breathing.
export function animateAvatar(avatar, t, dt) {
  const u = avatar.userData; if (!u.eyes) return;
  u.blinkAt -= dt;
  const closing = u.blinkAt < 0.12 && u.blinkAt > 0;
  for (const e of u.eyes) e.eye.scale.y = closing ? 0.12 : 1;
  if (u.blinkAt <= 0) u.blinkAt = 2 + Math.random() * 3.5;
  if (!u.posed) u.body.position.y = 1.0 + Math.sin(t * 2.1 + avatar.id) * 0.008;
  updateAvatarArms(avatar);
}

const armUp = new THREE.Vector3(0, 1, 0), armDelta = new THREE.Vector3(), armBend = new THREE.Vector3(), armElbow = new THREE.Vector3();
export function updateAvatarArms(avatar) {
  const u = avatar.userData;
  const connect = (mesh, a, b) => {
    armDelta.copy(b).sub(a); const length = armDelta.length();
    mesh.position.copy(a).lerp(b, .5); mesh.scale.y = Math.max(.001, length);
    if (length > 1e-5) mesh.quaternion.setFromUnitVectors(armUp, armDelta.divideScalar(length));
  };
  u.arms?.forEach((arm, i) => {
    const wrist = u.hands[i].position, distance = arm.shoulder.distanceTo(wrist);
    // Tracking can place a wrist beyond anatomical reach. Hide rather than stretch.
    const visible = distance < .62;
    arm.upper.visible = arm.lower.visible = arm.elbow.visible = visible;
    if (!visible) return;
    armDelta.copy(wrist).sub(arm.shoulder).normalize();
    armBend.set(0, -1, .25).addScaledVector(armDelta, -armBend.dot(armDelta)).normalize();
    armElbow.copy(arm.shoulder).lerp(wrist, .5).addScaledVector(armBend, Math.sqrt(Math.max(0, .27 ** 2 - (distance / 2) ** 2)));
    arm.elbow.position.copy(armElbow); connect(arm.upper, arm.shoulder, armElbow); connect(arm.lower, armElbow, wrist);
  });
}

// Drives a full avatar from a head pose and two hand positions (world space).
export function poseAvatar(avatar, headPos, headQuat, hands = [null, null]) {
  const u = avatar.userData, e = new THREE.Euler().setFromQuaternion(headQuat, 'YXZ');
  avatar.position.set(headPos.x, headPos.y - 1.47, headPos.z); avatar.rotation.set(0, e.y, 0); avatar.updateMatrixWorld(true);
  u.head.position.set(0, 1.47, 0); u.head.rotation.set(e.x, 0, e.z, 'YXZ');
  u.body.position.set(0, 1.0, 0.03); u.posed = true;
  hands.forEach((h, i) => { if (h) u.hands[i].position.copy(avatar.worldToLocal(h.clone())); else u.hands[i].position.set(i ? 0.3 : -0.3, 0.92, -0.16); });
  updateAvatarArms(avatar);
}

// Car body variants share the curved chassis, scaled and dressed differently.
export function buildPlazaCar(lookIn, { cockpit = false, tex = null, paintOverride = null } = {}) {
  const look = validLook(lookIn), paint = paintOverride || itemOf('paint', look.paint).value, pattern = itemOf('pattern', look.pattern).value;
  const kind = itemOf('car', look.car).value, car = buildCar(paint, { cockpit, tex });
  const body = car.children[0];
  if (pattern && body?.material) { body.material.map = patternTexture(pattern, paint); body.material.color.set('#ffffff'); body.material.needsUpdate = true; }
  if (kind === 'buggy') { car.scale.set(1.1, 0.95, 0.8); if (!cockpit) car.children[1].visible = false; const bar = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 24, Math.PI), std({ color: '#222', metalness: 0.6 })); bar.position.set(0, 0.9, 0); bar.rotation.y = Math.PI / 2; car.add(bar); }
  if (kind === 'truck') { car.scale.set(1.12, 1.25, 1.18); const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.3), body.material); bed.position.set(0, 0.95, 1.4); car.add(bed); }
  if (kind === 'kart') { car.scale.set(0.75, 0.6, 0.6); if (!cockpit) car.children[1].visible = false; }
  if (cockpit) {
    const wheel = new THREE.Group(); wheel.position.set(0, 1.08, -0.5); wheel.rotation.x = -0.45; car.add(wheel);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 32), std({ color: '#1c1c1c', roughness: 0.6 })));
    for (const a of [0, 2.1, -2.1]) { const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), std({ color: '#888', metalness: 0.6 })); spoke.position.set(Math.sin(a) * 0.08, Math.cos(a) * 0.08, 0); spoke.rotation.z = -a; wheel.add(spoke); }
    car.userData.wheel = wheel;
  }
  car.userData.kind = kind; return car;
}
