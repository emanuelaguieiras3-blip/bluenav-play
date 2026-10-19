// Spatial WebXR view of the live Véspera simulation. The 2D engine remains
// authoritative for movement, collision, combat, quests, saves and networking.
import * as THREE from './vendor/three.module.js';
import { createActor, disposeActor } from './vr-actors.js';

const RADIUS = 12;
const SIDE = RADIUS * 2 + 1;
// RPG directions: south, west, east, north. Models look along local -Z.
export function actorYaw(direction) { return [0, Math.PI / 2, -Math.PI / 2, Math.PI][direction] ?? 0; }

function noise(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.013) * 43758.5453;
  return n - Math.floor(n);
}

export function terrainKind(tile) {
  if (!tile) return 'earth';
  if (tile.kind === 'water') return 'water';
  if (tile.kind === 'lava') return 'lava';
  if (tile.kind === 'road' || tile.road || tile.kind === 'bridge') return 'road';
  if (tile.kind === 'sand' || tile.biome === 3) return 'sand';
  if (tile.kind === 'snow' || tile.biome === 4) return 'snow';
  if (tile.kind === 'farm') return 'farm';
  if (tile.underground || ['wall', 'stal', 'seal'].includes(tile.kind)) return 'stone';
  return 'grass';
}

export function terrainHeight(tile, x, y, seed) {
  const kind = terrainKind(tile);
  if (kind === 'water' || kind === 'lava') return -0.11;
  if (kind === 'road' || kind === 'farm') return 0;
  return (noise(x, y, seed) - 0.5) * 0.065;
}

function grainTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d'), image = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const i = (y * 128 + x) * 4, n = Math.round(214 + noise(x, y, 83) * 41);
    image.data[i] = n; image.data[i + 1] = n; image.data[i + 2] = n; image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(12, 12);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function instanced(geometry, material, capacity, parent) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}

