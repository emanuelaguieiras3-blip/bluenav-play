// Gemini button assistant. When the index fingertip approaches a button, Gemini
// receives only the button text and returns a short explanation and whether the
// action needs confirmation (leave, close, delete, open an external site).
// Answers are cached per label, so each button costs one call at most.
// The local contact test still detects the touch; Gemini only adds the hint and
// the hold-to-confirm step for risky buttons.
import { CONFIG } from '../../config.js';

export const BUTTON_PROMPT = `Você ajuda quem usa o BlueNav Play, um sistema de VR no navegador controlado pelo dedo indicador.
Recebe o texto de um botão que o dedo do usuário está tocando e o contexto da tela.
Responda APENAS com JSON válido: {"dica": "...", "confirmar": true|false}
- "dica": em português do Brasil, no máximo 60 caracteres, dizendo o que o botão faz. Sem emoji.
- "confirmar": true somente se o toque sair do jogo atual, fechar algo, apagar dados, encerrar a sessão VR ou abrir um site externo. Caso contrário false.
Sem texto extra.`;

const STORE_KEY = 'bluenav.buttonHints.v1';
const MAX_CACHE = 200;

export function parseButtonReply(text) {
  let out;
  try { out = JSON.parse(String(text).replace(/^```json|```$/g, '').trim()); } catch { return null; }
  if (!out || typeof out.dica !== 'string' || typeof out.confirmar !== 'boolean') return null;
  const dica = out.dica.replace(/\s+/g, ' ').trim().slice(0, 80);
  return dica ? { dica, confirmar: out.confirmar } : null;
}

export class ButtonAssist {
  // gemini: the GeminiAssist that owns the endpoint, model choice and enabled flag.
  constructor(gemini) {
    this.gemini = gemini;
    this.cache = new Map();
    this.pending = null;
    this.nextAt = 0;
    this.status = 'aguardando toque';
    try { for (const [label, value] of JSON.parse(localStorage.getItem(STORE_KEY) || '[]')) this.cache.set(label, value); } catch { /* storage blocked */ }
  }

  get active() { return !!this.gemini.enabled && !!(CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_PROXY_URL); }

  // Returns the cached answer, or null and starts one request in the background.
  lookup(label, context = 'menu') {
    label = String(label || '').trim().slice(0, 80);
    if (!label || !this.active) return null;
    if (this.cache.has(label)) return this.cache.get(label);
    const now = performance.now();
    if (this.pending || now < this.nextAt) return null;
    this.pending = label;
    this._request(label, context).finally(() => { this.pending = null; });
    return null;
  }

  async _request(label, context) {
    const gemini = this.gemini, model = CONFIG.GEMINI_MODELS[gemini.modelIdx];
    const { url, headers } = gemini._endpoint(model);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    const body = {
      systemInstruction: { parts: [{ text: BUTTON_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ botao: label, tela: context }) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 120 },
    };
    this.status = `consultando "${label}"`;
    try {
      const response = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
      if (response.status === 429) { this.nextAt = performance.now() + 30000; throw new Error('limite de uso (429)'); }
      if (!response.ok) { this.nextAt = performance.now() + 10000; throw new Error('HTTP ' + response.status); }
      const json = await response.json();
      const text = json?.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
      const answer = parseButtonReply(text);
      if (!answer) { this.nextAt = performance.now() + 5000; throw new Error('resposta inválida'); }
      this._remember(label, answer);
      this.status = `ok · ${this.cache.size} botões`;
      this.nextAt = performance.now() + 1200;
    } catch (error) {
      this.status = controller.signal.aborted ? 'tempo esgotado' : 'erro: ' + error.message;
      if (controller.signal.aborted) this.nextAt = performance.now() + 5000;
    } finally { clearTimeout(timeout); }
  }

  _remember(label, answer) {
    this.cache.set(label, answer);
    while (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...this.cache])); } catch { /* storage blocked */ }
  }
}
