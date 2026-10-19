import { RHYTHM_TRACKS, detectOnsets, makeChart, presetChart, importBeatmap } from './rhythmChart.js';

// Native file access needs a real screen tap; a camera gesture cannot grant
// the browser's user activation. The in-world button opens this screen panel.
export function createMusicPicker(ctx, onChoose, onVisibility) {
  if (!document.body?.appendChild) return { show() {}, dispose() {} };
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Escolher música para Ritmo de Luz');
  Object.assign(panel.style, { position: 'fixed', inset: '8% max(12px, calc((100vw - 520px)/2))', zIndex: '10000',
    background: '#111625', color: '#f2f6ff', padding: '24px', borderRadius: '20px', overflow: 'auto', boxShadow: '0 12px 80px #000b', display: 'none', font: '16px system-ui' });
  panel.innerHTML = `<h2 style="margin-top:0">Sua música. Seus sabres.</h2>
    <p>Escolha uma faixa própria ou um arquivo de áudio do aparelho. Faça isso antes de colocar o VR Box.</p>
    <div data-tracks style="display:grid;gap:8px"></div>
    <p><label>Dificuldade <select data-difficulty><option value="easy">Fácil · qualquer direção</option><option value="normal" selected>Normal · siga as setas</option><option value="expert">Expert · mais blocos</option></select></label></p>
    <p><label>Arquivo local <input data-file type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"></label></p>
    <p style="font-size:14px;color:#b2bdd2">Até 25 MB e 5 minutos. Áudio fica no aparelho. O mapa gerado automaticamente pode precisar de ajuste.</p>
    <p><label>BPM opcional <input data-bpm type="number" min="60" max="200" placeholder="Automático" style="width:110px"></label></p>
    <p style="font-size:14px;color:#b2bdd2">Se as batidas automáticas não ficarem boas, informe o BPM para criar uma grade regular.</p>
    <p><label>Mapa próprio v2/v3/v4 (.dat ou .json) <input data-map type="file" accept=".dat,.json,application/json"></label></p>
    <p style="font-size:14px;color:#b2bdd2">Selecione o mapa antes do áudio. Informe o BPM inicial, exceto se o mapa tiver um evento de BPM no beat 0. Sem mapa, os blocos são gerados automaticamente. Arquivos ficam no aparelho.</p>
    <p><label>Ajuste de sincronização <input data-offset type="range" min="-200" max="200" step="10" value="0"> <output data-offset-value>0 ms</output></label></p>
    <p style="font-size:14px;color:#b2bdd2">Valor positivo atrasa os blocos em relação ao áudio. Selecione a música novamente após mudar o ajuste.</p>
    <p data-status role="status" aria-live="polite"></p>
    <button data-close type="button">Voltar ao jogo</button>`;
  document.body.appendChild(panel);
  const status = panel.querySelector('[data-status]'), difficulty = panel.querySelector('[data-difficulty]');
  let disposed = false, revision = 0, beatmap = null;
  const offsetInput = panel.querySelector('[data-offset]');
  try { offsetInput.value = String(Math.max(-200, Math.min(200, Number(localStorage.getItem('bluenav-rhythm-offset')) || 0))); } catch {}
  offsetInput.oninput = () => { panel.querySelector('[data-offset-value]').textContent = `${offsetInput.value} ms`; };
  offsetInput.onchange = () => { try { localStorage.setItem('bluenav-rhythm-offset', offsetInput.value); } catch {} };
  offsetInput.oninput();
  const offsetMs = () => Number(offsetInput.value) || 0;
  panel.style.touchAction = 'pan-y';
  const show = (visible = true) => { panel.style.display = visible ? 'block' : 'none'; if (ctx.app) ctx.app.musicPickerOpen = visible; onVisibility(visible); };
  for (const track of RHYTHM_TRACKS) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = `${track.name} · ${track.bpm} BPM`;
    Object.assign(button.style, { padding: '14px', background: '#233453', border: '1px solid #607db0', borderRadius: '9px', color: 'white', font: 'inherit', cursor: 'pointer' });
    button.onclick = () => { revision++; ctx.audio.unlock(); onChoose({ ...track, chart: presetChart(track, difficulty.value), difficulty: difficulty.value, offsetMs: offsetMs() }); show(false); };
    panel.querySelector('[data-tracks]').appendChild(button);
  }
  panel.querySelector('[data-close]').onclick = () => show(false);
  panel.querySelector('[data-map]').onchange = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const token = ++revision;
    beatmap = null;
    if (file.size > 2 * 1024 * 1024) { status.textContent = 'Mapa acima de 2 MB. Escolha um menor.'; return; }
    try {
      const data = JSON.parse(await file.text());
      if (disposed || token !== revision) return;
      if (!Array.isArray(data?._notes) && !Array.isArray(data?.colorNotes)) throw new Error('Use um mapa Beat Saber v2, v3 ou v4 (.dat).');
      beatmap = data; status.textContent = `Mapa ${file.name} pronto. Informe BPM e selecione o áudio.`;
    } catch (error) { if (!disposed && token === revision) status.textContent = error.message || 'Mapa inválido.'; }
    finally { event.target.value = ''; }
  };
  panel.querySelector('[data-file]').onchange = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const token = ++revision;
    if (file.size > 25 * 1024 * 1024) { status.textContent = 'Arquivo acima de 25 MB. Escolha um arquivo menor.'; return; }
    ctx.audio.unlock();
    status.textContent = 'Lendo áudio e preparando blocos…';
    try {
      if (!ctx.audio.ctx) throw new Error('Áudio indisponível neste navegador.');
      const buffer = await ctx.audio.ctx.decodeAudioData(await file.arrayBuffer());
      if (disposed || token !== revision) return;
      if (!Number.isFinite(buffer.duration) || buffer.duration < 2 || buffer.duration > 300) throw new Error('Escolha uma música entre 2 segundos e 5 minutos.');
      const bpmValue = panel.querySelector('[data-bpm]').value;
      let bpm = bpmValue === '' ? null : Number(bpmValue);
      if (bpm !== null && (!Number.isFinite(bpm) || bpm < 60 || bpm > 200)) throw new Error('BPM deve ficar entre 60 e 200.');
      if (beatmap && bpm === null) {
        const initial = (Array.isArray(beatmap.bpmEvents) ? beatmap.bpmEvents.find(event => event?.b === 0)?.m : null) ??
          (Array.isArray(beatmap._events) ? beatmap._events.find(event => event?._type === 100 && event?._time === 0)?._floatValue : null);
        if (!Number.isFinite(initial) || initial < 30 || initial > 400) throw new Error('Informe o BPM inicial para sincronizar o mapa próprio.');
        bpm = initial;
      }
      let chart, obstacles;
      if (beatmap) ({ chart, obstacles } = importBeatmap(beatmap, bpm, buffer.duration));
      else {
        const times = bpm === null ? detectOnsets(buffer) : Array.from({ length: Math.floor(buffer.duration / (60 / bpm)) }, (_, i) => i * 60 / bpm);
        if (times.length < 4) throw new Error('Não encontrei batidas suficientes. Informe o BPM e selecione o arquivo novamente.');
        chart = makeChart(times, difficulty.value);
      }
      onChoose({ id: 'local', name: file.name, duration: buffer.duration, buffer, chart, obstacles, bpm, difficulty: difficulty.value, offsetMs: offsetMs() });
      status.textContent = `${chart.length} blocos preparados.`; show(false);
    } catch (error) { if (!disposed && token === revision) status.textContent = error.message || 'Formato não suportado. Tente MP3 ou WAV.'; }
    finally { event.target.value = ''; }
  };
  return { show, dispose() { disposed = true; revision++; show(false); panel.remove(); } };
}
