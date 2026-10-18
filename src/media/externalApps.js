import { screenPanel } from '../ui/screenPanel.js';
import { OFFICIAL_GAMES } from './officialGames.js';
import { APP_ART } from '../ui/catalogArt.js';

export const EXTERNAL_APPS = [
  ...OFFICIAL_GAMES,
  { id: 'roblox', name: 'Roblox', url: 'https://www.roblox.com/',
    description: 'No celular, abre o cliente normal. VR exige um headset compatível ou PC configurado para Roblox VR.',
    guide: 'https://en.help.roblox.com/hc/en-us/articles/208260046-Setting-up-VR-for-Roblox' },
  { id: 'recroom', name: 'Rec Room', url: 'https://recroom.com/',
    description: 'Use o cliente e confira os dispositivos atualmente disponíveis no site oficial. VR Box não transforma o cliente de celular em VR.' },
  { id: 'vrchat', name: 'VRChat', url: 'https://hello.vrchat.com/',
    description: 'A versão Android e os clientes VR têm requisitos diferentes. Este acesso não transmite mãos ou imagem do BlueNav para o jogo.' },
  { id: 'minecraft', name: 'Minecraft VR · Vivecraft', url: 'https://www.vivecraft.org/',
    description: 'Vivecraft é um mod para Minecraft Java no computador, com runtime VR compatível. Não funciona como mod do Minecraft de celular.',
    guide: 'https://github.com/Vivecraft/VivecraftMod' },
];

export function createExternalApps(app) {
  const panel = screenPanel(app, 'Jogos externos');
  const cards = new Map();
  for (const game of EXTERNAL_APPS) {
    const card = document.createElement('article'); card.className = 'app-card';
    if (APP_ART[game.id]) {
      const image = document.createElement('img'); image.className = 'app-banner'; image.src = APP_ART[game.id]; image.alt = game.name; image.loading = 'lazy'; card.append(image);
    }
    const title = document.createElement('h3'); title.textContent = game.name;
    const description = document.createElement('p'); description.textContent = game.description;
    const link = document.createElement('a'); link.textContent = 'Abrir site oficial'; link.href = game.url;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(title, description, link);
    if (game.guide) {
      const guide = document.createElement('a'); guide.href = game.guide; guide.textContent = 'Configuração VR';
      guide.target = '_blank'; guide.rel = 'noopener noreferrer'; card.append(guide);
    }
    if (game.id === 'minecraft') {
      const own = document.createElement('button'); own.type = 'button'; own.textContent = 'Jogar Mundo de Blocos no VR Box';
      own.onclick = async () => { app.screenDialog?.close(); await app.loadGame('blocks'); }; card.append(own);
    }
    if (game.reference) {
      const reference = document.createElement('a'); reference.href = game.reference;
      reference.textContent = 'Vídeo informado do Bitgamer'; reference.target = '_blank'; reference.rel = 'noopener noreferrer'; card.append(reference);
    }
    card.dataset.appId = game.id; cards.set(game.id, card); panel.content.append(card);
  }
  const note = document.createElement('p'); note.className = 'panel-hint';
  note.textContent = 'Roblox-VR-with-Webcam exige Python no PC, servidor e uma experiência R15 preparada. sauceVR exige executor de scripts; não é um driver de VR para celular. Nenhum dos dois resolve VR Box.';
  panel.content.append(note);
  return { ...panel, show(id) {
    panel.show();
    const card = cards.get(id);
    if (card) { card.scrollIntoView({ block: 'start' }); card.querySelector('a')?.focus({ preventScroll: true }); }
  } };
}
