import { RHYTHM_TRACKS, detectOnsets, makeChart, presetChart } from './rhythmChart.js';

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
    <p><label>Dificuldade <select data-difficulty><option value="normal">Normal · siga as setas</option><option value="easy">Fácil · corte em qualquer direção</option></select></label></p>
    <p><label>Arquivo local <input data-file type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"></label></p>
    <p style="font-size:14px;color:#b2bdd2">Até 25 MB e 5 minutos. Áudio fica no aparelho. O mapa gerado automaticamente pode precisar de ajuste.</p>
    <p><label>BPM opcional <input data-bpm type="number" min="60" max="200" placeholder="Automático" style="width:110px"></label></p>
    <p style="font-size:14px;color:#b2bdd2">Se as batidas automáticas não ficarem boas, informe o BPM para criar uma grade regular.</p>
    <p data-status role="status" aria-live="polite"></p>
    <button data-close type="button">Voltar ao jogo</button>`;
  document.body.appendChild(panel);
  const status = panel.querySelector('[data-status]'), difficulty = panel.querySelector('[data-difficulty]');
  let disposed = false, revision = 0;
  panel.style.touchAction = 'pan-y';
  const show = (visible = true) => { panel.style.display = visible ? 'block' : 'none'; if (ctx.app) ctx.app.musicPickerOpen = visible; onVisibility(visible); };
  for (const track of RHYTHM_TRACKS) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = `${track.name} · ${track.bpm} BPM`;
    Object.assign(button.style, { padding: '14px', background: '#233453', border: '1px solid #607db0', borderRadius: '9px', color: 'white', font: 'inherit', cursor: 'pointer' });
    button.onclick = () => { revision++; ctx.audio.unlock(); onChoose({ ...track, chart: presetChart(track, difficulty.value), difficulty: difficulty.value }); show(false); };
    panel.querySelector('[data-tracks]').appendChild(button);
  }
  panel.querySelector('[data-close]').onclick = () => show(false);
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
      const bpm = bpmValue === '' ? null : Number(bpmValue);
      if (bpm !== null && (!Number.isFinite(bpm) || bpm < 60 || bpm > 200)) throw new Error('BPM deve ficar entre 60 e 200.');
      let times = bpm === null ? detectOnsets(buffer) : Array.from({ length: Math.floor(buffer.duration / (60 / bpm)) }, (_, i) => i * 60 / bpm);
      if (times.length < 4) throw new Error('Não encontrei batidas suficientes. Informe o BPM e selecione o arquivo novamente.');
      const chart = makeChart(times, difficulty.value);
      onChoose({ id: 'local', name: file.name, duration: buffer.duration, buffer, chart, bpm, difficulty: difficulty.value });
      status.textContent = `${chart.length} blocos preparados.`; show(false);
    } catch (error) { if (!disposed && token === revision) status.textContent = error.message || 'Formato não suportado. Tente MP3 ou WAV.'; }
    finally { event.target.value = ''; }
  };
  return { show, dispose() { disposed = true; revision++; show(false); panel.remove(); } };
}
