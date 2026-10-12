import * as THREE from 'three';
import { CONFIG } from '../../config.js';

const DEFAULT_URL = CONFIG.NETWORK_URL || '';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class NetworkRoom {
  constructor(app) {
    this.app = app;
    this.socket = null; this.room = ''; this.id = ''; this.host = '';
    this.peers = new Map(); this.handlers = new Map(); this.elapsed = 0;
    this.group = new THREE.Group(); this.group.name = 'network-presence'; app.scene.add(this.group);
    this.url = localStorage.getItem('bluenav-network-url') || DEFAULT_URL;
    this.buildUI();
  }
  buildUI() {
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'network-toggle'; toggle.textContent = 'Sala online';
    const panel = document.createElement('section'); panel.className = 'network-panel'; panel.hidden = true;
    const title = document.createElement('strong'); title.textContent = 'Sala online';
    const status = document.createElement('p'); status.className = 'network-status'; status.textContent = 'Informe o endereço do servidor WebSocket.';
    const url = document.createElement('input'); url.type = 'url'; url.placeholder = 'wss://seu-servidor/room'; url.value = this.url; url.setAttribute('aria-label', 'Servidor de rede');
    const room = document.createElement('input'); room.maxLength = 6; room.placeholder = 'Código da sala'; room.setAttribute('aria-label', 'Código da sala');
    const create = document.createElement('button'); create.type = 'button'; create.textContent = 'Criar sala';
    const join = document.createElement('button'); join.type = 'button'; join.textContent = 'Entrar';
    const leave = document.createElement('button'); leave.type = 'button'; leave.textContent = 'Sair';
    const row = document.createElement('div'); row.append(create, join, leave);
    panel.append(title, status, url, room, row);
    document.body.append(toggle, panel);
    const sheet = document.createElement('style'); sheet.textContent = `.network-toggle{position:fixed;right:16px;top:16px;z-index:999;background:#172a43;color:white;border:1px solid #70bfff;border-radius:10px;padding:10px 14px;cursor:pointer}.network-panel{position:fixed;right:16px;top:65px;z-index:1000;width:280px;box-sizing:border-box;background:#101a29;color:#f4f7fb;border:1px solid #5e94c8;border-radius:12px;padding:16px;box-shadow:0 16px 40px #0009;font:14px system-ui}.network-panel[hidden]{display:none}.network-panel input{box-sizing:border-box;width:100%;margin:5px 0;padding:9px;border:1px solid #59769a;border-radius:6px;background:#18283c;color:white}.network-panel button{margin:4px 3px 0 0;padding:7px 10px;background:#315a86;color:white;border:0;border-radius:6px;cursor:pointer}.network-status{line-height:1.4;min-height:36px}`; document.head.append(sheet);
    toggle.onclick = () => { panel.hidden = !panel.hidden; };
    create.onclick = () => this.connect(url.value, 'create');
    join.onclick = () => this.connect(url.value, 'join', room.value);
    leave.onclick = () => this.leave();
    this.ui = { toggle, panel, status, room, url };
  }
  setStatus(message) { this.ui.status.textContent = message; }
  async connect(rawUrl, mode, roomCode = '') {
    if (!this.app.gameId || this.app.gameId === 'lobby') { this.setStatus('Abra um jogo antes de entrar numa sala.'); return false; }
    let url; try { url = new URL(rawUrl); } catch { this.setStatus('Endereço do servidor inválido.'); return false; }
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'wss:' && !(local && url.protocol === 'ws:')) { this.setStatus('Use wss:// para jogar pela internet.'); return false; }
    if (mode === 'join' && !/^[A-Z2-9]{6}$/.test(roomCode.toUpperCase())) { this.setStatus('Código de seis caracteres inválido.'); return false; }
    this.leave(); this.url = url.href; localStorage.setItem('bluenav-network-url', this.url);
    this.setStatus('Conectando…');
    const socket = new WebSocket(this.url); this.socket = socket;
    return new Promise(resolve => {
      let settled = false;
      const settle = value => { if (!settled) { settled = true; resolve(value); } };
      const timeout = setTimeout(() => { if (!settled) { this.setStatus('Tempo de conexão esgotado.'); socket.close(); settle(false); } }, 8000);
      socket.onopen = () => socket.send(JSON.stringify({ type: mode, game: this.app.gameId, room: roomCode.toUpperCase() }));
      socket.onmessage = event => {
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'joined') {
          clearTimeout(timeout); this.room = data.room; this.id = data.id; this.host = data.host;
          this.ui.room.value = data.room; this.ui.toggle.textContent = `Sala ${data.room}`;
          this.setStatus(`Sala ${data.room} · ${data.peers.length + 1}/4 jogadores`);
          settle(true);
        } else if (data.type === 'error') {
          clearTimeout(timeout); this.setStatus(`Erro: ${data.reason}`); socket.close(); settle(false);
        } else if (data.type === 'state') this.updatePeer(data);
        else if (data.type === 'peer-left') this.removePeer(data.id);
        else if (data.type === 'host') this.host = data.id;
        else if (data.type === 'event') for (const handler of this.handlers.get(data.name) || []) handler(data.data, data.id);
      };
      socket.onerror = () => { clearTimeout(timeout); this.setStatus('Falha na conexão. Verifique o servidor.'); settle(false); };
      socket.onclose = () => {
        clearTimeout(timeout); if (this.socket !== socket) return;
        this.room = ''; this.id = ''; this.host = ''; this.ui.toggle.textContent = 'Sala online';
        for (const id of this.peers.keys()) this.removePeer(id);
        if (!settled) { this.setStatus('Conexão encerrada.'); settle(false); }
      };
    });
  }
  leave() {
    const socket = this.socket; this.socket = null;
    if (socket) { socket.onclose = null; socket.close(); }
    this.room = ''; this.id = ''; this.host = ''; this.ui.toggle.textContent = 'Sala online';
    for (const id of [...this.peers.keys()]) this.removePeer(id);
  }
  removePeer(id) { const peer = this.peers.get(id); if (peer) { this.group.remove(peer.mesh); this.peers.delete(id); } }
  updatePeer(data) {
    if (data.id === this.id || !Array.isArray(data.position)) return;
    let peer = this.peers.get(data.id);
    if (!peer) {
      const custom = this.peerBuilder?.(data.id);
      if (custom) { this.group.add(custom); peer = { mesh: custom, target: V(...data.position) }; this.peers.set(data.id, peer); custom.position.copy(peer.target); }
    }
    if (!peer) {
      const mesh = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#69b5ec', roughness: 0.75 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 1.0, 5, 12), mat); body.position.y = 0.83;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), mat); head.position.y = 1.67;
      mesh.add(body, head); this.group.add(mesh);
      peer = { mesh, target: V(...data.position) }; this.peers.set(data.id, peer);
      mesh.position.copy(peer.target);
    }
    peer.target.set(...data.position); peer.yaw = data.yaw;
  }
  // A game can replace the default avatar (for example with the player's look).
  rebuildPeer(id) {
    const peer = this.peers.get(id), mesh = peer && this.peerBuilder?.(id); if (!mesh) return;
    mesh.position.copy(peer.mesh.position); mesh.rotation.copy(peer.mesh.rotation);
    this.group.remove(peer.mesh); this.group.add(mesh); peer.mesh = mesh;
  }
  on(name, handler) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    const set = this.handlers.get(name); set.add(handler);
    return () => set.delete(handler);
  }
  sendEvent(name, data) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'event', name, data }));
  }
  update(dt) {
    for (const peer of this.peers.values()) {
      peer.mesh.position.lerp(peer.target, Math.min(1, dt * 12));
      peer.mesh.rotation.y += Math.atan2(Math.sin((peer.yaw || 0) - peer.mesh.rotation.y), Math.cos((peer.yaw || 0) - peer.mesh.rotation.y)) * Math.min(1, dt * 8);
    }
    if (!this.room || this.socket?.readyState !== WebSocket.OPEN) return;
    this.elapsed += dt; if (this.elapsed < 0.1) return; this.elapsed = 0;
    const p = this.app.rig.position, yaw = this.app.headYaw();
    this.socket.send(JSON.stringify({ type: 'state', position: [p.x, p.y, p.z], yaw }));
  }
}
