// 🎉 PRAÇA BLUENAV — rede social VR própria: dormitório com espelho,
// guarda-roupa, garagem, 500 salas (Corrida, Paintball, Parkour, Encontro),
// fichas para liberar visuais e salas online com amigos.
import { std, Particles, glowTexture } from './common.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RigidWorld, grabbable, trackHands } from './rigidWorld.js';
import { GorillaMotion, boxSurface } from './gorillaMotion.js';
import { disposeTree } from '../core/util.js';
import { MAP_COUNT, MODES, generateMap, listMaps, trackPoints, distanceToTrack } from './plaza/maps.js';
import { COSMETICS, CATEGORY_NAMES, Wardrobe, itemOf, validLook } from './plaza/cosmetics.js';
import { buildAvatar, buildPlazaCar, poseAvatar, animateAvatar, patternTexture } from './plaza/avatar.js';
import { createMirror } from './plaza/mirror.js';
import { WEAPONS, BOT_NAMES, buildGun, splatTexture } from './plaza/weapons.js';
import { buildGrid, findPath, isFree } from './plaza/nav.js';
import { newCar, stepFreeCar, bumpCars, aiControl } from './plaza/freeCar.js';
import { barrelGeometry } from './sceneProps.js';

const PAGE = 8;
// Render layer for the player's own avatar: only the mirror camera shows it
// (WebXR uses layers 1 and 2 for the eyes).
export const SELF_LAYER = 5;
// Light paintballs: fast and with a gentle arc.
const PAINT_SPEED = 40, PAINT_GRAVITY = 4;

