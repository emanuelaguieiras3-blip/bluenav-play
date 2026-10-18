// Configuração do BlueNav Play.
// ATENÇÃO: tudo que está aqui fica visível para quem abrir o site.
// - YouTube: restrinja a chave por "HTTP referrer" (seu domínio) no Google Cloud Console.
// - Gemini: chave no navegador pode ser copiada. Use um proxy (ex.: Cloudflare Worker)
//   em GEMINI_PROXY_URL se for publicar o site.
// Inside the Android app (Capacitor serves the bundled files from https://localhost)
// the Gemini proxy lives on the published site; the key never ships in the APK.
export const BUNDLED = typeof window !== 'undefined' && !!window.Capacitor && location.hostname === 'localhost';
export const API_BASE = BUNDLED ? 'https://bluenav-play.vercel.app' : '';

export const CONFIG = {
  NETWORK_URL: '', // wss://seu-servidor/room (vazio: usuário informa no painel)
  YOUTUBE_API_KEY: 'AIzaSyDSXIOjEANDneoIrngoc2jhQ72otNPBg3s',
  YOUTUBE_REGION: 'BR',

  GEMINI_API_KEY: '',
  // Modelos tentados em ordem (o primeiro que responder é mantido).
  GEMINI_MODELS: ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-flash-latest'],
  // Se preenchido, as chamadas vão para este endereço (POST com o mesmo corpo da API).
  GEMINI_PROXY_URL: '',
  // O Gemini não aguenta 30 chamadas/s. Ele recebe uma janela de ~0,5s de frames
  // a cada intervalo e a resposta calibra o corretor local (que roda em todo frame).
  // 4 s = 15 chamadas/min (limite do plano gratuito do flash-lite)
  GEMINI_INTERVAL_MS: 4000,

  // Câmera do celular: campo de visão horizontal (graus). Ajuste se o passthrough parecer grande/pequeno.
  CAMERA_HFOV: 63,
  // true: a imagem da câmera preenche a visão toda nos óculos; false: escala real com bordas
  PASSTHROUGH_FILL: true,

  // Rastreamento de mãos
  MEDIAPIPE_VERSION: '0.10.14',
  DWELL_TIME: 0.65,     // s — tempo de ativação dos botões
  KEY_DWELL_TIME: 0.4,  // s — teclado virtual
  GESTURE_HOLD: 0.4,    // s — gesto precisa ficar estável
  SMOOTH_PREV: 0.85,    // pontoFinal = anterior × 0,85 + novo × 0,15
  SMOOTH_NEW: 0.15,
};
