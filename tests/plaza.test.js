import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.matchMedia ??= () => ({ matches: false }); globalThis.screen ??= { width: 1920, height: 1080 }; globalThis.window ??= { addEventListener() {} };
import { MAP_COUNT, MODES, THEMES, generateMap, listMaps, trackPoints, distanceToTrack, PARKOUR_LIMITS } from '../src/games/plaza/maps.js';
import { Wardrobe, COSMETICS, SKIN_COUNT, validLook } from '../src/games/plaza/cosmetics.js';
import { newCar, stepFreeCar, bumpCars, aiControl } from '../src/games/plaza/freeCar.js';

test('there are 500 distinct, deterministic maps covering every mode and theme', () => {
  assert.equal(MAP_COUNT, 500);
  const ids = new Set(), names = new Set(), combos = new Set();
  for (let i = 0; i < MAP_COUNT; i++) {
    const m = generateMap(i);
    ids.add(m.id); names.add(m.name); combos.add(m.mode.id + m.theme.id);
    assert.ok(m.blocks.length > 0, `${m.id} has geometry`);
    for (const b of m.blocks) assert.ok([b.x, b.y, b.z, b.w, b.h, b.d].every(Number.isFinite) && b.w > 0 && b.h > 0 && b.d > 0, `${m.id} block`);
  }
  assert.equal(ids.size, 500); assert.equal(names.size, 500);
  assert.equal(combos.size, MODES.length * THEMES.length);
  assert.deepEqual(JSON.stringify(generateMap(123)), JSON.stringify(generateMap(123)));
  assert.throws(() => generateMap(500)); assert.throws(() => generateMap(-1));
  for (const mode of MODES) assert.ok(listMaps({ mode: mode.id }).length >= 120, mode.id);
  assert.equal(listMaps({ query: '42' })[0].index, 41);
});

test('race maps: closed track, scenery never on the road, cars start on it', () => {
  for (const m of listMaps({ mode: 'corrida' })) {
    const pts = trackPoints(m, 160);
    for (const b of m.blocks) assert.ok(distanceToTrack(pts, b.x, b.z) > m.width / 2 + 1, `${m.id}: block on the road`);
    assert.ok(distanceToTrack(pts, pts[0][0], pts[0][1]) < 0.01);
    assert.ok(m.width >= 9 && m.laps === 3);
  }
});

test('parkour maps: every jump is within reach and the flag sits on the last platform', () => {
  for (const m of listMaps({ mode: 'parkour' })) {
    const plats = m.blocks.filter(b => b.kind === 'platform').slice(1);
    for (const p of plats) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), `${m.id}: position`); assert.ok(p.gap <= PARKOUR_LIMITS.gap + 1e-9, `${m.id}: gap ${p.gap}`); assert.ok(p.rise <= PARKOUR_LIMITS.rise + 1e-9); }
    const last = plats[plats.length - 1];
    assert.deepEqual([m.finish[0], m.finish[2]], [last.x, last.z]);
    assert.ok(plats.length >= 12);
  }
});

test('paintball maps are mirrored so both teams get the same cover', () => {
  for (const m of listMaps({ mode: 'paintball' })) {
    const covers = m.blocks.filter(b => b.kind === 'cover' && (b.x || b.z));
    for (const c of covers) assert.ok(covers.some(o => o.x === -c.x && o.z === -c.z && o.w === c.w), `${m.id}: unmirrored cover`);
    for (const [x, z] of m.bases) assert.ok(!m.blocks.some(b => b.kind === 'cover' && Math.abs(b.x - x) < b.w / 2 + 0.3 && Math.abs(b.z - z) < b.d / 2 + 0.3), `${m.id}: base blocked`);
  }
});

test('wardrobe: free items equip, paid items need tokens, rewards pay more the first time, data persists', () => {
  const store = new Map(), storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const w = new Wardrobe(storage);
  assert.ok(SKIN_COUNT >= 50);
  assert.equal(w.choose('paint', 1).ok, true);
  const crown = COSMETICS.hat.findIndex(h => h[0] === 'Coroa');
  assert.equal(w.choose('hat', crown).ok, false);
  assert.equal(w.reward(7, 200), 200); assert.equal(w.reward(7, 200), 50);
  assert.equal(w.choose('hat', crown).ok, true); assert.ok(w.owns('hat', crown));
  const again = new Wardrobe(storage);
  assert.equal(again.look.hat, crown); assert.equal(again.tokens, w.tokens); assert.ok(again.completed.has(7));
  assert.equal(validLook({ hat: 999, skin: -1, paint: 2.5 }).hat, 0); assert.equal(validLook({ hair: 3 }).hair, 3);
  storage.setItem('bluenav.plaza', '{broken'); assert.equal(new Wardrobe(storage).tokens, 50);
});

