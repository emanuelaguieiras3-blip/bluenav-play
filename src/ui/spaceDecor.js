// Space scene behind the system menu: nebula, twinkling star shell, a ringed
// gas giant with an orbiting cratered moon, a geodesic beacon wrapped in a
// torus-knot filament, and a comet. It stays behind the panel (renderOrder
// below 300) and ignores the depth buffer like the rest of the menu.
import * as THREE from 'three';
import { atmosphereMaterial, crateredMoonGeometry, gasGiantMaterial, litMaterial, nebulaMaterial, ringMaterial,
  twinkleGeometry, twinkleMaterial } from '../core/spaceShaders.js';

const LIGHT = [0.55, 0.5, 0.67];

function overlay(object, order) {
  object.traverse(o => {
    if (!o.material) return;
    o.renderOrder = order; o.frustumCulled = false;
    o.material.depthTest = false; o.material.depthWrite = false;
  });
  return object;
}

export function createSpaceDecor({ lowEnd = false } = {}) {
  const root = new THREE.Group(); root.name = 'menu-space-decor';
  const timed = [];

  const nebula = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.75), nebulaMaterial({ opacity: 0.85 }));
  nebula.position.set(0, 0.2, -1.0); root.add(overlay(nebula, 280)); timed.push(nebula.material);

  // Star shell on a golden spiral, curved around the reader.
  const count = lowEnd ? 260 : 620, positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = i * 2.399963, t = (i + 0.5) / count, r = Math.sqrt(t);
    const x = Math.cos(a) * r * 1.15, y = Math.sin(a) * r * 0.78, depth = 0.9 + ((i * 53) % 37) / 37 * 0.35;
    positions.set([x, y + 0.18, -depth + x * x * 0.25], i * 3);
  }
  const stars = new THREE.Points(twinkleGeometry(positions, { minSize: 0.0035, maxSize: 0.014 }), twinkleMaterial({ scale: 900 }));
  root.add(overlay(stars, 281)); timed.push(stars.material);

  // Ringed gas giant, upper right. The ring is split into far and near halves
  // so it passes behind and in front of the planet without a depth buffer.
  const planet = new THREE.Group(); planet.position.set(0.24, 0.74, -0.95); root.add(planet);
  const radius = 0.09, inner = radius * 1.32, outer = radius * 2.25;
  const tilt = new THREE.Group(); tilt.rotation.set(0.42, 0, -0.38); planet.add(tilt);
  const ringMat = ringMaterial({ inner, outer, planetRadius: radius, light: LIGHT });
  const ringFar = new THREE.Mesh(new THREE.RingGeometry(inner, outer, lowEnd ? 64 : 160, 1, 0, Math.PI), ringMat);
  const ringNear = new THREE.Mesh(new THREE.RingGeometry(inner, outer, lowEnd ? 64 : 160, 1, Math.PI, Math.PI), ringMat);
  ringFar.rotation.x = ringNear.rotation.x = -Math.PI / 2;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, lowEnd ? 40 : 72, lowEnd ? 28 : 48), gasGiantMaterial({ light: LIGHT }));
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.07, 48, 32), atmosphereMaterial({ color: '#8fc4ff', power: 3.2, strength: 1.1, light: LIGHT }));
  tilt.add(overlay(ringFar, 282), overlay(sphere, 283), overlay(atmosphere, 284), overlay(ringNear, 285));
  timed.push(sphere.material);

  // Orbit path drawn as a fading ellipse, with a cratered moon riding it.
  const orbitPoints = [], orbitA = 0.26, orbitB = 0.075;
  for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; orbitPoints.push(new THREE.Vector3(Math.cos(a) * orbitA, 0, Math.sin(a) * orbitB)); }
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  orbitGeometry.setAttribute('color', new THREE.Float32BufferAttribute(orbitPoints.flatMap(p => { const k = 0.25 + 0.75 * (p.z / orbitB * 0.5 + 0.5); return [0.55 * k, 0.75 * k, k]; }), 3));
  const orbit = new THREE.Line(orbitGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending }));
  orbit.rotation.z = -0.22; planet.add(overlay(orbit, 281));
  const moon = new THREE.Mesh(crateredMoonGeometry(0.026, lowEnd ? 3 : 4, 3), litMaterial({ color: '#c9ccd6', light: LIGHT }));
  planet.add(moon);

  // Geodesic beacon, lower left: icosphere edges, glowing vertices and a
  // (2,5) torus-knot filament spinning through it.
  const beacon = new THREE.Group(); beacon.position.set(-0.32, 0.7, -0.95); root.add(beacon);
  const ico = new THREE.IcosahedronGeometry(0.085, 1);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ico), new THREE.LineBasicMaterial({ color: '#7fc8ff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
  const vertexStars = new THREE.Points(twinkleGeometry(ico.attributes.position.array.slice(), { minSize: 0.008, maxSize: 0.016 }), twinkleMaterial({ scale: 900 }));
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.06, 0.0028, lowEnd ? 160 : 320, 8, 2, 5),
    new THREE.MeshBasicMaterial({ color: '#c58bff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 3), atmosphereMaterial({ color: '#9fe1ff', power: 1.2, strength: 1.6 }));
  beacon.add(overlay(edges, 286), overlay(vertexStars, 287), overlay(knot, 286), overlay(core, 287));
  timed.push(vertexStars.material);

  // Comet: bright head with a tapered additive tail along its path.
  const tailCount = 40, tailGeometry = new THREE.BufferGeometry();
  tailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tailCount * 3), 3));
  const tailAlpha = new Float32Array(tailCount * 3);
  for (let i = 0; i < tailCount; i++) { const k = Math.pow(1 - i / tailCount, 1.8); tailAlpha.set([0.75 * k, 0.9 * k, k], i * 3); }
  tailGeometry.setAttribute('color', new THREE.BufferAttribute(tailAlpha, 3));
  const tail = new THREE.Line(tailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending }));
  const head = new THREE.Points(twinkleGeometry(new Float32Array(3), { minSize: 0.03, maxSize: 0.03 }), twinkleMaterial({ scale: 900 }));
  root.add(overlay(tail, 282), overlay(head, 283)); timed.push(head.material);

  let time = 0;
  const cometAt = (t, out) => out.set(-0.95 + ((t * 0.07) % 1) * 1.9, 0.86 - ((t * 0.07) % 1) * 0.2 + Math.sin(t * 0.45) * 0.02, -0.98);
  const tmp = new THREE.Vector3(), orbitAxis = new THREE.Vector3(0, 0, 1);
  const update = (dt) => {
    time += dt;
    for (const material of timed) material.uniforms.time.value = time;
    sphere.rotation.y += dt * 0.12;
    const a = time * 0.55;
    moon.position.set(Math.cos(a) * orbitA, 0, Math.sin(a) * orbitB).applyAxisAngle(orbitAxis, -0.22);
    moon.rotation.y += dt * 0.4;
    // The moon hides behind the planet on the far half of its orbit.
    overlay(moon, Math.sin(a) < 0 ? 282 : 286);
    edges.rotation.set(time * 0.13, time * 0.21, 0); vertexStars.rotation.copy(edges.rotation);
    knot.rotation.set(-time * 0.35, time * 0.2, time * 0.27);
    core.scale.setScalar(1 + Math.sin(time * 2.2) * 0.12);
    const pos = tailGeometry.attributes.position;
    for (let i = 0; i < tailCount; i++) { cometAt(time - i * 0.045, tmp); pos.setXYZ(i, tmp.x, tmp.y, tmp.z); }
    pos.needsUpdate = true;
    cometAt(time, tmp); head.position.copy(tmp); const phase = (time * 0.07) % 1; head.visible = tail.visible = phase > 0.13 && phase < 0.94;
  };
  update(0);
  return { root, update };
}

