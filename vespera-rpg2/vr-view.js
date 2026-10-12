// WebXR view of the existing illustrated game. The canvas remains the source of
// truth, so its current art, save data, combat and network play keep working.
import * as THREE from './vendor/three.module.js';
import { createSpatialWorld } from './vr-world.js';

const worldCanvas = document.getElementById('world');
const button = document.createElement('button');
button.id = 'vr-toggle';
button.type = 'button';
button.textContent = 'Entrar em VR';
button.setAttribute('aria-label', 'Entrar em VR com rastreamento das mãos');
document.body.append(button);
const style = document.createElement('style');
style.textContent = '#vr-toggle{position:fixed;right:14px;bottom:14px;z-index:2200;background:#1b2636;color:#f6e9ca;border:1px solid #c4a875;border-radius:10px;padding:11px 17px;font:600 14px system-ui;cursor:pointer}#vr-toggle:disabled{opacity:.55;cursor:not-allowed}#vespera-vr-canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:2100;display:none}';
document.head.append(style);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#111923');
const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);
camera.position.set(0, 1.65, 0);
scene.add(new THREE.HemisphereLight('#fff3de', '#29384a', 2.2));
const lamp = new THREE.DirectionalLight('#fff1ce', 2.5); lamp.position.set(-3, 5, 2); scene.add(lamp);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.xr.enabled = true;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.id = 'vespera-vr-canvas';
document.body.append(renderer.domElement);

const canvasTexture = new THREE.CanvasTexture(worldCanvas);
canvasTexture.colorSpace = THREE.SRGBColorSpace;
canvasTexture.minFilter = THREE.LinearFilter;
canvasTexture.magFilter = THREE.LinearFilter;
// The original painted view stays available as a small map. The 3D world is
// built from the live simulation in vr-world.js and fills the headset view.
const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .65), new THREE.MeshBasicMaterial({ map: canvasTexture, side: THREE.DoubleSide }));
screen.position.set(-.8, 1.35, -1.4); scene.add(screen);
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#654f3c', roughness: .65, metalness: .22 });
const frame = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 8, 64), frameMaterial);
frame.scale.set(.58, .34, 1); frame.position.copy(screen.position); frame.position.z -= .02; scene.add(frame);
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ color: '#344636', roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.03; scene.add(floor);
for (const x of [-2.2, 2.2]) {
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, 2.6, 14), frameMaterial);
  pillar.position.set(x, 1.3, -2.7); scene.add(pillar);
  const light = new THREE.PointLight('#ffd89a', 3.5, 3); light.position.set(x, 2.6, -2.4); scene.add(light);
}

function labelTexture(title, detail = '') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 180;
  const draw = () => {
    const c = canvas.getContext('2d'); c.clearRect(0, 0, 1024, 180);
    c.fillStyle = '#172130ee'; c.roundRect(4, 4, 1016, 172, 25); c.fill();
    c.strokeStyle = '#c4a875'; c.lineWidth = 5; c.stroke();
    c.fillStyle = '#f6e9ca'; c.textAlign = 'center'; c.font = 'bold 46px system-ui';
    c.fillText(title.slice(0, 43), 512, detail ? 72 : 112, 940);
    if (detail) { c.font = '32px system-ui'; c.fillStyle = '#d7d2c5'; c.fillText(detail.slice(0, 70), 512, 135, 950); }
  };
  draw(); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, set(nextTitle, nextDetail = '') { title = nextTitle; detail = nextDetail; draw(); texture.needsUpdate = true; } };
}
const questLabel = labelTexture('VÉSPERA', 'Comece sua aventura na tela antes de entrar em VR');
const quest = new THREE.Mesh(new THREE.PlaneGeometry(2.85, .5), new THREE.MeshBasicMaterial({ map: questLabel.texture, transparent: true }));
quest.position.set(0, 2.55, -2.1); scene.add(quest);