test('free car: accelerates, turns right with positive steer, stops at walls and bumps other cars', () => {
  const car = newCar(0, 0, 0);
  for (let i = 0; i < 120; i++) stepFreeCar(car, { throttle: 1 }, 1 / 60);
  assert.ok(car.v > 10 && car.z < -5);
  const turn = newCar(0, 0, 0); turn.v = 10;
  for (let i = 0; i < 30; i++) stepFreeCar(turn, { throttle: 1, steer: 1 }, 1 / 60);
  assert.ok(turn.x > 0.5, `right ${turn.x}`);
  const wall = newCar(0, 0, 0); wall.v = 20;
  for (let i = 0; i < 60; i++) stepFreeCar(wall, { throttle: 1 }, 1 / 60, { boxes: [{ minX: -5, maxX: 5, minZ: -6, maxZ: -4 }] });
  assert.ok(wall.z >= -4 + 1.1 - 1e-6 - 0.01 || wall.z > -4, `stopped ${wall.z}`); assert.ok(wall.v < 20);
  const a = newCar(0, 0), b = newCar(1, 0); a.v = 10; assert.ok(bumpCars(a, b)); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 2.2 - 1e-9); assert.ok(b.v > 0);
  const ai = aiControl(newCar(0, 0, 0), [10, -10]); assert.ok(ai.steer > 0, 'target to the right');
});

test('bot navigation finds a path around cover and never through it', async () => {
  const { buildGrid, findPath, isFree } = await import('../src/games/plaza/nav.js');
  const wall = { minX: -4, maxX: 4, minZ: -0.5, maxZ: 0.5, maxY: 2 };
  const grid = buildGrid([wall], 10);
  const path = findPath(grid, [0, -3], [0, 3]);
  assert.ok(path && path.length >= 3, 'detour');
  for (let k = 1; k < path.length; k++) for (let t = 0; t <= 1; t += 0.05) {
    const x = path[k - 1][0] + (path[k][0] - path[k - 1][0]) * t, z = path[k - 1][1] + (path[k][1] - path[k - 1][1]) * t;
    assert.ok(!(x > wall.minX && x < wall.maxX && z > wall.minZ && z < wall.maxZ), 'through the wall');
  }
  assert.equal(isFree(grid, 0, 0), false); assert.equal(isFree(grid, 0, 5), true);
  const sealed = buildGrid([{ minX: -10, maxX: 10, minZ: -0.5, maxZ: 0.5, maxY: 2 }], 10);
  assert.equal(findPath(sealed, [0, -3], [0, 3]), null);
});

test('weapons: balanced stats and a model for each', async () => {
  const { WEAPONS } = await import('../src/games/plaza/weapons.js');
  for (const [id, w] of Object.entries(WEAPONS)) { assert.ok(w.mag > 0 && w.rate > 0 && w.reload > 0 && w.pellets >= 1, id); }
  assert.ok(WEAPONS.fuzil.auto && !WEAPONS.pistola.auto && WEAPONS.escopeta.pellets > 1);
});

test('mirror: reflected eye behind the glass and a frustum that exactly covers it', async () => {
  const THREE = await import('three');
  const { mirrorFrustum } = await import('../src/games/plaza/mirror.js');
  const glass = { planeZ: -5.8, cx: 0, cy: 1.2, w: 1.5, h: 2.1 };
  const f = mirrorFrustum(new THREE.Vector3(0.3, 1.6, -3.8), glass);
  assert.ok(Math.abs(f.virtualEye.z - -7.8) < 1e-9 && f.virtualEye.x === 0.3 && Math.abs(f.near - 2) < 1e-9);
  // The camera looks toward +z, so its right edge is the glass at world x = -0.75.
  assert.ok(Math.abs(f.right - 1.05) < 1e-9 && Math.abs(f.left - -0.45) < 1e-9);
  assert.ok(Math.abs(f.top - 0.65) < 1e-9 && Math.abs(f.bottom - -1.45) < 1e-9);
  assert.equal(mirrorFrustum(new THREE.Vector3(0, 1.6, -5.9), glass), null, 'behind the glass');
});
