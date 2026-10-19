import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_TYPES, circularVelocity, climateOf, detonate, habitableZone, kindOf, lifetimeOf, makeBody, rocheLimit, stepUniverse,
  temperatureOf } from '../src/games/universePhysics.js';
import { setCelestialValue } from '../src/games/universeEditing.js';
import { UniverseHistory, loadSlot, sanitizeBodies, saveSlot, slotInfo } from '../src/games/universeStore.js';

const totalMass = bodies => bodies.reduce((sum, body) => sum + body.mass, 0);
function simulate(state, seconds, dt = 1 / 60) {
  const events = [];
  for (let i = 0; i < seconds / dt; i++) events.push(...stepUniverse(state, dt));
  return events;
}

test('Universe eventos: estrela em órbita do buraco negro é despedaçada aos poucos e a massa se conserva', () => {
  const hole = makeBody('blackhole', 'u1', { x: 0, y: 0, z: 0 });
  const position = { x: 3.2, y: 0, z: 0 }, v = circularVelocity(hole, position);
  const star = makeBody('star', 'u2', position, { x: 0, y: 0, z: v.z * 0.8 });
  const state = { bodies: [hole, star], time: 0 }, mass = totalMass(state.bodies);
  const early = simulate(state, 5);
  assert.ok(early.filter(event => event.type === 'tidal').length > 100, 'fluxo contínuo de matéria');
  assert.ok(state.bodies.includes(star) && star.mass < BODY_TYPES.star.mass * 0.9, 'estrela perde massa sem cair de uma vez');
  assert.ok(hole.accretion > 10, 'buraco negro acumula disco de acreção');
  const late = simulate(state, 25);
  assert.ok(late.some(event => event.type === 'disrupt'), 'a estrela termina despedaçada');
  assert.deepEqual(state.bodies.map(body => body.id), ['u1']);
  assert.ok(Math.abs(totalMass(state.bodies) - mass) < 1e-6, 'massa total conservada');
});

test('Universe eventos: buraco negro só engole quando o corpo cruza o horizonte', () => {
  const hole = makeBody('blackhole', 'u1', { x: 0, y: 0, z: 0 }), rock = makeBody('rocky', 'u2', { x: 0.65, y: 0, z: 0 });
  const state = { bodies: [hole, rock], time: 0 };
  assert.equal(stepUniverse(state, 0.001).some(event => event.type === 'consume'), false, 'encostar não basta');
  const events = simulate(state, 1);
  const consume = events.find(event => event.type === 'consume');
  assert.ok(consume && consume.sourceType === 'rocky' && Number.isFinite(consume.position.x));
  assert.equal(state.bodies.length, 1);
});

test('Universe eventos: gigante azul vira supernova e deixa um remanescente', () => {
  const giant = makeBody('bluegiant', 'u1', { x: 0, y: 0, z: 0 });
  const near = makeBody('rocky', 'u2', { x: 3.5, y: 0, z: 0 }, circularVelocity(giant, { x: 3.5, y: 0, z: 0 })), far = makeBody('planet', 'u3', { x: 8, y: 0, z: 0 }, circularVelocity(giant, { x: 8, y: 0, z: 0 }));
  giant.age = lifetimeOf(giant) - 1;
  const state = { bodies: [giant, near, far], time: 0 };
  const events = simulate(state, 1.5);
  const supernova = events.find(event => event.type === 'supernova');
  assert.ok(supernova, 'explosão automática no fim da vida');
  assert.equal(giant.type, 'blackhole', 'massa acima de 1000 deixa buraco negro');
  assert.deepEqual(supernova.vaporized, ['u2'], 'planeta colado na estrela é vaporizado');
  const radial = (far.velocity.x * far.position.x + far.velocity.z * far.position.z) / Math.hypot(far.position.x, far.position.z);
  assert.ok(radial > 0.4, `onda de choque empurra o planeta para fora (${radial})`);
  const small = makeBody('bluegiant', 'u9', { x: 0, y: 0, z: 0 }); small.mass = 900;
  const other = { bodies: [small], time: 0 }, list = [];
  assert.ok(detonate(other, 'u9', list));
  assert.equal(small.type, 'neutron');
  assert.equal(detonate(other, 'u9', list), false, 'remanescente compacto não explode de novo');
  const frozen = makeBody('bluegiant', 'u4', { x: 0, y: 0, z: 0 }); frozen.age = 1000;
  const paused = { bodies: [frozen], time: 0, evolution: false };
  assert.equal(simulate(paused, 0.5).length, 0, 'evolução estelar desligada não explode');
});

