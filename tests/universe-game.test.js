import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
globalThis.window = { devicePixelRatio: 1 };
globalThis.matchMedia = () => ({ matches: false });
globalThis.screen = { width: 1920, height: 1080 };
globalThis.document = { createElement: () => ({ getContext: () => ({
  createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
}) }) };
const { default: universe } = await import('../src/games/universe.js');

function fixture(network = null) {
  const root = new THREE.Group(), objectives = [], input = { keys: new Set() };
  const texture = new THREE.Texture(); texture.userData.shared = true;
  const ctx = { THREE, root, input, lowEnd: true, app: { network },
    tex: { get: () => texture }, env: { set() {} }, audio: { thud() {}, success() {} },
    button: () => { const object = new THREE.Group(); object.userData.setLabel = () => {}; return object; },
    label: () => new THREE.Group(), pointers: () => [], teleport() {}, hud() {},
    objective: text => objectives.push(text) };
  return { ctx, root, objectives, texture };
}

test('Universe Sandbox: preset de impacto produz choque, detritos e objetivo', () => {
  const { ctx, root, objectives, texture } = fixture(), game = universe.create(ctx);
  game.preset('impact');
  for (let i = 0; i < 240 && !game.state.impactSeen; i++) game.update(1 / 60);
  assert.ok(game.state.impactSeen, 'meteoro atinge planeta');
  assert.equal(game.state.lastImpactType, 'planet', 'o meteoro atinge a Terra, não a Lua');
  const effects = root.getObjectByName('universe-effects');
  assert.ok(effects.children.some(group => group.children.some(mesh => mesh.geometry?.type === 'TorusGeometry')));
  const ring = effects.children.flatMap(group => group.children).find(mesh => mesh.geometry?.type === 'TorusGeometry');
  for (let i = 0; i < 20; i++) game.update(1 / 60);
  const planet = game.state.bodies.find(body => body.type === 'planet');
  assert.ok(Math.abs(ring.position.distanceTo(new THREE.Vector3(planet.position.x, planet.position.y, planet.position.z)) - planet.radius) < 0.02,
    'onda de impacto permanece na superfície enquanto o planeta se move');
  const crater = root.getObjectByName(`celestial-${planet.id}`).children.find(mesh => mesh.geometry?.type === 'CircleGeometry');
  assert.ok(crater.getWorldPosition(new THREE.Vector3()).distanceTo(ring.position) < 0.03,
    'onda acompanha a cratera enquanto o planeta gira');
  assert.ok(game.state.complete, 'estrela, planeta, lua e impacto concluem objetivo');
  assert.ok(objectives.at(-1).includes('concluído'));
  texture.dispose();
});

test('Universe Sandbox: preset de maré cria fluxo ligado a estrela e buraco negro', () => {
  const { ctx, root, texture } = fixture(), game = universe.create(ctx);
  game.preset('tidal'); game.update(1 / 60);
  assert.ok(game.state.tidalSeen);
  assert.ok(root.getObjectByName('universe-effects').children.some(child => child.type === 'Line'));
  texture.dispose();
});

test('Universe Sandbox: host valida comandos e envia a mesma simulação ao convidado', () => {
  const endpoints = [];
  function endpoint(id) {
    const handlers = new Map();
    const net = { id, host: 'host', room: 'ROOM12', handlers,
      on(name, callback) { handlers.set(name, callback); return () => handlers.delete(name); },
      sendEvent(name, data) { for (const other of endpoints) if (other !== net) other.handlers.get(name)?.(data, id); } };
    endpoints.push(net); return net;
  }
  const host = fixture(endpoint('host')), guest = fixture(endpoint('guest'));
  const hostGame = universe.create(host.ctx), guestGame = universe.create(guest.ctx);
  guestGame.spawn('star', { x: -2, y: 1, z: -8 });
  assert.equal(hostGame.state.bodies.length, 4);
  guestGame.spawn('planet', { x: Infinity, y: 1, z: -8 });
  assert.equal(hostGame.state.bodies.length, 4, 'posição inválida recusada pelo host');
  for (let i = 0; i < 15; i++) { hostGame.update(1 / 60); guestGame.update(1 / 60); }
  assert.equal(guestGame.state.bodies.length, hostGame.state.bodies.length);
  assert.ok(Math.abs(guestGame.state.bodies[0].position.x - hostGame.state.bodies[0].position.x) < 0.01);
  host.texture.dispose(); guest.texture.dispose();
});
