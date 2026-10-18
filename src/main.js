import { App } from './app.js';
import { CONFIG, API_BASE } from '../config.js';
import { releaseCamera } from './core/cameraFeed.js';

const $ = (id) => document.getElementById(id);
const status = (t) => { $('status').textContent = t; };
let app = null;
let previewTracker = null, previewGeneration = 0;
function stopPreview(release = false) {
  previewGeneration++;
  previewTracker?.stop(); previewTracker = null;
  $('camera-preview').hidden = true;
  $('camera-preview').srcObject = null;
  $('camera-test').textContent = 'Iniciar teste';
  if (release) releaseCamera();
}
async function testCamera() {
  if (previewTracker) { stopPreview(true); return; }
  const generation = ++previewGeneration;
  $('camera-test').disabled = true;
  try {
    const [{ HandTracker }, { getCamera }] = await Promise.all([import('./hands/handTracker.js'), import('./core/cameraFeed.js')]);
    if (generation !== previewGeneration) return;
    const tracker = new HandTracker(); previewTracker = tracker;
    const facing = $('camera-facing').value;
    const video = await getCamera(facing);
    if (generation !== previewGeneration) return;
    $('camera-preview').srcObject = video.srcObject;
    $('camera-preview').classList.toggle('mirror', facing === 'user');
    $('camera-preview').hidden = false;
    await $('camera-preview').play();
    await tracker.start({ facing, onStatus: text => { if (generation === previewGeneration) $('camera-test-status').textContent = text; } });
    if (generation !== previewGeneration) { tracker.stop(); return; }
    $('camera-test').textContent = 'Parar teste';
    const tick = () => {
      if (generation !== previewGeneration) return;
      tracker.update(performance.now());
      $('camera-test-status').textContent = `${tracker.status} · ${tracker.frameCount} quadros analisados`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (error) {
    if (generation === previewGeneration) $('camera-test-status').textContent = `Câmera: ${error.message}`;
    stopPreview(true);
  } finally { $('camera-test').disabled = false; }
}
$('camera-test').addEventListener('click', testCamera);
$('camera-facing').addEventListener('change', () => { if (previewTracker) stopPreview(true); });
$('camera-setup').addEventListener('toggle', () => { if (!$('camera-setup').open && previewTracker) stopPreview(true); });
// The site's own server holds the Gemini key; when it does, the key field is not needed.
const geminiServer = fetch(API_BASE + '/api/gemini/status', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(info => {
  if (!info?.available || CONFIG.GEMINI_API_KEY) return false;
  CONFIG.GEMINI_PROXY_URL = API_BASE + '/api/gemini';
  $('gemini-setup').hidden = true;
  $('gemini-status').textContent = 'Gemini integrado no servidor.';
  $('chk-gemini').parentElement.lastChild.textContent = ' Calibrar mãos da câmera com Gemini (integrado)';
  if ($('chk-hands').checked) $('chk-gemini').checked = true;
  return true;
}).catch(() => false);

async function go(mode, initialGame = null) {
  stopPreview(false);
  await geminiServer;
  if ($('chk-gemini').checked && !CONFIG.GEMINI_API_KEY && !CONFIG.GEMINI_PROXY_URL) $('chk-gemini').checked = false;
  try {
    status('Iniciando…');
    if (!app) app = new App();
    $('start').classList.add('hidden');
    window.__app = app; // depuração
    await app.start(mode, { hands: mode !== 'flat' && $('chk-hands').checked, gemini: $('chk-gemini').checked, cameraFacing: $('camera-facing').value, onStatus: status, initialGame });
    return app;
  } catch (e) {
    console.error(e);
    $('start').classList.remove('hidden');
    status('Não foi possível iniciar: ' + e.message);
  }
}

$('btn-cardboard').addEventListener('click', () => go('cardboard'));
$('btn-xr').addEventListener('click', () => go('xr'));
$('btn-pc').addEventListener('click', () => go('flat'));
$('btn-universe-pc').addEventListener('click', () => go('flat', 'universe'));
$('btn-pingpong').addEventListener('click', () => go($('btn-xr').hidden ? 'cardboard' : 'xr', 'pingpong'));
$('btn-rhythm').addEventListener('click', async () => {
  const running = await go('cardboard', 'rhythm');
  if (!running) return;
  running.menu.toggle(false); running.game?.chooseMusic?.();
});

if (navigator.xr?.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { $('btn-xr').hidden = !ok; }).catch(() => {});
}
if (!matchMedia('(pointer: coarse)').matches) $('chk-hands').checked = false;
const configured = () => !!(CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_PROXY_URL);
$('gemini-status').textContent = configured() ? 'Gemini configurado. A resposta será verificada durante o rastreamento.' : 'Sem chave configurada. Calibração Gemini indisponível até configurar.';
$('chk-gemini').addEventListener('change', () => {
  if (!$('chk-gemini').checked) { status('Pronto.'); return; }
  $('chk-hands').checked = true;
  if (!configured()) geminiServer.then(ok => { if (!ok && !configured()) { $('gemini-setup').open = true; $('gemini-key').focus(); } });
});
$('chk-hands').addEventListener('change', () => {
  if (!$('chk-hands').checked) { $('chk-gemini').checked = false; status('Pronto.'); }
});
$('gemini-save').addEventListener('click', () => {
  const key = $('gemini-key').value.trim();
  if (!key && !configured()) {
    $('gemini-status').textContent = 'Informe a chave Gemini para ativar.';
    $('gemini-key').focus(); return;
  }
  if (key) { CONFIG.GEMINI_API_KEY = key; CONFIG.GEMINI_PROXY_URL = ''; }
  $('gemini-key').value = '';
  $('chk-hands').checked = true; $('chk-gemini').checked = true;
  $('gemini-status').textContent = 'Configuração pronta. A chave será verificada ao detectar uma mão em VR.';
  status('Pronto.');
});

// ?auto=flat&game=racing — abre direto (útil para testar)
const auto = new URLSearchParams(location.search).get('auto');
if (auto) {
  $('chk-hands').checked = false;
  go(auto);
}
