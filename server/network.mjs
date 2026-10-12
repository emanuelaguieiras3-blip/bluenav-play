import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 4;
const MAX_MESSAGE = 16 * 1024;

function code() {
  const bytes = randomBytes(6);
  return [...bytes].map(v => ALPHABET[v % ALPHABET.length]).join('');
}
function send(client, data) { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data)); }
function validGame(id) { return typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id); }
function validPosition(p) {
  return Array.isArray(p) && p.length === 3 && p.every(n => Number.isFinite(n) && Math.abs(n) < 10000);
}

export function createNetworkServer({ port = 8787, host = '0.0.0.0', origins = [] } = {}) {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    if (req.url !== '/health') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE });
  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/room' || (origins.length && !origins.includes(req.headers.origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  function broadcast(room, data, except) { for (const peer of room.peers.values()) if (peer !== except) send(peer, data); }
  function leave(ws) {
    if (!ws.room) return;
    const room = ws.room; room.peers.delete(ws.id); ws.room = null;
    broadcast(room, { type: 'peer-left', id: ws.id });
    if (!room.peers.size) rooms.delete(room.code);
    else if (room.host === ws.id) {
      room.host = room.peers.keys().next().value;
      broadcast(room, { type: 'host', id: room.host });
    }
  }
  wss.on('connection', ws => {
    ws.id = randomUUID().slice(0, 12); ws.alive = true; ws.window = Date.now(); ws.count = 0;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('close', () => leave(ws));
    ws.on('message', raw => {
      const now = Date.now();
      if (now - ws.window > 1000) { ws.window = now; ws.count = 0; }
      if (++ws.count > 45) { ws.close(1008, 'rate limit'); return; }
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'create' || msg.type === 'join') {
        if (ws.room || !validGame(msg.game)) { send(ws, { type: 'error', reason: 'invalid-game' }); return; }
        let room;
        if (msg.type === 'create') {
          let roomCode; do { roomCode = code(); } while (rooms.has(roomCode));
          room = { code: roomCode, game: msg.game, host: ws.id, peers: new Map() };
          rooms.set(roomCode, room);
        } else {
          room = rooms.get(String(msg.room || '').toUpperCase());
          if (!room || room.game !== msg.game) { send(ws, { type: 'error', reason: 'room-not-found' }); return; }
          if (room.peers.size >= MAX_PLAYERS) { send(ws, { type: 'error', reason: 'room-full' }); return; }
        }
        const peers = [...room.peers.keys()]; room.peers.set(ws.id, ws); ws.room = room;
        send(ws, { type: 'joined', room: room.code, id: ws.id, host: room.host, game: room.game, peers });
        broadcast(room, { type: 'peer-joined', id: ws.id }, ws);
        return;
      }
      if (!ws.room) return;
      if (msg.type === 'state') {
        if (!validPosition(msg.position) || !Number.isFinite(msg.yaw) || Math.abs(msg.yaw) > 1000) return;
        broadcast(ws.room, { type: 'state', id: ws.id, position: msg.position, yaw: msg.yaw, at: now }, ws);
      } else if (msg.type === 'event') {
        if (typeof msg.name !== 'string' || !/^[a-z0-9-]{1,40}$/.test(msg.name)) return;
        if (JSON.stringify(msg.data ?? null).length > 8192) return;
        broadcast(ws.room, { type: 'event', id: ws.id, name: msg.name, data: msg.data ?? null, at: now }, ws);
      }
    });
  });
  const pulse = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.alive) { client.terminate(); continue; }
      client.alive = false; client.ping();
    }
  }, 30000);
  server.listen(port, host);
  return { server, wss, rooms, close: () => new Promise(resolve => {
    clearInterval(pulse);
    for (const client of wss.clients) client.terminate();
    wss.close(() => server.close(resolve));
  }) };
}

if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  const origins = (process.env.NETWORK_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const service = createNetworkServer({ port, host, origins });
  service.server.on('listening', () => console.log(`BlueNav network listening on ${host}:${port}`));
}
