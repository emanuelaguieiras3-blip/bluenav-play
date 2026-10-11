// 🤖 COMPLEXO — aventura física inspirada em BONEWORKS (mecânicas, não conteúdo):
// corpo que sobe em caixas e escala bordas, armas com carregador e ferrolho,
// bolsa de munição no quadril, armas brancas, socos e inimigos ragdoll.
// Tudo funciona com hand tracking (pinça), controles do Quest e olhar.
import { std, Particles, GrabMover, sweptDistanceSq } from './common.js';
import { RigidWorld, grabbable, trackHands } from './rigidWorld.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { barrelGeometry } from './sceneProps.js';

export const COMPLEX = { step: 0.55, mags: 6, magRounds: 10, enemyHp: 100, playerHp: 100, plateMass: 8 };

// Pure helper (tested): where the feet rest at (x, z), given solid tops.
export function supportHeight(x, z, feet, tops, step = COMPLEX.step, margin = 0.12) {
  let floor = 0;
  for (const t of tops) if (x > t.min.x - margin && x < t.max.x + margin && z > t.min.z - margin && z < t.max.z + margin && t.max.y <= feet + step && t.max.y > floor) floor = t.max.y;
  return floor;
}

// Wide-open hand (all four fingers straight): the gesture that drops a held
// weapon. A relaxed hand after a pinch is not open enough to drop it.
export function isWideOpen(p) {
  const P = p?.hand?.points; if (!P || P.length < 21) return false;
  const w = P[0], ratio = (tip, mcp) => P[tip].distanceTo(w) / Math.max(1e-4, P[mcp].distanceTo(w));
  return ratio(8, 5) > 1.75 && ratio(12, 9) > 1.75 && ratio(16, 13) > 1.7 && ratio(20, 17) > 1.65 && P[4].distanceTo(P[5]) > P[5].distanceTo(P[17]) * 0.9;
}

