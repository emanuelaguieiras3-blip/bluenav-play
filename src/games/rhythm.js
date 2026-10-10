// Original saber rhythm game, with local audio and generated maps.
import { std, sweptDistanceSq } from './common.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RHYTHM_TRACKS, presetChart, cutResult } from './rhythmChart.js';
import { createMusicPicker } from './rhythmMusic.js';

export default {
  id: 'rhythm',
  create(ctx) {
    const { THREE, root, audio, env } = ctx;
    env.set({ top: '#080a19', horizon: '#111327', bottom: '#050710', hemi: ['#8686bf', '#14152b', 0.55], sun: ['#fff', 0] });
    const colors = ['#36b9ff', '#ff4577'];
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
    const stage = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 26).rotateX(-Math.PI / 2), std({ color: '#10182b', roughness: 0.5 }));
    stage.position.z = -11; root.add(stage);
    const trackMat = basic('#569fff', { transparent: true, opacity: 0.3 });
    for (const x of [-0.7, 0, 0.7]) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 24), trackMat); line.position.set(x, 0.012, -11); root.add(line); }
    const title = ctx.label('RITMO DE LUZ · SABRES', { w: 1.3, h: 0.14, size: 0.45, bg: 'rgba(5,10,25,.65)' }); title.position.set(0, 2.1, -2.4); root.add(title);
    const hint = ctx.label('Escolha a música · corte os blocos seguindo as setas', { w: 1.65, h: 0.1, size: 0.3 }); hint.position.set(0, 1.9, -2.4); root.add(hint);
    const cubeGeo = new RoundedBoxGeometry(0.23, 0.23, 0.23, 2, 0.025);
    const cubeMats = colors.map(color => std({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.45 }));
    const arrowMat = basic('#ffffff'), arrowGeo = new THREE.BoxGeometry(0.065, 0.013, 0.009);
    const stemGeo = new THREE.BoxGeometry(0.014, 0.075, 0.009), dotGeo = new THREE.SphereGeometry(0.018, 8, 6);
    const pool = Array.from({ length: 36 }, () => {
      const mesh = new THREE.Mesh(cubeGeo, cubeMats[0]); mesh.visible = false;
      const arrow = new THREE.Group(); arrow.position.z = 0.12;
      const stem = new THREE.Mesh(stemGeo, arrowMat); stem.position.y = 0.012; arrow.add(stem);
      for (const sign of [-1, 1]) { const wing = new THREE.Mesh(arrowGeo, arrowMat); wing.position.set(sign * 0.022, -0.025, 0); wing.rotation.z = sign * Math.PI / 4; arrow.add(wing); }
      const dot = new THREE.Mesh(dotGeo, arrowMat); dot.position.z = 0.12;
      mesh.add(arrow, dot); root.add(mesh); return { mesh, arrow, dot, note: null, previous: new THREE.Vector3() };
    });
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.019, 0.14, 8).translate(0, -0.07, 0);
    const bladeGeo = new THREE.CylinderGeometry(0.009, 0.012, 0.45, 8).translate(0, 0.225, 0);
    const haloGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.45, 8).translate(0, 0.225, 0);
    const handleMat = std({ color: '#32394b', metalness: 0.65, roughness: 0.4 });
    const up = new THREE.Vector3(0, 1, 0);
    const sabers = colors.map((color, side) => {
      const group = new THREE.Group(), bladeMat = basic(color), haloMat = basic(color, { transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
      group.add(new THREE.Mesh(handleGeo, handleMat), new THREE.Mesh(bladeGeo, bladeMat), new THREE.Mesh(haloGeo, haloMat)); group.visible = false; root.add(group);
      const trailGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const trail = new THREE.Line(trailGeo, basic(color, { transparent: true, opacity: 0.5, depthWrite: false })); trail.frustumCulled = false; trail.visible = false; root.add(trail);
      return { group, bladeMat, haloMat, trail, side, owner: null, base: new THREE.Vector3(), tip: new THREE.Vector3(), prevBase: new THREE.Vector3(), prevTip: new THREE.Vector3(), active: false };
    });
    const fragmentsGeo = new THREE.BoxGeometry(0.115, 0.23, 0.23);
    const fragments = Array.from({ length: 24 }, () => { const mesh = new THREE.Mesh(fragmentsGeo, cubeMats[0]); mesh.visible = false; root.add(mesh); return { mesh, life: 0, velocity: new THREE.Vector3(), spin: 0 }; });
    const speed = 5.5, hitZ = -0.48, travel = 2.7;
    let track = { ...RHYTHM_TRACKS[0], difficulty: 'normal', chart: presetChart(RHYTHM_TRACKS[0], 'normal') };
    let state = 'ready', epoch = 0, time = -3, nextNote = 0, nextBeat = 0, score = 0, combo = 0, best = 0, misses = 0, hits = 0;
    let feedback = 'Escolha uma música e toque em Jogar', feedbackLife = 0, source = null, disposed = false;
    let systemPaused = false, manualPaused = false, pickerOpen = false, suspended = false;
    const a0 = new THREE.Vector3(), a1 = new THREE.Vector3(), motion = new THREE.Vector3();
    const stopSource = () => { if (source) { try { source.stop(); } catch {} source.disconnect(); source = null; } };
    const playSource = () => {
      if (!track.buffer || !audio.ctx || time >= track.duration) return;
      source = audio.ctx.createBufferSource(); source.buffer = track.buffer; source.connect(audio.master);
      source.start(audio.t + Math.max(0, -time), Math.max(0, time));
    };
    const pauseState = () => {
      const shouldPause = systemPaused || manualPaused || pickerOpen || audio.ctx?.state !== 'running';
      if (state !== 'playing' || shouldPause === suspended) return;
      if (shouldPause) { time = audio.t - epoch; stopSource(); }
      else { epoch = audio.t - time; playSource(); sabers.forEach(s => s.owner = null); }
      suspended = shouldPause;
    };
    const start = async () => {
      audio.unlock?.();
      try { if (audio.ctx?.state === 'suspended') await audio.ctx.resume(); } catch {}
      if (disposed) return;
      if (!audio.ctx || audio.ctx.state !== 'running') { feedback = 'Toque na tela para ativar o áudio e depois em Jogar'; return; }
      stopSource(); clear(); time = -3; epoch = audio.t + 3; nextNote = 0; nextBeat = 0;
      score = combo = best = misses = hits = 0; manualPaused = false; suspended = false; state = 'playing';
      feedback = 'Prepare os sabres'; feedbackLife = 3; playSource(); pauseState();
    };
    const clear = () => { pool.forEach(c => { c.note = null; c.mesh.visible = false; }); fragments.forEach(f => { f.life = 0; f.mesh.visible = false; }); };
    const choose = selected => { stopSource(); clear(); track = selected; state = 'ready'; time = -3; manualPaused = false; feedback = `${track.name} · pronto para jogar`; updateLabels(); };
    const picker = createMusicPicker(ctx, choose, visible => { pickerOpen = visible; pauseState(); });
    const buttons = new THREE.Group(); root.add(buttons);
    const addButton = (label, x, action) => { const button = ctx.button({ label, w: 0.25, h: 0.075, onClick: action }); button.position.set(x, 0.88, -0.85); buttons.add(button); return button; };
    addButton('Música', -0.39, () => picker.show());
    addButton('Jogar', 0, start);
    const pauseButton = addButton('Pausar / retomar', 0.39, () => { manualPaused = !manualPaused; pauseState(); });
    const trackLabel = ctx.label('', { w: 1.05, h: 0.08, size: 0.32 }); trackLabel.position.set(0, 0.76, -0.85); root.add(trackLabel);
    const updateLabels = () => trackLabel.userData.set(`${track.name} · ${track.bpm ? track.bpm + ' BPM' : 'mapa automático'}`);
    updateLabels();
    const preview = () => { for (let i = 0; i < 4; i++) { const c = pool[i], note = track.chart[i]; if (!note) continue; c.mesh.visible = true; c.mesh.material = cubeMats[note.side]; c.mesh.position.set(note.x, note.y, -2 - i * 0.8); c.arrow.visible = note.direction !== null; c.dot.visible = note.direction === null; c.arrow.rotation.z = [0, Math.PI, -Math.PI / 2, Math.PI / 2][note.direction] || 0; } };
    const pieces = c => { for (const sign of [-1, 1]) { const f = fragments.find(p => p.life <= 0); if (!f) break; f.life = 0.45; f.mesh.visible = true; f.mesh.material = cubeMats[c.note.side]; f.mesh.position.copy(c.mesh.position); f.mesh.position.x += sign * 0.06; f.mesh.rotation.set(0, 0, 0); f.velocity.set(sign * 0.8, 0.5, 0.4); f.spin = sign * 4; } };
    ctx.onDispose(() => { disposed = true; stopSource(); picker.dispose(); });
    void pauseButton;
    return {
      chooseMusic: () => picker.show(),
      start,
      choosePreset(id, difficulty = 'normal') { const preset = RHYTHM_TRACKS.find(t => t.id === id); if (preset) choose({ ...preset, difficulty, chart: presetChart(preset, difficulty) }); },
      setPaused(value) { systemPaused = value; pauseState(); },
      getState: () => ({ state, suspended, time, score, combo, best, misses, hits, track: track.name, notes: track.chart.length, activeBlocks: pool.filter(c => c.note).length }),
      update(dt) {
        if (disposed) return;
        pauseState();
        const pointers = ctx.pointers().slice(0, 2), twoHands = pointers.length >= 2, used = new Set();
        for (const s of sabers) { s.active = false; s.group.visible = s.trail.visible = false; }
        for (const p of pointers) {
          let s = twoHands ? sabers[p.side === 'left' ? 0 : 1] : sabers[1]; if (used.has(s)) s = sabers.find(q => !used.has(q)); used.add(s);
          s.prevBase.copy(s.base); s.prevTip.copy(s.tip);
          if (p.source === 'hand') { s.base.copy(p.hand.palm).lerp(p.hand.points[9], 0.5); s.group.quaternion.setFromUnitVectors(up, p.hand.dir.clone().normalize()); }
          else { s.base.copy(p.source === 'xr' ? p.handPos : ctx.eye().addScaledVector(p.ray.direction, 0.55)); s.group.quaternion.identity(); }
          s.tip.set(0, 0.45, 0).applyQuaternion(s.group.quaternion).add(s.base); s.group.position.copy(s.base);
          if (s.owner !== p.id || s.prevBase.distanceTo(s.base) > 0.5 || suspended) { s.prevBase.copy(s.base); s.prevTip.copy(s.tip); }
          s.owner = p.id; s.active = true; s.group.visible = true; s.bladeMat.color.set(twoHands ? colors[s.side] : '#effaff'); s.haloMat.color.copy(s.bladeMat.color);
          const positions = s.trail.geometry.attributes.position; positions.setXYZ(0, s.prevTip.x, s.prevTip.y, s.prevTip.z); positions.setXYZ(1, s.tip.x, s.tip.y, s.tip.z); positions.needsUpdate = true; s.trail.visible = s.tip.distanceTo(s.prevTip) > 0.015;
        }
        sabers.filter(s => !s.active).forEach(s => s.owner = null);
        if (state === 'ready') preview();
        if (state === 'playing' && !suspended) {
          const previousTime = time; time = audio.t - epoch;
          if (time >= 0 && !track.buffer) { while (nextBeat * 60 / track.bpm < time + 0.07) { const at = nextBeat * 60 / track.bpm; if (at >= time - 0.1) { const delay = Math.max(0, at - time); audio.tone({ freq: 120, to: 45, dur: 0.16, vol: 0.22, delay }); if (nextBeat % 2) audio.noise({ dur: 0.05, freq: 6500, type: 'highpass', vol: 0.035, delay }); if (nextBeat % 4 === 0) audio.tone({ freq: track.scale[(nextBeat / 4) % track.scale.length], dur: 60 / track.bpm * 2, type: 'triangle', vol: 0.065, delay }); } nextBeat++; } }
          while (nextNote < track.chart.length && track.chart[nextNote].at - time <= travel) { const c = pool.find(c => !c.note); if (!c) break; c.note = track.chart[nextNote++]; c.mesh.material = cubeMats[c.note.side]; c.mesh.visible = true; c.arrow.visible = c.note.direction !== null; c.dot.visible = c.note.direction === null; c.arrow.rotation.z = [0, Math.PI, -Math.PI / 2, Math.PI / 2][c.note.direction] || 0; c.mesh.position.set(c.note.x, c.note.y, hitZ + speed * (time - c.note.at)); c.previous.copy(c.mesh.position); }
          for (const c of pool) {
            if (!c.note) continue;
            c.previous.copy(c.mesh.position); c.mesh.position.z = hitZ + speed * (time - c.note.at); let cut = false;
            for (const s of sabers) {
              if (!s.active) continue;
              let distance = Infinity;
              for (let sample = 0; sample <= 6; sample++) { a0.copy(s.prevBase).lerp(s.prevTip, sample / 6); a1.copy(s.base).lerp(s.tip, sample / 6); distance = Math.min(distance, sweptDistanceSq(c.previous, c.mesh.position, a0, a1)); }
              if (distance > 0.145 ** 2) continue;
              motion.copy(s.tip).sub(s.prevTip);
              const result = cutResult({ side: s.side, noteSide: c.note.side, twoHands, motionX: motion.x, motionY: motion.y, speed: motion.length() / Math.max(dt, 0.001), direction: c.note.direction, timing: time - c.note.at });
              if (!result.hit) { feedback = result.reason; feedbackLife = 0.8; continue; }
              pieces(c); score += result.points * Math.min(8, 1 + Math.floor(combo / 8)); combo++; hits++; best = Math.max(best, combo); feedback = result.perfect ? 'PERFEITO' : 'BOM CORTE'; feedbackLife = 0.6; cut = true; audio.noise({ dur: 0.045, freq: 2200, vol: 0.05 }); break;
            }
            if (cut || c.mesh.position.z > 0.55) { if (!cut) { misses++; combo = 0; feedback = 'PERDEU'; feedbackLife = 0.5; } c.note = null; c.mesh.visible = false; }
          }
          feedbackLife = Math.max(0, feedbackLife - (time - previousTime));
          if (time > track.duration + 1 && !pool.some(c => c.note)) { state = 'finished'; stopSource(); feedback = `Música concluída · ${hits}/${hits + misses} cortes`; }
        }
        if (!suspended) for (const f of fragments) if (f.life > 0) { f.life -= dt; f.mesh.visible = f.life > 0; f.velocity.y -= dt * 2; f.mesh.position.addScaledVector(f.velocity, dt); f.mesh.rotation.z += f.spin * dt; }
        const status = suspended ? 'PAUSADO' : state === 'playing' && time < 0 ? `COMEÇA EM ${Math.ceil(-time)}` : feedbackLife > 0 || state !== 'playing' ? feedback : 'Corte na direção das setas';
        ctx.hud(`${score} pontos · combo ${combo} · ×${Math.min(8, 1 + Math.floor(combo / 8))}`, `${status} · ${twoHands ? 'azul: esquerda · rosa: direita' : 'um sabre corta as duas cores'} · melhor ${best}`);
      },
    };
  },
};
