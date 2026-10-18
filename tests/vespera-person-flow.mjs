import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts/characters', { recursive: true });
try {
  await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:8083'}/vespera-rpg2/`);
  await page.waitForFunction(() => window.Vespera?.classes && window.VesperaVR);
  const report = await page.evaluate(async () => {
    const THREE = await import('./vendor/three.module.js');
    const { createPerson, CLASS_VISUALS } = await import('./vr-person.js');
    const classes = window.Vespera.classes;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#ebe5d6');
    scene.add(new THREE.HemisphereLight('#fff8e8', '#697668', 2.4));
    const light = new THREE.DirectionalLight('#fff4df', 2.2); light.position.set(-5, 8, -5); scene.add(light);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#d8d5c5', roughness: 1 })); ground.position.y = -.025; scene.add(ground);
    const records = [];
    classes.forEach((c, i) => {
      const person = createPerson({ classId: c.id, appearance: i % 2 ? 'male' : 'female' }, c.color, window.Vespera.items);
      person.position.set((i % 7 - (i < 7 ? 3 : 2.5)) * 1.14, 0, i < 7 ? 1.3 : -1.5); scene.add(person);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
      const context = canvas.getContext('2d'); context.fillStyle = '#314737'; context.textAlign = 'center'; context.font = '600 23px system-ui'; context.fillText(c.name, 128, 37, 250);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(.96, .24), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
      label.position.set(person.position.x, -.02, person.position.z - .48); label.rotation.x = -Math.PI / 2; label.rotateZ(Math.PI); scene.add(label);
      let meshes = 0; person.traverse(object => { if (object.isMesh) meshes++; });
      records.push({ classId: c.id, represented: !!CLASS_VISUALS[c.id], weapon: person.userData.visual.weapon, meshes });
    });
    const camera = new THREE.PerspectiveCamera(43, 1.6, .1, 50); camera.position.set(0, 4.1, -8); camera.lookAt(0, .77, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(1600, 1000); renderer.setPixelRatio(1); renderer.setClearColor('#ebe5d6');
    renderer.domElement.id = 'person-gallery'; Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '10000' }); document.body.append(renderer.domElement);
    renderer.render(scene, camera);
    window.__personGallery = { renderer, scene, camera };
    return { records, calls: renderer.info.render.calls };
  });
  assert.equal(report.records.length, 13); assert.ok(report.records.every(record => record.represented && record.meshes <= 18));
  assert.deepEqual(errors, []); await page.screenshot({ path: 'artifacts/characters/vespera-classes.png' });
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
