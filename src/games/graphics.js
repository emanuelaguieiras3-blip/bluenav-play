// Per-game art direction. Decorative meshes never enter gameplay hit lists.
// Instancing, bounded particles and shader animation keep the stereo path cheap.
import * as THREE from 'three';
import { std, glowTexture } from './common.js';
import { rng } from '../core/util.js';

export const GRAPHICS_THEMES = {
  racing: { name: 'Circuito ao entardecer', accent: '#ffb85c', features: ['zebras da pista', 'serras em camadas', 'nuvens'] },
  jungle: { name: 'Floresta viva', accent: '#ccf184', features: ['samambaias', 'pólen', 'luz entre as árvores'] },
  arena: { name: 'Arena de pedra e bronze', accent: '#ffbd72', features: ['arcadas', 'estandartes', 'poeira na luz'] },
  archery: { name: 'Campo de tiro dourado', accent: '#e8b56d', features: ['cercas', 'bandeiras', 'flores do campo'] },
  rhythm: { name: 'Palco de luz', accent: '#73cfff', features: ['portal luminoso', 'piso de trilhas', 'pulsação musical'] },
  kingdom: { name: 'Jardim de construção', accent: '#94d4a0', features: ['pavilhão', 'jardins', 'base da mesa'] },
  dungeon: { name: 'Ruínas antigas', accent: '#69ded0', features: ['arcos do corredor', 'azulejos gastos', 'poeira e umidade'] },
  galaxy: { name: 'Órbita profunda', accent: '#81bfff', features: ['nebulosa', 'planeta com anéis', 'atmosfera planetária'] },
  puzzle: { name: 'Ateliê de formas', accent: '#e9b970', features: ['pedestal', 'parede do ateliê', 'aros de montagem'] },
  dive: { name: 'Recife iluminado', accent: '#70e6d3', features: ['cáusticas animadas', 'bolhas', 'algas'] },
  climb: { name: 'Cume alpino', accent: '#d8b985', features: ['serras distantes', 'nuvens altas', 'estratos da rocha'] },
  night: { name: 'Bosque sob a lua', accent: '#8fb7e8', features: ['vaga-lumes', 'névoa rasteira', 'feixes lunares'] },
  cook: { name: 'Cozinha de madeira e cobre', accent: '#ffd09a', features: ['azulejos', 'prateleiras', 'luz da janela'] },
  tablegames: { name: 'Salão de jogos', accent: '#e8b878', features: ['tapete', 'boiserie', 'luminária e quadros'] },
  physics: { name: 'Laboratório de vidro', accent: '#75c9e5', features: ['bancada', 'grade de medida', 'painéis de instrumentos'] },
  blocks: { name: 'Paisagem de blocos', accent: '#cbe6ff', features: ['nuvens cúbicas', 'montanhas distantes', 'água animada'] },
};

const UP = new THREE.Vector3(0, 1, 0);
const material = (color, options = {}) => std({ color, roughness: 0.85, ...options });

