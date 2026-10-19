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
const { PRESET_IDS } = await import('../src/games/universeCatalog.js');

function fixture({ network = null, presenting = false, storage = null } = {}) {
  const root = new THREE.Group(), scene = new THREE.Scene(), rig = new THREE.Group(), camera = new THREE.PerspectiveCamera();
  rig.add(camera); camera.position.set(0, 1.6, 0); scene.add(rig, root);
  const pointers = [], appInput = { pointers: [], gamepad: {} }, input = { keys: new Set() };
  const texture = new THREE.Texture(); texture.userData.shared = true;
  const buttons = [];
  const ctx = { THREE, root, rig, camera, input, lowEnd: true, storage,
    app: { network, input: appInput, camera, renderer: { xr: { isPresenting: presenting } }, mode: presenting ? 'xr' : 'cardboard' },
    tex: { get: () => texture }, env: { set() {} }, audio: { thud() {}, success() {} },
    button: options => { const object = new THREE.Group(); object.userData.options = options; object.userData.setLabel = () => {}; object.userData.setActive = () => {}; buttons.push(object); return object; },
    label: () => new THREE.Group(), pointers: () => pointers, teleport() {}, hud() {}, objective() {}, freeFlight() {} };
  return { ctx, root, rig, camera, pointers, appInput, input, buttons };
}
const run = (game, seconds, dt = 1 / 60) => { for (let i = 0; i < seconds / dt; i++) game.update(dt); };
const click = (buttons, label) => buttons.find(button => button.userData.options.label === label).userData.options.onClick();

function handPoints({ closed = false, palmToEye = false, origin = new THREE.Vector3(-0.2, 1.3, -0.4) } = {}) {
  const points = Array.from({ length: 21 }, () => origin.clone());
  points[9] = origin.clone().add(new THREE.Vector3(0, 0.08, 0));
  points[5] = origin.clone().add(new THREE.Vector3(palmToEye ? -0.03 : 0.03, 0.08, 0));
  points[17] = origin.clone().add(new THREE.Vector3(palmToEye ? 0.03 : -0.03, 0.08, 0));
  for (const tip of [8, 12, 16, 20]) {
    points[tip - 2] = origin.clone().add(new THREE.Vector3(0, 0.07, 0));
    points[tip] = origin.clone().add(new THREE.Vector3(0, closed ? 0.04 : 0.17, closed ? 0.02 : 0));
  }
  return points;
}
const leftHand = options => ({ id: 'left', source: 'hand', side: 'left', stale: false, pinch: false, hand: { confianca: 0.95, points: handPoints(options) } });
function rayPointer(origin, direction) {
  return { id: 'mouse', source: 'mouse', ray: new THREE.Ray(origin.clone(), direction.clone().normalize()), pinch: false, pinchDown: false, pinchUp: false };
}
function tap(game, pointer) {
  pointer.pinchDown = true; pointer.pinch = true; game.update(1 / 60);
  pointer.pinchDown = false; pointer.pinch = false; pointer.pinchUp = true; game.update(1 / 60);
  pointer.pinchUp = false;
}

test('Universe VR: punho esquerdo voa para onde a cabeça olha; mão aberta para', () => {
  const { ctx, rig, appInput } = fixture({ presenting: true }), game = universe.create(ctx);
  game.clear();
  appInput.pointers = [leftHand({ closed: true })];
  run(game, 1.5);
  assert.ok(rig.position.z < -2, `avançou ${rig.position.z}`);
  assert.ok(appInput.pointers[0].locomotion, 'mão de voo não cria nem seleciona');
  appInput.pointers = [leftHand({ closed: false })];
  run(game, 0.6);
  const stopped = rig.position.z;
  run(game, 0.5);
  assert.ok(Math.abs(rig.position.z - stopped) < 1e-6, 'parou depois de abrir a mão');
});

test('Universe VR: olhar para cima com o punho fechado sobe', () => {
  const { ctx, rig, camera, appInput } = fixture({ presenting: true }), game = universe.create(ctx);
  game.clear();
  camera.quaternion.setFromEuler(new THREE.Euler(Math.PI / 3, 0, 0, 'YXZ'));
  appInput.pointers = [leftHand({ closed: true })];
  run(game, 1.5);
  assert.ok(rig.position.y > 2, `subiu ${rig.position.y}`);
});

test('Universe VR: cabeça virada de lado gira o corpo sem deslocar a cabeça', () => {
  const { ctx, rig, camera } = fixture({ presenting: true }), game = universe.create(ctx);
  game.clear();
  camera.position.set(0.3, 1.6, 0.2);
  camera.quaternion.setFromEuler(new THREE.Euler(0, 50 * Math.PI / 180, 0, 'YXZ'));
  rig.updateMatrixWorld(true);
  const before = camera.getWorldPosition(new THREE.Vector3());
  run(game, 1.5);
  assert.ok(rig.rotation.y > 0.8, `girou ${rig.rotation.y}`);
  rig.updateMatrixWorld(true);
  assert.ok(camera.getWorldPosition(new THREE.Vector3()).distanceTo(before) < 1e-6, 'cabeça fica no lugar');
  game.toggleView('assist');
  const turned = rig.rotation.y;
  run(game, 1);
  assert.equal(rig.rotation.y, turned, 'giro assistido pode ser desligado');
});

