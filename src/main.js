import { App } from './app.js';

const $ = (id) => document.getElementById(id);
const status = (t) => { $('status').textContent = t; };
let app = null;

async function go(mode) {
  try {
    status('Iniciando…');
    if (!app) app = new App();
    $('start').classList.add('hidden');
    window.__app = app; // depuração
    await app.start(mode, { hands: $('chk-hands').checked, gemini: $('chk-gemini').checked, onStatus: status });
    return app;
  } catch (e) {
    console.error(e);
    $('start').classList.remove('hidden');
    status('Não foi possível iniciar: ' + e.message);
  }
}

$('btn-cardboard').addEventListener('click', () => go('cardboard'));
$('btn-flat').addEventListener('click', () => go('flat'));
$('btn-xr').addEventListener('click', () => go('xr'));
$('btn-rhythm').addEventListener('click', async () => {
  const running = await go('cardboard');
  if (!running) return;
  await running.loadGame('rhythm'); running.menu.toggle(false); running.game?.chooseMusic?.();
});

if (navigator.xr?.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { $('btn-xr').hidden = !ok; }).catch(() => {});
}
if (!matchMedia('(pointer: coarse)').matches) $('chk-hands').checked = false;

// ?auto=flat&game=racing — abre direto (útil para testar)
const auto = new URLSearchParams(location.search).get('auto');
if (auto) {
  $('chk-hands').checked = false;
  go(auto);
}
