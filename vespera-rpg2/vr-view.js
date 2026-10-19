// WebXR view of the existing illustrated game. The canvas remains the source of
// truth, so its current art, save data, combat and network play keep working.
import * as THREE from './vendor/three.module.js';
import { createSpatialWorld } from './vr-world.js';
import { pinchMovement, stickMovement } from './vr-gesture.js';
import { createPhoneView } from './vr-phone.js';

const worldCanvas = document.getElementById('world');
const button = document.createElement('button');
button.id = 'vr-toggle';
button.type = 'button';
button.textContent = 'Entrar em VR';
button.setAttribute('aria-label', 'Entrar em VR com rastreamento das mãos');
document.body.append(button);
const phoneButton = document.createElement('button');
phoneButton.id = 'vr-phone-toggle'; phoneButton.type = 'button'; phoneButton.textContent = 'VR Box';
phoneButton.setAttribute('aria-label', 'Entrar no VR Box com tela dividida');
document.body.append(phoneButton);
const status = document.createElement('div'); status.id = 'vr-status'; status.setAttribute('role', 'status');
document.body.append(status);
const style = document.createElement('style');
style.textContent = '#vr-status{position:fixed;bottom:70px;left:10%;right:10%;z-index:2300;color:white;background:#172130;border-radius:12px;padding:12px;text-align:center}#vr-status:empty{display:none}#vr-phone-toggle{position:fixed;left:14px;bottom:14px;z-index:2200}body.vespera-vr #hud,body.vespera-vr #touch-controls,body.vespera-vr .topbar{visibility:hidden}body.vespera-vr #vr-toggle,body.vespera-vr #vr-phone-toggle{visibility:visible}#vr-toggle{position:fixed;right:14px;bottom:14px;z-index:2200;background:#1b2636;color:#f6e9ca;border:1px solid #c4a875;border-radius:10px;padding:11px 17px;font:600 14px system-ui;cursor:pointer}#vr-toggle:disabled{opacity:.55;cursor:not-allowed}#vespera-vr-canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:2100;display:none}';
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
// Three.js creates canvases with inline display:block, overriding the CSS rule.
renderer.domElement.style.display = 'none';
document.body.append(renderer.domElement);
const phone = createPhoneView(renderer, camera);
let xrSupported = false, entering = false;
function resizeVR() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeVR);
function notify(message) { status.textContent = message; }
const requestedVR = new URLSearchParams(location.search).get('mode') === 'vr';
if (requestedVR) {
  notify('Prepare ou continue sua aventura. Depois toque em Entrar em VR (headset) ou VR Box (celular).');
  window.addEventListener('game-started', () => {
    notify('Aventura pronta. Toque em Entrar em VR para headset ou VR Box para celular.');
  });
}


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
const closeQuestLabel = labelTexture('×');
const questClose = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), new THREE.MeshBasicMaterial({ map: closeQuestLabel.texture, transparent: true, side: THREE.DoubleSide }));
questClose.position.set(1.55, 2.55, -2.08); questClose.userData.action = 'dismiss-quest'; scene.add(questClose);
const gestureLabel = labelTexture('MÃO ESQUERDA: PINÇA + MOVER', 'Mão direita: aponte e faça pinça para agir');
const gestureHelp = new THREE.Mesh(new THREE.PlaneGeometry(2.35, .4), new THREE.MeshBasicMaterial({ map: gestureLabel.texture, transparent: true }));
gestureHelp.position.set(0, 2.06, -1.9); scene.add(gestureHelp);

