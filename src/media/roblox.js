// External Roblox access cannot turn the mobile client into a VR renderer.
export function createRobloxAccess() {
  let panel = null;
  const show = () => {
    if (panel) { panel.hidden = false; return; }
    panel = document.createElement('section');
    panel.setAttribute('aria-label', 'Roblox e compatibilidade VR');
    Object.assign(panel.style, { position: 'fixed', inset: '12% max(16px, calc((100vw - 520px)/2))', zIndex: '10000', padding: '24px', borderRadius: '20px', background: '#151b28', color: '#fff', font: '16px system-ui', overflow: 'auto', boxShadow: '0 12px 80px #000b' });
    panel.innerHTML = `<h2>Roblox no seu dispositivo</h2>
      <p>Celular com VR Box: Roblox não oferece suporte oficial a VR. Abrir o aplicativo usa o modo normal.</p>
      <p>Este site não consegue inserir sua câmera, mãos ou duas câmeras VR no aplicativo Roblox.</p>
      <p>Para Roblox VR, use um headset compatível, como Meta Quest, ou a configuração de PC indicada pelo Roblox.</p>
      <p><a href="https://www.roblox.com/" target="_blank" rel="noopener noreferrer" style="color:#8bc4ff">Abrir Roblox · modo normal no celular</a></p>
      <p><a href="https://en.help.roblox.com/hc/en-us/articles/208260046-Setting-up-VR-for-Roblox" target="_blank" rel="noopener noreferrer" style="color:#8bc4ff">Ver dispositivos e configuração VR oficiais</a></p>
      <button type="button">Voltar ao BlueNav</button>`;
    panel.querySelector('button').onclick = () => { panel.hidden = true; };
    document.body.appendChild(panel);
  };
  return { show, dispose() { panel?.remove(); panel = null; } };
}
