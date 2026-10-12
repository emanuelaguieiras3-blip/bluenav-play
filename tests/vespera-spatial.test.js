import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpatialWorld, terrainHeight, terrainKind } from '../vespera-rpg2/vr-world.js';

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
    assert.ok(Math.abs(spatial.root.position.x + 0.2) < 1e-8);
    world.monsters.goblin.x = 300;
    spatial.update(1 / 60);
    assert.equal(spatial.interactables.length, 0);
  } finally {
    spatial.dispose(); globalThis.window = previousWindow; globalThis.document = previousDocument;
  }
});
