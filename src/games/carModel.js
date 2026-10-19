// Original sports car built from curves: extruded side profile with bevels,
// a glass cabin, round wheels with rims and lights. Front points to -z.
import * as THREE from 'three';
import { std, phys } from './common.js';

const shape = points => { const s = new THREE.Shape(); s.moveTo(...points[0]); for (let i = 1; i < points.length; i++) s.lineTo(...points[i]); s.closePath(); return s; };
// Smooth profile through control points (spline, not straight segments).
const smooth = (points, divisions = 48) => new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(divisions).map(v => [v.x, v.y]);

const geometryCache = new Map();
function carGeometries() {
  if (geometryCache.size) return geometryCache;
  const lower = smooth([[-2.1, 0.32], [-2.18, 0.6], [-2.05, 0.84], [-1.4, 0.9], [0.9, 0.88], [1.6, 0.78], [2.12, 0.62], [2.18, 0.42], [2.05, 0.3]]);
  lower.push([-1.95, 0.28]);
  const body = new THREE.ExtrudeGeometry(shape(lower), { depth: 1.62, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 4, curveSegments: 24 });
  body.translate(0, 0, -0.81).rotateY(Math.PI / 2);
  const cabinPoints = smooth([[-1.55, 0.86], [-1.0, 1.12], [-0.4, 1.27], [0.25, 1.27], [0.85, 0.9]], 32); cabinPoints.push([0.85, 0.85], [-1.55, 0.85]);
  const cabin = new THREE.ExtrudeGeometry(shape(cabinPoints), { depth: 1.36, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 16 });
  cabin.translate(0, 0, -0.68).rotateY(Math.PI / 2);
  const tire = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 24).rotateZ(Math.PI / 2);
  const rim = new THREE.TorusGeometry(0.2, 0.045, 8, 20).rotateY(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.08, 0.08, 0.28, 12).rotateZ(Math.PI / 2);
  const light = new THREE.SphereGeometry(0.09, 12, 8).scale(1.6, 0.6, 0.5);
  const spoiler = new THREE.ExtrudeGeometry(shape(smooth([[-0.22, 0], [0, 0.07], [0.22, 0.02], [0.2, -0.02]], 12)), { depth: 1.5, bevelEnabled: false }).translate(0, 0, -0.75).rotateY(Math.PI / 2);
  Object.entries({ body, cabin, tire, rim, hub, light, spoiler }).forEach(([k, v]) => { v.userData.shared = true; geometryCache.set(k, v); });
  return geometryCache;
}

export function buildCar(color = '#c21f2a', { cockpit = false, tex = null } = {}) {
  const g = carGeometries(), car = new THREE.Group();
  const paint = phys({ color, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const body = new THREE.Mesh(g.get('body'), paint); car.add(body);
  if (!cockpit) car.add(new THREE.Mesh(g.get('cabin'), phys({ color: '#1b2430', metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.88 })));
  const spoiler = new THREE.Mesh(g.get('spoiler'), std({ color: '#1a1a1a', roughness: 0.5 })); spoiler.position.set(0, 1.08, 1.85); car.add(spoiler);
  for (const x of [-0.6, 0.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), spoiler.material); post.position.set(x, 0.96, 1.85); car.add(post); }
  const tireMat = std({ color: '#1b1b1b', roughness: 0.95, ...(tex ? { map: tex.get('tire') } : {}) }), rimMat = std({ color: '#c9ced6', metalness: 0.9, roughness: 0.25 });
  const wheels = [];
  for (const [x, z] of [[-0.86, -1.38], [0.86, -1.38], [-0.86, 1.32], [0.86, 1.32]]) {
    const steer = new THREE.Group(); steer.position.set(x, 0.34, z); car.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    spin.add(new THREE.Mesh(g.get('tire'), tireMat));
    const rim = new THREE.Mesh(g.get('rim'), rimMat); rim.position.x = Math.sign(x) * 0.1; spin.add(rim);
    spin.add(new THREE.Mesh(g.get('hub'), rimMat));
    wheels.push({ steer, spin, front: z < 0 });
  }
  const head = new THREE.MeshBasicMaterial({ color: '#fff6d8', toneMapped: false }), tail = new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false });
  for (const x of [-0.62, 0.62]) {
    const h = new THREE.Mesh(g.get('light'), head); h.position.set(x, 0.62, -2.14); car.add(h);
    const t = new THREE.Mesh(g.get('light'), tail); t.position.set(x, 0.7, 2.12); car.add(t);
  }
  car.userData.wheels = wheels; car.userData.paint = paint;
  // Spin the wheels by distance and turn the front ones.
  car.userData.drive = (distance, steer) => { for (const w of wheels) { w.spin.rotation.x -= distance / 0.34; if (w.front) w.steer.rotation.y = -steer * 0.45; } };
  return car;
}