export default {
  id: 'plaza',
  create(ctx) {
    const { THREE, root, rig, camera, tex, audio, env, input } = ctx;
    const wardrobe = new Wardrobe();
    const world = new THREE.Group(); world.name = 'plaza-world'; root.add(world);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    let scene = null; // current scene controller { kind, update, dispose, state }
    let feedback = '', feedbackLife = 0;
    const say = (text, life = 2.5) => { feedback = text; feedbackLife = life; };
    const removeUI = group => ctx.app?.ui?.removeWhere?.(m => { for (let o = m; o; o = o.parent) if (o === group) return true; return false; });
    const clearWorld = () => {
      scene?.dispose?.(); scene = null;
      removeUI(world); disposeTree(world); world.clear();
      rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); ctx.teleport({ enabled: true, walk: true });
    };
    const button = (parent, label, x, y, z, onClick, { w = 0.3, h = 0.075, sub = null, rotY = 0, fontSize } = {}) => {
      const b = ctx.button({ label, sub, w, h, onClick, ...(fontSize ? { fontSize } : {}) }); b.position.set(x, y, z); b.rotation.y = rotY; parent.add(b); return b;
    };
    const label = (parent, text, x, y, z, { w = 1, h = 0.1, size = 0.34, rotY = 0 } = {}) => {
      const l = ctx.label(text, { w, h, size, bg: 'rgba(12,18,30,.78)' }); l.position.set(x, y, z); l.rotation.y = rotY; parent.add(l); return l;
    };

    // ---- block geometry for generated maps ----
    const unitBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.04), unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
    unitBox.userData.keepCube = true; unitBox.userData.shared = true; unitCyl.userData.shared = true;
    const buildBlocks = (group, blocks, theme) => {
      const byKey = new Map();
      for (const b of blocks) { const key = (b.shape || 'box') + '|' + b.kind + '|' + b.color; if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(b); }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = V(0, 1, 0);
      for (const [key, list] of byKey) {
        const color = list[0].color, kind = list[0].kind;
        // Inflatable striped bunkers, wooden benches and stage, stone walls in castles.
        const map = kind === 'cover' ? patternTexture('stripes', color) : kind === 'bench' ? tex.get('woodMedium') : kind === 'stage' ? tex.get('woodLight') : kind === 'fountain' ? tex.get('marble') : kind === 'wall' ? tex.get(theme.id === 'castelo' ? 'roughStone' : theme.id === 'espaco' ? 'metalPanel' : 'stoneTiles') : null;
        const mat = std({ color: map ? '#ffffff' : color, map, roughness: kind === 'cover' ? 0.35 : 0.75, ...(theme.emissive ? { emissive: color, emissiveIntensity: 0.25 } : {}) });
        if (map && kind !== 'cover') mat.color.set(color).lerp(new THREE.Color('#ffffff'), 0.6);
        const mesh = new THREE.InstancedMesh(key.startsWith('cylinder') ? unitCyl : unitBox, mat, list.length);
        list.forEach((b, i) => mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y, b.z), q.setFromAxisAngle(up, b.yaw || 0), s.set(b.w, b.h, b.d))));
        mesh.computeBoundingSphere(); group.add(mesh);
      }
    };
    // Themed scenery instead of plain blocks: same footprint (collision) per block.
    const SCENERY_STYLE = { cidade: 'building', neon: 'building', espaco: 'dome', floresta: 'tree', neve: 'pine', ilha: 'palm', praia: 'palm', castelo: 'tower', deserto: 'cactus', vulcao: 'rock' };
    const sceneryGeo = {
      trunk: new THREE.CylinderGeometry(0.12, 0.18, 1, 10).translate(0, 0.5, 0), crown: new THREE.IcosahedronGeometry(0.5, 1), cone: new THREE.ConeGeometry(0.5, 1, 12).translate(0, 0.5, 0),
      tower: new THREE.CylinderGeometry(0.5, 0.55, 1, 16).translate(0, 0.5, 0), dome: new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), rock: new THREE.DodecahedronGeometry(0.5, 1),
      frond: new THREE.ConeGeometry(0.5, 0.15, 7), windows: new RoundedBoxGeometry(1.02, 1, 1.02, 1, 0.01), cactus: new THREE.CapsuleGeometry(0.18, 0.7, 4, 10).translate(0, 0.53, 0),
    };
    Object.values(sceneryGeo).forEach(g2 => { g2.userData.shared = true; g2.userData.keepCube = true; });
    const buildScenery = (group, blocks, theme) => {
      const style = SCENERY_STYLE[theme.id] || 'building', parts = new Map();
      const put = (geo, color, pos, scale, extra = {}) => { const key = geo.uuid + color + (extra.emissive || ''); if (!parts.has(key)) parts.set(key, { geo, color, extra, list: [] }); parts.get(key).list.push([pos, scale]); };
      for (const b of blocks) {
        const base = V(b.x, b.y - b.h / 2, b.z), w = Math.min(b.w, b.d);
        if (style === 'building') { put(unitBox, b.color, V(b.x, b.y, b.z), V(b.w, b.h, b.d)); for (let f = 1; f < b.h / 1.2; f++) put(sceneryGeo.windows, theme.emissive ? '#36e3ff' : '#2b3442', V(b.x, base.y + f * 1.2, b.z), V(b.w, 0.18, b.d), theme.emissive ? { emissive: '#36e3ff' } : {}); }
        else if (style === 'tree' || style === 'pine') { put(sceneryGeo.trunk, '#6b4f35', base, V(w * 0.5, b.h * 0.35, w * 0.5)); put(style === 'pine' ? sceneryGeo.cone : sceneryGeo.crown, style === 'pine' ? '#2e554d' : b.color === '#6b4f35' ? '#4f7a3a' : '#4f7a3a', style === 'pine' ? V(b.x, base.y + b.h * 0.25, b.z) : V(b.x, base.y + b.h * 0.65, b.z), style === 'pine' ? V(w, b.h * 0.8, w) : V(w * 1.1, b.h * 0.6, w * 1.1)); if (style === 'pine') put(sceneryGeo.cone, '#f4f8fb', V(b.x, base.y + b.h * 0.8, b.z), V(w * 0.45, b.h * 0.25, w * 0.45)); }
        else if (style === 'palm') { put(sceneryGeo.trunk, '#a8875a', base, V(w * 0.35, b.h, w * 0.35)); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; put(sceneryGeo.frond, '#3f9a5a', V(b.x + Math.cos(a) * w * 0.4, base.y + b.h, b.z + Math.sin(a) * w * 0.4), V(w * 0.9, w * 0.6, w * 0.35)); } }
        else if (style === 'tower') { put(sceneryGeo.tower, b.color, base, V(w, b.h, w)); put(sceneryGeo.cone, theme.palette[3], V(b.x, base.y + b.h, b.z), V(w * 1.2, w * 1.1, w * 1.2)); }
        else if (style === 'dome') { put(sceneryGeo.tower, '#c9d3de', base, V(w, b.h * 0.5, w)); put(sceneryGeo.dome, b.color, V(b.x, base.y + b.h * 0.5, b.z), V(w, w, w), { emissive: b.color }); }
        else if (style === 'cactus') { put(sceneryGeo.cactus, '#5e8f4a', base, V(w * 0.6, b.h * 0.8, w * 0.6)); put(sceneryGeo.rock, b.color, V(b.x + w * 0.4, base.y + 0.2, b.z), V(w * 0.6, w * 0.35, w * 0.5)); }
        else put(sceneryGeo.rock, b.color, V(b.x, base.y + b.h * 0.4, b.z), V(b.w, b.h * 0.9, b.d), theme.id === 'vulcao' ? { emissive: '#3a0a00' } : {});
      }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (const { geo, color, extra, list } of parts.values()) {
        const mesh = new THREE.InstancedMesh(geo, std({ color, roughness: 0.8, ...(extra.emissive ? { emissive: extra.emissive, emissiveIntensity: 0.6 } : {}) }), list.length);
        list.forEach(([pos, scale], i) => mesh.setMatrixAt(i, m.compose(pos, q, scale))); mesh.computeBoundingSphere(); group.add(mesh);
      }
    };
    const buildMapBlocks = (group, blocks, theme) => { buildBlocks(group, blocks.filter(b => b.kind !== 'scenery'), theme); buildScenery(group, blocks.filter(b => b.kind === 'scenery'), theme); };
    const boxesOf = blocks => blocks.map(b => ({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minY: b.y - b.h / 2, maxY: b.y + b.h / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, block: b }));
    const flagCloth = [];
    // Fence posts and rails around an arena, plus lamp posts: instanced.
    const decorateArena = (map, half, { fence = true, lamps: withLamps = true } = {}) => {
      const posts = [], lamps = [], step = 3;
      for (let i = -half; i <= half; i += step) for (const [x, z] of [[i, -half - 1], [i, half + 1], [-half - 1, i], [half + 1, i]]) posts.push([x, z]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; lamps.push([Math.cos(a) * half * 0.85, Math.sin(a) * half * 0.85]); }
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1);
      const inst = (geometry, mat, list, y) => { const mesh = new THREE.InstancedMesh(geometry, mat, list.length); list.forEach(([x, z], i) => mesh.setMatrixAt(i, m.compose(V(x, y, z), q, one))); mesh.computeBoundingSphere(); world.add(mesh); return mesh; };
      const wood = std({ map: tex.get('woodMedium'), color: map.theme.palette[3], roughness: 0.8 });
      if (fence) inst(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 10), wood, posts, 0.55);
      if (fence) for (const [x, z, w, d] of [[0, -half - 1, half * 2, 0.06], [0, half + 1, half * 2, 0.06], [-half - 1, 0, 0.06, half * 2], [half + 1, 0, 0.06, half * 2]]) for (const y of [0.45, 0.9]) { const rail = new THREE.Mesh(new RoundedBoxGeometry(w || 0.06, 0.07, d || 0.06, 1, 0.02), wood); rail.position.set(x, y, z); world.add(rail); }
      if (withLamps) inst(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 10), std({ color: '#3a3f47', metalness: 0.6, roughness: 0.4 }), lamps, 1.6);
      if (withLamps) inst(new THREE.SphereGeometry(0.18, 16, 12), std({ color: '#fff4d6', emissive: '#ffe6a8', emissiveIntensity: 1 }), lamps, 3.25);
      // Soft clouds or stars in the sky.
      const night = map.theme.id === 'espaco' || map.theme.id === 'neon';
      const sprite = new THREE.SpriteMaterial({ map: glowTexture(night ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.9)'), transparent: true, depthWrite: false, fog: false });
      for (let i = 0; i < (night ? 60 : 16); i++) { const c = new THREE.Sprite(sprite), sc = night ? 0.6 + (i % 3) * 0.4 : 18 + (i % 4) * 8; c.scale.set(sc, night ? sc : sc * 0.45, 1); const a = i * 2.4; c.position.set(Math.cos(a) * (90 + (i % 5) * 20), night ? 25 + (i % 7) * 12 : 45 + (i % 4) * 6, Math.sin(a) * (90 + (i % 5) * 20)); world.add(c); }
    };
    const ground = (theme, size) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 48, 48).rotateX(-Math.PI / 2), std({ map: tex.get(theme.ground, { repeat: [size / 6, size / 6] }), color: theme.groundColor, roughness: 0.95 }));
      world.add(g); return g;
    };
    const setSky = theme => env.set({ top: theme.sky[0], horizon: theme.sky[1], bottom: theme.sky[2], fog: { color: theme.fog, near: 40, far: 180 }, hemi: ['#ffffff', theme.sky[2], 1.3], sun: ['#fff4e0', theme.id === 'espaco' || theme.id === 'neon' ? 0.9 : 2], sunPos: [30, 60, 20] });
    // Supports walking on stages, benches and covers.
    const supportAt = (boxes, x, z, feet) => { let top = 0; for (const b of boxes) if (x > b.minX - 0.1 && x < b.maxX + 0.1 && z > b.minZ - 0.1 && z < b.maxZ + 0.1 && b.maxY <= feet + 0.55 && b.maxY > top) top = b.maxY; return top; };
    const walkCheck = boxes => p => !boxes.some(b => b.maxY > rig.position.y + 0.55 && b.minY < rig.position.y + 1.7 && p.x > b.minX - 0.25 && p.x < b.maxX + 0.25 && p.z > b.minZ - 0.25 && p.z < b.maxZ + 0.25);
    const gravityWalk = (boxes, dt, state) => {
      const eye = ctx.eye(), floor = supportAt(boxes, eye.x, eye.z, rig.position.y);
      if (rig.position.y > floor + 0.01) { state.vy = (state.vy || 0) - 9.81 * dt; rig.position.y = Math.max(floor, rig.position.y + state.vy * dt); if (rig.position.y === floor) state.vy = 0; }
      else { rig.position.y += (floor - rig.position.y) * Math.min(1, dt * 12); state.vy = 0; }
    };

    // ---- watch menu: follows the player (like a wrist menu) ----
    const watch = new THREE.Group(); watch.name = 'plaza-watch'; root.add(watch);
    const watchButtons = [
      button(watch, 'Dormitório', -0.17, 0, 0, () => enterDorm(), { w: 0.3, h: 0.07 }),
      button(watch, 'Recomeçar sala', 0.17, 0, 0, () => { if (scene?.mapIndex !== undefined) enterMap(scene.mapIndex); }, { w: 0.3, h: 0.07 }),
    ];
    const placeWatch = () => {
      const eye = ctx.eye(), yaw = new THREE.Euler().setFromQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
      watch.position.copy(eye).add(V(0, -0.62, -0.5).applyAxisAngle(V(0, 1, 0), yaw)); watch.rotation.set(-0.6, yaw, 0, 'YXZ');
      watch.visible = scene?.kind !== 'dorm';
    };
    void watchButtons;

    // ---------------------------------------------------------------- DORM
    const enterDorm = () => {
      clearWorld();
      env.set({ top: '#8fb8de', horizon: '#f2e6d6', bottom: '#5a4a3a', hemi: ['#fff6ea', '#5a4a3a', 1.5], sun: ['#ffe7c4', 1.7], sunPos: [6, 10, 3] });
      const g = new THREE.Group(); world.add(g);
      const wood = std({ map: tex.get('woodLight'), roughness: 0.8 }), wall = std({ color: '#efe6da', roughness: 0.9 }), accent = std({ color: '#3f7fd1', roughness: 0.7 });
      const room = (size, pos, mat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, 0.04), mat); m.position.set(...pos); g.add(m); return m; };
      room([9, 0.1, 9], [0, -0.05, -1.5], wood);
      room([9, 3.2, 0.2], [0, 1.6, -6], wall); room([0.2, 3.2, 9], [-4.5, 1.6, -1.5], wall); room([0.2, 3.2, 9], [4.5, 1.6, -1.5], wall); room([9, 3.2, 0.2], [0, 1.6, 3], wall);
      room([1.6, 0.45, 2.2], [3.4, 0.25, 1.6], accent); room([1.4, 0.18, 0.5], [3.4, 0.55, 2.4], std({ color: '#ffffff' }));
      const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40).rotateX(-Math.PI / 2), std({ map: tex.get('rug'), color: '#c98a8a' })); rug.position.set(0, 0.01, -1.2); g.add(rug);
      // Real mirror: renders the room from the reflected viewpoint. Your own
      // avatar lives on a layer only the mirror camera sees, so in first
      // person you see your hands, and in the mirror your whole body.
      room([1.7, 2.3, 0.08], [0, 1.2, -5.86], std({ color: '#c9a46a', roughness: 0.4, metalness: 0.4 }));
      const mirror = createMirror({ planeZ: -5.8, cx: 0, cy: 1.2, w: 1.5, h: 2.1, resolution: ctx.mobile ? 384 : 768, layers: [SELF_LAYER] }); g.add(mirror.glass);
      let selfAvatar = null;
      const refreshAvatar = () => {
        if (selfAvatar) { disposeTree(selfAvatar); g.remove(selfAvatar); }
        selfAvatar = buildAvatar(wardrobe.look); selfAvatar.traverse(o => o.layers.set(SELF_LAYER)); g.add(selfAvatar);
      };
      refreshAvatar();
      label(g, 'ESPELHO', 0, 2.35, -5.78, { w: 0.6, h: 0.09 });
      // Garage: the car on display changes with the wardrobe.
      let showCar = null;
      const refreshCar = () => { if (showCar) { disposeTree(showCar); g.remove(showCar); } showCar = buildPlazaCar(wardrobe.look, { tex }); showCar.scale.multiplyScalar(0.4); showCar.position.set(3.1, 0.25, -4.7); showCar.rotation.y = 0.6; g.add(showCar); };
      refreshCar();
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.25, 32), std({ color: '#d9dde3', metalness: 0.3, roughness: 0.4 })); pedestal.position.set(3.1, 0.125, -4.7); g.add(pedestal);
      label(g, 'GARAGEM', 3.1, 1.3, -4.7, { w: 0.6, h: 0.09 });
      const tokensLabel = label(g, '', 0, 2.7, -5.85, { w: 1.2, h: 0.12 });
      // Wardrobe panel on the left wall: ◀ item ▶ Usar per category.
      // Kiosks stand within reach, angled toward the spawn point.
      const backing = (parent, w, h, y) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.05, 2, 0.02), std({ color: '#1d2433', roughness: 0.6 })); b.position.set(0, y, -0.04); parent.add(b); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, y - h / 2, 12), std({ color: '#8a8f98', metalness: 0.6 })); leg.position.set(0, (y - h / 2) / 2, -0.06); parent.add(leg); };
      const panel = new THREE.Group(); panel.position.set(-1.75, 0, -1.9); panel.rotation.y = 0.7; g.add(panel); backing(panel, 2.35, 2.35, 1.6);
      label(panel, 'GUARDA-ROUPA E GARAGEM', 0, 2.68, 0, { w: 1.6, h: 0.11 });
      const preview = { ...wardrobe.look }, rows = {};
      const categories = Object.keys(COSMETICS);
      const rowText = cat => { const it = itemOf(cat, preview[cat]), own = wardrobe.owns(cat, preview[cat]), worn = wardrobe.look[cat] === preview[cat]; return `${CATEGORY_NAMES[cat]}: ${it.name} · ${worn ? 'em uso' : own ? 'seu' : it.price + ' fichas'}`; };
      categories.forEach((cat, i) => {
        const y = 2.5 - i * 0.18;
        button(panel, '◀', -0.95, y, 0, () => { preview[cat] = (preview[cat] - 1 + COSMETICS[cat].length) % COSMETICS[cat].length; rows[cat].userData.set(rowText(cat)); }, { w: 0.14 });
        rows[cat] = label(panel, '', -0.1, y, 0, { w: 1.45, h: 0.09, size: 0.3 });
        button(panel, '▶', 0.75, y, 0, () => { preview[cat] = (preview[cat] + 1) % COSMETICS[cat].length; rows[cat].userData.set(rowText(cat)); }, { w: 0.14 });
        button(panel, 'Usar', 1.03, y, 0, () => {
          const r = wardrobe.choose(cat, preview[cat]); say(r.ok ? 'Visual atualizado' : r.reason);
          categories.forEach(c => rows[c].userData.set(rowText(c))); refreshAvatar(); refreshCar(); audio.click?.();
        }, { w: 0.24 });
        rows[cat].userData.set(rowText(cat));
      });
      // Room browser on the right wall.
      const board = new THREE.Group(); board.position.set(1.75, 0, -1.9); board.rotation.y = -0.7; g.add(board); backing(board, 2.2, 2.45, 1.6);
      label(board, `SALAS · ${MAP_COUNT} MAPAS`, 0, 2.6, 0, { w: 1.4, h: 0.12 });
      let filter = null, page = 0, maps = listMaps();
      const pageLabel = label(board, '', 0, 0.62, 0, { w: 0.8, h: 0.08, size: 0.3 });
      const cards = Array.from({ length: PAGE }, (_, i) => button(board, '', (i % 2 ? 0.52 : -0.52), 2.25 - Math.floor(i / 2) * 0.32, 0, () => { const m = maps[page * PAGE + i]; if (m) enterMap(m.index); }, { w: 0.98, h: 0.26, sub: '', fontSize: 0.27 }));
      const draw = () => {
        const pages = Math.max(1, Math.ceil(maps.length / PAGE)); page = Math.min(page, pages - 1);
        cards.forEach((c, i) => { const m = maps[page * PAGE + i]; c.visible = !!m; if (m) c.userData.setLabel(`${m.mode.icon} ${m.name}`, `${m.mode.name} · ${m.theme.name}${wardrobe.completed.has(m.index) ? ' · ✓' : ''}`); });
        pageLabel.userData.set(`Página ${page + 1}/${pages} · ${maps.length} salas`);
      };
      button(board, '◀ Página', -0.62, 0.62, 0, () => { page = (page - 1 + Math.ceil(maps.length / PAGE)) % Math.ceil(maps.length / PAGE); draw(); }, { w: 0.3 });
      button(board, 'Página ▶', 0.62, 0.62, 0, () => { page = (page + 1) % Math.ceil(maps.length / PAGE); draw(); }, { w: 0.3 });
      [['Todas', null], ...MODES.map(m => [m.name, m.id])].forEach(([name, id], i) => button(board, name, -0.84 + i * 0.42, 0.95, 0, () => { filter = id; maps = listMaps({ mode: filter }); page = 0; draw(); }, { w: 0.38, h: 0.07 }));
      button(board, 'Sala aleatória', 0, 0.38, 0, () => { const m = maps[Math.floor(Math.random() * maps.length)]; if (m) enterMap(m.index); }, { w: 0.42 });
      draw();
      ctx.teleport({ enabled: true, walk: true, check: p => Math.abs(p.x) < 4.1 && p.z < 2.6 && p.z > -5.4 });
      scene = {
        kind: 'dorm', refreshAvatar, mirror, get selfAvatar() { return selfAvatar; },
        dispose() { mirror.dispose(); },
        update(dt, t) {
          const tokensText = `Fichas: ${wardrobe.tokens} · salas concluídas: ${wardrobe.completed.size}`;
          if (tokensLabel.userData.text !== tokensText) { tokensLabel.userData.text = tokensText; tokensLabel.userData.set(tokensText); }
          // Your avatar follows your head and tracked hands (seen in the mirror).
          const hands = ctx.pointers().filter(p => p.source === 'hand' || p.source === 'xr');
          const handAt = side => { const p = hands.find(q => q.side === side); return p ? (p.hand?.palm || p.handPos).clone() : null; };
          poseAvatar(selfAvatar, ctx.eye(), camera.getWorldQuaternion(new THREE.Quaternion()), [handAt('left'), handAt('right')]);
          animateAvatar(selfAvatar, t, dt);
          // Mirror pass before the frame (phones: every other frame).
          if (ctx.eye().z > -5.75) mirror.render(ctx.app?.renderer, ctx.app?.scene || ctx.scene, ctx.eye(), { every: ctx.mobile ? 2 : 1 });
          showCar.rotation.y += dt * 0.4;
        },
      };
      say('Bem-vindo ao seu dormitório');
    };

    // ---------------------------------------------------------------- MAPS
    const rewardFor = (map, amount, text) => { const paid = wardrobe.reward(map.index, amount); say(`${text} · +${paid} fichas`, 6); audio.success?.(); };
    const steerFromHands = () => {
      const handPs = ctx.pointers().filter(p => p.source === 'hand' || p.source === 'xr');
      if (handPs.length >= 2) { const a = camera.worldToLocal(handPs[0].handPos.clone()), b = camera.worldToLocal(handPs[1].handPos.clone()); const [l, r] = a.x < b.x ? [a, b] : [b, a]; return THREE.MathUtils.clamp(-Math.atan2(r.y - l.y, r.x - l.x) / 0.9, -1, 1); }
      if (handPs.length) { const v = camera.worldToLocal(handPs[0].handPos.clone()); return THREE.MathUtils.clamp(v.x / Math.max(0.25, -v.z) * 1.6, -1, 1); }
      if (input.source === 'gaze') return THREE.MathUtils.clamp(-(ctx.app?.headYaw?.() || 0) / 0.5, -1, 1);
      return 0;
    };
    const keySteer = () => (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
    // Seat the player in a car: eye ~1.15 m, facing the car's forward.
    const seat = car => { rig.position.set(car.x, -0.25, car.z); rig.rotation.set(0, car.yaw, 0); };
    const placeCarMesh = (mesh, car) => { mesh.position.set(car.x, 0, car.z); mesh.rotation.y = car.yaw; mesh.userData.drive?.(car.v / 60, car.steer || 0); if (mesh.userData.wheel) mesh.userData.wheel.rotation.z = -(car.steer || 0) * 1.5; };

    const enterMap = index => {
      const map = generateMap(index);
      clearWorld(); setSky(map.theme);
      const ctl = map.mode.id === 'corrida' ? raceScene(map) : map.mode.id === 'paintball' ? paintballScene(map) : map.mode.id === 'parkour' ? parkourScene(map) : hangoutScene(map);
      scene = { ...ctl, kind: 'map', mapIndex: index, map };
      ctx.objective?.(map.mode.goal);
      say(`${map.name} · ${map.mode.goal}`, 5);
      if (ctx.app?.network?.room && ctx.app.network.id === ctx.app.network.host) ctx.app.network.sendEvent('plaza-map', { index });
    };

    // -------- Corrida: 3 voltas por anéis, 3 rivais com IA --------
    const raceScene = map => {
      const pts = trackPoints(map, 240), half = map.size;
      ground(map.theme, half * 2 + 60);
      // Road ribbon following the centre line.
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= pts.length; i++) {
        const a = pts[i % pts.length], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * map.width / 2, nz = dx / l * map.width / 2;
        pos.push(a[0] - nx, 0.03, a[1] - nz, a[0] + nx, 0.03, a[1] + nz); uv.push(0, i * 0.4, 1, i * 0.4);
        if (i < pts.length) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const roadGeo = new THREE.BufferGeometry(); roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); roadGeo.setIndex(idx); roadGeo.computeVertexNormals();
      world.add(new THREE.Mesh(roadGeo, std({ map: tex.get('road'), color: map.theme.id === 'neve' ? '#b9c6d2' : '#ffffff', roughness: 0.9, side: THREE.DoubleSide })));
      buildMapBlocks(world, map.blocks, map.theme);
      const boxes = boxesOf(map.blocks);
      // Checkpoint rings across the road.
      const ringIdx = Array.from({ length: 8 }, (_, i) => Math.floor(i * pts.length / 8));
      const rings = ringIdx.map((k, i) => {
        const a = pts[k], b = pts[(k + 1) % pts.length], ring = new THREE.Mesh(new THREE.TorusGeometry(map.width / 2 + 0.6, 0.18, 10, 40), new THREE.MeshBasicMaterial({ color: i ? '#5fe3ff' : '#ffffff', transparent: true, opacity: 0.8 }));
        ring.position.set(a[0], 0, a[1]); ring.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); world.add(ring); return { ring, x: a[0], z: a[1] };
      });
      const start = pts[0], next = pts[3], yaw0 = Math.atan2(-(next[0] - start[0]), -(next[1] - start[1]));
      const right = [Math.cos(yaw0), -Math.sin(yaw0)], back = [Math.sin(yaw0), Math.cos(yaw0)];
      const grid = (row, col) => newCar(start[0] + right[0] * col * 2.6 + back[0] * (row * 5 + 4), start[1] + right[1] * col * 2.6 + back[1] * (row * 5 + 4), yaw0);
      const player = grid(0, -0.5), playerMesh = buildPlazaCar(wardrobe.look, { cockpit: true, tex }); world.add(playerMesh);
      const paints = ['#2a64d8', '#f2b01e', '#1f9a52', '#ff5fa2'];
      const bots = Array.from({ length: ctx.lowEnd ? 2 : map.bots }, (_, i) => {
        const car = grid(i % 2 ? 0 : 1, i % 2 ? 0.5 : (i ? 0.5 : -0.5)); car.skill = 0.85 + (i * 0.07); car.target = 4; car.ring = 1; car.lap = 0;
        const mesh = buildPlazaCar({ ...wardrobe.look, car: i % 4, pattern: (i + 1) % 5 }, { tex, paintOverride: paints[i % paints.length] }); world.add(mesh);
        const driver = buildAvatar({ skin: (i * 3) % 8, shirt: i + 2, hair: i + 1, hairColor: i * 2, hat: 5 }, { shadow: false }); driver.scale.setScalar(0.8); driver.position.set(0, 0.1, 0.3); mesh.add(driver);
        const name = BOT_NAMES[(map.index + i * 5) % BOT_NAMES.length], tag = label(mesh, name, 0, 2.3, 0, { w: 0.6, h: 0.09, size: 0.32 });
        return { car, mesh, name, tag };
      });
      Object.assign(player, { ring: 1, lap: 0 });
      // Tyre barriers along both edges and a start/finish gantry.
      const tyreList = []; for (let k = 0; k < pts.length; k += 3) { const a = pts[k], b2 = pts[(k + 1) % pts.length], dx2 = b2[0] - a[0], dz2 = b2[1] - a[1], l = Math.hypot(dx2, dz2) || 1; for (const sgn of [-1, 1]) tyreList.push([a[0] - dz2 / l * sgn * (map.width / 2 + 2.6), a[1] + dx2 / l * sgn * (map.width / 2 + 2.6)]); }
      const tyres = new THREE.InstancedMesh(new THREE.TorusGeometry(0.32, 0.15, 6, 12).rotateX(Math.PI / 2), std({ color: '#26282c', roughness: 0.9 }), tyreList.length * 2);
      const tm = new THREE.Matrix4(); tyreList.forEach(([x, z], k) => { tyres.setMatrixAt(k * 2, tm.makeTranslation(x, 0.15, z)); tyres.setMatrixAt(k * 2 + 1, tm.makeTranslation(x, 0.43, z)); }); tyres.computeBoundingSphere(); world.add(tyres);
      const gantry = new THREE.Group(); gantry.position.set(start[0], 0, start[1]); gantry.rotation.y = yaw0; world.add(gantry);
      for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5, 14), std({ color: '#e8e8ea', metalness: 0.5, roughness: 0.35 })); post.position.set(sx * (map.width / 2 + 1), 2.5, 0); gantry.add(post); }
      const banner = new THREE.Mesh(new RoundedBoxGeometry(map.width + 2.4, 0.9, 0.2, 2, 0.06), std({ map: patternTexture('checker', '#111111'), roughness: 0.6 })); banner.position.y = 4.8; gantry.add(banner);
      decorateArena(map, 0, { fence: false, lamps: false });
      const state = { phase: 'grid', countdown: 3.5, time: 0, place: 1, finished: false };
      const allCars = [player, ...bots.map(b => b.car)];
      const progress = c => c.lap * 8 + c.ring + (1 - Math.min(1, Math.hypot(rings[c.ring % 8].x - c.x, rings[c.ring % 8].z - c.z) / 200));
      const engine = audio.oscLoop?.({ freq: 60, type: 'sawtooth', vol: 0.05, lp: 700 });
      const passRing = c => { const r = rings[c.ring % 8]; if (Math.hypot(r.x - c.x, r.z - c.z) < map.width / 2 + 2) { if (c.ring % 8 === 0) c.lap++; c.ring++; return true; } return false; };
      return {
        state, player, bots,
        update(dt) {
          if (state.phase === 'grid') { state.countdown -= dt; if (state.countdown <= 0) { state.phase = 'race'; audio.success?.(); } }
          const racing = state.phase === 'race';
          const braking = ctx.pointers().some(p => p.pinch && !p.uiBusy) || input.keys.has('KeyS');
          const offRoad = c => distanceToTrack(pts, c.x, c.z) > map.width / 2 + 0.5;
          stepFreeCar(player, { steer: keySteer() || steerFromHands(), throttle: racing && !state.finished ? 1 : 0, brake: braking }, dt, { grip: offRoad(player) ? 0.55 : 1.05, vmax: offRoad(player) ? 14 : 30, boxes, bound: half + 20 });
          if (player.hit > 3) audio.thud?.();
          for (const b of bots) {
            const c = b.car, target = pts[c.target % pts.length];
            if (Math.hypot(target[0] - c.x, target[1] - c.z) < 9) c.target += 3;
            // Keep the race close: rivals far ahead ease off, those behind push.
            const gap = progress(c) - progress(player), pace = c.skill * THREE.MathUtils.clamp(1 - gap * 0.025, 0.88, 1.08);
            const ai = aiControl(c, target, racing && c.lap < map.laps ? pace : 0);
            stepFreeCar(c, ai, dt, { grip: offRoad(c) ? 0.55 : 1.05, vmax: (offRoad(c) ? 14 : 29) * pace, boxes, bound: half + 20 });
            b.tag.lookAt(ctx.eye());
            passRing(c); placeCarMesh(b.mesh, c);
          }
          for (let i = 0; i < allCars.length; i++) for (let j = i + 1; j < allCars.length; j++) if (bumpCars(allCars[i], allCars[j]) && (i === 0)) audio.thud?.();
          if (racing && !state.finished) {
            state.time += dt;
            if (passRing(player)) audio.click?.();
            state.place = 1 + bots.filter(b => progress(b.car) > progress(player)).length;
            if (player.lap >= map.laps) {
              state.finished = true; rewardFor(map, state.place === 1 ? 60 : 25, `Chegada em ${state.place}º · ${state.time.toFixed(1)} s`);
            }
          }
          rings.forEach((r, i) => { r.ring.material.color.set(i === player.ring % 8 ? '#ffe14d' : '#5fe3ff'); });
          placeCarMesh(playerMesh, player); seat(player);
          engine?.osc?.frequency.setTargetAtTime(55 + Math.abs(player.v) * 4, audio.t, 0.05);
          return state.phase === 'grid' ? `Largada em ${Math.ceil(state.countdown)}` : state.finished ? `Fim · ${state.place}º lugar` : `${state.place}º · volta ${Math.min(map.laps, player.lap + 1)}/${map.laps} · anel ${player.ring % 8 || 8}/8 · ${Math.round(player.v * 3.6)} km/h`;
        },
        dispose() { engine?.osc?.stop?.(); },
      };
    };

    // -------- Paintball: 3x3 com bots, 3 armas, primeiro a 10 --------
    const paintballScene = map => {
      ground(map.theme, map.half * 2 + 40); buildMapBlocks(world, map.blocks, map.theme);
      decorateArena(map, map.half);
      const boxes = boxesOf(map.blocks), teamColors = ['#2f7bff', '#ff3b3b'], teamNames = ['Azul', 'Vermelho'];
      const box3s = boxes.map(x => new THREE.Box3(V(x.minX, x.minY, x.minZ), V(x.maxX, x.maxY, x.maxZ)));
      // Team bases: colored pad, flag and a weapon rack for the player.
      map.bases.forEach(([bx, bz], team) => {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.06, 40), std({ color: teamColors[team], roughness: 0.5, transparent: true, opacity: 0.55 })); pad.position.set(bx, 0.03, bz); world.add(pad);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 10), std({ color: '#dddddd', metalness: 0.6 })); const back = team ? 2.4 : -2.4; pole.position.set(bx, 1.5, bz + back); world.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6, 8, 1), std({ color: teamColors[team], side: THREE.DoubleSide })); flag.position.set(bx + 0.5, 2.65, bz + back); world.add(flag); flagCloth.push(flag);
      });
      const entities = [];
      const spawnAt = team => { const [bx, bz] = map.bases[team]; return [bx + (Math.random() - 0.5) * 4, bz + (Math.random() - 0.5) * 1.5]; };
      const player = { team: 0, isPlayer: true, alive: true, respawn: 0, name: 'Você', score: 0 }; entities.push(player);
      const botCount = ctx.lowEnd ? 2 : map.teamSize;
      const kinds = Object.keys(WEAPONS);
      for (let team = 0; team < 2; team++) for (let i = 0; i < (team ? botCount : botCount - 1); i++) {
        const look = { skin: (i * 3 + team) % 8, shirt: 0, hair: (i * 2 + team) % 8, hairColor: (i + team * 3) % 8, mouth: i % 5, hat: 5, face: 4 };
        const mesh = buildAvatar(look, { tint: teamColors[team] }); world.add(mesh);
        const name = BOT_NAMES[(team * 7 + i * 3 + map.index) % BOT_NAMES.length];
        const tag = label(mesh, name, 0, 2.0, 0, { w: 0.5, h: 0.07, size: 0.32 }); tag.rotation.y = Math.PI;
        const weapon = kinds[(i + team + map.index) % kinds.length], gun = buildGun(weapon, teamColors[team]); mesh.userData.hands[1].add(gun); gun.position.set(0, 0.02, -0.08);
        const [x, z] = spawnAt(team); mesh.position.set(x, 0, z);
        entities.push({ team, mesh, tag, name, weapon, gun, alive: true, respawn: 0, cooldown: 1 + Math.random() * 2, goal: null, state: 'advance', stateTime: 0, peekDir: 1, ammo: WEAPONS[weapon].mag, fall: 0, splats: 0, score: 0, reaction: 0.35 + Math.random() * 0.4, accuracy: 0.6 + Math.random() * 0.35 });
      }
      rig.position.set(map.bases[0][0], 0, map.bases[0][1]); rig.rotation.y = Math.PI;
      ctx.teleport({ enabled: true, walk: true, check: walkCheck(boxes) });
      // Player weapon rack at the base: touch to switch weapons.
      const rack = new THREE.Group(); rack.position.set(map.bases[0][0] - 1.6, 0, map.bases[0][1] + 0.9); rack.rotation.y = Math.PI; world.add(rack);
      const table = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.08, 0.5, 2, 0.02), std({ map: tex.get('woodMedium'), roughness: 0.8 })); table.position.y = 0.95; rack.add(table);
      for (const x of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), std({ color: '#555', metalness: 0.6 })); leg.position.set(x, 0.47, 0); rack.add(leg); }
      const weaponState = { kind: 'pistola', ammo: WEAPONS.pistola.mag, reload: 0, cooldown: 0, burst: 0, recoil: 0 };
      let held = buildGun('pistola', teamColors[0]); world.add(held);
      const equip = kind => {
        world.remove(held); disposeTree(held); held = buildGun(kind, teamColors[0]); world.add(held);
        Object.assign(weaponState, { kind, ammo: WEAPONS[kind].mag, reload: 0, burst: 0 }); say(`${WEAPONS[kind].name}: ${WEAPONS[kind].mag} tiros`, 1.5); audio.click?.();
      };
      kinds.forEach((kind, i) => {
        const display = buildGun(kind, '#9aa3ad'); display.position.set(-0.45 + i * 0.45, 1.05, 0); display.rotation.y = Math.PI / 2; rack.add(display);
        button(rack, WEAPONS[kind].name, -0.45 + i * 0.45, 1.32, 0, () => equip(kind), { w: 0.4, h: 0.07 });
      });
      const startReload = () => { if (weaponState.reload <= 0 && weaponState.ammo < WEAPONS[weaponState.kind].mag) { weaponState.reload = WEAPONS[weaponState.kind].reload; audio.click?.(); } };
      const reloadBtn = button(watch, 'Recarregar', 0, -0.09, 0, startReload, { w: 0.3, h: 0.07 });
      // Paintballs, splats on surfaces and on bodies.
      const ballGeo = new THREE.SphereGeometry(0.03, 8, 6);
      // One material per team for balls and splats (few GPU programs and uploads).
      const ballMats = teamColors.map(c => new THREE.MeshBasicMaterial({ color: c }));
      const balls = Array.from({ length: 80 }, () => { const m = new THREE.Mesh(ballGeo, ballMats[0]); m.visible = false; world.add(m); return { mesh: m, vel: V(0, 0, 0), team: 0, life: 0, owner: null }; });
      const splatTex = splatTexture();
      const splatMats = teamColors.map(c => new THREE.MeshBasicMaterial({ map: splatTex, color: c, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      const splatGeo = new THREE.PlaneGeometry(0.3, 0.3);
      const splats = Array.from({ length: 90 }, () => { const m = new THREE.Mesh(splatGeo, splatMats[0]); m.visible = false; world.add(m); return m; });
      let splatI = 0;
      const splat = (at, normal, team, size = 1) => { const s = splats[splatI++ % splats.length]; s.visible = true; s.material = splatMats[team]; s.position.copy(at).addScaledVector(normal, 0.015); s.lookAt(at.clone().add(normal)); s.rotateZ(Math.random() * 6.28); s.scale.setScalar((0.6 + Math.random() * 0.7) * size); };
      const bodySplatGeo = new THREE.SphereGeometry(0.06, 8, 6);
      const bodySplat = (e, team) => { const s = new THREE.Mesh(bodySplatGeo, ballMats[team]); s.scale.set(1, 1, 0.3); s.position.set((Math.random() - 0.5) * 0.25, 1.0 + (Math.random() - 0.3) * 0.35, -0.2); e.mesh.add(s); e.bodySplats = [...(e.bodySplats || []), s]; };
      const muzzle = new Particles(world, { max: 80, size: 0.06 });
      const fire = (from, dir, team, kind, owner, spread = 0) => {
        const w = WEAPONS[kind];
        for (let k = 0; k < w.pellets; k++) {
          const b = balls.find(x => x.life <= 0); if (!b) return;
          const s = w.spread + spread;
          b.mesh.visible = true; b.mesh.material = ballMats[team]; b.mesh.position.copy(from); b.team = team; b.owner = owner; b.life = 2.5;
          b.vel.copy(dir).add(V((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)).normalize().multiplyScalar(PAINT_SPEED);
        }
        for (let k = 0; k < 4; k++) muzzle.spawn(from, dir.clone().multiplyScalar(1.5).add(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)), { life: 0.25, color: [1, 1, 1, 0.6], drag: 3 });
        audio.noise?.({ dur: 0.05, freq: kind === 'escopeta' ? 700 : 1600, vol: owner === player ? 0.09 : 0.04 });
      };
      const centerOf = e => e.isPlayer ? ctx.eye().add(V(0, -0.45, 0)) : e.mesh.position.clone().add(V(0, 1.15, 0));
      const score = [0, 0], state = { score, finished: false, weapon: weaponState };
      const ray = new THREE.Ray(), hitPoint = new THREE.Vector3();
      const blocked = (a, b) => { const len = a.distanceTo(b); ray.set(a, b.clone().sub(a).normalize()); return box3s.some(x => ray.intersectBox(x, hitPoint) && hitPoint.distanceTo(a) < len); };
      // Inside the fence (or at least not moving further out) and clear of cover.
      const free = (x, z, from = null) => !boxes.some(b => b.block.kind !== 'wall' && b.maxY > 0.6 && x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) &&
        (Math.abs(x) < map.half - 0.6 || (from && Math.abs(x) <= Math.abs(from.x))) && (Math.abs(z) < map.half - 0.6 || (from && Math.abs(z) <= Math.abs(from.z)));
      const grid = buildGrid(boxes.filter(b => b.block.kind !== 'wall'), map.half);
      let pathBudget = 0;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: splatTex, transparent: true, opacity: 0, depthTest: false, color: teamColors[1] })); screen.renderOrder = 999; world.add(screen);
      let screenHit = 0;
      return {
        state, entities, equip, fire, free, boxes,
        update(dt, t) {
          gravityWalk(boxes, dt, state);
          flagCloth.forEach(f => { const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 4 + t * 4) * 0.06 * (p.getX(i) + 0.5)); p.needsUpdate = true; });
          // ---- player weapon ----
          const main = ctx.pointers().find(p => p.main) || ctx.pointers()[0], off = ctx.pointers().find(p => p !== main && (p.source === 'hand' || p.source === 'xr'));
          const w = WEAPONS[weaponState.kind];
          weaponState.cooldown = Math.max(0, weaponState.cooldown - dt); weaponState.recoil = Math.max(0, weaponState.recoil - dt * 6);
          if (weaponState.reload > 0) { weaponState.reload -= dt; if (weaponState.reload <= 0) { weaponState.ammo = w.mag; say('Recarregado', 0.8); } }
          held.visible = !!main && player.alive;
          if (main) {
            const dir = main.ray.direction.clone(), at = main.source === 'hand' || main.source === 'xr' ? main.handPos.clone() : ctx.eye().addScaledVector(dir, 0.45).add(V(0.18, -0.24, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())));
            held.position.copy(at); held.quaternion.setFromUnitVectors(V(0, 0, -1), dir); held.rotateX(weaponState.recoil * 0.25);
            held.userData.hopper && (held.userData.hopper.rotation.y += weaponState.reload > 0 ? dt * 12 : 0);
            // Off hand touching the hopper reloads, like topping up paint.
            if (off?.pinchDown && held.userData.hopper && off.handPos.distanceTo(held.userData.hopper.getWorldPosition(new THREE.Vector3())) < 0.15) startReload();
            if (input.keys.has('KeyR')) { startReload(); input.keys.delete('KeyR'); }
            const trigger = w.auto ? main.pinch : main.pinchDown;
            if (trigger && !main.uiBusy && player.alive && !state.finished && weaponState.cooldown <= 0 && weaponState.reload <= 0) {
              if (weaponState.ammo <= 0) { audio.click?.(); startReload(); }
              else { weaponState.ammo--; weaponState.cooldown = w.rate; weaponState.recoil = 1; fire(at.clone().addScaledVector(dir, 0.22), dir, 0, weaponState.kind, player); main.gamepad?.hapticActuators?.[0]?.pulse?.(0.3, 30)?.catch?.(() => {}); }
            }
          }
          pathBudget = 2;
          // ---- bots: take cover, peek, shoot, strafe when under fire ----
          for (const e of entities) {
            if (e.isPlayer) { if (!e.alive && (e.respawn -= dt) <= 0) { e.alive = true; rig.position.set(map.bases[0][0], 0, map.bases[0][1]); } continue; }
            if (!e.alive) {
              e.fall = Math.min(1, e.fall + dt * 3); e.mesh.rotation.x = -e.fall * 1.3; e.mesh.position.y = -e.fall * 0.3;
              if ((e.respawn -= dt) <= 0) { e.alive = true; e.fall = 0; e.mesh.rotation.x = 0; const [x, z] = spawnAt(e.team); e.mesh.position.set(x, 0, z); (e.bodySplats || []).forEach(s => e.mesh.remove(s)); e.bodySplats = []; e.state = 'advance'; e.goal = null; }
              continue;
            }
            animateAvatar(e.mesh, t, dt);
            e.stateTime += dt; e.cooldown -= dt; e.underFire = Math.max(0, (e.underFire || 0) - dt);
            const from = centerOf(e), enemies = entities.filter(o => o.team !== e.team && o.alive);
            const target = enemies.map(o => ({ o, d: centerOf(o).distanceTo(from) })).sort((a, b) => a.d - b.d).find(x => x.d < 45 && !blocked(from, centerOf(x.o)));
            if (target) e.seen = (e.seen || 0) + dt; else e.seen = 0;
            if (e.state === 'advance' && (!e.goal || e.mesh.position.distanceTo(e.goal) < 0.5)) {
              // Next cover toward the enemy; hide on the own-team side of it.
              const side = e.team ? 1 : -1, covers = map.blocks.filter(b => b.kind === 'cover'), here = e.mesh.position.z * side;
              const ahead = covers.filter(c => c.z * side < here - 1).sort((a, b) => Math.hypot(a.x - e.mesh.position.x, a.z - e.mesh.position.z) - Math.hypot(b.x - e.mesh.position.x, b.z - e.mesh.position.z));
              // Only covers whose hiding spot is itself reachable (not inside another block).
              const spots = ahead.map(c => ({ c, at: V(c.x + (Math.random() - 0.5) * c.w * 0.6, 0, c.z + side * (c.d / 2 + 0.55)) })).filter(o => isFree(grid, o.at.x, o.at.z));
              const pick = spots[Math.floor(Math.random() * Math.min(3, spots.length))], c = pick?.c;
              if (c) { e.goal = pick.at; e.cover = c; }
              else { e.state = 'push'; }
              if (e.goal && e.mesh.position.distanceTo(e.goal) < 0.5) { e.state = 'cover'; e.stateTime = 0; }
            }
            if (e.state === 'cover' && e.stateTime > 1.2 + Math.random() * 0.5) { e.state = 'peek'; e.stateTime = 0; e.peekDir = Math.random() < 0.5 ? -1 : 1; e.peekFrom = e.mesh.position.clone(); }
            if (e.state === 'peek') {
              if (!e.peekGoal) { const out = (e.cover?.w || 1.5) / 2 + 0.5; e.peekGoal = e.peekFrom.clone().add(V(e.peekDir * out, 0, 0)); if (!isFree(grid, e.peekGoal.x, e.peekGoal.z)) e.peekGoal.x = e.peekFrom.x - e.peekDir * out; }
              e.goal = e.peekGoal;
              if (e.stateTime > 2.2 || (e.ammo <= 0)) { e.state = Math.random() < 0.45 ? 'advance' : 'cover'; e.stateTime = 0; e.goal = e.state === 'cover' ? e.peekFrom : null; e.peekGoal = null; if (e.ammo <= 0) { e.reloading = WEAPONS[e.weapon].reload; } }
            }
            if (e.state === 'push') { const foe = enemies[0]; if (foe && (!e.goal || e.stateTime % 1 < dt)) e.goal = centerOf(foe).setY(0); if (e.stateTime > 4) { e.state = 'advance'; e.goal = null; } }
            // Under fire: one quick sidestep.
            if (e.underFire > 0.5 && e.state !== 'peek' && !e.dodging) { const d = e.mesh.position.clone().add(V(e.dodge || 1, 0, 0)); if (isFree(grid, d.x, d.z)) { e.goal = d; e.dodging = true; } }
            if (e.underFire <= 0) e.dodging = false;
            if (e.reloading > 0) { e.reloading -= dt; if (e.reloading <= 0) e.ammo = WEAPONS[e.weapon].mag; }
            if (e.goal) {
              // Plan a path around cover once per goal (a few plans per frame at most).
              if (e.pathFor !== e.goal && pathBudget > 0) { pathBudget--; e.pathFor = e.goal; e.path = findPath(grid, [e.mesh.position.x, e.mesh.position.z], [e.goal.x, e.goal.z]); if (!e.path) { e.goal = null; if (e.state !== 'peek') e.state = 'advance'; } }
              const wp = e.path?.[0];
              if (wp) {
                const step = V(wp[0] - e.mesh.position.x, 0, wp[1] - e.mesh.position.z), dist = step.length();
                if (dist < 0.2) e.path.shift();
                else {
                  step.setLength(Math.min(dist, (e.state === 'peek' ? 1.6 : 2.6) * dt)); e.mesh.position.add(step);
                  e.mesh.userData.body.position.y = 1.0 + Math.abs(Math.sin(t * 9 + e.mesh.id)) * 0.04;
                  if (!target) e.mesh.rotation.y = Math.atan2(-step.x, -step.z);
                }
              } else if (e.path && !e.path.length && e.state === 'advance') { e.state = 'cover'; e.stateTime = 0; }
            }
            if (target) {
              const aim = centerOf(target.o).sub(from); e.mesh.rotation.y = Math.atan2(-aim.x, -aim.z);
              e.mesh.userData.hands[1].position.set(0.18, 1.2, -0.38);
              if (e.cooldown <= 0 && e.seen > e.reaction && e.ammo > 0 && !(e.reloading > 0) && !state.finished) {
                const wpn = WEAPONS[e.weapon]; e.cooldown = wpn.rate * (wpn.auto ? 1.5 : 2.2) + Math.random() * 0.4; e.ammo--;
                aim.y += 0.5 * PAINT_GRAVITY * (target.d / PAINT_SPEED) ** 2;
                const miss = (1 - e.accuracy) * 0.12 + target.d * 0.002 + (e.state === 'peek' ? 0 : 0.02);
                fire(from.clone().add(aim.clone().setLength(0.5)), aim.normalize(), e.team, e.weapon, e, miss);
                if (!target.o.isPlayer) { target.o.underFire = 0.6; target.o.dodge = Math.random() < 0.5 ? -1.2 : 1.2; }
              }
            } else e.mesh.userData.hands[1].position.set(0.3, 0.92, -0.2);
            e.tag.lookAt(ctx.eye());
          }
          // ---- paintballs ----
          for (const b of balls) {
            if (b.life <= 0) continue;
            const prev = b.mesh.position.clone(); b.vel.y -= PAINT_GRAVITY * dt; b.mesh.position.addScaledVector(b.vel, dt); b.life -= dt;
            let done = b.life <= 0; const p = b.mesh.position;
            if (!done && p.y <= 0.01) { splat(V(p.x, 0.012, p.z), V(0, 1, 0), b.team); done = true; }
            if (!done) for (let k = 0; k < box3s.length; k++) {
              const x = boxes[k]; if (!(p.x > x.minX && p.x < x.maxX && p.y > x.minY && p.y < x.maxY && p.z > x.minZ && p.z < x.maxZ)) continue;
              const n = prev.x <= x.minX ? V(-1, 0, 0) : prev.x >= x.maxX ? V(1, 0, 0) : prev.z <= x.minZ ? V(0, 0, -1) : prev.z >= x.maxZ ? V(0, 0, 1) : V(0, 1, 0);
              const at = prev.clone(); if (n.x) at.x = n.x < 0 ? x.minX : x.maxX; else if (n.z) at.z = n.z < 0 ? x.minZ : x.maxZ; else at.y = x.maxY;
              splat(at, n, b.team); done = true; break;
            }
            if (!done) for (const e of entities) {
              if (!e.alive || e.team === b.team) continue;
              const c = centerOf(e), seg = new THREE.Line3(prev, p.clone()), closest = seg.closestPointToPoint(c, true, new THREE.Vector3());
              if (Math.abs(closest.y - c.y) < 0.6 && Math.hypot(closest.x - c.x, closest.z - c.z) < 0.28) {
                done = true; e.alive = false; e.respawn = 3; score[b.team]++; if (b.owner) b.owner.score = (b.owner.score || 0) + 1; audio.thud?.();
                if (e.isPlayer) { say(`${b.owner?.name || 'Alguém'} pintou você! Volta em 3 s`, 3); screenHit = 1; }
                else { bodySplat(e, b.team); say(`${b.owner?.name || '?'} pintou ${e.name}`, 1.5); }
                break;
              }
            }
            if (done) { b.life = 0; b.mesh.visible = false; }
          }
          muzzle.update(dt);
          // Paint on your visor when hit.
          screenHit = Math.max(0, screenHit - dt * 0.5); screen.material.opacity = screenHit * 0.85; screen.visible = screenHit > 0;
          if (screen.visible) { screen.position.copy(ctx.eye()).addScaledVector(ctx.forward(), 0.35); screen.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())); }
          if (!state.finished && (score[0] >= map.target || score[1] >= map.target)) {
            state.finished = true;
            const best = entities.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
            if (score[0] >= map.target) rewardFor(map, 40, `Time Azul venceu! Destaque: ${best.name}`); else say(`Time Vermelho venceu. Destaque: ${best.name}`, 6);
          }
          const ammo = weaponState.reload > 0 ? 'recarregando…' : `${weaponState.ammo}/${w.mag}`;
          return `${teamNames[0]} ${score[0]} × ${score[1]} ${teamNames[1]} · ${w.name} ${ammo} · ${player.alive ? (w.auto ? 'segure a pinça' : 'pince para atirar') : 'pintado'}`;
        },
        dispose() { removeUI(reloadBtn); watch.remove(reloadBtn); reloadBtn.userData.dispose?.(); flagCloth.length = 0; },
      };
    };

    // -------- Parkour: braços estilo gorila, plataformas móveis --------
    const parkourScene = map => {
      const surfaces = [], platforms = [];
      const mat = new Map();
      for (const b of map.blocks) {
        if (!mat.has(b.color)) mat.set(b.color, std({ color: b.color, roughness: 0.6, ...(map.theme.emissive ? { emissive: b.color, emissiveIntensity: 0.3 } : {}) }));
        const mesh = new THREE.Mesh(new RoundedBoxGeometry(b.w, b.h, b.d, 2, 0.06), mat.get(b.color)); mesh.position.set(b.x, b.y, b.z); world.add(mesh);
        const box = new THREE.Box3(V(b.x - b.w / 2, b.y - b.h / 2, b.z - b.d / 2), V(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2));
        surfaces.push(boxSurface(box)); platforms.push({ b, mesh, box, base: mesh.position.clone() });
        if (b.checkpoint && b !== map.blocks[0]) { const flag = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 12), std({ color: '#ffe14d', emissive: '#5a4a00' })); flag.position.set(b.x, b.y + 0.5, b.z); world.add(flag); }
      }
      const lava = new THREE.Mesh(new THREE.PlaneGeometry(400, 400, 20, 20).rotateX(-Math.PI / 2), std({ color: map.theme.id === 'neve' ? '#cfe7f7' : map.theme.id === 'praia' || map.theme.id === 'ilha' ? '#3aa6c9' : '#ff5a1f', emissive: map.theme.id === 'vulcao' || map.theme.id === 'neon' ? '#7a1a00' : '#000000', roughness: 0.4 }));
      lava.position.y = map.killY + 1; world.add(lava);
      const [fx, fy, fz] = map.finish;
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 10), std({ color: '#eeeeee', metalness: 0.6 })); flagPole.position.set(fx, fy + 1, fz); world.add(flagPole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), std({ color: '#2fdc6a', side: THREE.DoubleSide })); flag.position.set(fx + 0.36, fy + 1.75, fz); world.add(flag);
      const prevPlat = map.blocks[map.blocks.length - 2] || map.blocks[0];
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 10, 40, Math.PI), std({ map: patternTexture('checker', '#111111'), roughness: 0.5 })); arch.position.set(fx, fy, fz); arch.lookAt(V(prevPlat.x, fy, prevPlat.z)); world.add(arch);
      decorateArena(map, 0, { fence: false, lamps: false });
      const motion = new GorillaMotion(ctx, surfaces, () => true, { floor: -100, crouch: 0.4 });
      ctx.teleport({ enabled: true, walk: true });
      const state = { checkpoint: V(0, 0, 0), finished: false, falls: 0, time: 0, best: 0 };
      rig.position.set(0, -0.4, 0); ctx.app && (ctx.app.onTeleport = () => motion.reset());
      return {
        state, motion, platforms,
        update(dt, t) {
          for (const p of platforms) if (p.b.moving) {
            const off = Math.sin(t * p.b.moving.speed * 2) * p.b.moving.amp, prev = p.mesh.position.clone();
            p.mesh.position.copy(p.base); p.mesh.position[p.b.moving.axis] += off;
            const d = p.mesh.position.clone().sub(prev); p.box.translate(d);
            // Carry the player standing on it.
            const eye = ctx.eye(); if (Math.abs(rig.position.y + 0.4 - p.box.max.y) < 0.12 && eye.x > p.box.min.x && eye.x < p.box.max.x && eye.z > p.box.min.z && eye.z < p.box.max.z) rig.position.add(d);
          }
          // Desktop/VR Box without hands: Space or a tap jumps forward.
          const tap = ctx.pointers().some(p => p.pinchDown && !p.uiBusy && p.source !== 'hand' && p.source !== 'xr');
          if ((input.keys.has('Space') || tap) && Math.abs(motion.velocity.y) < 0.01) { const f = ctx.forward().setY(0).normalize(); motion.velocity.set(f.x * 3.2, 5.4, f.z * 3.2); input.keys.delete('Space'); }
          motion.update(dt);
          if (!state.finished) state.time += dt;
          const eye = ctx.eye();
          for (const p of platforms) if (p.b.checkpoint && Math.hypot(eye.x - p.b.x, eye.z - p.b.z) < p.b.w / 2 && rig.position.y > p.box.max.y - 0.6) state.checkpoint.set(p.b.x, p.box.max.y - 0.4, p.b.z);
          if (rig.position.y < map.killY) { state.falls++; motion.reset(); rig.position.copy(state.checkpoint); say('Caiu! Voltando ao último ponto', 1.5); audio.thud?.(); }
          if (!state.finished && Math.hypot(eye.x - fx, eye.z - fz) < 1.2 && rig.position.y > fy - 1) { state.finished = true; rewardFor(map, 35 + Math.min(30, map.blocks.length), `Concluído em ${state.time.toFixed(1)} s, ${state.falls} quedas`); }
          flag.rotation.y = Math.sin(t * 2) * 0.3;
          return state.finished ? 'Bandeira alcançada!' : `Parkour · ${state.time.toFixed(0)} s · quedas ${state.falls} · empurre com os braços ou Espaço`;
        },
        dispose() { motion.reset(); if (ctx.app) ctx.app.onTeleport = null; },
      };
    };

    // -------- Encontro: praça com objetos físicos, pista de dança e carro --------
    const hangoutScene = map => {
      ground(map.theme, map.half * 2 + 40); buildMapBlocks(world, map.blocks, map.theme); decorateArena(map, map.half);
      const water = new THREE.Mesh(new THREE.CircleGeometry(1.75, 32).rotateX(-Math.PI / 2), std({ color: '#5fc6ff', roughness: 0.05, transparent: true, opacity: 0.75 })); water.position.set(0, 0.62, 0); world.add(water);
      const spray = new Particles(world, { max: 120, size: 0.06 });
      const boxes = boxesOf(map.blocks);
      ctx.teleport({ enabled: true, walk: true, check: walkCheck(boxes) });
      rig.position.set(0, 0, 9);
      const physics = new RigidWorld({ floor: 0, limit: 24 });
      for (const b of boxes) physics.box([(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2], [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ]);
      const kinds = {
        ball: [new THREE.SphereGeometry(0.15, 20, 14), [0.3, 0.3, 0.3], 0.4, 0.75, 'sphere'], crate: [new RoundedBoxGeometry(0.4, 0.4, 0.4, 2, 0.04), [0.4, 0.4, 0.4], 2, 0.1, 'box'],
        cone: [new THREE.ConeGeometry(0.18, 0.5, 16), [0.36, 0.5, 0.36], 0.6, 0.2, 'box'], barrel: [barrelGeometry(0.22, 0.6), [0.44, 0.6, 0.44], 5, 0.1, 'box'],
      };
      for (const pr of map.props) {
        const [geom, size, mass, bounce, shape] = kinds[pr.kind];
        const mesh = new THREE.Mesh(geom, std({ color: map.theme.palette[Math.abs(Math.round(pr.x * 7)) % 5], roughness: 0.6 })); mesh.position.set(pr.x, size[1] / 2 + 0.2, pr.z); world.add(mesh);
        const body = physics.add(mesh, { size, mass, bounce, rotates: true, shape }); if (body) grabbable(ctx, physics, body);
      }
      const handsUpdate = trackHands(ctx, physics);
      // Dance floor tiles flash with a beat.
      const [dx, dz] = map.danceFloor, tiles = new THREE.InstancedMesh(new RoundedBoxGeometry(0.95, 0.06, 0.95, 1, 0.02), new THREE.MeshBasicMaterial({ toneMapped: false }), 25);
      const tm = new THREE.Matrix4(); for (let i = 0; i < 25; i++) { tiles.setMatrixAt(i, tm.makeTranslation(dx + (i % 5 - 2), 0.03, dz + (Math.floor(i / 5) - 2))); tiles.setColorAt(i, new THREE.Color('#ffffff')); }
      tiles.computeBoundingSphere(); world.add(tiles);
      // A car to drive around the plaza.
      const car = newCar(map.car[0], map.car[1], 0), carMesh = buildPlazaCar(wardrobe.look, { tex }); world.add(carMesh); placeCarMesh(carMesh, car);
      let driving = false, carButton = null;
      const toggleDrive = () => {
        driving = !driving;
        if (driving) { world.remove(carMesh); disposeTree(carMesh); const cockpit = buildPlazaCar(wardrobe.look, { cockpit: true, tex }); state.mesh = cockpit; world.add(cockpit); ctx.teleport({ enabled: false, walk: false }); }
        else { world.remove(state.mesh); disposeTree(state.mesh); state.mesh = buildPlazaCar(wardrobe.look, { tex }); world.add(state.mesh); rig.position.set(car.x + 2, 0, car.z); rig.rotation.set(0, 0, 0); ctx.teleport({ enabled: true, walk: true, check: walkCheck(boxes) }); }
        carButton.userData.setLabel(driving ? 'Sair do carro' : 'Dirigir'); state.driving = driving;
      };
      const state = { mesh: carMesh, time: 0, rewarded: false, driving: false };
      carButton = button(watch, 'Dirigir', 0, -0.09, 0, toggleDrive, { w: 0.3, h: 0.07 });
      const palette = map.theme.palette.map(c => new THREE.Color(c));
      // Other visitors: some dance on the floor, others stroll around the fountain.
      const npcs = Array.from({ length: ctx.lowEnd ? 4 : 8 }, (_, i) => {
        const mesh = buildAvatar({ skin: (i * 3) % 8, shirt: (i * 3) % 10, hair: (i * 5) % 8, hairColor: (i * 3) % 8, mouth: i % 5, hat: (i * 7) % 10, face: i % 7 }); world.add(mesh);
        const dancer = i % 2 === 0, home = dancer ? V(dx + (i % 3 - 1) * 1.2, 0, dz + (i % 4 - 1.5)) : V(0, 0, 0);
        const name = BOT_NAMES[(map.index * 3 + i) % BOT_NAMES.length], tag = label(mesh, name, 0, 1.95, 0, { w: 0.45, h: 0.07, size: 0.32 });
        mesh.position.copy(home); return { mesh, dancer, home, tag, angle: i * 0.8, radius: 6 + i % 3 };
      });
      return {
        state, physics, car,
        toggleDrive,
        update(dt, t) {
          state.time += dt;
          if (!state.rewarded && state.time > 60) { state.rewarded = true; rewardFor(map, 10, 'Um minuto na praça'); }
          if (driving) {
            const braking = ctx.pointers().some(p => p.pinch && !p.uiBusy) || input.keys.has('KeyS');
            stepFreeCar(car, { steer: keySteer() || steerFromHands(), throttle: input.keys.has('KeyS') ? 0 : 1, brake: braking }, dt, { boxes, bound: map.half + 10, vmax: 18 });
            seat(car);
            // The car shoves loose objects.
            physics.setHands([{ id: 'car', position: V(car.x, 0.4, car.z), velocity: V(-Math.sin(car.yaw), 0, -Math.cos(car.yaw)).multiplyScalar(car.v), radius: 1.2 }]);
          } else { gravityWalk(boxes, dt, state); handsUpdate(dt); }
          placeCarMesh(state.mesh, car);
          physics.update(dt);
          const eye = ctx.eye();
          for (const n of npcs) {
            const h = n.mesh.userData.hands, body = n.mesh.userData.body, near = Math.hypot(eye.x - n.mesh.position.x, eye.z - n.mesh.position.z) < 2.2;
            animateAvatar(n.mesh, t, dt);
            if (near) {
              // Visitors stop, face you and wave.
              n.mesh.rotation.y = Math.atan2(-(eye.x - n.mesh.position.x), -(eye.z - n.mesh.position.z));
              h[1].position.set(0.32, 1.55 + Math.sin(t * 9) * 0.04, -0.12); h[1].rotation.z = Math.sin(t * 9) * 0.5;
            } else if (n.dancer) { h[1].rotation.z = 0; body.position.y = 0.95 + Math.abs(Math.sin(t * 6.3 + n.angle)) * 0.08; n.mesh.rotation.y = Math.sin(t * 1.5 + n.angle) * 0.8; h[0].position.set(-0.32, 1.2 + Math.sin(t * 6.3) * 0.2, -0.16); h[1].position.set(0.32, 1.2 - Math.sin(t * 6.3) * 0.2, -0.16); }
            else { h[1].rotation.z = 0; n.angle += dt * 0.25; n.mesh.position.set(Math.cos(n.angle) * n.radius, 0, Math.sin(n.angle) * n.radius); n.mesh.rotation.y = Math.atan2(Math.sin(n.angle), -Math.cos(n.angle)); body.position.y = 1.0 + Math.abs(Math.sin(t * 5 + n.radius)) * 0.03; h[0].position.set(-0.3, 0.92 + Math.sin(t * 5) * 0.04, -0.16); h[1].position.set(0.3, 0.92 - Math.sin(t * 5) * 0.04, -0.16); }
            n.tag.lookAt(eye);
          }
          if (Math.random() < dt * 40) spray.spawn(V((Math.random() - 0.5) * 0.3, 0.7, (Math.random() - 0.5) * 0.3), V((Math.random() - 0.5) * 1.2, 2.5 + Math.random(), (Math.random() - 0.5) * 1.2), { life: 1.1, color: [0.75, 0.9, 1, 0.8], gravity: 4.5 });
          spray.update(dt);
          const beat = Math.floor(t * 2);
          if (beat !== state.beat) { state.beat = beat; for (let i = 0; i < 25; i++) tiles.setColorAt(i, palette[(i * 7 + beat) % palette.length]); tiles.instanceColor.needsUpdate = true; }
          return driving ? `Dirigindo · ${Math.round(Math.abs(car.v) * 3.6)} km/h · pinça freia` : 'Encontro · pince objetos · toque Dirigir no relógio';
        },
        dispose() { physics.setHands([]); removeUI(carButton); watch.remove(carButton); carButton.userData.dispose?.(); },
      };
    };

    // ---- online rooms: friends see your look; the host picks the room ----
    const net = ctx.app?.network;
    const offs = [];
    if (net) {
      const looks = new Map();
      net.peerBuilder = id => buildAvatar(looks.get(id) || {});
      offs.push(net.on?.('plaza-look', (look, id) => { looks.set(id, validLook(look)); net.rebuildPeer?.(id); }));
      offs.push(net.on?.('plaza-map', (data, id) => { if (id === net.host && Number.isInteger(data?.index) && data.index >= 0 && data.index < MAP_COUNT) enterMap(data.index); }));
    }
    let lookTimer = 0;

    enterDorm();
    return {
      wardrobe, enterMap, enterDorm,
      get scene() { return scene; },
      getState: () => ({ kind: scene?.kind, map: scene?.mapIndex ?? null, mode: scene?.map?.mode.id || null, tokens: wardrobe.tokens, look: { ...wardrobe.look }, ...(scene?.state ? { sub: scene.state } : {}) }),
      update(dt, t) {
        dt = Math.max(0, Math.min(dt, 0.05)); if (!dt) return;
        const status = scene?.update?.(dt, t || 0) || '';
        placeWatch();
        feedbackLife = Math.max(0, feedbackLife - dt);
        if (net?.room && (lookTimer -= dt) <= 0) { lookTimer = 5; net.sendEvent('plaza-look', wardrobe.look); }
        const title = scene?.kind === 'map' ? `${scene.map.mode.icon} ${scene.map.name}` : `Praça BlueNav · ${wardrobe.tokens} fichas`;
        ctx.hud(title, feedbackLife > 0 ? feedback : status || 'Guarda-roupa à esquerda · salas à direita');
      },
      dispose() { scene?.dispose?.(); offs.forEach(off => off?.()); if (net) net.peerBuilder = null; },
    };
  },
};
