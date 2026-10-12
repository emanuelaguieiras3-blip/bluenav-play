// Neon stage for the saber game, in the style of VR rhythm games on Quest:
// rotating laser fans, ring tunnel, glowing track edges and a back light that
// flash in the color of each cut and pulse with the beat. Everything is
// additive MeshBasic: no lights, cheap in stereo.
import * as THREE from 'three';

export function createRhythmStage(ctx, colors = ['#ff334e', '#36b9ff']) {
  const { root } = ctx, group = new THREE.Group(); group.name = 'rhythm-stage'; root.add(group);
  const glow = (color, opacity = 0.8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const tint = colors.map(c => new THREE.Color(c)), white = new THREE.Color('#ffffff');
  const flash = [0, 0]; let beat = 0, missFlash = 0;

  // Track edges: two thin light strips that run to the horizon.
  const edges = [-1, 1].map((side, i) => {
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 34, 6).rotateX(Math.PI / 2), glow(colors[i], 0.9));
    strip.position.set(side * 1.6, 0.02, -15); group.add(strip); return strip;
  });
  // Ring tunnel far down the track.
  const ringCount = ctx.lowEnd ? 8 : 14;
  const ringMat = glow('#8fa6ff', 0.35);
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.05, 6, 48), ringMat);
    ring.position.set(0, 2.2, -14 - i * 2.4); group.add(ring); return ring;
  });
  // Laser fans on both sides.
  const laserGeo = new THREE.CylinderGeometry(0.025, 0.025, 30, 6).translate(0, 15, 0);
  const lasers = [];
  for (const [i, side] of [[0, -1], [1, 1]]) for (let k = 0; k < 4; k++) {
    const pivot = new THREE.Group(); pivot.position.set(side * (5 + k * 1.2), 0, -10 - k * 5);
    const beam = new THREE.Mesh(laserGeo, glow(colors[i], 0.55)); pivot.add(beam); group.add(pivot);
    lasers.push({ pivot, beam, side, i, k });
  }
  // Big back light (a soft disc with a glow halo).
  const back = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), glow('#3d4cff', 0.25)); back.position.set(0, 3.2, -42); group.add(back);
  const backRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 8, 64), glow('#9fb0ff', 0.6)); backRing.position.copy(back.position); group.add(backRing);
  // Floor panels in front of the player light up with each hit.
  const pads = [0, 1].map(i => {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2).rotateX(-Math.PI / 2), glow(colors[i], 0.0)); pad.position.set(i ? 0.75 : -0.75, 0.015, -2.4); group.add(pad); return pad;
  });

  return {
    group,
    hit(side) { flash[side] = 1; },
    miss() { missFlash = 1; },
    update(dt, time, bpm, playing) {
      const beatLength = 60 / Math.max(40, bpm || 120);
      const phase = playing && time > 0 ? (time % beatLength) / beatLength : 0;
      const pulse = playing ? Math.pow(1 - phase, 3) : 0.15;
      const newBeat = playing && time > 0 ? Math.floor(time / beatLength) : -1;
      if (newBeat !== beat) beat = newBeat;
      for (let i = 0; i < 2; i++) flash[i] = Math.max(0, flash[i] - dt * 3.5);
      missFlash = Math.max(0, missFlash - dt * 3);
      edges.forEach((e, i) => { e.material.opacity = 0.45 + pulse * 0.3 + flash[i] * 0.6; e.material.color.copy(tint[i]).lerp(white, flash[i] * 0.5); });
      pads.forEach((p, i) => { p.material.opacity = flash[i] * 0.22; });
      const spin = playing ? time * 0.25 : 0;
      rings.forEach((r, i) => {
        r.rotation.z = spin * (i % 2 ? 1 : -1) + i * 0.13 + (beat % 8) * 0.04 * i;
        const s = 1 + pulse * 0.04 * (1 - i / rings.length); r.scale.set(s, s, 1);
      });
      ringMat.opacity = 0.18 + pulse * 0.25 + Math.max(flash[0], flash[1]) * 0.3;
      ringMat.color.set('#8fa6ff').lerp(tint[flash[0] > flash[1] ? 0 : 1], Math.max(flash[0], flash[1]) * 0.7).lerp(white, missFlash * 0.0);
      for (const l of lasers) {
        const t = time * (0.6 + l.k * 0.15) + l.k * 0.8;
        l.pivot.rotation.z = l.side * (0.35 + Math.sin(t) * 0.35);
        l.pivot.rotation.x = -0.25 + Math.cos(t * 0.7) * 0.15;
        l.beam.material.opacity = 0.25 + pulse * 0.35 + flash[l.i] * 0.4;
      }
      back.material.opacity = 0.18 + pulse * 0.2; backRing.rotation.z += dt * 0.2;
      back.material.color.set(missFlash > 0 ? '#ff2a2a' : '#3d4cff');
    },
  };
}
