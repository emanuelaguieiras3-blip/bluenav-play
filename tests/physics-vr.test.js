import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RigidWorld } from '../src/games/rigidWorld.js';
import { gamepadIntent, deadAxis } from '../src/core/gamepad.js';
import { readXRHand, XR_JOINTS } from '../src/core/xrHands.js';
import { ArmMotion } from '../src/games/armMotion.js';
import { Input } from '../src/core/input.js';

test('physics gives consistent falls at 30, 60 and 120 Hz', () => {
  const results = [];
  for (const hz of [30, 60, 120]) {
    const world = new RigidWorld(), mesh = new THREE.Object3D(); mesh.position.y = 4;
    const b = world.add(mesh, { bounce: 0.4 });
    for (let i = 0; i < hz; i++) world.update(1 / hz);
    results.push([mesh.position.y, b.velocity.y]);
  }
  for (const result of results) assert.ok(Math.abs(result[0] - results[0][0]) < 1e-6 && Math.abs(result[1] - results[0][1]) < 1e-6);
});
test('thrown body does not pass through thin wall, and body count is bounded', () => {
  const w = new RigidWorld({ gravity: 0, limit: 1 }), m = new THREE.Object3D(); m.position.set(-0.4, 1, 0);
  w.box([0, 1, 0], [0.025, 2, 2]); const b = w.add(m, { size: [0.12, 0.12, 0.12] });
  w.release(b, new THREE.Vector3(80, 0, 0));
  assert.equal(b.velocity.x, 8); assert.equal(w.add(new THREE.Object3D()), null);
  for (let i = 0; i < 10; i++) w.update(1 / 30);
  assert.ok(m.position.x < -0.07); assert.ok(b.velocity.x <= 0);
});
test('stacked bodies settle above ground without persistent overlap', () => {
  const world = new RigidWorld();
  for (let i = 0; i < 3; i++) { const m = new THREE.Object3D(); m.position.set(0, 0.1 + i * 0.21, 0); world.add(m, { bounce: 0 }); }
  for (let i = 0; i < 600; i++) world.update(1 / 120);
  const ys = world.bodies.map(b => b.mesh.position.y).sort((a, b) => a - b);
  assert.ok(ys[0] > 0.095); assert.ok(ys[1] - ys[0] > 0.195); assert.ok(ys[2] - ys[1] > 0.195);
});
test('XR thumbsticks use correct axes and Bluetooth pad stops on disconnect', () => {
  assert.equal(deadAxis(NaN), 0); assert.equal(deadAxis(0.15), 0);
  const sources = [{ handedness: 'left', gamepad: { axes: [0, 0, 1, -1] } }, { handedness: 'right', gamepad: { axes: [0, 0, -1, 0] } }];
  const intent = gamepadIntent(sources); assert.ok(Math.abs(Math.hypot(intent.x, intent.forward) - 1) < 1e-6); assert.equal(intent.turn, -1);
  assert.equal(gamepadIntent([sources[1]]).x, -1);
  const bluetooth = { connected: true, axes: [0, -1, 0], buttons: [{ pressed: true }] };
  assert.equal(gamepadIntent([], [bluetooth]).forward, 1); assert.equal(gamepadIntent([], [bluetooth]).select, true);
  bluetooth.connected = false; assert.equal(gamepadIntent([], [bluetooth]).forward, 0);
  assert.equal(gamepadIntent(sources, [{ ...bluetooth, connected: true }]).select, false);
});
test('native XR hand maps all joints through rig and uses pinch hysteresis', () => {
  const hand = new Map(XR_JOINTS.map(name => [name, name]));
  let separation = 0.02;
  const frame = { getJointPose(name) { return { transform: { position: { x: name === 'thumb-tip' ? separation : 0, y: 1 + XR_JOINTS.indexOf(name) * 0.001, z: -0.4 } } }; } };
  const matrix = new THREE.Matrix4().makeTranslation(3, 0, 2);
  const source = { hand, handedness: 'left' };
  const h = readXRHand(source, frame, {}, matrix); assert.equal(h.points.length, 21); assert.equal(h.points[0].x, 3); assert.equal(h.points[0].z, 1.6); assert.equal(h.gesture, 'pinça');
  separation = 0.03; assert.equal(readXRHand(source, frame, {}, matrix, true).gesture, 'pinça'); assert.equal(readXRHand(source, frame, {}, matrix, false).gesture, 'aberta');
  assert.equal(readXRHand(source, { getJointPose: () => null }, {}, matrix), null);
});
test('arm motion pushes from touched floor and never uses distant branch as ground', () => {
  const rig = new THREE.Group(), camera = new THREE.Object3D(); camera.position.set(0, 1.6, 0); rig.add(camera);
  const p = { id: 'right', source: 'xr', handPos: new THREE.Vector3(0, 0.13, -0.3), pinch: false };
  const ctx = { rig, pointers: () => [p], eye: () => camera.getWorldPosition(new THREE.Vector3()) };
  const distant = new THREE.Box3(new THREE.Vector3(4, 1, 4), new THREE.Vector3(5, 2, 5));
  const arm = new ArmMotion(ctx, [distant], () => true);
  arm.update(1 / 60); p.handPos.y -= 0.02; arm.update(1 / 60); assert.ok(rig.position.y > 0);
  arm.reset(); rig.position.y = 3; ctx.pointers = () => []; arm.update(1 / 60); assert.ok(rig.position.y < 3); assert.ok(rig.position.y > 2.9);
});

test('Input consumes native XR joints, releases pinch and removes lost hand', () => {
  globalThis.window = { addEventListener() {} };
  const rig = new THREE.Group(), camera = new THREE.PerspectiveCamera(); camera.position.y = 1.6; rig.add(camera);
  const source = { hand: new Map(XR_JOINTS.map(n => [n, n])), handedness: 'right' }, session = { inputSources: [source] };
  const app = { rig, camera, mode: 'xr', audio: { unlock() {} }, renderer: { domElement: { addEventListener() {} }, xr: { isPresenting: true, getSession: () => session, getReferenceSpace: () => ({}) } } };
  let separation = 0.02;
  const frame = { getJointPose(name) { return { transform: { position: { x: name === 'thumb-tip' ? separation : 0, y: 1 + XR_JOINTS.indexOf(name) * 0.001, z: -0.4 } } }; } };
  const input = new Input(app); input.update(1 / 60, frame);
  assert.equal(input.source, 'hand'); assert.equal(input.pointers.length, 1); assert.equal(input.pointers[0].pinchDown, true);
  separation = 0.06; input.update(1 / 60, frame); assert.equal(input.pointers[0].pinchUp, true);
  session.inputSources = []; input.update(1 / 60, frame); assert.equal(input.hands.length, 0); assert.equal(input.source, 'gaze'); assert.equal(input.pinch, false);
});
