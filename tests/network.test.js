import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { once } from 'node:events';
import { createNetworkServer } from '../server/network.mjs';

const inbox = new WeakMap();
function nextMessage(socket) {
  const box = inbox.get(socket);
  if (box.queue.length) return Promise.resolve(box.queue.shift());
  return new Promise(resolve => box.waiters.push(resolve));
}

test('network room relays state only within same game and reassigns host', async () => {
  const service = createNetworkServer({ port: 0 });
  const sockets = [];
  try {
    await once(service.server, 'listening');
    const url = `ws://127.0.0.1:${service.server.address().port}/room`;
    const connect = async () => {
      const socket = new WebSocket(url); sockets.push(socket);
      const box = { queue: [], waiters: [] }; inbox.set(socket, box);
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString()), waiter = box.waiters.shift();
        if (waiter) waiter(message); else box.queue.push(message);
      });
      await once(socket, 'open'); return socket;
    };
    const a = await connect();
    a.send(JSON.stringify({ type: 'create', game: 'ski' }));
    const created = await nextMessage(a);
    assert.match(created.room, /^[A-Z2-9]{6}$/);
    const b = await connect();
    b.send(JSON.stringify({ type: 'join', game: 'ski', room: created.room }));
    const joined = await nextMessage(b);
    assert.equal(joined.host, created.id);
    assert.equal((await nextMessage(a)).type, 'peer-joined');
    b.send(JSON.stringify({ type: 'state', position: [2, 0, -4], yaw: 0.5 }));
    assert.deepEqual((await nextMessage(a)).position, [2, 0, -4]);
    const c = await connect();
    c.send(JSON.stringify({ type: 'join', game: 'motorbike', room: created.room }));
    assert.equal((await nextMessage(c)).reason, 'room-not-found');
    a.close();
    assert.equal((await nextMessage(b)).type, 'peer-left');
    assert.deepEqual(await nextMessage(b), { type: 'host', id: joined.id });
  } finally {
    for (const socket of sockets) socket.terminate();
    await service.close();
  }
});