test('Universe eventos: gigante vermelha solta nebulosa e vira anã branca', () => {
  const giant = makeBody('redgiant', 'u1', { x: 0, y: 0, z: 0 }); giant.age = 139.5;
  const state = { bodies: [giant], time: 0 };
  assert.ok(simulate(state, 1).some(event => event.type === 'nebula'));
  assert.equal(giant.type, 'whitedwarf');
});

test('Universe eventos: lua dentro do limite de Roche vira anel de detritos', () => {
  const planet = makeBody('planet', 'u1', { x: 0, y: 0, z: 0 });
  const position = { x: 0.62, y: 0, z: 0 }, moon = makeBody('moon', 'u2', position, circularVelocity(planet, position));
  assert.ok(rocheLimit(planet, moon) > 0.62 && rocheLimit(planet, moon) < 0.85, 'a lua padrão a 0,85 está fora do limite');
  const state = { bodies: [planet, moon], time: 0 }, mass = totalMass(state.bodies);
  assert.equal(simulate(state, 1).some(event => event.type === 'roche'), false, 'passagem rápida não destrói');
  const roche = simulate(state, 2).find(event => event.type === 'roche');
  assert.ok(roche && planet.ring > 0);
  assert.equal(planet.radius, BODY_TYPES.planet.radius, 'o anel não infla o planeta');
  assert.ok(Math.abs(totalMass(state.bodies) - mass) < 1e-9);
});

test('Universe eventos: colisão de planetas, fusão de estrelas e repulsão do buraco branco', () => {
  const crash = { bodies: [makeBody('planet', 'u1', { x: 0, y: 0, z: 0 }), makeBody('rocky', 'u2', { x: 3, y: 0, z: 0 }, { x: -3, y: 0, z: 0 })], time: 0 };
  const collision = simulate(crash, 2).find(event => event.type === 'collision');
  assert.ok(collision && collision.speed > 2 && Number.isFinite(collision.point.x));
  const stars = { bodies: [makeBody('star', 'u1', { x: 0, y: 0, z: 0 }), makeBody('reddwarf', 'u2', { x: 2.5, y: 0, z: 0 })], time: 0 };
  assert.ok(simulate(stars, 3).some(event => event.type === 'stellar-merge'));
  assert.equal(stars.bodies.length, 1);
  const white = makeBody('whitehole', 'u1', { x: 0, y: 0, z: 0 }), rock = makeBody('rocky', 'u2', { x: 3, y: 0, z: 0 }, { x: -1, y: 0, z: 0 });
  const repel = { bodies: [white, rock], time: 0 };
  simulate(repel, 4);
  assert.ok(rock.velocity.x > 0 && rock.position.x > 3, 'buraco branco empurra para longe');
  assert.deepEqual(white.position, { x: 0, y: 0, z: 0 }, 'buraco branco não se move');
});

test('Universe clima: zona habitável e temperatura dependem da estrela', () => {
  const sun = makeBody('star', 'u1', { x: 0, y: 0, z: 0 });
  const zone = habitableZone(sun);
  assert.ok(zone.inner < 9 && zone.outer > 9, 'Terra a 9 unidades fica na zona habitável');
  const earth = makeBody('planet', 'u2', { x: 9, y: 0, z: 0 }), far = makeBody('rocky', 'u3', { x: 40, y: 0, z: 0 }), close = makeBody('rocky', 'u4', { x: 1.6, y: 0, z: 0 });
  const bodies = [sun, earth, far, close];
  assert.ok(Math.abs(temperatureOf(earth, bodies) - 288) < 5, `Terra ${temperatureOf(earth, bodies)}`);
  assert.equal(climateOf(earth, bodies), 'temperate');
  assert.equal(climateOf(far, bodies), 'frozen');
  assert.equal(climateOf(close, bodies), 'hot');
  assert.ok(habitableZone(makeBody('bluegiant', 'x', { x: 0, y: 0, z: 0 })).inner > zone.outer, 'gigante azul empurra a zona para longe');
  assert.equal(climateOf(sun, bodies), null);
  assert.equal(kindOf(makeBody('smbh', 'x', { x: 0, y: 0, z: 0 })), 'blackhole');
});

