import { MODELS, key, forward } from './_proxy.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!key()) return res.status(503).json({ error: 'Gemini não configurado.' });
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Origem recusada.' });
  const model = req.query.model || MODELS[0];
  if (!MODELS.includes(model)) return res.status(400).json({ error: 'Modelo inválido.' });
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  if (body.length > 200_000) return res.status(413).json({ error: 'Requisição grande demais.' });
  try {
    const { status, text } = await forward(model, body);
    res.status(status).setHeader('content-type', 'application/json; charset=utf-8'); res.send(text);
  } catch { res.status(502).json({ error: 'Não foi possível consultar Gemini.' }); }
}
