import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistTurn, FLIGHT, PalmMenu, createFlight, cruiseSpeed, palmFacing, pushOutOfBodies, rotateAbout, speedOf, stepFlight } from '../src/games/universeFlight.js';
import { makeBody } from '../src/games/universePhysics.js';

const fly = (flight, options, seconds, dt = 1 / 60) => {
  const eye = { ...options.eye };
  for (let i = 0; i < seconds / dt; i++) {
    const d = stepFlight(flight, { ...options, eye, dt });
    eye.x += d.x; eye.y += d.y; eye.z += d.z;
  }
  return eye;
};

test('Universe voo: segue a direção do olhar, inclusive para cima', () => {
  const flight = createFlight(), up = Math.SQRT1_2;
  const eye = fly(flight, { eye: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: up, z: -up }, throttle: 1 }, 2);
  assert.ok(eye.z < -5 && eye.y > 5, JSON.stringify(eye));
  assert.ok(Math.abs(eye.y + eye.z) < 0.01, 'sobe e avança na mesma proporção do olhar');
});

test('Universe voo: velocidade é lenta perto de astros e rápida no vazio', () => {
  const sun = makeBody('star', 'u1', { x: 0, y: 0, z: 0 });
  const near = cruiseSpeed({ x: 1.2, y: 0, z: 0 }, [sun]), far = cruiseSpeed({ x: 40, y: 0, z: 0 }, [sun]);
  assert.ok(near < 1.2 && near >= FLIGHT.minSpeed, `perto ${near}`);
  assert.equal(far, FLIGHT.maxSpeed);
  assert.equal(cruiseSpeed({ x: 0, y: 0, z: 0 }, []), FLIGHT.maxSpeed);
});

test('Universe voo: mão aberta para com desaceleração curta', () => {
  const flight = createFlight();
  fly(flight, { eye: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 }, throttle: 1 }, 2);
  assert.ok(speedOf(flight) > 10);
  fly(flight, { eye: { x: 0, y: 0, z: 0 }, direction: null, throttle: 0 }, 0.3);
  assert.ok(speedOf(flight) < 0.6, `ainda a ${speedOf(flight)}`);
  fly(flight, { eye: { x: 0, y: 0, z: 0 }, direction: null, throttle: 0 }, 0.4);
  assert.equal(speedOf(flight), 0);
});

test('Universe voo: não atravessa astros e é empurrado para fora do horizonte', () => {
  const planet = makeBody('planet', 'u1', { x: 0, y: 0, z: -3 });
  const eye = fly(createFlight(), { eye: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 }, throttle: 1, bodies: [planet] }, 4);
  assert.ok(Math.hypot(eye.x, eye.y, eye.z + 3) >= planet.radius + FLIGHT.margin - 1e-6, JSON.stringify(eye));
  const hole = makeBody('blackhole', 'u2', { x: 0, y: 0, z: 0 }), inside = { x: 0.2, y: 0, z: 0 };
  assert.equal(pushOutOfBodies(inside, [hole]), hole);
  assert.ok(Math.hypot(inside.x, inside.y, inside.z) >= hole.radius * 2.2 + FLIGHT.margin - 1e-6);
});

test('Universe voo: borda macia do mapa zera a velocidade para fora', () => {
  const flight = createFlight();
  const eye = fly(flight, { eye: { x: 0, y: 0, z: -70 }, direction: { x: 0, y: 0, z: -1 }, throttle: 1 }, 10);
  assert.ok(Math.hypot(eye.x, eye.y, eye.z) <= FLIGHT.bound + 0.05, JSON.stringify(eye));
  assert.ok(flight.warning);
  const back = fly(flight, { eye, direction: { x: 0, y: 0, z: 1 }, throttle: 1 }, 1);
  assert.ok(back.z > eye.z + 3, 'voltar para dentro continua livre');
});

test('Universe giro assistido: 35° por 0,4 s gira até a cabeça voltar abaixo de 15°', () => {
  const turn = new AssistTurn(), deg = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < 20; i++) total += turn.update(0.016, 40 * deg);
  assert.equal(total, 0, 'antes de 0,4 s nada acontece');
  for (let i = 0; i < 10; i++) total += turn.update(0.016, 40 * deg);
  assert.ok(total > 0, 'cabeça à esquerda gira o corpo para a esquerda');
  total = 0;
  for (let i = 0; i < 60; i++) total += turn.update(1 / 60, 20 * deg);
  assert.ok(Math.abs(total - 60 * deg) < 1e-6, 'continua a 60°/s enquanto acima de 15°');
  assert.equal(turn.update(1 / 60, 10 * deg), 0, 'para abaixo de 15°');
  for (let i = 0; i < 40; i++) total = turn.update(1 / 60, -30 * deg);
  assert.equal(total, 0, '30° não reativa o giro');
  turn.enabled = false;
  for (let i = 0; i < 60; i++) assert.equal(turn.update(1 / 60, 80 * deg), 0);
});

test('Universe giro assistido: o rig gira em torno da cabeça sem deslocá-la', () => {
  const head = { x: 2, z: -1 }, rig = { x: 0, z: 0 }, angle = 0.7;
  const next = rotateAbout(rig.x, rig.z, head.x, head.z, angle);
  // The head sits at rig + R(rig.rotation)·offset; offset (2,-1) at rotation 0 becomes R(angle)·offset.
  const c = Math.cos(angle), s = Math.sin(angle), local = { x: 2, z: -1 };
  const headAfter = { x: next.x + local.x * c + local.z * s, z: next.z - local.x * s + local.z * c };
  assert.ok(Math.abs(headAfter.x - head.x) < 1e-9 && Math.abs(headAfter.z - head.z) < 1e-9, JSON.stringify(headAfter));
});

test('Universe menu: palma esquerda virada para o rosto abre com histerese', () => {
  const eye = { x: 0, y: 1.6, z: 0 };
  // Left hand in front of the face, fingers up, palm toward the eyes: thumb side to the viewer's left.
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 1.3, z: -0.35 }));
  points[5] = { x: -0.03, y: 1.38, z: -0.35 }; points[17] = { x: 0.03, y: 1.38, z: -0.35 };
  assert.ok(palmFacing(points, 'left', eye) > 0.6);
  const back = points.map(p => ({ ...p })); back[5] = { x: 0.03, y: 1.38, z: -0.35 }; back[17] = { x: -0.03, y: 1.38, z: -0.35 };
  assert.ok(palmFacing(back, 'left', eye) < 0);
  const menu = new PalmMenu();
  assert.equal(menu.update(0.1, 0.9), false, 'precisa manter um instante');
  menu.update(0.2, 0.9);
  assert.equal(menu.update(0.05, 0.9), true);
  assert.equal(menu.update(0.5, 0.4), true, 'pequena variação não fecha');
  menu.update(0.2, 0.1);
  assert.equal(menu.update(0.1, 0.1), false);
});
