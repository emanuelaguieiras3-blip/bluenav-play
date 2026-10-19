import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GeminiAssist } from '../src/hands/geminiAssist.js';
import { HandTracker } from '../src/hands/handTracker.js';
import { CONFIG } from '../config.js';
import { GAMES, loadGameModule } from '../src/games/index.js';

const points = Array.from({ length: 21 }, (_, i) => [i * 0.001, 0.01, -0.4]);
const frames = Array.from({ length: 8 }, (_, i) => ({ t: i * 60, pontos: points }));
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('Gemini setup uses AI Studio headers, ignores thought text, and reports denied credentials', async () => {
  const oldFetch = globalThis.fetch, oldProxy = CONFIG.GEMINI_PROXY_URL, oldKey = CONFIG.GEMINI_API_KEY;
  CONFIG.GEMINI_PROXY_URL = ''; CONFIG.GEMINI_API_KEY = 'session-test-key';
  const g = new GeminiAssist(); g.enabled = true;
  let applied = 0;
  try {
    globalThis.fetch = async (url, options) => {
      assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
      assert.ok(!url.includes(CONFIG.GEMINI_API_KEY));
      assert.equal(options.headers['x-goog-api-key'], 'session-test-key');
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [
        { thought: true, text: 'private reasoning' },
        { text: JSON.stringify({ pontosCorrigidos: points, gesto: 'aberta', confianca: 0.8 }) },
      ] } }] }) };
    };
    g.maybeSend(performance.now(), frames, 'aberta', () => { applied++; });
    await settle(); assert.equal(applied, 1);
    globalThis.fetch = async () => ({ ok: false, status: 403 });
    g.nextAt = 0; g.maybeSend(performance.now(), frames, 'aberta', () => { applied++; });
    await settle(); assert.match(g.status, /403/); assert.equal(applied, 1); assert.equal(g.busy, false);
  } finally { g.cancel(); globalThis.fetch = oldFetch; CONFIG.GEMINI_PROXY_URL = oldProxy; CONFIG.GEMINI_API_KEY = oldKey; }
});

test('Gemini tries the Gemini API for an AQ key, then Vertex, and names a disabled API', async () => {
  const oldFetch = globalThis.fetch, oldProxy = CONFIG.GEMINI_PROXY_URL, oldKey = CONFIG.GEMINI_API_KEY;
  CONFIG.GEMINI_PROXY_URL = ''; CONFIG.GEMINI_API_KEY = 'AQ.test-only';
  const gemini = new GeminiAssist(); gemini.enabled = true;
  try {
    const urls = [];
    globalThis.fetch = async (url, options) => {
      urls.push(url);
      if (urls.length === 1) {
        assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
        assert.equal(options.headers['x-goog-api-key'], 'AQ.test-only');
        return { ok: false, status: 403, json: async () => ({ error: { message: 'API key not valid for this API.' } }) };
      }
      assert.match(url, /^https:\/\/aiplatform\.googleapis\.com\/v1\/publishers\/google\/models\//);
      assert.equal(options.headers['x-goog-api-key'], undefined);
      return { ok: false, status: 403, json: async () => ({ error: { message: 'Agent Platform API has not been used in project before or it is disabled.' } }) };
    };
    gemini.maybeSend(performance.now(), frames, 'aberta', () => {});
    await settle();
    gemini.nextAt = 0; gemini.maybeSend(performance.now(), frames, 'aberta', () => {});
    await settle();
    assert.equal(urls.length, 2);
    assert.match(gemini.status, /API Vertex desativada/);
  } finally { gemini.cancel(); globalThis.fetch = oldFetch; CONFIG.GEMINI_PROXY_URL = oldProxy; CONFIG.GEMINI_API_KEY = oldKey; }
});

test('Gemini uses one request, six frames, validates result, and releases busy state', async () => {
  const oldFetch = globalThis.fetch, oldProxy = CONFIG.GEMINI_PROXY_URL;
  CONFIG.GEMINI_PROXY_URL = 'https://test.invalid';
  let complete, sent, requests = 0, applied = 0;
  globalThis.fetch = async (_url, opts) => {
    requests++; sent = JSON.parse(opts.body);
    return new Promise((resolve) => { complete = resolve; });
  };
  const g = new GeminiAssist(); g.enabled = true;
  try {
    g.maybeSend(performance.now(), frames, 'aberta', () => { applied++; });
    g.maybeSend(performance.now(), frames, 'aberta', () => { applied++; });
    assert.equal(requests, 1); assert.equal(g.busy, true);
    assert.equal(JSON.parse(sent.contents[0].parts[0].text).frames.length, 6);
    complete({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pontosCorrigidos: points, gesto: 'aberta', confianca: 0.8 }) }] } }] }) });
    await settle();
    assert.equal(applied, 1); assert.equal(g.busy, false); assert.equal(g.calls, 1);
    g.nextAt = 0;
    g.maybeSend(performance.now(), frames, 'aberta', () => { applied++; });
    complete({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"confianca":2}' }] } }] }) });
    await settle();
    assert.equal(applied, 1); assert.equal(g.busy, false);
  } finally { g.cancel(); globalThis.fetch = oldFetch; CONFIG.GEMINI_PROXY_URL = oldProxy; }
});