test('Universe teclado: WASD voa e E sobe no modo de tela', () => {
  const { ctx, rig, input } = fixture(), game = universe.create(ctx);
  game.clear();
  input.keys.add('KeyW'); input.keys.add('KeyE');
  run(game, 1);
  assert.ok(rig.position.z < -1 && rig.position.y > 1, JSON.stringify(rig.position));
});

test('Universe VR: virar a palma esquerda para o rosto abre a paleta no pulso', () => {
  const { ctx, appInput, buttons } = fixture({ presenting: true }), game = universe.create(ctx);
  appInput.pointers = [leftHand({ palmToEye: true })];
  run(game, 0.5);
  assert.ok(game.panels.open && game.panels.palette.visible, 'paleta aberta');
  assert.equal(game.panels.anchor, 'wrist');
  click(buttons, 'Buraco negro');
  assert.equal(game.state.selected, 'blackhole');
  assert.equal(game.state.tool, 'create');
  appInput.pointers = [leftHand({ palmToEye: false })];
  run(game, 0.5);
  assert.equal(game.panels.open, false, 'fecha ao virar a palma');
  click(buttons, 'Menu');
  assert.ok(game.panels.open, 'botão Menu é a alternativa sem rastreamento de mãos');
});

test('Universe ferramentas: criar perto do jogador, mover, lançar, régua e apagar com desfazer', () => {
  const { ctx, rig, pointers } = fixture(), game = universe.create(ctx);
  game.clear(); rig.position.set(30, 0, 10);
  const pointer = rayPointer(new THREE.Vector3(30, 1.6, 10), new THREE.Vector3(0, 0, -1)); pointers.push(pointer);
  game.selectType('blackhole');
  tap(game, pointer);
  assert.equal(game.state.bodies.length, 1);
  const hole = game.state.bodies[0];
  assert.equal(hole.type, 'blackhole');
  assert.ok(Math.abs(hole.position.x - 30) < 0.01 && hole.position.z < 10 && hole.position.z > 3, 'criado à frente do jogador, não na origem');
  game.setTool('move');
  pointer.pinchDown = true; pointer.pinch = true; game.update(1 / 60); pointer.pinchDown = false;
  pointer.ray.direction.set(0.3, 0, -1).normalize(); game.update(1 / 60);
  pointer.pinch = false; pointer.pinchUp = true; game.update(1 / 60); pointer.pinchUp = false;
  assert.ok(hole.position.x > 31, `movido para ${hole.position.x}`);
  game.setTool('launch');
  game.state.selected = 'rocky';
  pointer.ray.direction.set(-0.4, 0, -1).normalize();
  pointer.pinchDown = true; pointer.pinch = true; game.update(1 / 60); pointer.pinchDown = false;
  pointer.ray.direction.set(-0.6, 0, -1).normalize(); game.update(1 / 60);
  assert.ok(ctx.root.getObjectByName('universe-launch-arrow').visible, 'seta de lançamento');
  pointer.pinch = false; pointer.pinchUp = true; game.update(1 / 60); pointer.pinchUp = false;
  const rock = game.state.bodies.find(body => body.type === 'rocky');
  assert.ok(rock && rock.velocity.x > 0.5, 'estilingue: puxar para a esquerda lança para a direita');
  game.setTool('ruler');
  pointer.ray.direction.set(hole.position.x - 30, 0, hole.position.z - 11.6).normalize(); tap(game, pointer);
  pointer.ray.direction.set(rock.position.x - 30, rock.position.y - 1.6, rock.position.z - 10).normalize(); tap(game, pointer);
  assert.ok(ctx.root.getObjectByName('universe-ruler').visible, 'régua entre dois astros');
  game.setTool('erase');
  pointer.ray.direction.set(rock.position.x - 30, rock.position.y - 1.6, rock.position.z - 10).normalize(); tap(game, pointer);
  assert.equal(game.state.bodies.some(body => body.type === 'rocky'), false);
  game.undo();
  assert.ok(game.state.bodies.some(body => body.type === 'rocky'), 'desfazer traz o astro de volta');
  game.redo();
  assert.equal(game.state.bodies.some(body => body.type === 'rocky'), false);
});

test('Universe inspetor: duplicar, renomear, sliders e detonar uma estrela', () => {
  const { ctx } = fixture(), game = universe.create(ctx);
  const sun = game.state.bodies.find(body => body.type === 'star');
  game.state.selectedBodyId = sun.id;
  const copy = game.duplicate();
  assert.equal(game.state.bodies.length, 4); assert.equal(copy.type, 'star');
  game.rename('Sol Dois');
  assert.equal(copy.name, 'Sol Dois');
  game.setSlider('mass', 1); game.commitSlider('mass');
  assert.equal(copy.mass, 2000);
  game.undo();
  assert.equal(game.state.bodies.find(body => body.id === copy.id).mass, 260, 'um passo de desfazer por arraste do slider');
  game.state.selectedBodyId = copy.id;
  assert.ok(game.detonate());
  assert.equal(game.state.bodies.find(body => body.id === copy.id).type, 'whitedwarf');
  assert.equal(game.detonate(), false, 'anã branca não detona');
  assert.ok(game.api.info(sun).rows.some(([key]) => key === 'Temperatura'));
});