test('Universe edição: sliders ajustam massa, raio e velocidade dentro dos limites', () => {
  const sun = makeBody('star', 'u1', { x: 0, y: 0, z: 0 }), planet = makeBody('planet', 'u2', { x: 5, y: 0, z: 0 });
  const bodies = [sun, planet];
  assert.ok(setCelestialValue(bodies, 'u2', 'speed', 2));
  assert.ok(Math.abs(Math.hypot(planet.velocity.x, planet.velocity.y, planet.velocity.z) - 2) < 1e-9, 'parado ganha velocidade tangencial');
  assert.ok(Math.abs(planet.velocity.x) < 1e-9, 'direção orbital, não radial');
  setCelestialValue(bodies, 'u2', 'mass', 1e9); assert.equal(planet.mass, 2000);
  setCelestialValue(bodies, 'u2', 'radius', -4); assert.equal(planet.radius, 0.05);
  assert.equal(setCelestialValue(bodies, 'u2', 'mass', NaN), false);
  assert.equal(setCelestialValue(bodies, 'u2', 'color', 3), false);
});

test('Universe histórico: desfazer e refazer restauram o estado exato', () => {
  const state = { bodies: [makeBody('star', 'u1', { x: 0, y: 0, z: 0 })], nextId: 2, time: 3 };
  const history = new UniverseHistory(3), original = structuredClone(state.bodies);
  history.record(state);
  state.bodies.push(makeBody('planet', 'u2', { x: 5, y: 0, z: 0 })); state.nextId = 3;
  const edited = structuredClone(state.bodies);
  const back = history.undo(state);
  assert.deepEqual(back.bodies, original);
  state.bodies = back.bodies;
  assert.deepEqual(history.redo(state).bodies, edited);
  assert.equal(history.redo(state), null);
  for (let i = 0; i < 5; i++) history.record(state);
  assert.equal(history.past.length, 3, 'limite de histórico');
});

test('Universe salvar: três espaços, dados inválidos recusados e armazenamento ausente tolerado', () => {
  const memory = new Map(), storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const body = makeBody('ringed', 'u4', { x: 1, y: 2, z: 3 }, { x: 0.5, y: 0, z: 0 }); body.name = 'Saturno'; body.ring = 0.2;
  const state = { bodies: [body], nextId: 5, time: 12 };
  assert.ok(saveSlot(storage, 2, state));
  const loaded = loadSlot(storage, 2);
  assert.deepEqual(loaded.bodies, [{ id: 'u4', type: 'ringed', mass: body.mass, radius: body.radius, position: body.position, velocity: body.velocity, name: 'Saturno', ring: 0.2 }]);
  assert.equal(loaded.nextId, 5);
  assert.equal(slotInfo(storage, 2).count, 1);
  assert.equal(loadSlot(storage, 1), null);
  memory.set('bluenav.universe.slot3', JSON.stringify({ v: 1, bodies: [{ id: 'x', type: 'star' }] }));
  assert.equal(loadSlot(storage, 3), null);
  memory.set('bluenav.universe.slot3', '{oops');
  assert.equal(loadSlot(storage, 3), null);
  const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.equal(saveSlot(broken, 1, state), false);
  assert.equal(loadSlot(broken, 1), null);
  assert.equal(sanitizeBodies([{ ...body, position: { x: Infinity, y: 0, z: 0 } }]), null);
  assert.equal(sanitizeBodies([body, { ...body }]), null, 'ids repetidos');
});