function setInstances(mesh, positions, scale = [1, 1, 1]) {
  const dummy = new THREE.Object3D(); mesh.count = positions.length;
  positions.forEach(([x, y, z, s = 1], i) => {
    dummy.position.set(x, y, z); dummy.scale.set(scale[0] * s, scale[1] * s, scale[2] * s);
    dummy.rotation.y = noise(x, z) * Math.PI * 2; dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
}

export function createSpatialWorld(scene, getSession) {
  const root = new THREE.Group(); root.name = 'vespera-spatial-world'; scene.add(root);
  const groundGeometry = new THREE.PlaneGeometry(SIDE, SIDE, SIDE, SIDE).rotateX(-Math.PI / 2);
  const colors = new Float32Array(groundGeometry.attributes.position.count * 3);
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const grain = grainTexture();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ map: grain, vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  ground.receiveShadow = true; root.add(ground);
  const bark = new THREE.MeshStandardMaterial({ color: '#644631', roughness: 1, map: grain });
  const leaves = new THREE.MeshStandardMaterial({ color: '#39734d', roughness: 1, map: grain });
  const stone = new THREE.MeshStandardMaterial({ color: '#8d8990', roughness: 1, map: grain });
  const water = new THREE.MeshStandardMaterial({ color: '#3d9bb7', roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.82 });
  const masonry = new THREE.MeshStandardMaterial({ color: '#a29883', roughness: 0.94, map: grain });
  const roof = new THREE.MeshStandardMaterial({ color: '#665a52', roughness: 0.91, map: grain });
  const trunkMesh = instanced(new THREE.CylinderGeometry(0.12, 0.19, 1.6, 9), bark, SIDE * SIDE, root);
  const crownMesh = instanced(new THREE.ConeGeometry(0.72, 2.1, 10), leaves, SIDE * SIDE, root);
  const rockMesh = instanced(new THREE.IcosahedronGeometry(0.5, 1), stone, SIDE * SIDE, root);
  const waterMesh = instanced(new THREE.CircleGeometry(0.74, 16).rotateX(-Math.PI / 2), water, SIDE * SIDE, root);
  const buildingMesh = instanced(new THREE.CylinderGeometry(0.53, 0.61, 1.7, 10), masonry, SIDE * SIDE, root);
  const roofMesh = instanced(new THREE.ConeGeometry(0.74, 0.72, 10), roof, SIDE * SIDE, root);
  const actors = new Map(), interactables = [];
  let centerX = Infinity, centerY = Infinity, worldSeed = null, elapsed = 0, refresh = 0, harvestCount = -1;

  function rebuild(world, x0, y0) {
    centerX = x0; centerY = y0; worldSeed = world.seed; refresh = 0;
    harvestCount = Object.keys(world.harvested || {}).length;
    const V = window.Vespera, palette = {
      earth: '#736f56', grass: '#698c61', road: '#8f8267', sand: '#bc9d73', snow: '#cbdce3',
      water: '#4b9bb4', lava: '#d16b3e', farm: '#7a6044', stone: '#6e707a',
    };
    const trunks = [], crowns = [], rocks = [], waters = [], buildings = [], roofs = [];
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const lx = positions.getX(i), lz = positions.getZ(i), wx = Math.floor(x0 + lx), wy = Math.floor(y0 - lz);
      const tile = V.tileAt(wx, wy, world.seed), kind = terrainKind(tile), color = new THREE.Color(palette[kind]);
      const shade = 0.83 + noise(wx, wy, world.seed) * 0.34;
      color.multiplyScalar(shade); colors.set(color.toArray(), i * 3);
      positions.setY(i, terrainHeight(tile, wx, wy, world.seed));
    }
    positions.needsUpdate = true; groundGeometry.attributes.color.needsUpdate = true; groundGeometry.computeVertexNormals();
    for (let dy = -RADIUS; dy <= RADIUS; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const wx = x0 + dx, wy = y0 + dy, tile = V.tileAt(wx, wy, world.seed);
      const x = dx + 0.5, z = -(dy + 0.5), harvested = world.harvested?.[`${wx},${wy}`] > world.time;
      if (tile.kind === 'tree' && !harvested) {
        const size = 0.72 + noise(wx, wy, 5) * 0.52;
        trunks.push([x, 0.77 * size, z, size]); crowns.push([x, 2.15 * size, z, size]);
      } else if (tile.kind === 'rock' && !harvested || ['wall', 'stal'].includes(tile.kind)) {
        rocks.push([x, tile.kind === 'rock' ? 0.27 : 0.75, z, tile.kind === 'rock' ? 0.65 : 1.4]);
      } else if (tile.kind === 'water') waters.push([x, -0.075, z, 1.0]);
      else if (tile.kind === 'building' || tile.kind === 'citywall' || tile.kind === 'seal') {
        const scale = tile.kind === 'citywall' ? 1.45 : 1;
        buildings.push([x, 0.85 * scale, z, scale]);
        if (tile.kind === 'building') roofs.push([x, 2.04, z, 1]);
      }
    }
    setInstances(trunkMesh, trunks); setInstances(crownMesh, crowns); setInstances(rockMesh, rocks);
    setInstances(waterMesh, waters); setInstances(buildingMesh, buildings); setInstances(roofMesh, roofs);
  }

  function updateActors(world, player, time) {
    const visible = new Set(); interactables.length = 0;
    const V = window.Vespera, me = player.id;
    const add = (id, kind, entity, tint) => {
      if (!entity || Math.abs(entity.x - player.x) > RADIUS || Math.abs(entity.y - player.y) > RADIUS) return;
      visible.add(id);
      const signature = kind === 'monster' ? entity.kind : JSON.stringify([entity.classId, entity.appearance, entity.look, entity.equipment, entity.isekai?.chosen, entity.isekai?.race, tint]);
      let record = actors.get(id);
      if (!record || record.appearance !== signature) {
        if (record) { disposeActor(record.group); root.remove(record.group); }
        const group = createActor(tint, kind === 'monster' ? entity.kind : '', false, kind !== 'monster' ? entity : null, V.items); root.add(group);
        group.userData.entityId = id;
        record = { group, kind, appearance: signature, x: entity.x, y: entity.y }; actors.set(id, record);
      }
      const dx = entity.x - record.x, dy = entity.y - record.y;
      const moving = Math.hypot(dx, dy) > .001;
      record.x = entity.x; record.y = entity.y;
      const floating = record.group.userData.shape === 'spirit';
      record.group.position.set(entity.x - centerX, floating ? .08 + Math.sin(time * 2.2 + entity.x) * .06 : .025, centerY - entity.y);
      record.group.userData.limbs.forEach((limb, i) => { limb.rotation.x = moving ? Math.sin(time * 9 + (limb.userData.walkPhase ?? i * Math.PI)) * .3 : 0; });
      const attackAge = world.time - entity.attackAt;
      if (kind === 'player' && record.group.userData.weaponArm && attackAge >= 0 && attackAge < .48) {
        record.group.userData.weaponArm.rotation.x -= Math.sin(attackAge / .48 * Math.PI) * .9;
      }
      record.group.rotation.y = kind === 'player' ? actorYaw(entity.dir) : kind === 'npc' && moving ? Math.atan2(-dx, dy) : Math.atan2(entity.x - player.x, player.y - entity.y);
      if (kind !== 'player') interactables.push({ mesh: record.group.userData.body, kind, entity });
    };
    for (const monster of Object.values(world.monsters || {})) {
      if (monster.hp <= 0) continue;
      const tint = V.monsterTypes?.[monster.kind]?.color || '#a36c78';
      add(`monster:${monster.id}`, 'monster', monster, tint);
    }
    for (const other of Object.values(world.players || {})) if (other.id !== me && other.online !== false) {
      add(`player:${other.id}`, 'player', other, V.classById?.[other.classId]?.color || '#c49a6c');
    }
    for (const npc of V.npcsAt?.(world, player) || []) if (!npc.inside) add(`npc:${npc.id}`, 'npc', npc, '#927e66');
    for (const [id, record] of actors) if (!visible.has(id)) {
      disposeActor(record.group); root.remove(record.group); actors.delete(id);
    }
  }

  return {
    root,
    get interactables() { return interactables; },
    update(dt) {
      const session = getSession(), world = session?.world, player = session?.player;
      if (!session?.playing || !world || !player || !window.Vespera) { root.visible = false; return; }
      root.visible = true; elapsed += Math.min(dt || 0, 0.05);
      const x = Math.floor(player.x), y = Math.floor(player.y);
      refresh += Math.min(dt || 0, 0.05);
      if (x !== centerX || y !== centerY || world.seed !== worldSeed || refresh > 4 ||
          Object.keys(world.harvested || {}).length !== harvestCount) rebuild(world, x, y);
      root.position.set(centerX - player.x, 0, player.y - centerY);
      updateActors(world, player, elapsed);
      root.updateMatrixWorld(true);
      scene.background.set(terrainKind(window.Vespera.tileAt(x, y, world.seed)) === 'stone' ? '#202531' : '#83b3c9');
      if (!scene.fog) scene.fog = new THREE.Fog(scene.background, 13, 29);
      else scene.fog.color.copy(scene.background);
    },
    dispose() {
      for (const record of actors.values()) { disposeActor(record.group); root.remove(record.group); }
      actors.clear(); interactables.length = 0;
      scene.remove(root);
      const geometries = new Set(), materials = new Set();
      root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      grain.dispose();
    },
  };
}
