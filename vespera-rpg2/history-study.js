(() => {
  'use strict';
  const key = 'vespera-history-v1';
  const missions = [
    {title:'Ficção e fontes',scene:'As três coroas e o vale são parte da narrativa do jogo.',summary:'Ficção pode motivar perguntas, mas uma afirmação sobre o passado precisa ser confrontada com fontes.',topics:['Narrativa','Fonte','Evidência'],question:'Qual atitude permite investigar uma afirmação histórica?',answers:['Comparar documentos, objetos e relatos da época','Aceitar uma cena do RPG como prova','Repetir uma opinião sem fonte'],hints:['Separe aventura de investigação.','Procure vestígios que outras pessoas possam examinar.','Compare diferentes tipos de fonte.']},
    {title:'Poder e posição social',scene:'O sobrenome no jogo diferencia casas nobres e famílias plebeias.',summary:'Parentesco, terra e poder influenciaram posições sociais em várias sociedades, de maneiras diferentes conforme época e lugar.',topics:['Poder','Parentesco','Contexto'],question:'Como comparar as famílias de Véspera com sociedades reais?',answers:['Escolher um tempo e lugar e consultar fontes','Supor que todas as sociedades seguiram as regras do jogo','Tratar as famílias inventadas como pessoas reais'],hints:['Regras de fantasia não são universais.','Pergunte onde e quando uma prática ocorreu.','Contexto e fontes vêm antes da comparação.']},
    {title:'Trabalho e tecnologia',scene:'O vale tem minas, forja e contratos da guilda.',summary:'Ferramentas, técnicas e organização do trabalho mudam no tempo. Vestígios materiais e registros ajudam a estudá-los.',topics:['Produção','Técnica','Vestígios'],question:'O que ajuda a estudar uma oficina de outra época?',answers:['Ferramentas, registros e vestígios materiais','Somente o botão de fabricar do RPG','Apenas uma fantasia sobre o passado'],hints:['Pense no que uma oficina pode deixar.','Objetos e registros contam partes diferentes da história.','Busque mais de um tipo de evidência.']},
  ];
  let completed=new Set();
  try { const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))completed=new Set(saved.filter(n=>Number.isInteger(n)&&n>=0&&n<missions.length)); } catch (_) {}
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const top=document.querySelector('.top-actions'),home=document.querySelector('.home-card');
  if(!top||!home)return;
  const topButton=document.createElement('button');topButton.id='vh-open-top';topButton.type='button';topButton.textContent='HISTÓRIA';topButton.setAttribute('aria-label','Abrir modo História');top.insertBefore(topButton,document.getElementById('system-button'));
  const homeButton=document.createElement('button');homeButton.id='vh-open-home';homeButton.type='button';homeButton.className='button secondary';homeButton.textContent='Aprender História no vale →';home.insertBefore(homeButton,document.getElementById('help-home'));
  const overlay=document.createElement('div');overlay.id='vh-overlay';overlay.hidden=true;
  overlay.innerHTML='<section class="vh-panel" role="dialog" aria-modal="true" aria-labelledby="vh-title"><header><div><small>CADERNO DO VIAJANTE · MODO HISTÓRIA</small><h2 id="vh-title">Investigue o vale</h2></div><button type="button" id="vh-close" aria-label="Fechar modo História">×</button></header><p>O mundo de Véspera é fantasia. Explore o cenário, depois compare o que viu com conhecimentos baseados em fontes históricas.</p><p id="vh-progress" role="status"></p><div class="vh-nav"><button id="vh-prev" type="button">← Anterior</button><span id="vh-position">1 / 3</span><button id="vh-next" type="button">Próxima →</button></div><div id="vh-slides" class="vh-slides"></div></section>';
  document.body.append(overlay);
  const slides=overlay.querySelector('#vh-slides');
  slides.innerHTML=missions.map((mission,index)=>{
    const answers=mission.answers.map((answer,n)=>({answer,n}));
    const shift=(index+1)%answers.length;
    const ordered=answers.slice(shift).concat(answers.slice(0,shift));
    return `<article class="vh-mission" data-mission="${index}"><small>INVESTIGAÇÃO ${index+1}</small><h3>${esc(mission.title)}</h3><span class="vh-done" ${completed.has(index)?'':'hidden'}>Concluída ✓</span><p><strong>No jogo:</strong> ${esc(mission.scene)}</p><p><strong>Resumo:</strong> ${esc(mission.summary)}</p><ul>${mission.topics.map(topic=>`<li>${esc(topic)}</li>`).join('')}</ul><h4>Desafio</h4><p>${esc(mission.question)}</p><div class="vh-answers">${ordered.map(({answer,n})=>`<button type="button" data-answer="${n}">${esc(answer)}</button>`).join('')}</div><div class="vh-hints">${['Difícil','Média','Fácil'].map((label,n)=>`<button type="button" data-hint="${n}">Dica ${label}</button>`).join('')}</div><p class="vh-feedback" role="status" aria-live="polite"></p></article>`;
  }).join('');
  let current=0;
  function notifyParent(){
    if(window.parent===window)return;
    try { const origin=new URL(document.referrer).origin; if(origin==='https://bluenav-web-system.vercel.app'||/^http:\/\/localhost:\d+$/.test(origin)) window.parent.postMessage({vesperaHistory:true,type:'progress',completed:[...completed]},origin); } catch (_) {}
  }
  function update(){
    overlay.querySelector('#vh-progress').textContent=`${completed.size} de ${missions.length} investigações concluídas neste navegador`;
    overlay.querySelector('#vh-position').textContent=`${current+1} / ${missions.length}`;
    overlay.querySelector('#vh-prev').disabled=current===0;overlay.querySelector('#vh-next').disabled=current===missions.length-1;
    slides.querySelectorAll('.vh-mission').forEach((mission,index)=>{
      mission.classList.toggle('vh-active',index===current);
    });
  }
  function open(){overlay.hidden=false;update();overlay.querySelector('#vh-close').focus();}
  function close(){overlay.hidden=true;topButton.focus();}
  topButton.addEventListener('click',open);homeButton.addEventListener('click',open);
  overlay.querySelector('#vh-close').addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  overlay.querySelector('#vh-prev').addEventListener('click',()=>{current=Math.max(0,current-1);update();});
  overlay.querySelector('#vh-next').addEventListener('click',()=>{current=Math.min(missions.length-1,current+1);update();});
  window.addEventListener('keydown',event=>{if(overlay.hidden)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}event.stopImmediatePropagation();},{capture:true});
  slides.addEventListener('click',event=>{
    const card=event.target.closest('[data-mission]');if(!card)return;
    const index=Number(card.dataset.mission),hint=event.target.closest('[data-hint]'),answer=event.target.closest('[data-answer]');
    if(hint){card.querySelector('.vh-feedback').textContent=`Dica ${['difícil','média','fácil'][Number(hint.dataset.hint)]}: ${missions[index].hints[Number(hint.dataset.hint)]}`;return;}
    if(answer){const correct=Number(answer.dataset.answer)===0;card.querySelector('.vh-feedback').textContent=correct?'Correto. Continue a aventura e procure novas perguntas.':'Tente outra opção. Uma cena de fantasia não serve como fonte histórica.';if(correct){completed.add(index);card.querySelector('.vh-done').hidden=false;card.querySelectorAll('[data-answer]').forEach(button=>button.disabled=true);try{localStorage.setItem(key,JSON.stringify([...completed]));}catch(_){}update();notifyParent();}}
  });
  update();notifyParent();
})();