export function createGameGraphics(ctx, id) {
  const theme = GRAPHICS_THEMES[id];
  if (!theme) return { update() {}, summary: { id, features: [], calls: 0 } };
  const root = new THREE.Group(); root.name = `graphics-${id}`; ctx.root.add(root);
  const R = rng(`graphics-${id}`), mobile = !!ctx.mobile, low = !!ctx.lowEnd;
  const updates = [], motion = [], shaderMaterials = [];
  let clock = 0;
  const add = (geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); mesh.rotation.set(...rotation);
    mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const box = (size, color, position, options) => add(new THREE.BoxGeometry(...size), material(color, options), position);
  const instances = (geometry, mat, placements) => {
    const mesh = new THREE.InstancedMesh(geometry, mat, placements.length), o = new THREE.Object3D();
    placements.forEach((p, i) => {
      o.position.set(...p.position); o.rotation.set(...(p.rotation || [0, 0, 0])); o.scale.set(...(p.scale || [1, 1, 1])); o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix); if (p.color) mesh.setColorAt(i, new THREE.Color(p.color));
    });
    mesh.computeBoundingSphere(); mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const lines = (segments, color, opacity = 1) => {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3));
    const mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); root.add(mesh); return mesh;
  };
  const shadow = (position, scale, opacity = 0.18) => {
    const m = add(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(0,0,0,1)'), transparent: true, opacity, depthWrite: false }), position, [-Math.PI / 2, 0, 0]);
    m.scale.set(...scale, 1); return m;
  };
  const motes = (color, count, bounds, size = 0.025, speed = 0.06) => {
    count = Math.round(count * (low ? 0.4 : mobile ? 0.65 : 1));
    const base = new Float32Array(count * 3), positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) for (let j = 0; j < 3; j++) base[i * 3 + j] = bounds[j][0] + R() * (bounds[j][1] - bounds[j][0]);
    positions.set(base);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: glowTexture(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); root.add(m);
    updates.push((t) => {
      for (let i = 0; i < count; i++) {
        positions[i * 3] = base[i * 3] + Math.sin(t * 0.4 + i * 2.17) * 0.18;
        const range = bounds[1][1] - bounds[1][0];
        positions[i * 3 + 1] = bounds[1][0] + ((base[i * 3 + 1] - bounds[1][0] + t * speed) % range + range) % range;
      }
      g.attributes.position.needsUpdate = true; m.material.opacity = 0.35 + Math.sin(t * 0.6) * 0.1;
    }); return m;
  };
  const clouds = (height, radius, cubic = false, center = [0, 0, 0]) => {
    const placements = [];
    for (let i = 0; i < (low ? 10 : 22); i++) {
      const a = i * 2.39996, r = radius * (0.55 + R() * 0.5);
      const x = center[0] + Math.cos(a) * r, y = height + R() * 5, z = center[2] + Math.sin(a) * r;
      const scale = cubic ? [8 + R() * 10, 1.4 + R(), 4 + R() * 4] : [6 + R() * 8, 2.5 + R() * 2.5, 4 + R() * 5];
      placements.push({ position: [x, y, z], scale });
      if (!cubic) for (const side of [-1, 1]) placements.push({ position: [x + side * scale[0] * 0.65, y - scale[1] * 0.2, z + 1], scale: [scale[0] * 0.8, scale[1] * 0.7, scale[2] * 0.8] });
    }
    const geometry = cubic ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(1, 10, 6);
    const colors = new Float32Array(geometry.attributes.position.count * 3), c = new THREE.Color(), shade = new THREE.Color('#c1cfdb');
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      c.copy(shade).lerp(new THREE.Color('#f5f6ee'), Math.max(0, Math.min(1, geometry.attributes.position.getY(i) * 0.8 + 0.5)));
      colors.set(c.toArray(), i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = instances(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), placements);
    m.receiveShadow = false;
    updates.push((t) => { m.position.x = Math.sin(t * 0.012) * 3; });
  };
  const mountains = (radius, height, colors = ['#718b8d', '#a4b8b4'], center = [0, 0, 0]) => {
    for (let layer = 0; layer < 2; layer++) {
      const placements = [];
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2, h = height * (0.45 + R() * 0.75), r = radius + layer * height * 2;
        placements.push({ position: [center[0] + Math.cos(a) * r, h * 0.42 - 3, center[2] + Math.sin(a) * r], scale: [height * (0.7 + R()), h, height * (0.7 + R())], rotation: [0, R() * 6, 0] });
      }
      instances(new THREE.ConeGeometry(1, 1, 7, 1), material(colors[layer], { flatShading: true, fog: false }), placements);
    }
  };
  const grass = (radius, count, color, center = [0, 0, 0], floor = 0.015) => {
    const placements = [];
    for (let i = 0; i < (low ? count * 0.5 : count); i++) {
      const a = R() * Math.PI * 2, r = 2 + R() * radius;
      placements.push({ position: [center[0] + Math.cos(a) * r, floor, center[2] + Math.sin(a) * r], rotation: [0, R() * 6, (R() - 0.5) * 0.2], scale: [0.08 + R() * 0.09, 0.15 + R() * 0.4, 0.08] });
    }
    const m = instances(new THREE.ConeGeometry(1, 1, 3).translate(0, 0.5, 0), material(color, { side: THREE.DoubleSide }), placements);
    updates.push((t) => { m.rotation.z = Math.sin(t * 0.8) * 0.008; });
  };
  const arch = (position, radius, color, thickness = 0.12, springHeight = radius) => {
    const g = new THREE.Group(); g.position.set(...position); root.add(g);
    const mat = material(color), ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, 24, Math.PI), mat);
    ring.position.y = springHeight; g.add(ring);
    for (const x of [-radius, radius]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness * 1.3, springHeight, 8), mat); p.position.set(x, springHeight * 0.5, 0); g.add(p); }
    return g;
  };
  const banner = (position, color, scale = 1) => {
    const pole = box([0.035, 1.8, 0.035], '#5c5143', [position[0], position[1] + 0.9 * scale, position[2]]); pole.scale.y = scale;
    const cloth = add(new THREE.PlaneGeometry(0.42 * scale, 0.65 * scale, 4, 5), material(color, { side: THREE.DoubleSide }), [position[0] + 0.22 * scale, position[1] + 1.4 * scale, position[2]]);
    const p = cloth.geometry.attributes.position, base = Float32Array.from(p.array);
    updates.push((t) => { for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(base[i * 3] * 6 + t * 1.6) * 0.045 * (base[i * 3] / (0.42 * scale) + 0.5)); p.needsUpdate = true; });
  };
  const grid = (width, depth, step, position, color, opacity = 0.25) => {
    const segments = [];
    for (let x = -width / 2; x <= width / 2 + 0.001; x += step) segments.push([x, 0, -depth / 2, x, 0, depth / 2]);
    for (let z = -depth / 2; z <= depth / 2 + 0.001; z += step) segments.push([-width / 2, 0, z, width / 2, 0, z]);
    const m = lines(segments, color, opacity); m.position.set(...position); return m;
  };
  const beam = (position, size, color, angle = 0.2, opacity = 0.025) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    return add(new THREE.PlaneGeometry(...size), mat, position, [0, 0.15, angle]);
  };

  switch (id) {
    case 'racing': {
      mountains(340, 70, ['#718b91', '#b0c1bf']); clouds(58, 260);
      // Match the game's deterministic track, without modifying its collision ribbon.
      const ctrl = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 120 + Math.sin(i * 2.3) * 28 + Math.cos(i * 1.7) * 14; ctrl.push(new THREE.Vector3(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r)); }
      const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal'), placements = [];
      for (let i = 0; i < 420; i++) {
        const u = i / 420; if (u > 0.52 && u < 0.72) continue;
        const p = curve.getPointAt(u), t = curve.getTangentAt(u), n = new THREE.Vector3(-t.z, 0, t.x);
        for (const side of [-1, 1]) placements.push({ position: [p.x + n.x * side * 5.65, 0.035, p.z + n.z * side * 5.65], rotation: [0, Math.atan2(t.x, t.z), 0], color: i % 2 ? '#f0e6d5' : '#b33f32' });
      }
      instances(new THREE.BoxGeometry(0.45, 0.035, curve.getLength() / 420), material('#ffffff'), placements);
      break;
    }
    case 'jungle': {
      grass(18, 220, '#476f30');
      const placements = [];
      for (let i = 0; i < (low ? 70 : 150); i++) { const a = R() * 6.28, r = 2 + R() * 14; placements.push({ position: [Math.cos(a) * r, 0.18, Math.sin(a) * r], rotation: [0.5 + R() * 0.5, a, 0.25], scale: [0.18, 0.7 + R() * 0.6, 1], color: i % 2 ? '#3c642b' : '#75913e' }); }
      instances(new THREE.PlaneGeometry(1, 1, 1, 1), material('#547c34', { map: ctx.tex.get('leaf'), alphaTest: 0.5, side: THREE.DoubleSide }), placements);
      motes('#e2f1ae', 90, [[-8, 8], [0.3, 8], [-10, 6]], 0.025);
      for (const x of [-5, 2, 7]) beam([x, 6, -5], [0.65, 11], '#eef7bb', -0.35);
      break;
    }
    case 'arena': {
      const columns = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; columns.push({ position: [Math.cos(a) * 7.7, 3.1, Math.sin(a) * 7.7] }); }
      instances(new THREE.CylinderGeometry(0.22, 0.35, 6.2, 10), material('#554939', { map: ctx.tex.get('roughStone') }), columns);
      for (const x of [-3.4, 3.4]) { arch([x, 0, -6.7], 1.1, '#7a6850', 0.16); banner([x + 0.3, 3.2, -6.55], x < 0 ? '#6f2730' : '#826238', 1.2); }
      grid(5, 5, 1, [0, 0.012, -1], '#ad8c54', 0.18);
      motes('#e5b780', 65, [[-2, 2], [0.8, 6], [-3, 2]], 0.02, 0.025);
      break;
    }
    case 'archery': {
      grass(24, 200, '#819351', [0, 0, -14]);
      const posts = [], rails = [];
      for (let i = 0; i < 22; i++) {
        const z = -3 - i * 2;
        for (const x of [-8, 8]) { posts.push({ position: [x, 0.6, z] }); for (const y of [0.4, 0.9]) rails.push({ position: [x, y, z - 1] }); }
      }
      const wood = material('#b29b73', { map: ctx.tex.get('woodLight') });
      instances(new THREE.BoxGeometry(0.12, 1.2, 0.12), wood, posts); instances(new THREE.BoxGeometry(0.08, 0.08, 2.1), wood, rails);
      for (const [x, z] of [[-1.5, -10], [-5.5, -20], [6.5, -30]]) banner([x, 0, z], '#b55c37');
      const flowers = [];
      for (let i = 0; i < 90; i++) { const x = (R() - 0.5) * 15, z = -3 - R() * 30; flowers.push({ position: [x, 0.22, z], scale: [0.055, 0.04, 0.055], color: i % 3 ? '#ded5ac' : '#c59751' }); }
      instances(new THREE.IcosahedronGeometry(1, 0), material('#ffffff'), flowers);
      clouds(32, 90); break;
    }
    case 'rhythm': {
      const mat = new THREE.MeshBasicMaterial({ color: '#6dc8ff', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
      const portal = add(new THREE.TorusGeometry(1.8, 0.025, 6, 64, Math.PI), mat, [0, 0.7, -5.2]); portal.scale.y = 1.15;
      add(new THREE.TorusGeometry(1.95, 0.01, 4, 64, Math.PI), mat, [0, 0.7, -5.3]);
      const floor = box([5, 0.05, 12], '#090f1c', [0, 0.45, -5.5], { metalness: 0.4, roughness: 0.32 });
      grid(5, 12, 0.5, [0, 0.478, -5.5], '#2e648a', 0.5);
      const lights = [];
      for (let i = 0; i < 20; i++) for (const x of [-2.25, 2.25]) lights.push({ position: [x, 0.5 + (i % 4) * 0.09, -i * 0.5], color: x < 0 ? '#4daaff' : '#ff71c2' });
      const bars = instances(new THREE.BoxGeometry(0.05, 0.15, 0.2), mat.clone(), lights);
      updates.push((t) => { const pulse = 0.65 + Math.pow(Math.max(0, Math.cos(t * 110 / 60 * Math.PI * 2)), 8) * 0.35; mat.opacity = pulse; bars.material.opacity = pulse; });
      floor.receiveShadow = false; break;
    }
    case 'kingdom': {
      clouds(20, 55); mountains(65, 15, ['#789e80', '#c1d0ba']);
      const posts = [];
      for (const x of [-2.9, 2.9]) for (const z of [-4.5, 2]) posts.push({ position: [x, 1.6, z] });
      instances(new THREE.BoxGeometry(0.16, 3.2, 0.16), material('#b5a183', { map: ctx.tex.get('woodLight') }), posts);
      for (const x of [-2.9, 2.9]) box([0.2, 0.15, 7], '#8a785e', [x, 3.2, -1.25]);
      box([6, 0.14, 0.2], '#8a785e', [0, 3.2, -4.5]);
      for (const x of [-2.4, 2.4]) { box([0.45, 0.3, 2.4], '#736f57', [x, 0.15, -1.3]); grass(0.5, 35, '#6e9652', [x, 0, -1.3], 0.32); }
      shadow([0, 0.014, -1.3], [4.5, 4.5], 0.24); break;
    }
    case 'dungeon': {
      const start = ctx.rig.position;
      for (const x of [start.x + 1.35, start.x + 2.8, start.x + 4.1]) arch([x, 0, start.z], 0.86, '#454949', 0.11, 1.65).rotation.y = Math.PI / 2;
      grid(5, 1.7, 0.55, [start.x + 2, 0.006, start.z], '#788682', 0.2);
      motes('#96b7b4', 45, [[start.x - 0.6, start.x + 5], [0.15, 2.6], [start.z - 0.8, start.z + 0.8]], 0.012, -0.012);
      // Soft pools of damp stone, no reflective render target.
      for (let i = 0; i < 3; i++) shadow([start.x + i * 1.5, 0.008, start.z + (R() - 0.5) * 0.7], [0.65, 1.1], 0.3);
      break;
    }
    case 'galaxy': {
      const noise = ctx.tex.get('nebula');
      const mat = new THREE.MeshBasicMaterial({ map: noise, color: '#6880be', transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, fog: false });
      add(new THREE.PlaneGeometry(280, 150), mat, [-100, 50, -340], [0, 0.2, -0.3]);
      const planet = add(new THREE.SphereGeometry(24, 32, 20), material('#8eaaa5', { map: ctx.tex.get('planetBands'), roughness: 1 }), [-115, 38, -220]);
      add(new THREE.SphereGeometry(24.9, 24, 16), new THREE.MeshBasicMaterial({ color: '#749dbd', transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }), planet.position.toArray());
      const ring = add(new THREE.RingGeometry(31, 49, 80), new THREE.MeshBasicMaterial({ color: '#bca785', transparent: true, opacity: 0.48, depthWrite: false, side: THREE.DoubleSide }), planet.position.toArray(), [-1.05, 0.3, 0.2]);
      updates.push((t) => { planet.rotation.y = t * 0.012; ring.rotation.z = 0.2 + Math.sin(t * 0.005) * 0.03; });
      break;
    }
    case 'puzzle': {
      box([2.5, 0.055, 1.2], '#687b87', [0, 0.78, -1.0], { roughness: 0.38 });
      box([0.65, 0.76, 0.55], '#b7bdbe', [0, 0.38, -1.0]); shadow([0, 0.005, -1], [2.5, 1.6]);
      box([7, 3.2, 0.12], '#cbd3d0', [0, 1.6, -4.5]);
      for (const x of [-2.2, 2.2]) box([0.8, 1.6, 0.08], '#e4e0ce', [x, 1.8, -4.4]);
      const ring = add(new THREE.TorusGeometry(0.27, 0.004, 4, 48), new THREE.MeshBasicMaterial({ color: '#ddb777', transparent: true, opacity: 0.7 }), [0, 1.35, -0.75]);
      ring.rotation.x = -Math.PI / 2; motion.push({ object: ring, axis: 'z', rate: 0.14 });
      grid(2, 0.9, 0.1, [0, 0.811, -1], '#99a6b0', 0.3); break;
    }
    case 'dive': {
      const caustic = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, tint: { value: new THREE.Color('#8af1dd') } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform float time; uniform vec3 tint; varying vec2 vUv; void main(){vec2 p=vUv*48.0; float a=sin(p.x+sin(p.y*1.17+time*.6)*1.5+time*.4);float b=sin(p.y+cos(p.x*.91-time*.4)*1.5-time*.3);float c=pow(max(0.0,1.0-abs(a+b)*2.8),3.0);gl_FragColor=vec4(tint,c*.16);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      });
      const m = add(new THREE.PlaneGeometry(70, 70), caustic, [0, -5.42, 0], [-Math.PI / 2, 0, 0]); shaderMaterials.push(caustic); m.renderOrder = 2;
      motes('#b8f7f2', 100, [[-12, 12], [-6, 3], [-15, 10]], 0.035, 0.28);
      grass(17, 100, '#477f68', [0, 0, 0], -5.95);
      break;
    }
    case 'climb': {
      mountains(100, 34, ['#737e89', '#b1bcc3']); clouds(42, 120);
      const ledges = [];
      for (let i = 0; i < 34; i++) ledges.push({ position: [(R() - 0.5) * 12, 0.25 + i * 0.7, -0.94], scale: [0.35 + R() * 0.5, 0.025, 0.13], color: i % 2 ? '#90856f' : '#666757' });
      instances(new THREE.BoxGeometry(1, 1, 1), material('#ffffff'), ledges); break;
    }
    case 'night': {
      motes('#b8d68b', 60, [[-14, 14], [0.2, 2.2], [-18, 7]], 0.035, 0.012);
      for (const [x, z] of [[-7, -8], [5, -12], [9, 3]]) beam([x, 5, z], [0.65, 10], '#89afd8', -0.3, 0.03);
      const mist = new THREE.MeshBasicMaterial({ map: glowTexture('rgba(162,184,204,1)'), color: '#688599', transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide });
      const placements = [];
      for (let i = 0; i < (low ? 5 : 10); i++) placements.push({ position: [(R() - 0.5) * 30, 0.32 + R() * 0.3, -2 - R() * 25], scale: [6 + R() * 6, 0.6, 1], rotation: [0, (R() - 0.5) * 0.7, 0] });
      const m = instances(new THREE.PlaneGeometry(1, 1), mist, placements); updates.push((t) => { m.position.x = Math.sin(t * 0.06) * 0.7; });
      break;
    }
    case 'cook': {
      box([3.9, 1, 0.035], '#cdc2a8', [0, 1.45, -1.16], { map: ctx.tex.get('kitchenTile') });
      for (const x of [-1.7, 1.7]) {
        box([0.8, 0.045, 0.32], '#956c47', [x, 1.9, -1.05], { map: ctx.tex.get('woodMedium') });
        for (let i = 0; i < 3; i++) { const jar = add(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12), material(i % 2 ? '#897e61' : '#ad8463'), [x - 0.23 + i * 0.23, 2.0, -1.05]); jar.castShadow = !mobile; }
      }
      const handles = [];
      for (let i = 0; i < 4; i++) handles.push({ position: [-0.9 + i * 0.6, 0.68, -0.24] });
      instances(new THREE.BoxGeometry(0.18, 0.018, 0.02), material('#b9aa8c', { metalness: 0.65, roughness: 0.35 }), handles);
      grid(2.35, 0.67, 0.6, [0, 0.002, -0.62], '#443322', 0.2);
      beam([-1.4, 1.15, -2.8], [0.8, 2.4], '#ffd9a0', -0.4, 0.045); break;
    }
    case 'tablegames': {
      add(new THREE.PlaneGeometry(4.5, 4.5), material('#52252b', { map: ctx.tex.get('rug') }), [0, 0.008, -0.75], [-Math.PI / 2, 0, 0]);
      box([9, 3.4, 0.1], '#3d3028', [0, 1.7, -4.2]);
      const panels = [];
      for (let i = 0; i < 9; i++) panels.push({ position: [-4 + i, 0.65, -4.12] });
      instances(new THREE.BoxGeometry(0.78, 1.1, 0.055), material('#5a4531', { map: ctx.tex.get('woodMedium') }), panels);
      for (const x of [-2, 2]) { box([1.25, 0.9, 0.06], '#b19667', [x, 2.0, -4.1]); box([1.05, 0.7, 0.07], '#27343d', [x, 2.0, -4.06], { map: ctx.tex.get('artPrint') }); }
      shadow([0, 0.02, -0.75], [2.5, 2.5], 0.3); break;
    }
    case 'physics': {
      box([2.7, 0.045, 1.5], '#d4e0e4', [0, 0.51, -1.0], { roughness: 0.36 });
      for (const x of [-1.1, 1.1]) box([0.07, 0.5, 1.1], '#708697', [x, 0.25, -1]);
      grid(2.6, 1.4, 0.1, [0, 0.536, -1], '#63879a', 0.3);
      box([5, 2.8, 0.08], '#d2dee4', [0, 1.4, -3.5]);
      for (const x of [-1.45, 1.45]) box([0.8, 0.9, 0.06], '#567584', [x, 1.8, -3.44], { map: ctx.tex.get('instrumentPanel') });
      shadow([0, 0.006, -1], [3.0, 2.0], 0.12); break;
    }
    case 'blocks': {
      clouds(24, 45, true, [16, 0, 16]); mountains(60, 17, ['#7a9a8c', '#b1c5ba'], [16, 0, 16]);
      // Animate only liquid materials; cube positions and hit IDs remain unchanged.
      const water = new Set();
      ctx.root.traverse((o) => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (m.transparent && m.map && m.opacity === 0.72) water.add(m.map); });
      updates.push((t) => { for (const map of water) { map.offset.x = t * 0.014; map.offset.y = Math.sin(t * 0.1) * 0.03; } });
      break;
    }
  }
  let calls = 0; root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) calls++; });
  root.userData.decorative = true;
  return {
    group: root,
    summary: { id, name: theme.name, features: theme.features, calls, profile: low ? 'economy' : mobile ? 'mobile' : 'desktop' },
    update(dt) {
      clock += Math.max(0, Math.min(dt, 0.05));
      for (const update of updates) update(clock);
      for (const entry of motion) entry.object.rotation[entry.axis] += dt * entry.rate;
      for (const mat of shaderMaterials) mat.uniforms.time.value = clock;
    },
  };
}