// Glass panel background for the library canvas: gradient, faint stars and an
// accent rim. Replaces the flat fill.
export function paintSpacePanel(context, width, height, radius) {
  const g = context.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, 'rgba(18,22,44,0.9)'); g.addColorStop(0.55, 'rgba(14,16,30,0.9)'); g.addColorStop(1, 'rgba(30,18,48,0.9)');
  context.fillStyle = g; context.beginPath(); context.roundRect(0, 0, width, height, radius); context.fill();
  context.save(); context.clip();
  const glow = context.createRadialGradient(width * 0.82, height * 0.08, 0, width * 0.82, height * 0.08, width * 0.6);
  glow.addColorStop(0, 'rgba(110,140,255,0.16)'); glow.addColorStop(1, 'rgba(110,140,255,0)');
  context.fillStyle = glow; context.fillRect(0, 0, width, height);
  for (let i = 0; i < 140; i++) {
    const x = ((i * 7919) % 1000) / 1000 * width, y = ((i * 104729) % 997) / 997 * height, s = 0.6 + (i % 5) * 0.35;
    context.fillStyle = `rgba(220,230,255,${0.08 + (i % 7) * 0.025})`; context.beginPath(); context.arc(x, y, s, 0, Math.PI * 2); context.fill();
  }
  context.restore();
  const rim = context.createLinearGradient(0, 0, width, 0);
  rim.addColorStop(0, 'rgba(120,180,255,0.55)'); rim.addColorStop(0.5, 'rgba(197,139,255,0.25)'); rim.addColorStop(1, 'rgba(120,180,255,0.55)');
  context.strokeStyle = rim; context.lineWidth = 3; context.beginPath(); context.roundRect(1.5, 1.5, width - 3, height - 3, radius); context.stroke();
}
