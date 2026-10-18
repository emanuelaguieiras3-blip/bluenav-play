export const CATEGORIES = {
  pingpong: 'Esporte', plaza: 'Social', complex: 'Aventura', sandbox: 'Criação', jobs: 'Simulação', tactical: 'Ação',
  racing: 'Corrida', ski: 'Esporte', motorbike: 'Corrida', shiftworld: 'Aventura', jungle: 'Esporte', arena: 'Ação',
  archery: 'Esporte', rhythm: 'Música', kingdom: 'Criação', dungeon: 'Aventura', galaxy: 'Espaço', universe: 'Espaço',
  puzzle: 'Puzzle', dive: 'Exploração', climb: 'Esporte', night: 'Aventura', cook: 'Simulação', tablegames: 'Mesa', physics: 'Criação', blocks: 'Criação',
};
export const APP_ART = {
  boneworks: 'assets/apps/boneworks.jpg', bonelab: 'assets/apps/bonelab.jpg', gorillatag: 'assets/apps/gorillatag.png',
  roblox: 'assets/apps/roblox.jpg', vrchat: 'assets/apps/vrchat.png', minecraft: 'assets/apps/minecraft.png', youtube: 'assets/apps/youtube.png',
  recroom: 'assets/apps/recroom.svg',
};
export const gameCover = id => `assets/covers/${id}.jpg`;
const images = new Map();
export function loadCatalogImage(url) {
  if (!images.has(url)) images.set(url, new Promise(resolve => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = url;
  }));
  return images.get(url);
}
export function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
  context.drawImage(image, x + (width - image.width * scale) / 2, y + (height - image.height * scale) / 2, image.width * scale, image.height * scale);
  context.restore();
}
