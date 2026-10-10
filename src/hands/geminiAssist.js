// Assistente Gemini: recebe uma janela curta de frames da mão e devolve os pontos corrigidos.
// Roda em segundo plano, nunca trava a renderização. O resultado calibra o corretor local.
import { CONFIG } from '../../config.js';

export const SYSTEM_PROMPT = `Você é um corretor de dados de rastreamento de mãos para um projeto de VR no navegador chamado BlueNav Play.

Sua única função: receber uma sequência de pontos das mãos detectados pelo MediaPipe e devolver esses pontos CORRIGIDOS.

REGRAS OBRIGATÓRIAS:

✅ SUAVIZAÇÃO:
- Reduza tremidas pequenas sem atrasar o movimento real
- Se o ponto mudar muito de um frame pro outro de forma impossível, interpole suavemente
- NÃO deixe o movimento lento ou travado — mantenha natural

✅ VALIDAÇÃO:
- Dedo não pode se curvar para trás
- Os pontos devem manter distâncias anatômicas coerentes
- Se um valor parecer errado, substitua pela média dos vizinhos e dos frames anteriores

✅ GESTOS:
- Confirme gestos apenas quando estáveis por pelo menos 0,4s
- PINÇA: polegar e indicador próximos → confirmar
- MÃO ABERTA: todos os dedos esticados → confirmar
- APONTAR: indicador esticado, outros dobrados → confirmar

✅ SAÍDA:
- Responda APENAS com JSON válido no formato:
{
  "pontosCorrigidos": [[x,y,z], [x,y,z], ...],
  "gesto": "pinça|aberta|apontando|indefinida",
  "confianca": 0.0 a 1.0
}
- Sem explicações, sem comentários, sem texto extra
- Se não tiver certeza, devolva os pontos originais e confiança baixa

Seja rápido, preciso e silencioso. O usuário só deve sentir que a mão está estável e precisa.`;

export class GeminiAssist {
  constructor() {
    this.enabled = false;
    this.busy = false;
    this.nextAt = 0;
    this.backoff = CONFIG.GEMINI_INTERVAL_MS;
    this.modelIdx = 0;
    this.status = 'desligado';
    this.last = null;
    this.calls = 0;
    this.agree = 0;
  }

  _endpoint(model) {
    if (CONFIG.GEMINI_PROXY_URL) return { url: CONFIG.GEMINI_PROXY_URL, headers: {} };
    const key = CONFIG.GEMINI_API_KEY;
    // Chaves "AIza..." = Google AI Studio; chaves "AQ...." = Vertex AI (modo express)
    if (key.startsWith('AIza')) {
      return { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, headers: { 'x-goog-api-key': key } };
    }
    return { url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${encodeURIComponent(key)}`, headers: {} };
  }

  // frames: [{t, pontos:[[x,y,z]x21]}]  — chamado pelo HandTracker
  maybeSend(now, frames, localGesture, onResult) {
    if (!this.enabled || this.busy || now < this.nextAt || frames.length < 4) return;
    // menos dados = resposta mais rápida: no máximo 6 quadros espaçados da janela
    if (frames.length > 6) { const step = (frames.length - 1) / 5; frames = Array.from({ length: 6 }, (_, i) => frames[Math.round(i * step)]); }
    if (!CONFIG.GEMINI_API_KEY && !CONFIG.GEMINI_PROXY_URL) { this.status = 'sem chave'; return; }
    this.busy = true;
    const payload = {
      intervaloMs: Math.round((frames[frames.length - 1].t - frames[0].t)),
      unidade: 'metros, espaço da câmera (x direita, y cima, z para o usuário)',
      frames: frames.map((f) => f.pontos.map((p) => p.map((v) => Math.round(v * 1000) / 1000))), // milímetros
    };
    const model = CONFIG.GEMINI_MODELS[this.modelIdx];
    const { url, headers } = this._endpoint(model);
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 900 },
    };
    if (!this.noThinkingCfg) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    this.status = `enviando (${model})…`;
    const t0 = performance.now();
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
      .then(async (r) => {
        if (r.status === 404 && this.modelIdx < CONFIG.GEMINI_MODELS.length - 1) { this.modelIdx++; this.retrySoon = true; throw new Error('modelo indisponível, tentando outro'); }
        if (r.status === 400 && !this.noThinkingCfg) { this.noThinkingCfg = true; this.retrySoon = true; throw new Error('ajustando requisição'); }
        if (r.status === 429) { this.backoff = Math.min(60000, this.backoff * 2); throw new Error('limite de uso (429)'); }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        const out = JSON.parse(text.replace(/^```json|```$/g, '').trim());
        this.calls++;
        if (out.gesto === localGesture) this.agree++;
        this.last = out;
        this.backoff = CONFIG.GEMINI_INTERVAL_MS;
        this.status = `ok ${Math.round(performance.now() - t0)}ms · gesto ${out.gesto} · conf ${out.confianca} · acordo ${this.agree}/${this.calls}`;
        onResult(out);
      })
      .catch((e) => { this.status = 'erro: ' + e.message; })
      .finally(() => { this.busy = false; this.nextAt = performance.now() + (this.retrySoon ? 500 : this.backoff); this.retrySoon = false; });
  }
}