test('Universe presets: todos montam e simulam sem erro, dentro do limite', () => {
  const { ctx } = fixture(), game = universe.create(ctx);
  for (const id of PRESET_IDS) {
    game.preset(id);
    assert.ok(game.state.bodies.length > 0 && game.state.bodies.length <= 64, `${id}: ${game.state.bodies.length}`);
    run(game, 3, 1 / 30);
    assert.ok(game.state.bodies.every(body => Number.isFinite(body.position.x) && Number.isFinite(body.velocity.z)), id);
  }
});

test('Universe preset estrela vs buraco negro: disco de acreção visível em poucos segundos', () => {
  const { ctx, root } = fixture(), game = universe.create(ctx);
  game.preset('tidal');
  run(game, 3);
  const disk = root.getObjectByName('universe-accretion');
  assert.ok(disk, 'disco criado');
  const alpha = disk.geometry.attributes.color.array;
  let visible = 0;
  for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 0.2) visible++;
  assert.ok(visible > 30, `partículas visíveis ${visible}`);
  const star = game.state.bodies.find(body => body.type === 'star');
  assert.ok(star && star.mass < 260, 'estrela sendo despedaçada');
});

test('Universe preset supernova: explode, troca o visual e empurra os planetas', () => {
  const { ctx, root } = fixture(), game = universe.create(ctx);
  game.preset('supernova');
  const giant = game.state.bodies.find(body => body.type === 'bluegiant');
  run(game, 10, 1 / 30);
  assert.ok(['blackhole', 'neutron'].includes(giant.type), giant.type);
  const visual = root.getObjectByName(`celestial-${giant.id}`);
  assert.ok(giant.type === 'neutron' ? visual.userData.beams : visual.userData.disk, 'visual do remanescente');
  assert.ok(game.state.bodies.filter(body => body.id !== giant.id).every(body => Math.hypot(body.position.x - giant.position.x, body.position.z - giant.position.z) > 3),
    'planetas próximos foram vaporizados ou empurrados');
});

test('Universe salvar e abrir no jogo, velocidade de 0,25× a 64× e evolução desligável', () => {
  const memory = new Map(), storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const { ctx } = fixture({ storage }), game = universe.create(ctx);
  assert.ok(game.save(1));
  game.preset('belt');
  assert.ok(game.load(1));
  assert.equal(game.state.bodies.length, 3);
  for (let i = 0; i < 12; i++) game.api.speedStep(1);
  assert.equal(game.state.speed, 64);
  for (let i = 0; i < 12; i++) game.api.speedStep(-1);
  assert.equal(game.state.speed, 0.25);
  game.toggleView('evolution'); game.update(0);
  assert.equal(game.state.evolution, false);
});

test('Universe rede: host valida comandos novos do convidado', () => {
  const handlers = new Map();
  const net = { id: 'host', host: 'host', room: 'ROOM12', on(name, callback) { handlers.set(name, callback); return () => handlers.delete(name); }, sendEvent() {} };
  const { ctx } = fixture({ network: net }), game = universe.create(ctx);
  const send = (data, sender) => handlers.get('universe-command')(data, sender);
  const planet = game.state.bodies.find(body => body.type === 'planet');
  send({ action: 'remove', id: planet.id }, 'g1');
  assert.equal(game.state.bodies.length, 2);
  send({ action: 'undo' }, 'g2');
  assert.equal(game.state.bodies.length, 3);
  send({ action: 'launch', type: 'comet', position: { x: 0, y: 1, z: -5 }, velocity: { x: 1, y: 0, z: 0 } }, 'g3');
  assert.ok(game.state.bodies.some(body => body.type === 'comet'));
  send({ action: 'launch', type: 'unknown', position: { x: 0, y: 1, z: -5 }, velocity: { x: 1, y: 0, z: 0 } }, 'g4');
  send({ action: 'set', id: planet.id, key: 'mass', value: 1e12 }, 'g5');
  assert.equal(game.state.bodies.find(body => body.id === planet.id).mass, 2000);
  send({ action: 'rename', id: planet.id, name: 'Terra\u0000'.repeat(10) }, 'g6');
  assert.ok(game.state.bodies.find(body => body.id === planet.id).name.length <= 24);
  send({ action: 'restore', bodies: [{ id: 'u1', type: 'star', mass: -1, radius: 1, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }] }, 'g7');
  assert.ok(game.state.bodies.length >= 4, 'restauração inválida recusada');
  send({ action: 'speed-set', value: 1000 }, 'g8');
  assert.equal(game.state.speed, 1);
  send({ action: 'preset', kind: 'galaxies' }, 'g9');
  assert.ok(game.state.bodies.some(body => body.type === 'smbh'));
});
