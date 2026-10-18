// Shared Gemini proxy for Vercel functions: the key stays in GEMINI_API_KEY and never reaches the browser.
export const MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'];
export const key = () => (process.env.GEMINI_API_KEY || '').trim();

// The Android app loads its files from https://localhost (Capacitor) and calls this site.
const APP_ORIGINS = ['https://localhost'];
export function cors(req, res) {
  const origin = req.headers.origin;
  if (APP_ORIGINS.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS'); res.setHeader('access-control-allow-headers', 'content-type');
  }
  return APP_ORIGINS.includes(origin);
}

export async function forward(model, body) {
  let upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key() }, body, signal: AbortSignal.timeout(12000) });
  // AQ. keys may be Vertex express keys instead of Gemini API keys.
  if (key().startsWith('AQ.') && [401, 403].includes(upstream.status)) {
    upstream = await fetch(`https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key())}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(12000) });
  }
  return { status: upstream.status, text: await upstream.text() };
}