test('cancelled Gemini response cannot recalibrate a hand', async () => {
  const oldFetch = globalThis.fetch, oldProxy = CONFIG.GEMINI_PROXY_URL;
  CONFIG.GEMINI_PROXY_URL = 'https://test.invalid';
  let complete, applied = 0;
  globalThis.fetch = async () => new Promise((resolve) => { complete = resolve; });
  const g = new GeminiAssist(); g.enabled = true;
  try {
    g.maybeSend(performance.now(), frames, 'aberta', () => { applied++; }); g.cancel();
    complete({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ pontosCorrigidos: points, gesto: 'aberta', confianca: 0.8 }) }] } }] }) });
    await settle(); assert.equal(applied, 0); assert.equal(g.busy, false);
  } finally { globalThis.fetch = oldFetch; CONFIG.GEMINI_PROXY_URL = oldProxy; }
});

test('frozen camera marks pose stale, then removes it without waiting for worker', () => {
  const tracker = new HandTracker(); tracker.running = true;
  tracker.video = { readyState: 2, currentTime: 0 }; tracker.lastVideoTime = 0;
  tracker.slots = [{ id: 0, lastSeen: 100 }];
  tracker.hands = [{ id: 0, stale: false }];
  tracker.update(190); assert.equal(tracker.hands[0].stale, true);
  tracker.update(251); assert.equal(tracker.hands.length, 0);
});

test('stop closes inference but leaves shared passthrough camera alive', () => {
  const tracker = new HandTracker(); let stopped = 0, closed = 0, terminated = 0;
  tracker.video = { srcObject: { getTracks: () => [{ stop: () => { stopped++; } }] } };
  tracker.landmarker = { close: () => { closed++; } };
  tracker.worker = { terminate: () => { terminated++; } }; tracker.running = true;
  tracker.stop(); assert.equal(stopped, 0); assert.equal(closed, 1); assert.equal(terminated, 1);
  assert.equal(tracker.running, false);
});

test('all game modules load and fast relative collisions are detected', async () => {
  globalThis.matchMedia = () => ({ matches: false }); globalThis.screen = { width: 1920, height: 1080 };
  for (const game of GAMES) {
    const module = await loadGameModule(game.id);
    assert.equal(typeof module.default.create, 'function', game.id);
  }
  const { sweptDistanceSq } = await import('../src/games/common.js');
  const v = (x, y = 0) => new THREE.Vector3(x, y, 0);
  assert.equal(sweptDistanceSq(v(-1), v(1), v(1), v(-1)), 0);
  assert.equal(sweptDistanceSq(v(-1), v(1), v(1, 1), v(-1, 1)), 1);
  assert.equal(sweptDistanceSq(v(0), v(0), v(1), v(1)), 1);
});

test('sword sweep hits thin target and respects finite segment bounds', async () => {
  globalThis.matchMedia = () => ({ matches: false }); globalThis.screen = { width: 1920, height: 1080 };
  const { segmentIntersectsBox } = await import('../src/games/common.js');
  const box = new THREE.Box3(new THREE.Vector3(-0.1, -0.1, -0.1), new THREE.Vector3(0.1, 0.1, 0.1));
  const v = (x, y = 0) => new THREE.Vector3(x, y, 0);
  assert.equal(segmentIntersectsBox(v(-1), v(1), box), true);
  assert.equal(segmentIntersectsBox(v(-1, 1), v(1, 1), box), false);
  assert.equal(segmentIntersectsBox(v(-1), v(-0.5), box), false);
  assert.equal(segmentIntersectsBox(v(0), v(0), box), true);
  assert.equal(segmentIntersectsBox(v(1), v(1), box), false);
});