const controls = [
  { title: '↑', key: 'w', x: -.75, y: .52 }, { title: '←', key: 'a', x: -.25, y: .52 },
  { title: '↓', key: 's', x: .25, y: .52 }, { title: '→', key: 'd', x: .75, y: .52 },
  { title: 'Interagir', key: 'e', x: -1.08, y: .18 }, { title: 'Atacar', key: ' ', x: -.36, y: .18 },
  { title: 'Habilidade', key: 'q', x: .36, y: .18 }, { title: 'Menu', key: 'Escape', x: 1.08, y: .18 },
];
const menuPanel = new THREE.Group(); scene.add(menuPanel);
const menuBackground = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.12), new THREE.MeshBasicMaterial({ color: '#172130', side: THREE.DoubleSide }));
menuBackground.position.set(0, .35, -1.23); menuPanel.add(menuBackground);
const targets = [];
targets.push(questClose);
for (const control of controls) {
  const text = labelTexture(control.title);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.62, .25), new THREE.MeshBasicMaterial({ map: text.texture, transparent: true, side: THREE.DoubleSide }));
  mesh.position.set(control.x, control.y, -1.2); mesh.userData.key = control.key; menuPanel.add(mesh); targets.push(mesh);
}
for (const [title, action, x] of [['Recentralizar', 'recenter', -.85], ['Fechar painel', 'close-menu', 0], ['Sair do VR', 'exit-vr', .85]]) {
  const label = labelTexture(title);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.76, .24), new THREE.MeshBasicMaterial({ map: label.texture, transparent: true, side: THREE.DoubleSide }));
  mesh.position.set(x, -.14, -1.2); mesh.userData.action = action; menuPanel.add(mesh); targets.push(mesh);
}
function placeMenu() {
  const viewer = activeSession ? renderer.xr.getCamera(camera) : camera;
  viewer.getWorldPosition(menuPanel.position);
  const rotation = new THREE.Euler().setFromQuaternion(viewer.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
  menuPanel.rotation.set(0, rotation.y, 0); menuPanel.position.y -= .5;
  menuPanel.visible = true;
}
function visibleTarget(target) { for (let node = target; node; node = node.parent) if (!node.visible) return false; return true; }
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
  if (source === walkingSource) {
    walkingSource = walkingAnchor = null;
    window.GameSession?.setVRMovement?.(0, 0);
  }
}
function press(source, ray) {
  raycaster.ray.copy(ray); raycaster.far = 3.5;
  const hit = raycaster.intersectObjects(targets.filter(visibleTarget), false)[0];
  if (hit) {
    const action = hit.object.userData.action;
    if (action === 'exit-vr') { exitVR(); return true; }
    if (action === 'close-menu') { menuPanel.visible = false; return true; }
    if (action === 'recenter') { phone.recenter(); placeMenu(); return true; }
    if (hit.object.userData.key === 'Escape') { menuPanel.visible = false; return true; }
    if (action === 'dismiss-quest') {
      quest.visible = questClose.visible = false;
      return true;
    }
    const key = hit.object.userData.key; held.set(source, key); emitKey(key, true);
    hit.object.scale.setScalar(.92); return true;
  }
  raycaster.far = 8;
  const choices = spatialWorld.interactables;
  const worldHit = raycaster.intersectObjects(choices.map(item => item.mesh), false)[0];
  if (!worldHit) return false;
  const choice = choices.find(item => item.mesh === worldHit.object);
  const player = window.GameSession?.player;
  if (!choice || !player || choice.kind === 'player') return false;
  const distance = Math.hypot(choice.entity.x - player.x, choice.entity.y - player.y);
  if (choice.kind === 'monster') {
    if (distance >= (window.Vespera?.stats(player).range || 1.8)) return false;
    window.GameSession.command('attack', { targetId: choice.entity.id });
  } else {
    if (distance > 2.2) return false;
    window.GameSession.command('interact');
  }
  return true;
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
  return { ray: new THREE.Ray(fingertip, direction), pinchDistance: fingertip.distanceTo(thumbtip), wrist: new THREE.Vector3(wrist.transform.position.x, wrist.transform.position.y, wrist.transform.position.z) };
}
const jointNames = [
  'wrist',
  ...['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].flatMap(finger =>
    finger === 'thumb'
      ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
      : [`${finger}-metacarpal`, `${finger}-phalanx-proximal`, `${finger}-phalanx-intermediate`, `${finger}-phalanx-distal`, `${finger}-tip`]),
];
const bonePairs = [];
for (let start = 1; start < jointNames.length;) {
  const length = start === 1 ? 4 : 5;
  bonePairs.push([0, start]);
  for (let i = start; i < start + length - 1; i++) bonePairs.push([i, i + 1]);
  start += length;
}
const handModels = new Map();
const jointDummy = new THREE.Object3D();
function updateHandModel(source, frame, reference) {
  let model = handModels.get(source);
  if (!model) {
    const color = source.handedness === 'left' ? '#8ad8d1' : '#f3c58e';
    const joints = new THREE.InstancedMesh(new THREE.SphereGeometry(.013, 8, 6), new THREE.MeshBasicMaterial({ color }), jointNames.length);
    joints.frustumCulled = false;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bonePairs.length * 6), 3));
    const bones = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .85 }));
    scene.add(joints, bones); model = { joints, bones }; handModels.set(source, model);
  }
  const positions = jointNames.map(name => {
    const space = source.hand.get(name), pose = space && frame.getJointPose(space, reference);
    return pose ? new THREE.Vector3(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z) : null;
  });
  if (!positions[0]) { model.joints.visible = model.bones.visible = false; return; }
  model.joints.visible = model.bones.visible = true;
  positions.forEach((position, i) => {
    jointDummy.position.copy(position || positions[0]); jointDummy.scale.setScalar(position ? 1 : .001);
    jointDummy.updateMatrix(); model.joints.setMatrixAt(i, jointDummy.matrix);
  });
  model.joints.instanceMatrix.needsUpdate = true;
  const points = model.bones.geometry.attributes.position;
  bonePairs.forEach(([a, b], i) => {
    const from = positions[a] || positions[0], to = positions[b] || from;
    points.setXYZ(i * 2, from.x, from.y, from.z);
    points.setXYZ(i * 2 + 1, to.x, to.y, to.z);
  });
  points.needsUpdate = true; model.bones.geometry.computeBoundingSphere();
}
function removeHandModel(source) {
  const model = handModels.get(source); if (!model) return;
  scene.remove(model.joints, model.bones);
  model.joints.geometry.dispose(); model.joints.material.dispose();
  model.bones.geometry.dispose(); model.bones.material.dispose(); handModels.delete(source);
}
let activeSession = null, lastQuest = '', helpMode = '';
const rays = new Map();
let walkingSource = null, walkingAnchor = null;
let lastFrameTime = 0;
const menuPressed = new Set();
function showRay(source, ray, active) {
  let line = rays.get(source);
  if (!line) {
    line = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 1.5, '#f6d591', .11, .035);
    scene.add(line); rays.set(source, line);
  }
  line.position.copy(ray.origin); line.setDirection(ray.direction);
  line.setColor(active ? '#7ce4c0' : '#f6d591');
}
const gazeSource = {}, gazeRay = new THREE.Ray();
let gazeTarget = null, gazeStart = 0, gazeFired = false;
const crosshair = new THREE.Mesh(new THREE.RingGeometry(.009, .013, 16), new THREE.MeshBasicMaterial({ color: '#f6d591', depthTest: false }));
crosshair.position.set(0, 0, -.65); camera.add(crosshair); scene.add(camera); crosshair.visible = false;
renderer.setAnimationLoop((time, frame) => {
  if (phone.active) {
    window.GameSession?.tickVR?.(time);
    spatialWorld.update(lastFrameTime ? (time - lastFrameTime) / 1000 : 0); lastFrameTime = time;
    phone.update(); canvasTexture.needsUpdate = true;
    camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
    camera.getWorldPosition(gazeRay.origin); camera.getWorldDirection(gazeRay.direction);
    raycaster.ray.copy(gazeRay); raycaster.far = 3.5;
    const target = raycaster.intersectObjects(targets.filter(visibleTarget), false)[0]?.object;
    if (target !== gazeTarget) { release(gazeSource); gazeTarget = target; gazeStart = time; gazeFired = false; }
    if (target && !gazeFired && time - gazeStart > 1000) { press(gazeSource, gazeRay); gazeFired = true; }
    crosshair.material.color.set(target ? '#7ce4c0' : '#f6d591');
    gestureLabel.set('VR BOX: OLHE PARA SELECIONAR', phone.sensorActive ? 'Segure o olhar por 1 segundo; V: menu' : 'Sem sensor: arraste a tela para olhar; V: menu');
    phone.render(scene); return;
  }
  if (!activeSession || !frame) return;
  window.GameSession?.tickVR?.(time);
  spatialWorld.update(lastFrameTime ? (time - lastFrameTime) / 1000 : 0); lastFrameTime = time;
  canvasTexture.needsUpdate = true;
  const title = document.getElementById('quest-title')?.textContent?.trim() || 'Explore Véspera';
  const goal = document.getElementById('quest-goal')?.textContent?.trim() || 'Explore, lute e conclua as missões do diário.';
  const current = title + '|' + goal;
  if (current !== lastQuest) { lastQuest = current; questLabel.set(title, goal); }
  const reference = renderer.xr.getReferenceSpace();
  const seen = new Set();
  let handsSeen = 0, handMovement = { x: 0, y: 0 };
  if (reference) for (const source of activeSession.inputSources) {
    if (!source.hand) {
      const down = source.gamepad?.buttons?.[4]?.pressed;
      if (down && !menuPressed.has(source)) { menuPressed.add(source); placeMenu(); }
      if (!down) menuPressed.delete(source);
      const pose = frame.getPose(source.targetRaySpace, reference);
      if (!pose) continue;
      const t = pose.transform;
      const ray = new THREE.Ray(new THREE.Vector3(t.position.x, t.position.y, t.position.z),
        new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w)));
      seen.add(source); showRay(source, ray, held.has(source));
      continue;
    }
    const hand = handRay(frame, source, reference);
    if (!hand) continue;
    seen.add(source); handsSeen++;
    updateHandModel(source, frame, reference);
    const pinched = pinchedSources.has(source) ? hand.pinchDistance < .045 : hand.pinchDistance < .028;
    showRay(source, hand.ray, pinched);
    if (pinched && !pinchedSources.has(source)) {
      pinchedSources.add(source);
      const acted = press(source, hand.ray);
      if (!acted && source.handedness === 'left') {
        walkingSource = source; walkingAnchor = hand.wrist.clone();
      }
    }
    if (pinched && source === walkingSource) {
      handMovement = pinchMovement(walkingAnchor, hand.wrist);
    }
    if (!pinched && pinchedSources.has(source)) { pinchedSources.delete(source); release(source); }
  }
  for (const source of pinchedSources) if (!seen.has(source)) { pinchedSources.delete(source); release(source); }
  for (const source of handModels.keys()) if (!seen.has(source)) removeHandModel(source);
  for (const [source, line] of rays) if (!seen.has(source)) { scene.remove(line); rays.delete(source); }
  const controllers = [...activeSession.inputSources].filter(source => !source.hand && source.gamepad);
  const controller = controllers.find(source => source.handedness === 'left') || controllers[0];
  const viewer = reference && frame.getViewerPose(reference);
  const orientation = viewer?.transform.orientation;
  const yaw = orientation ? new THREE.Euler().setFromQuaternion(new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w), 'YXZ').y : 0;
  const stick = controller ? stickMovement(controller.gamepad.axes, yaw) : { x: 0, y: 0 };
  const magnitude = Math.max(1, Math.hypot(handMovement.x + stick.x, handMovement.y + stick.y));
  window.GameSession?.setVRMovement?.((handMovement.x + stick.x) / magnitude, (handMovement.y + stick.y) / magnitude);
  const nextHelp = handsSeen ? 'hands' : 'controllers';
  if (nextHelp !== helpMode) {
    helpMode = nextHelp;
    gestureLabel.set(nextHelp === 'hands' ? 'MÃO ESQUERDA: PINÇA + MOVER' : 'CONTROLES VR',
      nextHelp === 'hands' ? 'Mão direita: aponte e faça pinça para agir' : 'Analógico esquerdo: andar · gatilho: selecionar');
  }
  renderer.render(scene, camera);
});

