// Saguão: céu azul calmo, piso circular e o menu em arco
export default {
  id: 'lobby',
  create(ctx) {
    const { THREE, root, env } = ctx;
    env.set({ top: '#7d8a99', horizon: '#dfe3e8', bottom: '#2a2c30', sharp: 0.8, fog: { color: '#dfe3e8', near: 12, far: 60 }, hemi: ['#ffffff', '#3a3c40', 1.6], sun: ['#ffffff', 1.0] });
    ctx.teleport({ enabled: true, walk: true, check: (p) => Math.hypot(p.x, p.z) < 7 });

    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#3a3d43' }));
    root.add(floor);
    for (let i = 1; i <= 7; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(i - 0.01, i + 0.01, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12 / i + 0.03 }));
      ring.position.y = 0.002; root.add(ring);
    }
    // partículas flutuando devagar
    const n = 300, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 10; pos.set([Math.cos(a) * r, Math.random() * 6, Math.sin(a) * r], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.02, transparent: true, opacity: 0.5 }));
    root.add(pts);

    const info = ctx.label('Pince para selecionar · olhe para a palma e pince para abrir o menu', { w: 1.3, h: 0.07, size: 0.36, sub: null });
    info.position.set(0, 2.55, -2.2); info.rotation.x = 0.35;
    root.add(info);

    return {
      update(dt, t) {
        pts.rotation.y = t * 0.01;
        pts.position.y = Math.sin(t * 0.3) * 0.05;
      },
    };
  },
};
