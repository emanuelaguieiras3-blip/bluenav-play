// Marcadores de paintball BlueNav: modelos próprios com cano, depósito de
// tinta, empunhadura e coronha. Os números ficam aqui para testar o balanço.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std } from '../common.js';

export const WEAPONS = {
  pistola: { name: 'Pistola', mag: 12, rate: 0.22, reload: 1.0, pellets: 1, spread: 0.01, auto: false },
  fuzil: { name: 'Fuzil', mag: 30, rate: 0.1, reload: 1.6, pellets: 1, spread: 0.025, auto: true },
  escopeta: { name: 'Escopeta', mag: 6, rate: 0.7, reload: 1.8, pellets: 5, spread: 0.09, auto: false },
};

export const BOT_NAMES = ['Lia', 'Theo', 'Nina', 'Caio', 'Bia', 'Rafa', 'Duda', 'Leo', 'Mia', 'Davi', 'Iara', 'Gabi', 'Juca', 'Tati', 'Enzo', 'Lua', 'Zeca', 'Malu', 'Ravi', 'Kika', 'Pedro', 'Sol', 'Teca', 'Ian'];

const geo = {
  body: new RoundedBoxGeometry(0.06, 0.08, 0.2, 2, 0.02), barrel: new THREE.CylinderGeometry(0.014, 0.016, 0.22, 14).rotateX(Math.PI / 2),
  longBarrel: new THREE.CylinderGeometry(0.015, 0.017, 0.36, 14).rotateX(Math.PI / 2), wideBarrel: new THREE.CylinderGeometry(0.024, 0.026, 0.26, 14).rotateX(Math.PI / 2),
  grip: new RoundedBoxGeometry(0.035, 0.1, 0.045, 2, 0.012), hopper: new THREE.SphereGeometry(0.055, 18, 12).scale(1, 0.85, 1.25), neck: new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10),
  stock: new RoundedBoxGeometry(0.04, 0.07, 0.16, 2, 0.015), guard: new THREE.TorusGeometry(0.022, 0.005, 6, 16, Math.PI), tank: new THREE.CapsuleGeometry(0.022, 0.12, 4, 12).rotateX(Math.PI / 2),
  pump: new THREE.CylinderGeometry(0.022, 0.022, 0.08, 12).rotateX(Math.PI / 2),
};
Object.values(geo).forEach(g => { g.userData.shared = true; });

// Barrel points to -z; the grip sits at the origin (where the hand holds it).
export function buildGun(kind, color = '#2f7bff') {
  const g = new THREE.Group(); g.name = 'paint-gun-' + kind;
  const shell = std({ color, roughness: 0.4, metalness: 0.1 }), dark = std({ color: '#25282e', roughness: 0.5, metalness: 0.4 });
  const glass = std({ color: '#e8f4ff', roughness: 0.1, transparent: true, opacity: 0.55 });
  const add = (geometry, mat, x, y, z) => { const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(geo.body, shell, 0, 0.05, -0.05);
  add(kind === 'fuzil' ? geo.longBarrel : kind === 'escopeta' ? geo.wideBarrel : geo.barrel, dark, 0, 0.065, kind === 'fuzil' ? -0.31 : -0.24);
  add(geo.grip, dark, 0, -0.02, 0.01).rotation.x = 0.25;
  add(geo.guard, dark, 0, 0.01, -0.04).rotation.set(0, Math.PI / 2, Math.PI);
  const hopper = add(geo.hopper, glass, 0, 0.14, -0.04); add(geo.neck, dark, 0, 0.1, -0.04);
  // A few colored balls inside the hopper.
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.014, 8, 6), shell, (i % 2 - 0.5) * 0.03, 0.13 + Math.floor(i / 2) * 0.02, -0.05 + (i % 2) * 0.02);
  if (kind !== 'pistola') { add(geo.stock, shell, 0, 0.04, 0.12); add(geo.tank, dark, 0, -0.03, 0.1); }
  if (kind === 'escopeta') add(geo.pump, shell, 0, 0.03, -0.2);
  g.userData.hopper = hopper; g.userData.kind = kind;
  return g;
}

// Irregular paint splat (canvas), shared by every splat decal.
let splat = null;
export function splatTexture() {
  if (splat) return splat;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.beginPath?.(); x.arc?.(32, 32, 18, 0, Math.PI * 2); x.fill?.();
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + (i % 3) * 0.3, r = 18 + (i * 7) % 11; x.beginPath?.(); x.arc?.(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 3 + (i * 5) % 5, 0, Math.PI * 2); x.fill?.(); }
  splat = new THREE.CanvasTexture(c); splat.userData.shared = true; return splat;
}