async function enterVR() {
  if (activeSession) { await activeSession.end(); return; }
  if (entering) return;
  if (!window.GameSession?.playing) { notify('Comece ou continue a aventura antes de entrar em VR.'); return; }
  if (!xrSupported) { notify('Headset WebXR indispon\u00edvel. Use VR Box para tela dividida.'); return; }
  if (phone.active) exitVR();
  window.GameSession?.close();
  entering = true;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'hand-tracking'],
    });
    activeSession = session; document.body.classList.add('vespera-vr'); notify('');
    quest.visible = questClose.visible = true;
    renderer.domElement.style.display = 'block'; button.textContent = 'Sair do VR';
    session.addEventListener('end', () => {
      for (const source of held.keys()) release(source);
      if (walkingSource) release(walkingSource);
      window.GameSession?.setVRMovement?.(0, 0);
      pinchedSources.clear(); lastFrameTime = 0;
      for (const line of rays.values()) scene.remove(line);
      rays.clear();
      for (const source of handModels.keys()) removeHandModel(source);
      for (const mesh of targets) mesh.scale.setScalar(1);
      activeSession = null; document.body.classList.remove('vespera-vr'); renderer.domElement.style.display = 'none'; button.textContent = 'Entrar em VR';
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
    session.addEventListener('squeezestart', event => {
      if (event.inputSource.hand) return;
      window.GameSession?.command(event.inputSource.handedness === 'left' ? 'skill' : 'dodge');
    });
    await renderer.xr.setSession(session); placeMenu();
  } catch (error) {
    if (activeSession) await activeSession.end().catch(() => {});
    renderer.domElement.style.display = 'none'; document.body.classList.remove('vespera-vr');
    const reason = error.name === 'NotAllowedError' ? 'Permissão recusada. Autorize o headset e tente novamente.'
      : error.name === 'SecurityError' ? 'Abra o jogo em HTTPS ou localhost e permita o acesso ao headset.'
      : error.name === 'NotSupportedError' ? 'Este navegador não oferece essa sessão. Use VR Box no celular.'
      : 'Falha ao iniciar VR: ' + error.message;
    notify(reason); button.textContent = 'Entrar em VR'; console.warn('Véspera VR:', error);
  } finally { entering = false; }
}
function exitVR() {
  if (activeSession) { activeSession.end().catch(error => notify(error.message)); return; }
  phone.stop(); crosshair.visible = false; release(gazeSource);
  for (const source of [...held.keys()]) release(source);
  window.GameSession?.setVRMovement?.(0, 0); lastFrameTime = 0;
  renderer.domElement.style.display = 'none'; document.body.classList.remove('vespera-vr');
  phoneButton.textContent = 'VR Box'; notify(''); resizeVR();
}
async function enterPhoneVR() {
  if (entering) return;
  if (phone.active) { exitVR(); return; }
  if (activeSession) { notify('Saia do headset antes de abrir VR Box.'); return; }
  if (!window.GameSession?.playing) { notify('Comece ou continue a aventura antes de entrar em VR Box.'); return; }
  document.getElementById('close-modal')?.click();
  entering = true;
  try {
    await phone.start(); resizeVR(); placeMenu(); crosshair.visible = true;
    renderer.domElement.style.display = 'block'; document.body.classList.add('vespera-vr');
    phoneButton.textContent = 'Sair do VR Box'; notify('');
  } catch (error) { exitVR(); notify('Falha no VR Box: ' + error.message); }
  finally { entering = false; }
}
button.addEventListener('click', enterVR);
phoneButton.addEventListener('click', enterPhoneVR);
document.addEventListener('click', event => {
  const mode = event.target.closest('[data-vr-mode]')?.dataset.vrMode;
  if (mode) { document.getElementById('close-modal')?.click(); mode === 'cardboard' ? enterPhoneVR() : enterVR(); }
});
document.addEventListener('keydown', event => {
  if (!phone.active && !activeSession) return;
  if (event.key.toLowerCase() === 'v') { event.preventDefault(); placeMenu(); }
  if (event.key === 'Escape' && phone.active) exitVR();
});
let drag = null;
renderer.domElement.addEventListener('pointerdown', event => { if (phone.active) { drag = { x: event.clientX, y: event.clientY }; renderer.domElement.setPointerCapture(event.pointerId); } });
renderer.domElement.addEventListener('pointermove', event => {
  if (!drag || !phone.active || phone.sensorActive) return;
  camera.rotation.order = 'YXZ'; camera.rotation.y -= (event.clientX - drag.x) * .004;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - (event.clientY - drag.y) * .004, -1.3, 1.3);
  drag = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', () => drag = null);
renderer.domElement.addEventListener('pointercancel', () => drag = null);
document.addEventListener('fullscreenchange', () => { if (phone.active && !document.fullscreenElement) exitVR(); });
if (!navigator.xr?.isSessionSupported) { button.title = 'Sem WebXR: use VR Box'; }
else navigator.xr.isSessionSupported('immersive-vr').then(supported => { xrSupported = supported; button.title = supported ? 'Entrar no headset' : 'Headset n\u00e3o detectado: use VR Box'; }).catch(() => { button.title = 'WebXR indispon\u00edvel: use VR Box'; });
window.VesperaVR = { button, phoneButton, scene, controls, spatialWorld, enterVR, enterPhoneVR, exitVR, phone,
  get active() { return !!activeSession || phone.active; } };
