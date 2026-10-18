// Gemini button assistant. When the index fingertip approaches a button, Gemini
// receives only the button text and returns a short explanation and whether the
// action needs confirmation (leave, close, delete, open an external site).
// Answers are cached per label, so each button costs one call at most.
// The local contact test still detects the touch. When the fingertip stops just
// in front of a button without touching it (phone-camera depth is noisy),
// judge() lets Gemini decide from the finger's distance track whether the user
// meant to press. Risky buttons never take that path: they need a real touch.
import { CONFIG } from '../../config.js';

export const BUTTON_PROMPT = `Você ajuda quem usa o BlueNav Play, um sistema de VR no navegador controlado pelo dedo indicador.
Recebe o texto de um botão que o dedo do usuário está tocando e o contexto da tela.
Responda APENAS com JSON válido: {"dica": "...", "confirmar": true|false}
- "dica": em português do Brasil, no máximo 60 caracteres, dizendo o que o botão faz. Sem emoji.
- "confirmar": true somente se o toque sair do jogo atual, fechar algo, apagar dados, encerrar a sessão VR ou abrir um site externo. Caso contrário false.
Sem texto extra.`;

export const INTENT_PROMPT = `Você decide se uma pessoa quer apertar um botão em VR.
A mão é rastreada pela câmera do celular, que erra a profundidade em 1 a 3 cm.
Recebe o texto do botão, o tipo de evento ("colisao": o dedo bateu no botão; "quase": parou perto sem tocar) e amostras [distancia_mm, tempo_ms]: distância da ponta do indicador até a superfície do botão (positivo = à frente; 0 ou negativo = tocando ou afundando o botão).
Evento "colisao": é clique quando o dedo vem de longe (mais de ~15 mm) e chega ao botão (0 mm ou menos), mesmo que pare logo. Não é clique o raspão: o dedo já estava perto (menos de ~8 mm) sem vir de longe, mal entra (não passa de -2 mm) e logo se afasta.
Evento "quase": como a câmera erra a profundidade, um dedo que se aproximou e ficou parado a menos de ~25 mm É clique; não é clique quando o dedo se afasta ou oscila longe (mais de ~25 mm).
Responda APENAS com JSON válido: {"pressionar": true|false, "confianca": número de 0 a 1}. Sem texto extra.`;

export function parseIntentReply(text) {
  let out;
  try { out = JSON.parse(String(text).replace(/^```json|```$/g, '').trim()); } catch { return null; }
  if (!out || typeof out.pressionar !== 'boolean' || typeof out.confianca !== 'number' || !(out.confianca >= 0 && out.confianca <= 1)) return null;
  return { pressionar: out.pressionar, confianca: out.confianca };
}

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

  // Gemini's verdict on a fingertip that stopped just short of a button, or null.
  async judge(label, samples, evento = 'quase') {
    label = String(label || '').trim().slice(0, 80);
    if (!label || !this.active || this.judging || performance.now() < this.nextAt) return null;
    this.judging = true;
    try {
      const text = await this._call(INTENT_PROMPT, { botao: label, evento, amostras: samples.slice(-16) }, 60);
      const verdict = parseIntentReply(text);
      this.status = verdict ? `toque ${verdict.pressionar ? 'confirmado' : 'recusado'} pelo Gemini` : 'resposta inválida';
      return verdict;
    } catch (error) { this.status = 'erro: ' + error.message; return null; }
    finally { this.judging = false; }
  }

  async _call(prompt, payload, maxOutputTokens) {
    const gemini = this.gemini, model = CONFIG.GEMINI_MODELS[gemini.modelIdx];
    const { url, headers } = gemini._endpoint(model);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens },
      }) });
      if (response.status === 429) { this.nextAt = performance.now() + 30000; throw new Error('limite de uso (429)'); }
      if (!response.ok) { this.nextAt = performance.now() + 10000; throw new Error('HTTP ' + response.status); }
      const json = await response.json();
      return json?.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') || '';
    } finally { clearTimeout(timeout); }
  }

  async _request(label, context) {
    this.status = `consultando "${label}"`;
    try {
      const answer = parseButtonReply(await this._call(BUTTON_PROMPT, { botao: label, tela: context }, 120));
      if (!answer) { this.nextAt = performance.now() + 5000; throw new Error('resposta inválida'); }
      this._remember(label, answer);
      this.status = `ok · ${this.cache.size} botões`;
      this.nextAt = performance.now() + 1200;
    } catch (error) {
      const timedOut = error.name === 'AbortError';
      this.status = timedOut ? 'tempo esgotado' : 'erro: ' + error.message;
      if (timedOut) this.nextAt = performance.now() + 5000;
    }
  }

  _remember(label, answer) {
    this.cache.set(label, answer);
    while (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...this.cache])); } catch { /* storage blocked */ }
  }
}
