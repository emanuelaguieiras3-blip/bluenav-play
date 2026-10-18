import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TABLE, paddleContact, createPingPongMatch } from '../src/games/pingpongPhysics.js';

const paddle = (x = 0) => ({ previous: new THREE.Vector3(x, 1, 0), position: new THREE.Vector3(x, 1, 0), normal: new THREE.Vector3(0, 0, 1), radius: .1 });

test('tênis de mesa: colisão contínua pega bola rápida e rejeita golpe fora do disco', () => {
  const from = new THREE.Vector3(0, 1, .4), to = new THREE.Vector3(0, 1, -.4);
  const hit = paddleContact(from, to, paddle());
  assert.ok(hit && hit.t > 0 && hit.t < 1);
  assert.equal(paddleContact(from, to, paddle(.4)), null);
  assert.equal(paddleContact(from, from, paddle()), null);
});

test('tênis de mesa: raquete móvel encontra bola parada', () => {
  const p = paddle(); p.previous.z = -.4; p.position.z = .4;
  const ball = new THREE.Vector3(0, 1, 0);
  assert.ok(paddleContact(ball, ball, p));
});

test('tênis de mesa: saque quica nas duas metades e ausência de devolução conta ponto', () => {
  const game = createPingPongMatch(); assert.equal(game.serve(), true);
  assert.equal(game.serve(), false);
  let tableHits = 0;
  for (let i = 0; i < 360; i++) tableHits += game.step(1 / 120).filter(e => e === 'table').length;
  assert.equal(tableHits, 2); assert.deepEqual(game.score, [0, 1]);
  assert.equal(game.getState().phase, 'point');
});

test('tênis de mesa: perda de tracking impede colisão e ponto não se repete', () => {
  const game = createPingPongMatch(); game.serve();
  const inactive = { ...paddle(), side: 0, active: false };
  for (let i = 0; i < 120; i++) game.step(1 / 120);
  game.position.set(0, 1, .1); game.velocity.set(0, 0, -10);
  game.step(.03, [inactive]);
  assert.equal(game.getState().rally, 0);
  for (let i = 0; i < 400; i++) game.step(1 / 120);
  const scored = [...game.score]; game.step(.05); assert.deepEqual(game.score, scored);
});

test('tênis de mesa: devolução legal muda metade esperada e conta a troca', () => {
  const game = createPingPongMatch(); game.serve();
  for (let i = 0; i < 120; i++) game.step(1 / 120);
  assert.equal(game.getState().bounces, 1);
  game.position.set(0, 1, -.55); game.velocity.set(0, -1, 4);
  const p = { ...paddle(), side: 0, active: true, velocity: new THREE.Vector3() };
  p.position.z = p.previous.z = -.45; p.normal.set(0, .6, -.8);
  assert.ok(game.step(.03, [p]).includes('paddle'));
  assert.equal(game.getState().rally, 1); assert.equal(game.getState().expected, 1);
  assert.ok(game.velocity.z < 0); assert.deepEqual(game.score, [0, 0]);
});

test('tênis de mesa: final exige 11 pontos e dois de vantagem; reinício limpa placar', () => {
  const game = createPingPongMatch(); game.score[0] = 10; game.score[1] = 10;
  game.serve(); game.position.set(0, -.1, TABLE.far - .1); game.step(.01);
  assert.equal(game.getState().phase, 'point'); assert.deepEqual(game.score, [11, 10]);
  game.serve(); game.position.set(0, -.1, TABLE.far - .1); game.step(.01);
  // At deuce the server rotates every point; the second missed serve gives the other side a point.
  assert.deepEqual(game.score, [11, 11]);
  game.score[0] = 10; game.score[1] = 9;
  game.serve(); game.position.set(0, -.1, TABLE.far - .1); game.step(.01);
  assert.equal(game.getState().phase, 'finished'); assert.equal(game.getState().winner, 0);
  assert.equal(game.serve(), false);
  game.reset(); assert.deepEqual(game.score, [0, 0]); assert.equal(game.getState().winner, null);
});