export default {
  id: 'complex',
  create(ctx) {
    const { THREE, root, tex, audio, env, rig } = ctx;
    env.set({ top: '#5d6d7a', horizon: '#a9b6bf', bottom: '#2a3138', fog: { color: '#9aa8b2', near: 18, far: 60 }, hemi: ['#e8eef6', '#3a4148', 1.25], sun: ['#fff1dc', 1.6], sunPos: [6, 14, 4] });
    const world = new RigidWorld({ floor: 0, limit: 80 });
    const solids = []; // { box, mesh, door? }
    const ledges = []; // climbable top edges { a, b }
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const mats = {
      concrete: std({ map: tex.get('stoneTiles'), color: '#c9cdd1', roughness: 0.9 }),
      wall: std({ color: '#e4e7ea', roughness: 0.8 }),
      trim: std({ color: '#f2a33a', roughness: 0.5 }),
      dark: std({ color: '#2b3036', roughness: 0.6, metalness: 0.4 }),
      wood: std({ map: tex.get('woodLight'), roughness: 0.85 }),
      metal: std({ map: tex.get('brushedMetal'), color: '#9aa3ab', metalness: 0.8, roughness: 0.35 }),
      glass: std({ color: '#a7d8f0', transparent: true, opacity: 0.25, roughness: 0.05 }),
    };
    const solid = (size, pos, mat = mats.wall, { door = false } = {}) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(0.05, Math.min(...size) * 0.2)), mat);
      mesh.position.set(...pos); root.add(mesh);
      const box = world.box(pos, size), entry = { box, mesh, door }; solids.push(entry); return entry;
    };
    // ---- level: break room -> physics museum (plate + ledge) -> yard -> exit ----
    const W = 4.2;
    solid([W * 2, 0.2, 21], [0, -0.1, -10], mats.concrete);           // floor A+B
    solid([W * 2, 1.3, 4], [0, 0.65, -19], mats.concrete);             // raised platform end of B
    solid([W * 2 + 4, 1.3, 17], [0, 0.65, -29], mats.concrete);        // yard floor (raised)
    for (const x of [-W, W]) solid([0.25, 4, 21], [x, 2, -10]);
    for (const x of [-W - 2, W + 2]) solid([0.25, 3, 17], [x, 2.8, -29]);
    solid([W * 2, 4, 0.25], [0, 2, 0.4]);
    solid([W * 2 + 4, 3, 0.25], [0, 2.8, -37.6]);
    // Walls with doorways: A|B at z = -8, B|C at z = -21 (on the platform).
    for (const x of [-2.6, 2.6]) solid([3.2, 4, 0.25], [x, 2, -8]);
    solid([2, 1.4, 0.25], [0, 3.3, -8]);
    for (const x of [-3.6, 3.6]) solid([5.2, 3, 0.25], [x, 2.8, -21]);
    solid([2, 0.6, 0.25], [0, 4.0, -21]);
    const doorA = solid([2, 2.6, 0.18], [0, 1.3, -8], mats.dark, { door: true });
    const doorB = solid([2, 2.4, 0.18], [0, 2.5, -21], mats.dark, { door: true });
    ledges.push({ a: V(-W, 1.3, -17), b: V(W, 1.3, -17) });
    // Trim lines and lights give the clean test-facility look.
    for (const z of [-0.2, -7.8, -8.2, -16.9, -20.8]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, W * 2, 8).rotateZ(Math.PI / 2), mats.trim); t.position.set(0, z === -16.9 ? 1.32 : 0.05, z); root.add(t); }
    for (let i = 0; i < 6; i++) { const lamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.2, 4, 10).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f4f8ff', toneMapped: false })); lamp.position.set(0, i < 3 ? 3.9 : 4.6, -2 - i * 6.5); root.add(lamp); }

    // ---- furniture (break room) ----
    solid([1.6, 0.08, 0.8], [-2, 0.78, -3], mats.wood);
    for (const [x, z] of [[-2.7, -2.7], [-1.3, -2.7], [-2.7, -3.3], [-1.3, -3.3]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.74, 8), mats.metal); leg.position.set(x, 0.37, z); root.add(leg); }
    solid([1.2, 0.08, 0.6], [2.4, 0.95, -2], mats.metal);
    solid([0.9, 2, 0.7], [3.5, 1, -5.5], mats.dark); // vending machine
    const label = (text, pos, w = 1.4, rotY = 0) => { const l = ctx.label(text, { w, h: 0.12, size: 0.3, bg: 'rgba(10,16,24,.7)' }); l.position.set(...pos); l.rotation.y = rotY; root.add(l); return l; };
    label('Pince a arma: ela fica na mão. Pince de novo: atira.', [-2, 1.75, -3.6], 1.7);
    label('Abra bem a mão para soltar · pince no quadril: carregador', [-2, 1.58, -3.6], 1.7);
    label('Carregador na base da arma · puxe o ferrolho com a outra mão', [2.4, 1.6, -2.4], 1.7);
    label('Coloque 8 kg na balança para abrir a porta de cima', [0, 2.2, -16.8], 1.6);
    label('Empilhe caixas para subir ou pince a borda e puxe', [0, 1.7, -16.75], 1.6);

    // ---- dynamic objects ----
    const items = []; // every physical thing the hands can hold
    const addBody = (mesh, opts, kind, extra = {}) => {
      root.add(mesh); const body = world.add(mesh, opts); if (!body) return null;
      body.kind = kind; Object.assign(body, extra); grabbable(ctx, world, body, { register: false }); items.push(body); return body;
    };
    const crateGeo = new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.04);
    const crate = (x, y, z, mass = 4.5) => { const m = new THREE.Mesh(crateGeo, mats.wood); m.position.set(x, y, z); return addBody(m, { size: [0.5, 0.5, 0.5], mass, bounce: 0.05, rotates: true }, 'crate'); };
    for (const [x, z] of [[-3.2, -10], [-2.5, -11.5], [3, -12], [2.2, -10.6], [-3.3, -13.6]]) crate(x, 0.25, z);
    crate(3.2, 0.25, -14.8, 9);
    const barrelMesh = () => new THREE.Mesh(barrelGeometry(0.22, 0.62), std({ map: tex.get('woodMedium'), color: '#3f7fb5' }));
    for (const [x, z] of [[-3, -24], [3.5, -27], [-4.5, -31]]) { const m = barrelMesh(); m.position.set(x, 1.3 + 0.31, z); addBody(m, { size: [0.44, 0.62, 0.44], mass: 7, bounce: 0.05, rotates: true }, 'barrel'); }
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16), mats.metal); m.position.set(-2.4 + i * 0.18, 0.88, -3); addBody(m, { size: [0.08, 0.12, 0.08], mass: 0.15, bounce: 0.3, rotates: true }, 'can'); }

    // ---- pistol (original design: rounded receiver, slide, grip) ----
    const gunGroup = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.05, 0.19, 2, 0.008), mats.dark); frame.position.set(0, 0, -0.02); gunGroup.add(frame);
    const slide = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.032, 0.2, 2, 0.008), mats.metal); slide.position.set(0, 0.036, -0.03); gunGroup.add(slide);
    const gripMesh = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.12, 0.05, 2, 0.01), std({ map: tex.get('rubber'), color: '#333' })); gripMesh.position.set(0, -0.07, 0.05); gripMesh.rotation.x = 0.22; gunGroup.add(gripMesh);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 16, Math.PI).rotateY(Math.PI / 2), mats.dark); guard.position.set(0, -0.03, -0.005); guard.rotation.x = Math.PI; gunGroup.add(guard);
    const magInGun = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.11, 0.04, 2, 0.006), std({ color: '#1c2228', roughness: 0.5 })); magInGun.position.set(0, -0.075, 0.052); magInGun.rotation.x = 0.22; gunGroup.add(magInGun);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false })); flash.position.set(0, 0.036, -0.15); flash.visible = false; gunGroup.add(flash);
    gunGroup.position.set(-2.2, 0.85, -3);
    const gunBody = addBody(gunGroup, { size: [0.05, 0.16, 0.2], mass: 1, bounce: 0.1, rotates: true }, 'gun');
    const gun = { body: gunBody, mag: { rounds: COMPLEX.magRounds }, chambered: true, locked: false, holder: null, recoil: 0, slideBack: 0, shots: 0, rack: null };
    // Magazines: physical bodies with a round count.
    const magGeo = new RoundedBoxGeometry(0.026, 0.11, 0.04, 2, 0.006), magMat = std({ color: '#1c2228', roughness: 0.5 });
    const mags = [];
    const spawnMag = (at, rounds = COMPLEX.magRounds) => {
      let body = mags.find(m => !m.enabled) || null;
      if (!body && mags.length >= COMPLEX.mags) body = mags.filter(m => !m.holders.size).sort((a, b) => a.born - b.born)[0];
      if (!body) {
        const mesh = new THREE.Mesh(magGeo, magMat);
        body = addBody(mesh, { size: [0.03, 0.11, 0.045], mass: 0.25, bounce: 0.2, rotates: true }, 'mag'); if (!body) return null; mags.push(body);
      }
      body.enabled = true; body.mesh.visible = true; body.rounds = rounds; body.born = performance.now();
      body.mesh.position.copy(at); body.velocity.set(0, 0, 0); body.angular.set(0, 0, 0);
      return body;
    };
    spawnMag(V(2.2, 1.06, -2)); spawnMag(V(2.4, 1.06, -2)); spawnMag(V(2.6, 1.06, -2));
    // Melee: a pipe and a baton with real lathe/capsule shapes.
    // Melee geometry runs along local +x so the lying collision box matches.
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.75, 12).rotateZ(Math.PI / 2), mats.metal); pipe.position.set(2.2, 1.03, -2.25);
    const pipeBody = addBody(pipe, { size: [0.75, 0.05, 0.05], mass: 1.2, bounce: 0.1, rotates: true }, 'melee');
    const baton = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.55, 4, 12).rotateZ(Math.PI / 2), std({ map: tex.get('rubber'), color: '#5a2b2b' })); baton.position.set(-3.6, 1.6, -26);
    const batonBody = addBody(baton, { size: [0.6, 0.06, 0.06], mass: 0.9, bounce: 0.1, rotates: true }, 'melee');
    void pipeBody; void batonBody;

    // ---- enemies: puppeted ragdolls ----
    const enemyMat = std({ color: '#3a4047', roughness: 0.55, metalness: 0.3 }), jointMat = std({ color: '#c26a2a', roughness: 0.5 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false });
    const PARTS = [
      ['torso', [0, 1.12, 0], [0.38, 0.46, 0.24], 8], ['head', [0, 1.58, 0], [0.26, 0.28, 0.26], 2], ['hip', [0, 0.78, 0], [0.3, 0.2, 0.22], 5],
      ['leftArm', [-0.3, 1.18, 0], [0.13, 0.34, 0.13], 1.5], ['rightArm', [0.3, 1.18, 0], [0.13, 0.34, 0.13], 1.5],
      ['leftHand', [-0.33, 0.88, 0], [0.12, 0.26, 0.12], 1], ['rightHand', [0.33, 0.88, 0], [0.12, 0.26, 0.12], 1],
      ['leftLeg', [-0.1, 0.36, 0], [0.15, 0.62, 0.16], 3], ['rightLeg', [0.1, 0.36, 0], [0.15, 0.62, 0.16], 3],
    ];
    const enemies = [];
    const makeEnemy = (x, z, floor) => {
      const group = 'enemy-' + enemies.length, parts = [];
      for (const [name, at, size, mass] of PARTS) {
        const r = Math.min(size[0], size[2]) / 2;
        const geo = name === 'head' ? new THREE.SphereGeometry(0.13, 16, 12) : new THREE.CapsuleGeometry(r, Math.max(0.02, size[1] - r * 2), 4, 12);
        const mesh = new THREE.Mesh(geo, name.endsWith('Hand') ? jointMat : enemyMat);
        if (name === 'torso' || name === 'hip') mesh.scale.x = size[0] / (r * 2);
        if (name === 'head') for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat); eye.position.set(s * 0.05, 0.02, -0.115); mesh.add(eye); }
        mesh.position.set(x + at[0], floor + at[1], z + at[2]);
        const body = addBody(mesh, { size, mass, bounce: 0.04, friction: 0.9 }, 'enemy', { part: name, local: V(...at) });
        body.collisionGroup = group; body.held = 'puppet'; parts.push(body);
      }
      for (const [a, b] of [[0, 1], [0, 2], [0, 3], [0, 4], [3, 5], [4, 6], [2, 7], [2, 8]]) world.connect(parts[a], parts[b]);
      const enemy = { parts, home: V(x, floor, z), pos: V(x, floor, z), yaw: 0, hp: COMPLEX.enemyHp, state: 'idle', timer: 0, phase: Math.random() * 6, attack: 0, hitCooldown: 0, floor };
      parts.forEach(p => p.enemy = enemy); enemies.push(enemy); return enemy;
    };
    makeEnemy(-2, -27, 1.3); makeEnemy(2.5, -30, 1.3); makeEnemy(0, -34, 1.3);

    // ---- player body ----
    let hp = COMPLEX.playerHp, vy = 0, hurtFlash = 0, kills = 0, shots = 0, hits = 0, checkpoint = V(0, 0, -1), finished = false, clock = 0, feedback = '', feedbackLife = 0;
    let sandboxMode = false;
    const sandboxObjects = [];
    const say = (text, life = 2) => { feedback = text; feedbackLife = life; };
    const tops = () => [...solids.filter(s => !s.removed).map(s => s.box), ...items.filter(b => b.enabled && !b.holders.size && b.kind !== 'enemy' && b.half.y >= 0.2).map(b => world.bounds(b))];
    const blocked = (x, z, feet) => solids.some(s => !s.removed && s.box.max.y > feet + COMPLEX.step && s.box.min.y < feet + 1.7 && x > s.box.min.x - 0.2 && x < s.box.max.x + 0.2 && z > s.box.min.z - 0.2 && z < s.box.max.z + 0.2) ||
      items.some(b => b.enabled && b.kind === 'crate' && !b.holders.size && world.bounds(b).max.y > feet + COMPLEX.step && world.bounds(b).min.y < feet + 1.2 && world.bounds(b).distanceToPoint(new THREE.Vector3(x, feet + 0.3, z)) < 0.2);
    ctx.teleport({ enabled: true, walk: true, check: p => !blocked(p.x, p.z, rig.position.y) });
    const mover = new GrabMover(ctx);
    const handsUpdate = trackHands(ctx, world, 0.055);
    const particles = new Particles(root, { max: 200, size: 0.035 });
    const tracerGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: '#ffe6a6', transparent: true, opacity: 0.9 })); tracer.frustumCulled = false; tracer.visible = false; root.add(tracer);
    let tracerLife = 0;

    // ---- doors, plate, exit ----
    const openDoor = door => { if (door.removed) return; door.removed = true; door.opening = 0; const i = world.statics.indexOf(door.box); if (i >= 0) world.statics.splice(i, 1); audio.success(); };
    const buttonMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 20).rotateX(Math.PI / 2), std({ color: '#d33', emissive: '#600', roughness: 0.4 }));
    buttonMesh.position.set(1.6, 1.3, -7.84); root.add(buttonMesh);
    ctx.addUI(buttonMesh, { onClick: () => { openDoor(doorA); say('Porta aberta'); } });
    label('Aperte o botão', [1.6, 1.55, -7.85], 0.7);
    const plate = new THREE.Box3(V(-1.2, -0.05, -15.6), V(1.2, 0.45, -14.0));
    const plateMesh = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.06, 1.6, 2, 0.02), std({ color: '#f2a33a', emissive: '#3a2200', roughness: 0.5 })); plateMesh.position.set(0, 0.03, -14.8); root.add(plateMesh);
    const plateLabel = label('0 / 8 kg', [0, 0.6, -13.95], 0.6);
    let plateMass = 0;
    const exitPad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 32), new THREE.MeshBasicMaterial({ color: '#4dffb0', transparent: true, opacity: 0.6, toneMapped: false })); exitPad.position.set(0, 1.33, -36.4); root.add(exitPad);

    // ---- grabbing, gun, reload ----
    const handState = new Map(); // pointer id -> { item, sticky, open, pinchTime }
    const isHand = p => p.source === 'hand' || p.source === 'xr';
    const palmOf = p => p.hand?.palm || p.handPos;
    const gunPose = (p, pos, quat) => {
      if (p.source === 'xr' && p.quaternion) { quat.copy(p.quaternion); pos.copy(p.handPos); return; }
      if (p.source === 'hand' && p.hand?.points?.length >= 18) {
        const P = p.hand.points, f = P[9].clone().sub(P[0]).normalize(), up = P[5].clone().sub(P[17]);
        up.addScaledVector(f, -up.dot(f)); if (up.lengthSq() < 1e-8) up.set(0, 1, 0); up.normalize();
        const z = f.clone().negate(), x = new THREE.Vector3().crossVectors(up, z);
        quat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
        pos.copy(palmOf(p)).addScaledVector(f, 0.02); return;
      }
      // Gaze/mouse: gun floats low and to the right of the view, aimed at the ray.
      pos.copy(ctx.eye()).addScaledVector(p.ray.direction, 0.45).add(V(0.12, -0.16, 0).applyQuaternion(ctx.camera.getWorldQuaternion(new THREE.Quaternion())));
      quat.setFromUnitVectors(V(0, 0, -1), p.ray.direction);
    };
    const local = (v, obj) => { obj.updateMatrixWorld(true); return v.clone().applyMatrix4(obj.matrixWorld); };
    const magwell = () => local(V(0, -0.12, 0.06), gunGroup);
    const slideRear = () => local(V(0, 0.036, 0.08), gunGroup);
    const hipPoint = side => {
      const yaw = new THREE.Euler().setFromQuaternion(ctx.camera.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
      return ctx.eye().add(V(side * 0.2, -0.62, 0.05).applyAxisAngle(V(0, 1, 0), yaw));
    };
    const insertMag = mag => {
      if (gun.mag) return false;
      for (const [id, s] of handState) if (s.item === mag) { mag.grab.end(null); handState.set(id, { ...s, item: null }); }
      gun.mag = { rounds: mag.rounds }; mag.enabled = false; mag.mesh.visible = false; mag.holders.clear(); mag.held = null;
      audio.click(); say(gun.chambered ? 'Carregado' : 'Puxe o ferrolho', 1.5); return true;
    };
    const ejectMag = () => {
      if (!gun.mag) return;
      const m = spawnMag(magwell(), gun.mag.rounds); gun.mag = null;
      if (m) m.velocity.copy(gunBody.velocity).add(V(0, -0.5, 0));
    };
    const chamber = () => { if (!gun.chambered && gun.mag?.rounds > 0) { gun.mag.rounds--; gun.chambered = true; gun.locked = false; audio.metal?.(); say('Pronto para atirar', 1); return true; } return false; };
    const reloadButton = () => { if (!gun.mag || !gun.mag.rounds) { gun.mag = { rounds: COMPLEX.magRounds }; } if (!gun.chambered) chamber(); gun.locked = false; say('Recarregado'); };
    const rayTargets = () => items.filter(b => b.enabled && b.mesh.visible && b !== gunBody && !(b.kind === 'mag' && b.holders.size));
    const fire = () => {
      if (!gun.chambered) { audio.click(); say(gun.mag ? 'Puxe o ferrolho' : 'Sem carregador: pince no quadril', 1.2); return; }
      gun.chambered = false; shots++; gun.recoil = 1; gun.slideBack = 1;
      gunGroup.updateMatrixWorld(true);
      const origin = local(V(0, 0.036, -0.14), gunGroup), dir = V(0, 0, -1).transformDirection(gunGroup.matrixWorld).normalize();
      const ray = new THREE.Ray(origin, dir), hitPoint = new THREE.Vector3();
      let best = 40, target = null, point = origin.clone().addScaledVector(dir, 40);
      for (const s of solids) if (!s.removed && ray.intersectBox(s.box, hitPoint)) { const d = hitPoint.distanceTo(origin); if (d < best) { best = d; target = null; point = hitPoint.clone(); } }
      for (const b of rayTargets()) if (ray.intersectBox(world.bounds(b), hitPoint)) { const d = hitPoint.distanceTo(origin); if (d < best) { best = d; target = b; point = hitPoint.clone(); } }
      if (target) {
        if (target.kind === 'enemy') { hits++; damage(target.enemy, target.part === 'head' ? 100 : 34, target, dir.clone().multiplyScalar(6)); }
        else { target.velocity.addScaledVector(dir, 3 / target.mass).clampLength(0, 8); target.angular.add(V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6)); }
      }
      for (let i = 0; i < 10; i++) particles.spawn(point, V((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).addScaledVector(dir, -1), { life: 0.35, color: target?.kind === 'enemy' ? [1, 0.55, 0.15, 1] : [1, 0.9, 0.6, 1], gravity: 6, drag: 1 });
      const pos = tracerGeo.attributes.position; pos.setXYZ(0, origin.x, origin.y, origin.z); pos.setXYZ(1, point.x, point.y, point.z); pos.needsUpdate = true; tracer.visible = true; tracerLife = 0.05;
      audio.noise({ dur: 0.09, freq: 1100, vol: 0.2 }); audio.tone?.({ freq: 90, to: 40, dur: 0.12, vol: 0.15 });
      const holder = (ctx.input.pointers || []).find(p => p.id === gun.holder); holder?.gamepad?.hapticActuators?.[0]?.pulse?.(0.6, 60)?.catch?.(() => {});
      if (gun.mag?.rounds > 0) { gun.mag.rounds--; gun.chambered = true; }
      else { gun.locked = true; ejectTimer = 0.25; say('Vazio! Pegue outro carregador no quadril', 2); }
    };
    let ejectTimer = 0;

    // ---- enemies: pose, damage, ragdoll ----
    const poseLocal = (e, part) => {
      const l = part.local.clone(), s = Math.sin(e.phase), walking = e.state === 'chase' ? 1 : 0.15;
      if (part.part === 'leftLeg') { l.z += s * 0.14 * walking; l.y += Math.max(0, s) * 0.05 * walking; }
      if (part.part === 'rightLeg') { l.z -= s * 0.14 * walking; l.y += Math.max(0, -s) * 0.05 * walking; }
      if (part.part === 'leftArm' || part.part === 'leftHand') l.z -= s * 0.1 * walking;
      if (part.part === 'rightArm' || part.part === 'rightHand') l.z += s * 0.1 * walking;
      if (e.attack > 0 && (part.part === 'rightHand' || part.part === 'rightArm')) { const k = Math.sin(Math.min(1, e.attack) * Math.PI); l.z -= k * (part.part === 'rightHand' ? 0.45 : 0.2); l.y += k * 0.25; }
      l.y += Math.abs(Math.sin(e.phase * 2)) * 0.02 * walking;
      return l.applyAxisAngle(V(0, 1, 0), e.yaw).add(e.pos);
    };
    const ragdoll = (e, impulse = null, part = null) => {
      if (e.state === 'ragdoll' || e.state === 'dead') { if (impulse && part) part.velocity.add(impulse).clampLength(0, 8); return; }
      e.state = e.hp > 0 ? 'ragdoll' : 'dead'; e.timer = e.hp > 0 ? 2.6 : 9;
      for (const p of e.parts) if (p.held === 'puppet') p.held = null;
      if (impulse) (part || e.parts[0]).velocity.add(impulse).clampLength(0, 8);
      audio.thud?.();
    };
    const damage = (e, amount, part, impulse) => {
      if (e.state === 'dead' || e.state === 'gone') return;
      e.hp -= amount; e.hitCooldown = 0.3;
      if (e.hp <= 0) { kills++; e.hp = 0; say(`Inimigo derrubado (${kills}/${enemies.length})`, 1.5); ragdoll(e, impulse, part); e.state = 'dead'; e.timer = 9; return; }
      if (amount >= 30 || impulse.length() > 4) ragdoll(e, impulse, part);
      else part.velocity.add(impulse);
    };
    const getUp = e => {
      const hip = e.parts[2].mesh.position; e.pos.set(hip.x, e.floor, hip.z); e.state = 'getup'; e.timer = 0.6;
      for (const p of e.parts) { p.held = 'puppet'; p.holders.clear(); }
      for (const [id, s] of handState) if (s.item?.enemy === e) handState.set(id, { ...s, item: null });
    };

    // ---- restart ----
    const restart = (toCheckpoint = true) => {
      for (const [id, s] of handState) { s.item?.grab?.end(null); handState.delete(id); }
      gun.holder = null; mover.stop();
      if (!toCheckpoint) {
        world.reset(); for (const d of [doorA, doorB]) if (d.removed) { d.removed = false; d.mesh.position.y = d.closedY; world.statics.push(d.box); }
        checkpoint.set(0, 0, -1); kills = 0; shots = 0; hits = 0; finished = false; clock = 0;
        Object.assign(gun, { mag: { rounds: COMPLEX.magRounds }, chambered: true, locked: false });
        mags.forEach((m, i) => { m.enabled = i < 3; m.mesh.visible = i < 3; m.rounds = COMPLEX.magRounds; });
      }
      for (const e of enemies) {
        if (!toCheckpoint || e.state !== 'dead') {
          e.hp = COMPLEX.enemyHp; e.state = 'idle'; e.pos.copy(e.home); e.yaw = 0; e.attack = 0;
          for (const p of e.parts) { p.enabled = true; p.mesh.visible = true; p.held = 'puppet'; p.holders.clear(); p.velocity.set(0, 0, 0); p.mesh.position.copy(poseLocal(e, p)); }
        }
      }
      rig.position.copy(checkpoint); vy = 0; hp = COMPLEX.playerHp;
      if (!toCheckpoint) kills = 0;
    };
    doorA.closedY = doorA.mesh.position.y; doorB.closedY = doorB.mesh.position.y;
    const restartButton = ctx.button({ label: 'Reiniciar fase', w: 0.3, h: 0.07, onClick: () => restart(false) });
    restartButton.position.set(-1.0, 1.25, -0.9); root.add(restartButton);
    const reloadBtn = ctx.button({ label: 'Recarregar', w: 0.26, h: 0.07, onClick: reloadButton });
    reloadBtn.position.set(-0.68, 1.25, -0.9); root.add(reloadBtn);
    const equipBtn = ctx.button({ label: 'Pegar/soltar arma', w: 0.32, h: 0.07, onClick: () => {
      const main = (ctx.input.pointers || []).find(p => p.main) || ctx.input.pointers?.[0]; if (!main) return;
      if (gun.holder) { const s = handState.get(gun.holder); if (s) s.item = null; gun.holder = null; gunBody.held = null; }
      else { handState.set(main.id, { item: gunBody, sticky: true, open: 0, pinchTime: 0, justGrabbed: true }); gun.holder = main.id; gunBody.held = main.id; }
    } });
    equipBtn.position.set(-1.38, 1.25, -0.9); root.add(equipBtn);

    const clearSandbox = () => {
      for (const body of sandboxObjects.splice(0)) {
        world.remove(body);
        items.splice(items.indexOf(body), 1);
        root.remove(body.mesh);
      }
    };
    const spawnSandbox = (kind) => {
      if (!sandboxMode) return;
      if (sandboxObjects.length >= 12) {
        const oldest = sandboxObjects.shift();
        world.remove(oldest); items.splice(items.indexOf(oldest), 1); root.remove(oldest.mesh);
      }
      const at = ctx.eye().addScaledVector(ctx.forward().setY(0).normalize(), 1.2);
      at.y = Math.max(1.7, rig.position.y + 1.2);
      let body;
      if (kind === 'esfera') {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 14), mats.metal);
        mesh.position.copy(at);
        body = addBody(mesh, { size: [0.46, 0.46, 0.46], mass: 2.5, bounce: 0.55, rotates: true, shape: 'sphere' }, 'ball');
      } else if (kind === 'barril') {
        const mesh = barrelMesh(); mesh.position.copy(at);
        body = addBody(mesh, { size: [0.44, 0.62, 0.44], mass: 7, bounce: 0.05, rotates: true }, 'barrel');
      } else {
        body = crate(at.x, at.y, at.z, 4.5);
      }
      if (body) { sandboxObjects.push(body); say(`${kind} criada`, 1); }
      else say('Limite de objetos físicos atingido', 2);
    };
    const setSandbox = (enabled) => {
      if (sandboxMode === enabled) return;
      clearSandbox(); sandboxMode = enabled; restart(false);
      if (sandboxMode) { openDoor(doorA); openDoor(doorB); say('Sandbox livre: inimigos passivos, vida infinita e objetos', 4); }
      else say('Campanha reiniciada', 2);
      modeButton.userData.setLabel?.(`Sandbox: ${sandboxMode ? 'ligado' : 'desligado'}`);
      ctx.objective?.(sandboxMode ? 'Experimente a física: crie, pegue, arremesse e empilhe objetos.' : 'Abra as portas, atravesse o pátio e alcance a saída.');
    };
    const modeButton = ctx.button({ label: 'Sandbox: desligado', w: 0.38, h: 0.07, onClick: () => setSandbox(!sandboxMode) });
    modeButton.position.set(-0.72, 1.12, -0.9); root.add(modeButton);
    for (const [kind, x] of [['caixa', -1.39], ['esfera', -0.94], ['barril', -0.49]]) {
      const button = ctx.button({ label: `Criar ${kind}`, w: 0.4, h: 0.07, onClick: () => spawnSandbox(kind) });
      button.position.set(x, 1.01, -0.9); root.add(button);
    }

    const grabAt = (p, body) => {
      const sticky = body.kind === 'gun' || body.kind === 'melee';
      if (body.kind === 'enemy' && body.held === 'puppet') ragdoll(body.enemy, null);
      if (sticky) { body.held = p.id; body.holders.clear(); if (body.kind === 'gun') gun.holder = p.id; body.prev = body.mesh.position.clone(); }
      else body.grab.start(p, { distance: 0.1 });
      handState.set(p.id, { item: body, sticky, open: 0, pinchTime: 0, justGrabbed: true });
      audio.click();
    };
    const dropSticky = (p, s) => {
      const body = s.item; body.held = null; if (body.kind === 'gun') gun.holder = null;
      body.velocity.copy(body.throwVel || V()).clampLength(0, 8); s.item = null;
    };
    const tmpPos = new THREE.Vector3(), tmpQuat = new THREE.Quaternion();
    const meleeTip = (body, out) => out.set(body.half.x, 0, 0).applyQuaternion(body.mesh.quaternion).add(body.mesh.position);
    const rotZ90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const prevHands = new Map();

    return {
      world, enemies, gun, mags, solids, doors: [doorA, doorB], items,
      fire, insertMag, chamber, restart, openDoor, damage, grabAt, setSandbox, spawnSandbox,
      getState: () => ({ hp, kills, shots, hits, sandboxMode, sandboxObjects: sandboxObjects.length, ammo: (gun.mag?.rounds || 0) + (gun.chambered ? 1 : 0), magIn: !!gun.mag, chambered: gun.chambered, holding: !!gun.holder, plateMass, doors: [!!doorA.removed, !!doorB.removed], finished, height: rig.position.y, climbing: mover.active, enemyStates: enemies.map(e => e.state) }),
      update(dt) {
        dt = Math.max(0, Math.min(dt, 0.05)); if (!dt) return;
        clock += dt;
        const pointers = (ctx.input.pointers || []).filter(p => !p.system);
        // ---- hands ----
        for (const p of pointers) {
          let s = handState.get(p.id);
          if (p.stale) continue;
          const palm = palmOf(p);
          if (s?.item) {
            const body = s.item;
            if (s.sticky) {
              gunPose(p, tmpPos, tmpQuat);
              // A bat leaves the hand on the thumb side, most of its length out.
              if (body.kind === 'melee') { tmpQuat.multiply(rotZ90); tmpPos.addScaledVector(V(1, 0, 0).applyQuaternion(tmpQuat), body.half.x - 0.09); }
              body.throwVel = tmpPos.clone().sub(body.mesh.position).divideScalar(dt);
              body.mesh.position.copy(tmpPos); body.mesh.quaternion.copy(tmpQuat);
              body.velocity.copy(body.throwVel).clampLength(0, 8);
              if (body.kind === 'gun' && p.pinchDown && !s.justGrabbed && !p.uiBusy) fire();
              s.justGrabbed = s.justGrabbed && p.pinch;
              // Release: open the hand wide (hand tracking) or hold the trigger (controllers).
              s.open = isWideOpen(p) ? s.open + dt : 0;
              s.pinchTime = p.pinch && p.source === 'xr' ? s.pinchTime + dt : 0;
              if (s.open > 0.35 || s.pinchTime > 0.8) { dropSticky(p, s); say('Soltou', 0.8); }
            } else if (!p.pinch) { body.grab.end(p); s.item = null; }
            else { body.grab.move(p); if (body.kind === 'mag' && gun.holder && body.mesh.position.distanceTo(magwell()) < 0.09) insertMag(body); }
            p.uiBusy = true;
            continue;
          }
          // Slide rack with the free hand.
          if (gun.rack?.id === p.id) {
            if (!p.pinch) gun.rack = null;
            else {
              const back = palm.clone().sub(gun.rack.start).dot(V(0, 0, 1).transformDirection(gunGroup.matrixWorld));
              gun.slideBack = Math.max(0, Math.min(1, back / 0.04));
              if (back > 0.035 && !gun.rack.done) { gun.rack.done = true; if (gun.chambered && gun.mag) { gun.mag.rounds++; } gun.chambered = false; if (!chamber()) say(gun.mag ? 'Carregador vazio' : 'Sem carregador', 1.2); }
            }
            p.uiBusy = true; continue;
          }
          if (!p.pinchDown || p.uiBusy || !isHand(p)) continue;
          if (gun.holder && gun.holder !== p.id && palm.distanceTo(slideRear()) < 0.1) { gun.rack = { id: p.id, start: palm.clone(), done: false }; p.uiBusy = true; continue; }
          // Nearest physical item within reach.
          let best = null, bestD = 0.11;
          for (const b of items) {
            if (!b.enabled || !b.mesh.visible || (b.held && b.held !== 'puppet')) continue;
            const d = Math.min(world.bounds(b).distanceToPoint(palm), world.bounds(b).distanceToPoint(p.handPos));
            if (d < bestD) { bestD = d; best = b; }
          }
          if (best) { grabAt(p, best); p.uiBusy = true; continue; }
          // Ammo pouch on the hips: a fresh magazine appears in the hand.
          if ([-1, 1].some(side => palm.distanceTo(hipPoint(side)) < 0.28)) { const m = spawnMag(p.handPos.clone()); if (m) { grabAt(p, m); say('Carregador', 0.8); } p.uiBusy = true; continue; }
          // Ledges: pull yourself up.
          for (const l of ledges) {
            const line = new THREE.Line3(l.a, l.b), closest = line.closestPointToPoint(palm, true, new THREE.Vector3());
            if (closest.distanceTo(palm) < 0.18) { mover.start(p); p.uiBusy = true; break; }
          }
        }
        for (const [id, s] of handState) if (!pointers.some(p => p.id === id)) { if (s.item && !s.sticky) s.item.grab.end(null); if (s.item?.kind === 'gun') { s.item.held = null; gun.holder = null; } else if (s.item?.sticky) s.item.held = null; handState.delete(id); }
        for (const p of pointers) if (!p.pinch && mover.holding(p)) mover.stop(p);

        // ---- gun visuals ----
        gun.recoil = Math.max(0, gun.recoil - dt * 8); gun.slideBack = gun.rack ? gun.slideBack : Math.max(gun.locked ? 1 : 0, gun.slideBack - dt * 10);
        slide.position.z = -0.03 + gun.slideBack * 0.04; magInGun.visible = !!gun.mag; flash.visible = gun.recoil > 0.7;
        if (gun.holder && gun.recoil > 0) gunGroup.rotateX(gun.recoil * 0.12);
        if (ejectTimer > 0 && (ejectTimer -= dt) <= 0) ejectMag();
        tracerLife -= dt; tracer.visible = tracerLife > 0;

        // ---- player body: climb, fall, step up ----
        if (mover.active) { const before = rig.position.clone(); mover.update(null, dt); vy = 0; const eye = ctx.eye(); if (blocked(eye.x, eye.z, rig.position.y + COMPLEX.step) && rig.position.y < 1.2) { rig.position.x = before.x; rig.position.z = before.z; } }
        else {
          const eye = ctx.eye(), floor = supportHeight(eye.x, eye.z, rig.position.y, tops());
          if (rig.position.y > floor + 0.005) { vy -= 9.81 * dt; rig.position.y = Math.max(floor, rig.position.y + vy * dt); if (rig.position.y === floor) { if (vy < -7) { hp -= 10; hurtFlash = 0.4; } vy = 0; } }
          else { rig.position.y += (floor - rig.position.y) * Math.min(1, dt * 14); vy = 0; }
        }

        // ---- melee & punches ----
        for (const b of items) if (b.kind === 'melee' && b.held && b.held !== 'puppet') {
          const tip = meleeTip(b, new THREE.Vector3()), old = b.prevTip || tip.clone(), speed = tip.distanceTo(old) / dt;
          if (speed > 2.5) for (const e of enemies) if (e.state !== 'dead' && e.state !== 'gone' && e.hitCooldown <= 0) for (const part of e.parts) {
            if (sweptDistanceSq(part.mesh.position, part.mesh.position, old, tip) < (Math.max(part.half.x, part.half.z) + 0.06) ** 2) { audio.metal?.(); damage(e, 18 * speed / 3, part, tip.clone().sub(old).normalize().multiplyScalar(speed * 0.8)); break; }
          }
          b.prevTip = tip;
        }
        for (const p of pointers) {
          if (!isHand(p) || handState.get(p.id)?.item) continue;
          const palm = palmOf(p).clone(), old = prevHands.get(p.id) || palm; prevHands.set(p.id, palm);
          const speed = palm.distanceTo(old) / dt; if (speed < 2.5 || speed > 15) continue;
          for (const e of enemies) if (e.state !== 'dead' && e.state !== 'gone' && e.hitCooldown <= 0) for (const part of e.parts) if (sweptDistanceSq(part.mesh.position, part.mesh.position, old, palm) < (Math.max(part.half.x, part.half.z) + 0.05) ** 2) { audio.thud?.(); damage(e, 6 * speed / 3, part, palm.clone().sub(old).normalize().multiplyScalar(speed)); break; }
        }

        // ---- enemies ----
        const eye = ctx.eye(), inYard = eye.z < -21;
        for (const e of enemies) {
          e.hitCooldown = Math.max(0, e.hitCooldown - dt);
          if (!sandboxMode && e.state === 'idle' && inYard && rig.position.y > 0.8) e.state = 'chase';
          if (e.state === 'chase' || e.state === 'idle') {
            const to = V(eye.x - e.pos.x, 0, eye.z - e.pos.z), distance = to.length();
            if (e.state === 'chase') {
              e.yaw = Math.atan2(-to.x, -to.z);
              if (distance > 0.85 && e.attack <= 0) {
                to.normalize().multiplyScalar(1.15 * dt); const nx = e.pos.x + to.x, nz = e.pos.z + to.z;
                if (!blocked(nx, nz, e.floor) && !blocked(nx, nz, e.floor)) { e.pos.x = nx; e.pos.z = nz; }
                e.phase += dt * 7;
              } else if (e.attack <= 0) e.attack = 0.001;
              if (e.attack > 0) {
                const before = e.attack; e.attack += dt / 0.9;
                if (!sandboxMode && before < 0.5 && e.attack >= 0.5 && distance < 1.15) { hp -= 12; hurtFlash = 0.35; audio.thud?.(); say('Atingido!', 0.8); }
                if (e.attack >= 1) e.attack = 0;
              }
            }
            for (const p of e.parts) { const target = poseLocal(e, p); p.velocity.copy(target).sub(p.mesh.position).divideScalar(dt).clampLength(0, 8); p.mesh.position.copy(target); p.mesh.rotation.set(0, e.yaw, 0); }
            // Heavy things thrown at an enemy knock it down.
            for (const b of items) if (b.kind !== 'enemy' && b.enabled && !b.held && b.velocity.length() > 3.5 && b.mass >= 0.8 && e.parts.some(pt => world.bounds(pt).intersectsBox(world.bounds(b)))) { damage(e, 15 * b.mass * b.velocity.length() / 10, e.parts[0], b.velocity.clone().multiplyScalar(0.6)); break; }
          } else if (e.state === 'getup') {
            e.timer -= dt; const k = 1 - Math.exp(-dt * 10);
            for (const p of e.parts) { p.mesh.position.lerp(poseLocal(e, p), k); p.velocity.set(0, 0, 0); }
            if (e.timer <= 0) e.state = 'chase';
          } else if (e.state === 'ragdoll') { if (!e.parts.some(p => p.holders.size) && (e.timer -= dt) <= 0) getUp(e); }
          else if (e.state === 'dead' && (e.timer -= dt) <= 0) { e.state = 'gone'; for (const p of e.parts) { p.enabled = false; p.mesh.visible = false; p.holders.clear(); } }
        }

        // ---- world ----
        handsUpdate(dt); world.update(dt); particles.update(dt);
        for (const d of [doorA, doorB]) if (d.removed && d.opening < 1) { d.opening = Math.min(1, d.opening + dt); d.mesh.position.y = d.closedY + d.opening * 2.6; }
        plateMass = items.filter(b => b.enabled && !b.holders.size && !b.held && b.kind !== 'enemy' && plate.containsPoint(b.mesh.position)).reduce((sum, b) => sum + b.mass, 0);
        if (Math.round(plateMass * 10) !== Math.round((plateLabel.userData.mass || 0) * 10)) { plateLabel.userData.mass = plateMass; plateLabel.userData.set(`${plateMass.toFixed(1)} / ${COMPLEX.plateMass} kg`); }
        plateMesh.position.y = plateMass >= COMPLEX.plateMass ? 0.012 : 0.03;
        if (plateMass >= COMPLEX.plateMass && !doorB.removed) { openDoor(doorB); say('Porta de cima aberta!'); }
        if (rig.position.y > 1 && eye.z < -17.2 && checkpoint.z > -17) checkpoint.set(0, 1.3, -18.5);
        if (!sandboxMode && !finished && Math.hypot(eye.x - exitPad.position.x, eye.z - exitPad.position.z) < 0.8 && rig.position.y > 1) { finished = true; audio.success(); say(`Fase concluída em ${clock.toFixed(0)} s · ${kills} inimigos`, 8); }
        exitPad.material.opacity = 0.4 + Math.sin(clock * 3) * 0.2;
        hp = Math.min(COMPLEX.playerHp, hp + dt * 1.5); hurtFlash = Math.max(0, hurtFlash - dt);
        if (hp <= 0) { say('Você caiu. De volta ao último ponto.', 3); restart(true); }
        feedbackLife = Math.max(0, feedbackLife - dt);
        const ammo = (gun.mag?.rounds || 0) + (gun.chambered ? 1 : 0);
        const status = feedbackLife > 0 ? feedback : !gun.holder ? 'Pince a arma na mesa · pince caixas, latas e inimigos' : !gun.chambered ? (gun.mag ? 'Puxe o ferrolho com a outra mão' : 'Pince no quadril: carregador') : 'Pince para atirar · abra a mão para soltar';
        ctx.hud(`Complexo${sandboxMode ? ' SANDBOX' : ''} · vida ${sandboxMode ? '∞' : Math.round(hp)}${hurtFlash > 0 ? ' !' : ''} · munição ${ammo}${gun.mag ? '' : ' (sem carregador)'} · ${kills}/${enemies.length}`, sandboxMode && feedbackLife <= 0 ? 'Crie objetos nos botões da sala e use as mãos para pegá-los.' : status);
      },
      dispose() { mover.stop(); world.setHands([]); },
    };
  },
};