const controls = [
  { title: '↑', key: 'w', x: -.75, y: .52 }, { title: '←', key: 'a', x: -.25, y: .52 },
  { title: '↓', key: 's', x: .25, y: .52 }, { title: '→', key: 'd', x: .75, y: .52 },
  { title: 'Interagir', key: 'e', x: -1.08, y: .18 }, { title: 'Atacar', key: ' ', x: -.36, y: .18 },
  { title: 'Habilidade', key: 'q', x: .36, y: .18 }, { title: 'Menu', key: 'Escape', x: 1.08, y: .18 },
];
const targets = [];
for (const control of controls) {
  const text = labelTexture(control.title);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.62, .25), new THREE.MeshBasicMaterial({ map: text.texture, transparent: true, side: THREE.DoubleSide }));
  mesh.position.set(control.x, control.y, -1.2); mesh.userData.key = control.key; scene.add(mesh); targets.push(mesh);
}
const raycaster = new THREE.Raycaster();
const held = new Map();
const pinchedSources = new Set();
const spatialWorld = createSpatialWorld(scene, () => window.GameSession);
function emitKey(key, down) {
  if (!key) return;
  document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true }));
}
function release(source) {
  const key = held.get(source);
  if (key) {
    emitKey(key, false);
    targets.find(target => target.userData.key === key)?.scale.setScalar(1);
  }
  held.delete(source);
}
function press(source, ray) {
  raycaster.ray.copy(ray); raycaster.far = 3.5;
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (hit) {
    const key = hit.object.userData.key; held.set(source, key); emitKey(key, true);
    hit.object.scale.setScalar(.92); return;
  }
  const choices = spatialWorld.interactables;
  const worldHit = raycaster.intersectObjects(choices.map(item => item.mesh), false)[0];
  if (!worldHit) return;
  const choice = choices.find(item => item.mesh === worldHit.object);
  const player = window.GameSession?.player;
  if (!choice || !player || Math.hypot(choice.entity.x - player.x, choice.entity.y - player.y) > 2.2) return;
  window.GameSession.command(choice.kind === 'monster' ? 'attack' : 'interact');
}
function handRay(frame, inputSource, reference) {
  const hand = inputSource.hand;
  if (!hand) return null;
  const wristJoint = hand.get('wrist'), baseJoint = hand.get('index-finger-phalanx-proximal') || wristJoint;
  const tipJoint = hand.get('index-finger-tip'), thumbJoint = hand.get('thumb-tip');
  if (!wristJoint || !tipJoint || !thumbJoint) return null;
  const wrist = frame.getJointPose(wristJoint, reference);
  const base = frame.getJointPose(baseJoint, reference);
  const tip = frame.getJointPose(tipJoint, reference);
  const thumb = frame.getJointPose(thumbJoint, reference);
  if (!wrist || !base || !tip || !thumb) return null;
  const origin = new THREE.Vector3(base.transform.position.x, base.transform.position.y, base.transform.position.z);
  const fingertip = new THREE.Vector3(tip.transform.position.x, tip.transform.position.y, tip.transform.position.z);
  const thumbtip = new THREE.Vector3(thumb.transform.position.x, thumb.transform.position.y, thumb.transform.position.z);
  const direction = fingertip.clone().sub(origin).normalize();
  return { ray: new THREE.Ray(fingertip, direction), pinched: fingertip.distanceTo(thumbtip) < .028 };
}
let activeSession = null, lastQuest = '';
const rays = new Map();
let lastFrameTime = 0;
renderer.setAnimationLoop((time, frame) => {
  if (!activeSession || !frame) return;
  spatialWorld.update(lastFrameTime ? (time - lastFrameTime) / 1000 : 0); lastFrameTime = time;
  canvasTexture.needsUpdate = true;
  const title = document.getElementById('quest-title')?.textContent?.trim() || 'Explore Véspera';
  const goal = document.getElementById('quest-goal')?.textContent?.trim() || 'Explore, lute e conclua as missões do diário.';
  const current = title + '|' + goal;
  if (current !== lastQuest) { lastQuest = current; questLabel.set(title, goal); }
  const reference = renderer.xr.getReferenceSpace();
  const seen = new Set();
  if (reference) for (const source of activeSession.inputSources) {
    const hand = handRay(frame, source, reference);
    if (!hand) continue;
    seen.add(source);
    let line = rays.get(source);
    if (!line) {
      line = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 1.5, '#f6d591', .11, .035);
      scene.add(line); rays.set(source, line);
    }
    line.position.copy(hand.ray.origin); line.setDirection(hand.ray.direction);
    line.setColor(hand.pinched ? '#7ce4c0' : '#f6d591');
    if (hand.pinched && !pinchedSources.has(source)) { pinchedSources.add(source); press(source, hand.ray); }
    if (!hand.pinched && pinchedSources.has(source)) { pinchedSources.delete(source); release(source); }
  }
  for (const source of pinchedSources) if (!seen.has(source)) { pinchedSources.delete(source); release(source); }
  renderer.render(scene, camera);
});

async function enterVR() {
  if (activeSession) { await activeSession.end(); return; }
  if (!navigator.xr) return;
  if (!document.getElementById('home')?.classList.contains('hidden')) {
    button.textContent = 'Comece a aventura primeiro'; setTimeout(() => button.textContent = 'Entrar em VR', 2500); return;
  }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'dom-overlay'], domOverlay: { root: document.body },
    });
    activeSession = session;
    renderer.domElement.style.display = 'block'; button.textContent = 'Sair do VR';
    session.addEventListener('end', () => {
      for (const source of held.keys()) release(source);
      pinchedSources.clear(); lastFrameTime = 0;
      for (const line of rays.values()) scene.remove(line);
      rays.clear();
      for (const mesh of targets) mesh.scale.setScalar(1);
      activeSession = null; renderer.domElement.style.display = 'none'; button.textContent = 'Entrar em VR';
    }, { once: true });
    session.addEventListener('selectstart', event => {
      if (event.inputSource.hand) return;
      const pose = event.frame?.getPose(event.inputSource.targetRaySpace, renderer.xr.getReferenceSpace());
      if (!pose) return;
      const t = pose.transform;
      const ray = new THREE.Ray(
        new THREE.Vector3(t.position.x, t.position.y, t.position.z),
        new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w)));
      press(event.inputSource, ray);
    });
    session.addEventListener('selectend', event => release(event.inputSource));
    await renderer.xr.setSession(session);
  } catch (error) {
    if (activeSession) await activeSession.end().catch(() => {});
    button.textContent = 'VR indisponível'; console.warn('Véspera VR:', error);
    setTimeout(() => button.textContent = 'Entrar em VR', 2500);
  }
}
button.addEventListener('click', enterVR);
if (!navigator.xr?.isSessionSupported) { button.disabled = true; button.title = 'Navegador sem WebXR'; }
else navigator.xr.isSessionSupported('immersive-vr').then(supported => { button.disabled = !supported; if (!supported) button.title = 'Headset VR não detectado'; }).catch(() => { button.disabled = true; });
window.VesperaVR = { button, scene, controls, spatialWorld, enterVR };
