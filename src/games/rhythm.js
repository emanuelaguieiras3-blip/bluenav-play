// Original saber rhythm game, with local audio and generated maps.
import { std, sweptDistanceSq } from './common.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RHYTHM_TRACKS, presetChart, cutResult, arrowRotation } from './rhythmChart.js';
import { createMusicPicker } from './rhythmMusic.js';
import { HandSaberTracker, SABER_GRIPS } from './handSaber.js';
import { FlexibleBlade } from './flexibleBlade.js';
import { createRhythmStage } from './rhythmStage.js';

export default {
  id: 'rhythm',
  create(ctx) {
    const { THREE, root, audio, env } = ctx;
    env.set({ top: '#080a19', horizon: '#111327', bottom: '#050710', hemi: ['#8686bf', '#14152b', 0.55], sun: ['#fff', 0] });
    // Beat Saber maps use color 0 for the left red note and color 1 for right blue.
    const colors = ['#ff334e', '#36b9ff'];
    const stage3d = createRhythmStage(ctx, colors);
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
    const stage = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 26).rotateX(-Math.PI / 2), std({ color: '#10182b', roughness: 0.5 }));
    stage.position.z = -11; root.add(stage);
    const trackMat = basic('#569fff', { transparent: true, opacity: 0.3 });
    for (const x of [-0.7, 0, 0.7]) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 24), trackMat); line.position.set(x, 0.012, -11); root.add(line); }
    const title = ctx.label('RITMO DE LUZ', { w: 1.3, h: 0.14, size: 0.45, bg: 'rgba(5,10,25,.65)' }); title.position.set(0, 2.1, -2.4); root.add(title);
    const hint = ctx.label('Corte na direção das setas', { w: 1.5, h: 0.1, size: 0.3 }); hint.position.set(0, 1.78, -1.65); root.add(hint);
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
    const bladeLength = 0.85;
    const handleMat = std({ color: '#32394b', metalness: 0.65, roughness: 0.4 });
    const up = new THREE.Vector3(0, 1, 0);
    const sabers = colors.map((color, side) => {
      const group = new THREE.Group(), bladeMat = basic(color), haloMat = basic(color, { transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
      const flex = new FlexibleBlade(bladeLength), blade = new THREE.Mesh(flex.geometry, bladeMat);
      // Scale the halo only across the blade; its centerline follows the bend.
      const halo = new THREE.Mesh(flex.geometry, haloMat); halo.scale.set(1.8, 1, 1.8);
      group.add(new THREE.Mesh(handleGeo, handleMat), blade, halo); group.visible = false; root.add(group);
      const trailGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(flex.segments * 18), 3));
      const trail = new THREE.Mesh(trailGeo, basic(color, { transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); trail.frustumCulled = false; trail.visible = false; root.add(trail);
      return { group, bladeMat, haloMat, trail, flex, side, owner: null, tracker: null, held: false, base: new THREE.Vector3(), tip: new THREE.Vector3(), prevBase: new THREE.Vector3(), prevTip: new THREE.Vector3(), active: false };
    });
    const fragmentsGeo = new THREE.BoxGeometry(0.115, 0.23, 0.23);
    const fragments = Array.from({ length: 24 }, () => { const mesh = new THREE.Mesh(fragmentsGeo, cubeMats[0]); mesh.visible = false; root.add(mesh); return { mesh, life: 0, velocity: new THREE.Vector3(), spin: 0, axis: new THREE.Vector3(1, 0, 0) }; });
    // Side panels like the Quest game: combo on the left, score and multiplier on the right.
    const comboLabel = ctx.label('', { w: 0.62, h: 0.2, size: 0.34, bg: 'rgba(5,10,25,.55)' }); comboLabel.position.set(-1.25, 1.05, -2.3); comboLabel.rotation.y = 0.35; root.add(comboLabel);
    const scoreLabel = ctx.label('', { w: 0.62, h: 0.2, size: 0.34, bg: 'rgba(5,10,25,.55)' }); scoreLabel.position.set(1.25, 1.05, -2.3); scoreLabel.rotation.y = -0.35; root.add(scoreLabel);
    let panelText = '';
    const speed = 5.5, hitZ = -0.48, travel = 2.7;
    let track = { ...RHYTHM_TRACKS[0], difficulty: 'normal', chart: presetChart(RHYTHM_TRACKS[0], 'normal') };
    let state = 'ready', epoch = 0, time = -3, nextNote = 0, nextBeat = 0, score = 0, combo = 0, best = 0, misses = 0, hits = 0;
    let feedback = 'Escolha música. Toque Jogar.', feedbackLife = 0, source = null, disposed = false;
    let systemPaused = false, manualPaused = false, pickerOpen = false, suspended = false;
    let energy = 100, nextHazard = 0, hazardCooldown = 0;
    const hazards = Array.from({ length: 8 }, () => {
      const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), std({ color: '#151515', emissive: '#ff742f', emissiveIntensity: 0.3 }));
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.2, 0.3), basic('#ff5d89', { wireframe: true, transparent: true, opacity: 0.7 }));
      bomb.visible = wall.visible = false; root.add(bomb, wall);
      return { bomb, wall, mesh: bomb, note: null, previous: new THREE.Vector3(), box: new THREE.Box3() };
    });
    const hazardChart = () => Array.isArray(track.obstacles) ? track.obstacles : track.difficulty === 'easy' ? [] :
      track.chart.filter((n, i) => i > 0 && i % 16 === 0).map((n, i) => ({ at: n.at + 0.2, wall: i % 3 === 2, x: n.x > 0 ? -0.65 : 0.65, y: i % 3 === 2 ? 1.1 : 1.25 }));
    let obstacles = hazardChart();
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
      score = combo = best = misses = hits = nextHazard = 0; energy = 100; hazardCooldown = 0; manualPaused = false; suspended = false; state = 'playing';
      feedback = 'Prepare os sabres'; feedbackLife = 3; playSource(); pauseState();
    };
    const clear = () => { pool.forEach(c => { c.note = null; c.mesh.visible = false; }); fragments.forEach(f => { f.life = 0; f.mesh.visible = false; }); hazards.forEach(h => { h.note = null; h.bomb.visible = h.wall.visible = false; }); };
    const choose = selected => { stopSource(); clear(); track = selected; obstacles = hazardChart(); state = 'ready'; time = -3; manualPaused = false; feedback = 'Pronto · toque Jogar'; updateLabels(); };
    const picker = createMusicPicker(ctx, choose, visible => { pickerOpen = visible; pauseState(); });
    const buttons = new THREE.Group(); root.add(buttons);
    const addButton = (label, x, action) => { const button = ctx.button({ label, w: 0.25, h: 0.075, onClick: action }); button.position.set(x, 0.88, -0.85); buttons.add(button); return button; };
    addButton('Música', -0.39, () => picker.show());
    addButton('Jogar', 0, start);
    const pauseButton = addButton('Pausar / retomar', 0.39, () => { manualPaused = !manualPaused; pauseState(); });
    const trackLabel = ctx.label('', { w: 1.05, h: 0.08, size: 0.32 }); trackLabel.position.set(0, 0.76, -0.85); root.add(trackLabel);
    let grip = 'fist';
    try { if (SABER_GRIPS.includes(localStorage.getItem('bluenav.saberGrip'))) grip = localStorage.getItem('bluenav.saberGrip'); } catch {}
    const gripText = () => grip === 'fist' ? 'Sabre: mão fechada' : 'Sabre: dedos';
    const setGrip = value => {
      if (!SABER_GRIPS.includes(value)) return;
      grip = value;
      try { localStorage.setItem('bluenav.saberGrip', grip); } catch {}
      gripButton.userData.setLabel?.(gripText());
      sabers.forEach(s => { s.tracker = null; s.owner = null; });
      feedback = grip === 'fist' ? 'Feche a mão como se segurasse o cabo' : 'A lâmina sai dos dedos esticados'; feedbackLife = 2;
    };
    const gripButton = ctx.button({ label: gripText(), w: 0.36, h: 0.065, onClick: () => setGrip(grip === 'fist' ? 'fingers' : 'fist') });
    gripButton.position.set(0, 0.665, -0.85); buttons.add(gripButton);
    const updateLabels = () => trackLabel.userData.set(`${track.name} · ${track.bpm ? track.bpm + ' BPM' : 'mapa automático'}`);
    updateLabels();
    const preview = () => { for (let i = 0; i < 4; i++) { const c = pool[i], note = track.chart[i]; if (!note) continue; c.mesh.visible = true; c.mesh.material = cubeMats[note.side]; c.mesh.position.set(note.x, note.y, -2 - i * 0.8); c.arrow.visible = note.direction !== null; c.dot.visible = note.direction === null; c.arrow.rotation.z = arrowRotation(note.direction); } };
    // The block splits along the swing: the halves separate across the cut,
    // keep the saber's momentum and tumble about the cut direction.
    const pieces = (c, cut = null) => {
      let dx = cut ? cut.x : 0, dy = cut ? cut.y : 1; const length = Math.hypot(dx, dy) || 1; dx /= length; dy /= length; if (!cut || length < 1e-6) { dx = 0; dy = 1; }
      const nx = -dy, ny = dx, angle = Math.atan2(ny, nx);
      for (const sign of [-1, 1]) {
        const f = fragments.find(p => p.life <= 0); if (!f) break;
        f.life = 0.8; f.mesh.visible = true; f.mesh.material = cubeMats[c.note.side];
        f.mesh.position.copy(c.mesh.position); f.mesh.position.x += sign * nx * 0.06; f.mesh.position.y += sign * ny * 0.06;
        f.mesh.rotation.set(0, 0, angle);
        f.velocity.set(sign * nx * 1.2 + dx * 1.8, sign * ny * 1.2 + dy * 1.8 + 0.5, 2.2);
        f.axis.set(dx, dy, 0); if (f.axis.lengthSq() < 1e-6) f.axis.set(0, 1, 0); f.axis.normalize(); f.spin = sign * 7;
      }
    };
    ctx.onDispose(() => { disposed = true; stopSource(); picker.dispose(); });
    void pauseButton;
    return {
      chooseMusic: () => picker.show(),
      start,
      choosePreset(id, difficulty = 'normal') { const preset = RHYTHM_TRACKS.find(t => t.id === id); if (preset) choose({ ...preset, difficulty, chart: presetChart(preset, difficulty) }); },
      setGrip,
      setPaused(value) { systemPaused = value; pauseState(); },
      getState: () => ({ grip, heldSabers: sabers.filter(s => s.held).length, state, suspended, time, score, combo, best, misses, hits, energy, track: track.name, notes: track.chart.length, offsetMs: track.offsetMs || 0, activeBlocks: pool.filter(c => c.note).length, activeHazards: hazards.filter(h => h.note).length }),
      update(dt) {
        if (disposed) return;
        pauseState();
        const pointers = ctx.pointers().slice(0, 2), twoHands = pointers.length >= 2, used = new Set();
        for (const s of sabers) { s.wasActive = s.active; s.active = false; s.group.visible = s.trail.visible = false; }
        for (const p of pointers) {
          if (p.source === 'gaze' && state !== 'playing') continue;
          let s = twoHands ? sabers[p.side === 'left' ? 0 : 1] : sabers[1]; if (used.has(s)) s = sabers.find(q => !used.has(q)); used.add(s);
          s.prevBase.copy(s.base); s.prevTip.copy(s.tip);
          if (p.source === 'hand') {
            const native = String(p.hand.id).startsWith('native-');
            if (!s.tracker || s.tracker.native !== native || s.owner !== p.id) { s.tracker = new HandSaberTracker(native); s.tracker.native = native; }
            const pose = s.tracker.update(p.hand, grip, dt);
            s.base.copy(pose.base); s.group.quaternion.setFromUnitVectors(up, pose.dir);
          }
          else { s.base.copy(p.source === 'xr' ? p.handPos : ctx.eye().addScaledVector(p.ray.direction, 0.55)); if (p.source === 'xr') s.group.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 0, -1).applyQuaternion(p.quaternion || new THREE.Quaternion())); else s.group.quaternion.identity(); }
          const length = p.source === 'hand' || p.source === 'xr' ? bladeLength : 0.35;
          s.group.scale.setScalar(length / bladeLength);
          s.tip.set(0, length, 0).applyQuaternion(s.group.quaternion).add(s.base); s.group.position.copy(s.base);
          const resetBlade = s.owner !== p.id || !s.wasActive || s.prevBase.distanceTo(s.base) > 0.5 || suspended;
          s.flex.update(s.base, s.group.quaternion, length / bladeLength, dt, resetBlade);
          s.tip.copy(s.flex.world.at(-1));
          if (resetBlade) { s.prevBase.copy(s.base); s.prevTip.copy(s.tip); }
          s.owner = p.id; s.pointer = p; s.active = true; s.held = false; s.group.visible = true; s.bladeMat.color.set(twoHands ? colors[s.side] : '#8bdcff'); s.haloMat.color.copy(s.bladeMat.color);
          const positions = s.trail.geometry.attributes.position;
          for (let i = 0; i < s.flex.segments; i++) {
            const old = s.flex.previous, now = s.flex.world;
            [old[i], old[i + 1], now[i + 1], old[i], now[i + 1], now[i]].forEach((point, j) => positions.setXYZ(i * 6 + j, point.x, point.y, point.z));
          }
          positions.needsUpdate = true; s.trail.visible = s.tip.distanceTo(s.prevTip) > 0.015;
        }
        // Fast swings can drop hand tracking for a few frames; keep the blade
        // where it was (without cutting) instead of letting it blink out.
        for (const s of sabers) {
          if (s.active) continue;
          if (s.wasActive || s.held) s.held = !!s.tracker && s.pointer?.source === 'hand' && s.tracker.lost(dt);
          if (s.held) { s.group.visible = true; s.prevBase.copy(s.base); s.prevTip.copy(s.tip); }
          else s.owner = null;
        }
        if (state === 'ready') preview();
        if (state === 'playing' && !suspended) {
          const previousTime = time; time = audio.t - epoch;
          hazardCooldown = Math.max(0, hazardCooldown - dt);
          const timingOffset = (track.offsetMs || 0) / 1000;
          while (nextHazard < obstacles.length && obstacles[nextHazard].at + timingOffset - time <= travel) {
            const h = hazards.find(h => !h.note); if (!h) break;
            h.note = obstacles[nextHazard++]; h.mesh = h.note.wall ? h.wall : h.bomb; h.mesh.visible = true; h.hit = false;
            if (h.note.wall) {
              h.wall.scale.x = (h.note.width || 1) * 0.48 / 0.55;
              h.wall.scale.y = (h.note.height || 2.2) / 2.2;
              h.wall.scale.z = (0.3 + speed * (h.note.duration || 0)) / 0.3;
            }
            h.mesh.position.set(h.note.x, h.note.y, hitZ + speed * (time - h.note.at - timingOffset - (h.note.wall ? (h.note.duration || 0) / 2 : 0))); h.previous.copy(h.mesh.position);
          }
          for (const h of hazards) {
            if (!h.note) continue;
            h.previous.copy(h.mesh.position);
            h.mesh.position.z = hitZ + speed * (time - h.note.at - timingOffset - (h.note.wall ? (h.note.duration || 0) / 2 : 0));
            let touched = false;
            if (h.note.wall) {
              h.mesh.updateMatrixWorld(true); h.box.setFromObject(h.mesh).expandByScalar(0.12);
              // Head dodge requires positional VR tracking. In VR Box the hand
              // is tracked but head translation is not, so dodge with the hand.
              touched = ctx.app?.renderer?.xr?.isPresenting ? h.box.containsPoint(ctx.eye()) :
                sabers.some(s => s.active && s.pointer?.source === 'hand' && h.box.containsPoint(s.base));
            }
            else for (const s of sabers) if (s.active) {
              for (let sample = 0; sample < s.flex.world.length; sample++) { a0.copy(s.flex.previous[sample]); a1.copy(s.flex.world[sample]); if (sweptDistanceSq(h.previous, h.mesh.position, a0, a1) < 0.15 ** 2) touched = true; }
            }
            if (touched && !hazardCooldown && !h.hit) {
              energy = Math.max(0, energy - 15); combo = 0;
              if (!h.note.wall) feedback = 'Evite as bombas';
              else if (h.note.crouch) feedback = ctx.app?.renderer?.xr?.isPresenting ? 'Agache para passar' : 'Abaixe a mão';
              else feedback = ctx.app?.renderer?.xr?.isPresenting ? 'Desvie da parede com a cabeça' : 'Afaste a mão da parede';
              feedbackLife = 1; hazardCooldown = 0.4; h.hit = true; audio.thud();
            }
            const rear = h.mesh.position.z - (h.note.wall ? h.wall.scale.z * 0.15 : 0);
            if ((touched && !h.note.wall) || rear > 0.7) { h.note = null; h.mesh.visible = false; }
          }
          if (time >= 0 && !track.buffer) { while (nextBeat * 60 / track.bpm < time + 0.07) { const at = nextBeat * 60 / track.bpm; if (at >= time - 0.1) { const delay = Math.max(0, at - time); audio.tone({ freq: 120, to: 45, dur: 0.16, vol: 0.22, delay }); if (nextBeat % 2) audio.noise({ dur: 0.05, freq: 6500, type: 'highpass', vol: 0.035, delay }); if (nextBeat % 4 === 0) audio.tone({ freq: track.scale[(nextBeat / 4) % track.scale.length], dur: 60 / track.bpm * 2, type: 'triangle', vol: 0.065, delay }); } nextBeat++; } }
          while (nextNote < track.chart.length && track.chart[nextNote].at + timingOffset - time <= travel) { const c = pool.find(c => !c.note); if (!c) break; c.note = track.chart[nextNote++]; c.mesh.material = cubeMats[c.note.side]; c.mesh.visible = true; c.arrow.visible = c.note.direction !== null; c.dot.visible = c.note.direction === null; c.arrow.rotation.z = arrowRotation(c.note.direction); c.mesh.position.set(c.note.x, c.note.y, hitZ + speed * (time - c.note.at - timingOffset)); c.previous.copy(c.mesh.position); }
          for (const c of pool) {
            if (!c.note) continue;
            c.previous.copy(c.mesh.position); c.mesh.position.z = hitZ + speed * (time - c.note.at - timingOffset); let cut = false, badCut = false;
            for (const s of sabers) {
              if (!s.active) continue;
              let distance = Infinity;
              for (let sample = 0; sample < s.flex.world.length; sample++) {
                a0.copy(s.flex.previous[sample]);
                a1.copy(s.flex.world[sample]);
                const candidate = sweptDistanceSq(c.previous, c.mesh.position, a0, a1);
                if (candidate < distance) { distance = candidate; motion.copy(a1).sub(a0); }
              }
              if (distance > 0.145 ** 2) continue;
              const result = cutResult({ side: s.side, noteSide: c.note.side, twoHands, motionX: motion.x, motionY: motion.y, motionZ: motion.z, speed: motion.length() / Math.max(dt, 0.001), direction: c.note.direction, timing: time - c.note.at - timingOffset, centerError: Math.sqrt(distance) });
              if (!result.hit) {
                feedback = result.reason; feedbackLife = 0.8;
                if (result.penalty) { badCut = true; stage3d.miss(); misses++; combo = 0; energy = Math.max(0, energy - 10); audio.thud(); break; }
                continue;
              }
              pieces(c, motion); stage3d.hit(c.note.side); score += result.points * Math.min(8, 1 + Math.floor(combo / 8)); combo++; hits++; energy = Math.min(100, energy + 2); best = Math.max(best, combo); feedback = result.perfect ? 'PERFEITO' : 'BOM CORTE'; feedbackLife = 0.6; cut = true; audio.noise({ dur: 0.045, freq: 2200, vol: 0.05 }); s.pointer?.gamepad?.hapticActuators?.[0]?.pulse?.(0.3, 35)?.catch?.(() => {}); break;
            }
            if (cut || badCut || c.mesh.position.z > 0.55) { if (!cut && !badCut) { stage3d.miss(); misses++; combo = 0; energy = Math.max(0, energy - 8); feedback = 'PERDEU'; feedbackLife = 0.5; } c.note = null; c.mesh.visible = false; }
          }
          feedbackLife = Math.max(0, feedbackLife - (time - previousTime));
          if (time > track.duration + 1 + timingOffset && !pool.some(c => c.note)) { state = 'finished'; stopSource(); feedback = `Concluído · ${hits}/${hits + misses} cortes`; }
        }
        if (!suspended) for (const f of fragments) if (f.life > 0) {
          f.life -= dt; f.mesh.visible = f.life > 0; f.velocity.y -= dt * 9.81; f.mesh.position.addScaledVector(f.velocity, dt); f.mesh.rotateOnWorldAxis(f.axis, f.spin * dt);
          // Halves bounce on the floor and slide to a stop.
          if (f.mesh.position.y < 0.06) { f.mesh.position.y = 0.06; f.velocity.y = Math.abs(f.velocity.y) * 0.3; f.velocity.x *= 0.7; f.velocity.z *= 0.7; f.spin *= 0.6; }
        }
        stage3d.update(dt, time, track.bpm, state === 'playing' && !suspended);
        const multiplier = Math.min(8, 1 + Math.floor(combo / 8)), nextPanel = `${combo}|${score}|${multiplier}|${energy}`;
        if (nextPanel !== panelText) { panelText = nextPanel; comboLabel.userData.set(`COMBO ${combo}`); scoreLabel.userData.set(`${score} · x${multiplier} · ${Math.round(energy)}%`); }
        const status = suspended ? 'PAUSADO' : state === 'playing' && time < 0 ? `COMEÇA EM ${Math.ceil(-time)}` : feedbackLife > 0 || state !== 'playing' ? feedback : 'Corte na direção das setas';
        hint.userData.set(status);
        if (state === 'playing' && time >= 0 && ctx.app?.hud?.guideTime > 0) {
          ctx.app.hud.guideTime = 0;
          ctx.app.hud.guide.visible = false;
        }
        ctx.hud(`${score} · combo ${combo} · ${energy}%`, status);
      },
    };
  },
};
