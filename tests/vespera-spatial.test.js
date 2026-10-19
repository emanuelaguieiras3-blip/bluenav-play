import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpatialWorld, terrainHeight, terrainKind, actorYaw } from '../vespera-rpg2/vr-world.js';

test('Véspera: orientação 3D respeita sul/oeste/leste/norte do motor RPG', () => {
  const expected = [[0, 0, -1], [-1, 0, 0], [1, 0, 0], [0, 0, 1]];
  expected.forEach((direction, i) => {
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, actorYaw(i), 0));
    assert.ok(forward.distanceTo(new THREE.Vector3(...direction)) < 1e-8);
  });
});

test('Véspera: terreno 3D segue tipo de solo e mantém altura determinística', () => {
  assert.equal(terrainKind({ kind: 'water' }), 'water');
  assert.equal(terrainKind({ kind: 'road' }), 'road');
  assert.equal(terrainKind({ kind: 'grass', biome: 4 }), 'snow');
  assert.equal(terrainHeight({ kind: 'water' }, 4, 8, 2), -0.11);
  assert.equal(terrainHeight({ kind: 'tree' }, 4, 8, 2), terrainHeight({ kind: 'tree' }, 4, 8, 2));
});

test('Véspera: cena espacial acompanha estado real e remove criaturas distantes', () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  globalThis.document = { createElement() { return { width: 0, height: 0, getContext() { return {
    createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
    putImageData() {}, drawImage() {},
  }; } }; } };
  const player = { id: 'me', x: 128.2, y: 130.6 };
  const world = { seed: 123, time: 0, harvested: {}, players: { me: player },
    monsters: { goblin: { id: 'goblin', kind: 'goblin', hp: 10, x: 129, y: 130 } } };
  globalThis.window = { Vespera: {
    tileAt(x, y) { return { kind: x === 129 && y === 130 ? 'rock' : x === 127 && y === 130 ? 'water' : 'tree' }; },
    monsterTypes: { goblin: { color: '#4c9d52' } }, npcDefs: [],
  } };
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#fff');
  const spatial = createSpatialWorld(scene, () => ({ world, player, playing: true }));
  try {
    spatial.update(1 / 60);
    assert.equal(spatial.root.visible, true);
    assert.ok(spatial.root.children.some(child => child.isMesh && child.geometry.type === 'PlaneGeometry'));
    assert.equal(spatial.interactables.length, 1);
    const monster = spatial.root.children.find(object => object.userData.shape);
    const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(monster.quaternion);
    const toward = new THREE.Vector3(player.x - world.monsters.goblin.x, 0, world.monsters.goblin.y - player.y).normalize();
    assert.ok(facing.dot(toward) > .99, 'criatura olha para o jogador, não dá as costas');
    assert.ok(Math.abs(spatial.root.position.x + 0.2) < 1e-8);
    world.monsters.goblin.x = 300;
    spatial.update(1 / 60);
    assert.equal(spatial.interactables.length, 0);
    world.players.other = { id: 'other', x: 129, y: 131, classId: 'mago', appearance: 'female', equipment: {} };
    spatial.update(1 / 60);
    const before = spatial.root.children.find(object => object.name === 'vespera-person');
    assert.ok(before.userData.details.includes('staff'));
    spatial.update(1 / 60);
    assert.equal(spatial.root.children.find(object => object.name === 'vespera-person'), before, 'não recria recursos sem alteração visual');
    let released = false; before.userData.body.geometry.addEventListener('dispose', () => released = true);
    world.players.other.equipment.weapon = 'arco-1';
    spatial.update(1 / 60);
    const after = spatial.root.children.find(object => object.name === 'vespera-person');
    assert.notEqual(after, before); assert.ok(released); assert.ok(after.userData.details.includes('bow'));
    const npc = { id: 'walking', x: 129, y: 132, classId: 'bardo', look: { item: 'none' } };
    globalThis.window.Vespera.npcsAt = () => [npc]; spatial.update(1 / 60);
    npc.x += .1; spatial.update(1 / 60);
    const walking = spatial.root.children.find(object => object.userData.entityId === 'npc:walking');
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(walking.quaternion);
    assert.ok(forward.x > .99, 'NPC olha na direção do deslocamento, sem andar de costas');
  } finally {
    spatial.dispose(); globalThis.window = previousWindow; globalThis.document = previousDocument;
  }
});
