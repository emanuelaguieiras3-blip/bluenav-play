import { std } from './common.js';
import { TABLE, createPingPongMatch } from './pingpongPhysics.js';
import { buildAvatar, animateAvatar } from './plaza/avatar.js';

export default {
  id: 'pingpong',
  create(ctx) {
    const { THREE, root, env, audio, input } = ctx;
    ctx.lookDown(-.23); ctx.teleport({ walk: false });
    ctx.objective?.(''); ctx.hudPose(-52, .95);
    env.set({ sky: false, top: '#e7dfcc', horizon: '#c8c6b6', bottom: '#43594c', hemi: ['#fff4df', '#526352', 1.7], sun: ['#fff4de', 1.8], sunPos: [-3, 7, 1] });
    const match = createPingPongMatch();
    const add = (geometry, material, position) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); root.add(mesh); return mesh;
    };
    const green = std({ color: '#28594d', roughness: .83 }), iron = std({ color: '#293a35', roughness: .6 });
    const wood = std({ color: '#c2a77b', roughness: .85 });
    const length = TABLE.near - TABLE.far;
    add(new THREE.BoxGeometry(TABLE.width, .035, length), green, [0, TABLE.height - .0175, TABLE.net]);
    const stripe = new THREE.MeshBasicMaterial({ color: '#eee9d8' });
    for (const x of [-TABLE.width / 2 + .01, TABLE.width / 2 - .01, 0]) add(new THREE.BoxGeometry(x ? .02 : .008, .002, length), stripe, [x, TABLE.height + .001, TABLE.net]);
    for (const z of [TABLE.near - .01, TABLE.far + .01]) add(new THREE.BoxGeometry(TABLE.width, .002, .02), stripe, [0, TABLE.height + .001, z]);
    for (const x of [-.58, .58]) for (const z of [-1.05, -2.98]) add(new THREE.BoxGeometry(.045, .72, .045), iron, [x, .36, z]);
    for (const z of [-1.05, -2.98]) add(new THREE.BoxGeometry(1.2, .035, .035), iron, [0, .24, z]);
    // A single line buffer gives the net a visible woven grid without dozens of draw calls.
    const points = [];
    for (let x = -.79; x <= .8; x += .035) points.push(x, TABLE.height, TABLE.net, x, TABLE.height + TABLE.netHeight, TABLE.net);
    for (let y = TABLE.height; y < TABLE.height + TABLE.netHeight; y += .025) points.push(-.79, y, TABLE.net, .79, y, TABLE.net);
    const net = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color: '#d9d5c3' })); root.add(net);
    add(new THREE.BoxGeometry(1.62, .012, .012), stripe, [0, TABLE.height + TABLE.netHeight, TABLE.net]);
    for (const x of [-.81, .81]) add(new THREE.CylinderGeometry(.012, .012, .2, 8), iron, [x, TABLE.height + .07, TABLE.net]);
    add(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), std({ color: '#c1ac88' }), [0, 0, -2]);
    const floorLines = [];
    for (let z = -7; z < 4; z += .4) floorLines.push(-5, .002, z, 5, .002, z);
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(floorLines, 3)), new THREE.LineBasicMaterial({ color: '#a79172', transparent: true, opacity: .28 })));
    add(new THREE.BoxGeometry(10, 3.4, .12), std({ color: '#dfd8c6' }), [0, 1.7, -5.4]);
    add(new THREE.BoxGeometry(10, .96, .14), green, [0, .48, -5.31]);
    for (const x of [-3.8, 3.8]) add(new THREE.BoxGeometry(.08, 3.4, 7), wood, [x, 1.7, -2]);

    function paddle(color) {
      const group = new THREE.Group(), face = std({ color, roughness: .93 });
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .014, 32).rotateX(Math.PI / 2), wood);
      blade.scale.y = 1.12; group.add(blade);
      for (const z of [-.009, .009]) {
        const rubber = new THREE.Mesh(new THREE.CircleGeometry(.093, 32), z < 0 ? face : iron); rubber.position.z = z; rubber.scale.y = 1.12;
        if (z < 0) rubber.rotation.y = Math.PI; group.add(rubber);
      }
      const handle = new THREE.Mesh(new THREE.CapsuleGeometry(.018, .11, 4, 10), wood); handle.position.y = -.15; group.add(handle);
      root.add(group); return group;
    }
    const playerPaddle = paddle('#b54f3c'), opponentPaddle = paddle('#303f38');
    const player = { side: 0, position: new THREE.Vector3(.25, 1, -.45), previous: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), velocity: new THREE.Vector3(), active: false, radius: .1 };
    const opponent = { side: 1, position: new THREE.Vector3(0, 1, -3.32), previous: new THREE.Vector3(), normal: new THREE.Vector3(0, .22, 1).normalize(), velocity: new THREE.Vector3(), active: true, radius: .1 };
    player.previous.copy(player.position); opponent.previous.copy(opponent.position);
    const avatar = buildAvatar({ shirt: 2, hair: 1, skin: 2, mouth: 0 }); avatar.position.set(0, 0, -3.8); avatar.rotation.y = Math.PI; root.add(avatar);
    const ball = add(new THREE.SphereGeometry(TABLE.radius, 16, 12), std({ color: '#fff7e7', roughness: .7 }), [0, 1.1, -3.25]);
    const score = ctx.label('00   :   00', { w: .68, h: .18, bg: '#203e35', fg: '#f5eedf', size: .65 }); score.position.set(0, 1.92, -3.95); root.add(score);
    const heading = ctx.label('CLUBE / MESA 01', { w: .7, h: .065, bg: 'rgba(0,0,0,0)', fg: '#ede5d3', size: .36 }); heading.position.set(0, 2.13, -3.95); root.add(heading);
    const instruction = ctx.label('Devolva após um quique', { w: .9, h: .065, bg: 'rgba(0,0,0,0)', fg: '#304e42', size: .38 }); instruction.position.set(0, 2.4, -4); root.add(instruction);
    const serve = () => { if (!match.serve() && match.getState().phase === 'finished') { match.reset(); match.serve(); } };
    const serveButton = ctx.button({ label: 'Sacar', w: .2, h: .075, onClick: serve }); serveButton.position.set(-.31, 1.03, -.56); root.add(serveButton);
    const switchButton = ctx.button({ label: 'Trocar mão', w: .2, h: .075, onClick: () => { side = side === 'right' ? 'left' : 'right'; trackedId = null; } }); switchButton.position.set(-.55, 1.03, -.56); root.add(switchButton);
    let side = 'right', trackedId = null, lastScore = '', stateText = '', autoServe = 0, keyDown = false;
    const up = new THREE.Vector3(0, 1, 0), normal = new THREE.Vector3(), edge = new THREE.Vector3();
    return {
      match, serve, playerPaddle, opponentPaddle, getState: () => ({ ...match.getState(), hand: side, tracking: player.active }),
      update(dt, t) {
        dt = Math.max(0, Math.min(.05, dt));
        const pointers = ctx.pointers();
        const candidates = pointers.filter(p => !p.stale && !p.uiBusy);
        const pointer = candidates.find(p => p.side === side) || (candidates.length === 1 ? candidates[0] : null);
        player.previous.copy(player.position); player.active = !!pointer;
        if (pointer) {
          if (pointer.hand?.points?.length >= 18) {
            const P = pointer.hand.points;
            normal.copy(P[5]).sub(P[0]).cross(edge.copy(P[17]).sub(P[0]));
            if (normal.lengthSq() < 1e-8) player.active = false;
            else {
              player.normal.copy(normal.normalize());
              player.position.copy(pointer.hand.palm || pointer.handPos).addScaledVector(pointer.hand.dir || up, .13);
            }
          } else if (pointer.source === 'xr') {
            playerPaddle.quaternion.copy(pointer.quaternion);
            player.normal.set(0, 0, 1).applyQuaternion(playerPaddle.quaternion);
            player.position.copy(pointer.handPos).addScaledVector(up, .13);
          } else {
            // Flat-screen practice: pointer ray intersects a fixed reachable paddle plane.
            const ray = pointer.ray || input.ray;
            const distance = Math.abs(ray.direction.z) > 1e-6 ? (-.47 - ray.origin.z) / ray.direction.z : -1;
            if (distance > 0) player.position.copy(ray.origin).addScaledVector(ray.direction, distance);
            player.position.x = THREE.MathUtils.clamp(player.position.x, -.9, .9);
            player.position.y = THREE.MathUtils.clamp(player.position.y, .78, 1.65); player.position.z = -.47;
            player.normal.set(0, .2, 1).normalize();
          }
          if (trackedId !== pointer.id || pointer.fresh || player.previous.distanceTo(player.position) > .45) player.previous.copy(player.position);
          trackedId = pointer.id;
          if (dt > 0) player.velocity.copy(player.position).sub(player.previous).divideScalar(dt).clampLength(0, 8);
          playerPaddle.position.copy(player.position);
          if (pointer.hand) {
            edge.copy(pointer.hand.dir || up).cross(player.normal).normalize();
            if (edge.lengthSq() > .5) {
              normal.copy(player.normal).cross(edge).normalize();
              playerPaddle.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(edge, normal, player.normal));
            }
          } else if (pointer.source !== 'xr') playerPaddle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), player.normal);
        } else { trackedId = null; player.velocity.set(0, 0, 0); }
        playerPaddle.visible = player.active;
        const state = match.getState();
        opponent.previous.copy(opponent.position);
        const approaching = match.velocity.z < 0 && state.expected === 1 && state.bounces === 1;
        const targetX = approaching ? match.position.x : 0;
        const targetY = approaching ? match.position.y : 1.03;
        const speed = dt * 2.6;
        opponent.position.x += THREE.MathUtils.clamp(targetX - opponent.position.x, -speed, speed);
        opponent.position.y += THREE.MathUtils.clamp(targetY - opponent.position.y, -speed, speed);
        opponent.position.y = THREE.MathUtils.clamp(opponent.position.y, .8, 1.55);
        opponent.velocity.copy(opponent.position).sub(opponent.previous).divideScalar(dt || 1).clampLength(0, 3);
        if (approaching) {
          const flight = (-1.35 - opponent.position.z) / 3.8;
          const lift = (TABLE.height + TABLE.radius - opponent.position.y + 4.905 * flight * flight) / flight;
          const change = new THREE.Vector3(-match.position.x * .5 - match.velocity.x, lift - match.velocity.y, 3.8 - match.velocity.z);
          opponent.normal.copy(change).normalize();
          // Account for restitution: a small virtual swing supplies the missing normal impulse.
          const swing = change.length() / 1.78 + match.velocity.dot(opponent.normal);
          opponent.velocity.addScaledVector(opponent.normal, swing - opponent.velocity.dot(opponent.normal));
        }
        opponentPaddle.position.copy(opponent.position); opponentPaddle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), opponent.normal);
        avatar.position.x = opponent.position.x * .65;
        avatar.updateMatrixWorld(true); avatar.userData.hands[1].position.copy(avatar.worldToLocal(opponent.position.clone().add(new THREE.Vector3(0, -.14, 0))));
        animateAvatar(avatar, t, dt);
        for (const event of match.step(dt, [player, opponent])) if (event === 'paddle' || event === 'table') audio.tone({ freq: event === 'paddle' ? 950 : 620, dur: .025, vol: .1, type: 'triangle' });
        const next = match.getState(); ball.visible = next.phase === 'playing'; ball.position.copy(match.position);
        const summary = next.score.join(':');
        if (summary !== lastScore) { lastScore = summary; score.userData.set(next.score.map(n => String(n).padStart(2, '0')).join('   :   ')); }
        const text = next.phase === 'finished' ? (next.winner === 0 ? 'Você venceu' : 'Adversário venceu') : next.message;
        const detail = player.active ? 'Mova a raquete · Espaço para sacar' : 'Mão fora de vista · mostre a palma para retomar';
        if (text + detail !== stateText) { stateText = text + detail; ctx.hud(text, detail); }
        const pressed = input.keys.has('Space'); if (pressed && !keyDown) serve(); keyDown = pressed;
        if (next.phase === 'point' || next.phase === 'ready' && next.message.startsWith('Rede')) { autoServe += dt; if (autoServe > 1.6 && player.active) { match.serve(); autoServe = 0; } } else autoServe = 0;
      },
      onPause() { trackedId = null; player.active = false; player.velocity.set(0, 0, 0); },
    };
  },
};
