'use strict';
// Character look editor (creation screen and the wardrobe in Options). It only edits a draft;
// the caller decides when to apply it. Pieces are the same paper-doll parts the villagers use.
window.WorldCustomizer = (() => {
  const V = window.Vespera, colors = new Set(['skin', 'hairColor', 'main', 'accent']);
  const labels = { body: 'Corpo', skin: 'Tom de pele', hair: 'Cabelo', hairColor: 'Cor do cabelo', beard: 'Barba', outfit: 'Roupa', main: 'Cor principal', accent: 'Detalhes', hat: 'Chapéu', cape: 'Capa' };
  const names = { woman: 'Feminino', man: 'Masculino', short: 'Curto', long: 'Longo', bun: 'Coque', ponytail: 'Rabo de cavalo', braids: 'Tranças', curly: 'Cacheado', bald: 'Raspado', spiky: 'Espetado', none: 'Nenhum', mustache: 'Bigode', goatee: 'Cavanhaque', full: 'Cheia', tunic: 'Túnica', coat: 'Casaco', robe: 'Manto', dress: 'Vestido', armor: 'Armadura', noble: 'Traje de corte', hood: 'Capuz', cap: 'Gorro', bandana: 'Bandana', straw: 'Palha', feather: 'Com pluma', wizard: 'De mago', helmet: 'Elmo' };
  const skinNames = ['Claro', 'Dourado', 'Médio', 'Bronze', 'Escuro', 'Profundo'];
  let current = null, raf = 0;
  function mount(root, initial, classId, appearance, onChange) {
    const original = V.normalizeLook(initial || {}, classId, appearance);
    const s = { root, look: { ...original }, classId, onChange, dir: 0, walking: true };
    current = s;
    const opts = V.appearanceOptions;
    root.innerHTML = `<div class="tailor-stage"><canvas width="160" height="190" aria-label="Prévia animada do personagem"></canvas>
      <div class="tailor-facing" role="group" aria-label="Girar a prévia"><button type="button" data-facing="1" aria-label="Esquerda">←</button><button type="button" data-facing="0" aria-pressed="true">Frente</button><button type="button" data-facing="3">Costas</button><button type="button" data-facing="2" aria-label="Direita">→</button></div>
      <button type="button" class="tailor-motion" aria-pressed="true">Parar caminhada</button></div>
      <div class="tailor-options">${['body', 'hair', 'outfit', 'beard', 'hat', 'skin', 'hairColor', 'main', 'accent', 'cape'].map(key => {
        const values = opts[key];
        if (colors.has(key)) return `<fieldset class="tailor-colors"><legend>${labels[key]}</legend><div>${values.map((v, i) => `<button type="button" class="color-swatch" data-look="${key}" data-value="${v}" style="--swatch:${v}" title="${key === 'skin' ? skinNames[i] : labels[key] + ' ' + (i + 1)}" aria-label="${labels[key]} ${key === 'skin' ? skinNames[i] : i + 1}" aria-pressed="${s.look[key] === v}"></button>`).join('')}</div></fieldset>`;
        if (key === 'cape') return `<label class="tailor-check"><input type="checkbox" data-look="cape" ${s.look.cape ? 'checked' : ''}> Usar capa</label>`;
        return `<label class="tailor-field">${labels[key]}<select data-look="${key}">${values.map(v => `<option value="${v}" ${s.look[key] === v ? 'selected' : ''}>${names[v] || v}</option>`).join('')}</select></label>`;
      }).join('')}<div class="tailor-tools"><button type="button" data-tailor="random">⚄ Sortear</button><button type="button" data-tailor="reset">Restaurar</button></div></div>`;
    const emit = () => onChange?.({ ...s.look });
    const sync = () => { root.querySelectorAll('[data-look]').forEach(el => { const v = s.look[el.dataset.look]; if (el.tagName === 'SELECT') el.value = v; else if (el.type === 'checkbox') el.checked = v; else el.setAttribute('aria-pressed', String(v === el.dataset.value)); }); emit(); };
    root.onchange = e => { const key = e.target.dataset.look; if (!key) return; s.look[key] = key === 'cape' ? e.target.checked : e.target.value; emit(); };
    root.onclick = e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.look) { s.look[b.dataset.look] = b.dataset.value; sync(); }
      if (b.dataset.facing !== undefined) { s.dir = Number(b.dataset.facing); root.querySelectorAll('[data-facing]').forEach(el => el.setAttribute('aria-pressed', String(el === b))); }
      if (b.classList.contains('tailor-motion')) { s.walking = !s.walking; b.setAttribute('aria-pressed', String(s.walking)); b.textContent = s.walking ? 'Parar caminhada' : 'Testar caminhada'; }
      if (b.dataset.tailor === 'random') { for (const [k, vals] of Object.entries(opts)) s.look[k] = vals[Math.floor(Math.random() * vals.length)]; if (s.look.body === 'woman') s.look.beard = 'none'; sync(); }
      if (b.dataset.tailor === 'reset') { s.look = { ...original }; sync(); }
    };
    cancelAnimationFrame(raf); const loop = now => { if (current !== s || !root.isConnected) return; draw(s, now); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
    emit();
    return { get look() { return { ...s.look }; } };
  }
  // Animated preview, 2x, using exactly the sprite the world will draw.
  function draw(s, now) {
    const reduced = !!window.Experience?.settings?.reducedMotion, frame = s.walking && !reduced ? 1 + Math.floor(now / 120) % 6 : 0;
    const art = window.WorldArt.sprite(s.classId, s.dir, frame, s.look.body === 'man' ? 'male' : 'female', s.look, !reduced && now % 4300 < 140);
    const c = s.root.querySelector('canvas'); if (!c || !art) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
    const k = 2.4, w = art.width * k, h = art.height * k, bob = !frame && !reduced && Math.sin(now / 550) > .5 ? 1 : 0;
    g.fillStyle = '#15202355'; g.beginPath(); g.ellipse(80, 176, 30, 6, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(art, Math.round(80 - w / 2), Math.round(176 + 4 * k - h + bob), Math.round(w), Math.round(h));
  }
  function stop() { current = null; cancelAnimationFrame(raf); }
  return { mount, stop };
})();
