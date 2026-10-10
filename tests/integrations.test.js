import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId } from '../src/media/youtubeUrl.js';
import { SecurityAssist, securityChecks } from '../src/security/securityAssist.js';
test('YouTube accepts video links and rejects impostor hosts and executable schemes', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [id, `https://youtu.be/${id}?t=4`, `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/shorts/${id}`]) assert.equal(youtubeId(link), id);
  for (const link of ['javascript:alert(1)', `https://youtube.com.attacker.test/watch?v=${id}`, `https://youtube.com@attacker.test/watch?v=${id}`, 'https://youtube.com/watch?v=bad', `http://youtu.be/${id}`]) assert.equal(youtubeId(link), null);
});
test('local security checks report permissions and cloud processing accurately', () => {
  const report = securityChecks({ secureContext: false, cameraActive: true, cloudHands: true, apiConfigured: true }).join('\n');
  assert.match(report, /use HTTPS/); assert.match(report, /Câmera: ativa/); assert.match(report, /enviados/); assert.match(report, /públicas/);
});
test('security assistant handles service errors and sends only the submitted question', async () => {
  const previous = globalThis.fetch; let payload;
  try {
    globalThis.fetch = async (_, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Ative 2FA.' }] } }] }) }; };
    assert.equal(await new SecurityAssist().ask('Como proteger minha conta?'), 'Ative 2FA.');
    assert.deepEqual(payload.contents, [{ role: 'user', parts: [{ text: 'Como proteger minha conta?' }] }]);
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(new SecurityAssist().ask('Como proteger minha conta?'), /HTTP 429/);
  } finally { globalThis.fetch = previous; }
});
