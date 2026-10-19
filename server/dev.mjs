import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const port = Number(process.env.PORT || 8084);
const host = process.env.HOST || '127.0.0.1';
let key = process.env.GEMINI_API_KEY || '';
if (!key) {
  try {
    const env = await readFile(path.join(root, '.env.local'), 'utf8');
    key = env.replace(/^\uFEFF/, '').match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim() || '';
  } catch { /* Optional local credential file. */ }
}
const json = (response, code, value) => {
  response.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
};

http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/api/gemini/status') return json(response, 200, { available: !!key });
  if (pathname === '/api/gemini' && request.method === 'POST') {
    if (!key) return json(response, 503, { error: 'Gemini não configurado.' });
    if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) return json(response, 403, { error: 'Origem recusada.' });
    const model = new URL(request.url, 'http://localhost').searchParams.get('model') || 'gemini-3.5-flash-lite';
    if (!['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'].includes(model)) return json(response, 400, { error: 'Modelo inválido.' });
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 200_000) return json(response, 413, { error: 'Requisição grande demais.' });
    }
    try {
      JSON.parse(body);
      let upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body, signal: AbortSignal.timeout(12000) });
      // AQ. keys may be Vertex express keys instead of Gemini API keys.
      if (key.startsWith('AQ.') && [401, 403].includes(upstream.status)) {
        upstream = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(12000) });
      }
      const result = await upstream.text();
      response.writeHead(upstream.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(result);
    } catch { json(response, 502, { error: 'Não foi possível consultar Gemini.' }); }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Método não permitido.' });
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return json(response, 400, { error: 'Caminho inválido.' }); }
  const filename = path.resolve(root, '.' + decoded, decoded.endsWith('/') ? 'index.html' : '');
  if (!filename.startsWith(root + path.sep) || path.relative(root, filename).split(path.sep).some(part => part.startsWith('.') || part === 'node_modules')) return json(response, 403, { error: 'Acesso negado.' });
  try {
    const source = (await stat(filename)).isDirectory() ? path.join(filename, 'index.html') : filename;
    const data = await readFile(source);
    response.writeHead(200, { 'content-type': types[path.extname(source)] || 'application/octet-stream', 'cache-control': 'no-store',
      'permissions-policy': 'camera=(self), xr-spatial-tracking=(self), accelerometer=(self), gyroscope=(self)' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { json(response, 404, { error: 'Arquivo não encontrado.' }); }
}).listen(port, host, () => console.log(`BlueNav local em http://${host}:${port} · Gemini ${key ? 'configurado' : 'sem chave'}`));
