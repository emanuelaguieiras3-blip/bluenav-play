import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_TYPES, circularVelocity, makeBody, stepUniverse, tidalRadius } from '../src/games/universePhysics.js';

test('Universe Sandbox: planeta mantém uma órbita aproximadamente circular', () => {
  const sun = makeBody('star', 'sun', { x: 0, y: 0, z: 0 });
  const earth = makeBody('planet', 'earth', { x: 5, y: 0, z: 0 }, circularVelocity(sun, { x: 5, y: 0, z: 0 }));
  const state = { bodies: [sun, earth], time: 0 };
  for (let i = 0; i < 1200; i++) stepUniverse(state, 0.02);
  const r = Math.hypot(earth.position.x - sun.position.x, earth.position.z - sun.position.z);
  assert.ok(r > 4.5 && r < 5.5, `raio orbital ${r}`);
  assert.equal(state.bodies.length, 2);
});

test('Universe Sandbox: impacto conserva massa e gera evento com ponto de colisão', () => {
  const earth = makeBody('planet', 'earth', { x: 0, y: 0, z: 0 });
  const meteor = makeBody('meteor', 'meteor', { x: 0.45, y: 0, z: 0 }, { x: -5, y: 0, z: 0 });
  const state = { bodies: [earth, meteor], time: 0 };
  const expectedCenter = meteor.mass * meteor.position.x / (earth.mass + meteor.mass);
  const events = stepUniverse(state, 0.01);
  assert.equal(state.bodies.length, 1);
  assert.ok(Math.abs(earth.mass - BODY_TYPES.planet.mass - BODY_TYPES.meteor.mass) < 1e-9);
  assert.equal(events[0].type, 'impact');
  assert.ok(events[0].speed > 4 && Number.isFinite(events[0].point.x));
  assert.ok(Math.abs(earth.position.x - expectedCenter) < 0.001, 'a fusão preserva o centro de massa');
});

test('Universe Sandbox: lua do sistema permanece satélite após uma volta longa e impacto', () => {
  const star = makeBody('star', 'star', { x: -5, y: 1.5, z: -9 });
  const planetPosition = { x: 4, y: 1.5, z: -9 };
  const planet = makeBody('planet', 'planet', planetPosition, circularVelocity(star, planetPosition));
  const moonPosition = { x: 4.85, y: 1.5, z: -9 };
  const moon = makeBody('moon', 'moon', moonPosition, circularVelocity(planet, moonPosition));
  const meteor = makeBody('meteor', 'meteor', { x: 4, y: 1.5, z: -6.6 },
    { x: planet.velocity.x, y: 0, z: planet.velocity.z - 3.5 });
  const state = { bodies: [star, planet, moon, meteor], time: 0 };
  let minimum = Infinity, maximum = 0, impactedPlanet = false;
  for (let i = 0; i < 3000; i++) {
    const events = stepUniverse(state, 0.02);
    if (events.some(event => event.type === 'impact' && event.targetId === planet.id)) impactedPlanet = true;
    const distance = Math.hypot(moon.position.x - planet.position.x, moon.position.z - planet.position.z);
    minimum = Math.min(minimum, distance); maximum = Math.max(maximum, distance);
  }
  assert.ok(impactedPlanet, 'meteoro atinge o planeta');
  assert.ok(state.bodies.includes(moon), 'lua não colide nem escapa durante a simulação');
  assert.ok(minimum > planet.radius + moon.radius && maximum < 1.2, `órbita lunar entre ${minimum} e ${maximum}`);
});

test('Universe Sandbox: estrela perde matéria na zona de maré do buraco negro', () => {
  const hole = makeBody('blackhole', 'hole', { x: 0, y: 0, z: 0 });
  const star = makeBody('star', 'star', { x: 2.5, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });
  assert.ok(tidalRadius(hole, star) > 2.5);
  const total = hole.mass + star.mass, momentum = hole.mass * hole.velocity.x + star.mass * star.velocity.x;
  const state = { bodies: [hole, star], time: 0 };
  const events = stepUniverse(state, 0.04);
  assert.ok(events.some(event => event.type === 'tidal'));
  assert.ok(star.mass < BODY_TYPES.star.mass);
  assert.ok(Math.abs(hole.mass + star.mass - total) < 1e-8);
  assert.ok(Math.abs(hole.mass * hole.velocity.x + star.mass * star.velocity.x - momentum) < 1e-5);
});
