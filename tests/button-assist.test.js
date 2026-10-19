import test from 'node:test';
import assert from 'node:assert/strict';
import { ButtonAssist, parseButtonReply } from '../src/hands/buttonAssist.js';
import { CONFIG } from '../config.js';

test('button reply parser accepts only a short hint and a boolean confirmation', () => {
  assert.deepEqual(parseButtonReply('{"dica":"Volta ao início","confirmar":true}'), { dica: 'Volta ao início', confirmar: true });
  assert.equal(parseButtonReply('{"dica":"x","confirmar":"sim"}'), null);
  assert.equal(parseButtonReply('{"dica":"   ","confirmar":false}'), null);
  assert.equal(parseButtonReply('texto livre'), null);
  assert.equal(parseButtonReply(`{"dica":"${'a'.repeat(200)}","confirmar":false}`).dica.length, 80);
});

test('button assistant sends only the label, caches the answer and stays silent when Gemini is off', async () => {
  const oldFetch = globalThis.fetch, oldKey = CONFIG.GEMINI_API_KEY, oldProxy = CONFIG.GEMINI_PROXY_URL;
  CONFIG.GEMINI_API_KEY = 'test-key'; CONFIG.GEMINI_PROXY_URL = '';
  const bodies = [];
  globalThis.fetch = async (url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"dica":"Fecha o menu","confirmar":true}' }] } }] }) };
  };
  try {
    const gemini = { enabled: false, modelIdx: 0, _endpoint: () => ({ url: 'https://example.test', headers: {} }) };
    const assist = new ButtonAssist(gemini);
    assert.equal(assist.lookup('Fechar menu'), null);
    assert.equal(bodies.length, 0);
    gemini.enabled = true;
    assert.equal(assist.lookup('Fechar menu'), null);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(JSON.parse(bodies[0].contents[0].parts[0].text), { botao: 'Fechar menu', tela: 'menu' });
    assert.deepEqual(assist.lookup('Fechar menu'), { dica: 'Fecha o menu', confirmar: true });
    assert.equal(bodies.length, 1);
  } finally { globalThis.fetch = oldFetch; CONFIG.GEMINI_API_KEY = oldKey; CONFIG.GEMINI_PROXY_URL = oldProxy; }
});

test('intent reply parser accepts only a boolean press and a 0..1 confidence', async () => {
  const { parseIntentReply } = await import('../src/hands/buttonAssist.js');
  assert.deepEqual(parseIntentReply('{"pressionar":true,"confianca":0.9}'), { pressionar: true, confianca: 0.9 });
  assert.equal(parseIntentReply('{"pressionar":"sim","confianca":0.9}'), null);
  assert.equal(parseIntentReply('{"pressionar":true,"confianca":1.5}'), null);
  assert.equal(parseIntentReply('aperta'), null);
});

test('near-miss judge sends only the label and the distance track, and stays off without Gemini', async () => {
  const oldFetch = globalThis.fetch, oldKey = CONFIG.GEMINI_API_KEY, oldProxy = CONFIG.GEMINI_PROXY_URL;
  CONFIG.GEMINI_API_KEY = 'test-key'; CONFIG.GEMINI_PROXY_URL = '';
  const bodies = [];
  globalThis.fetch = async (url, options) => { bodies.push(JSON.parse(options.body)); return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"pressionar":true,"confianca":0.85}' }] } }] }) }; };
  try {
    const gemini = { enabled: false, modelIdx: 0, _endpoint: () => ({ url: 'https://example.test', headers: {} }) };
    const assist = new ButtonAssist(gemini), samples = [[30, 0], [18, 200], [12, 400], [11, 500]];
    assert.equal(await assist.judge('Abrir jogo', samples), null);
    assert.equal(bodies.length, 0);
    gemini.enabled = true;
    assert.deepEqual(await assist.judge('Abrir jogo', samples), { pressionar: true, confianca: 0.85 });
    assert.deepEqual(JSON.parse(bodies[0].contents[0].parts[0].text), { botao: 'Abrir jogo', evento: 'quase', amostras: samples });
    await assist.judge('Abrir jogo', [[4, 0], [0, 40], [-6, 80]], 'colisao');
    assert.equal(JSON.parse(bodies[1].contents[0].parts[0].text).evento, 'colisao');
    assert.match(bodies[0].systemInstruction.parts[0].text, /pressionar/);
  } finally { globalThis.fetch = oldFetch; CONFIG.GEMINI_API_KEY = oldKey; CONFIG.GEMINI_PROXY_URL = oldProxy; }
});
