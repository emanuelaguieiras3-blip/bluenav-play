'use strict';
// The System window (Solo Leveling style): hunter rank, attributes, daily training and guild ranking.
// Plain HTML inside the game's modal; it refreshes only while open, so it costs nothing when closed.
window.SystemUI=(()=>{
  const G=()=>window.GameSession,V=()=>window.Vespera,P=()=>window.WorldProgress;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Icon indexes in assets/ui-icons (8 per row, 64 px cells).
  const ICON={plus:0,close:1,crystal:2,check:4,lock:5,strength:16,agility:17,vitality:18,spirit:19,perception:20,fatigue:21,gold:22,xp:23,quest:24,warn:25,skull:26,trophy:27,guild:28,sword:29,crown:30,gift:31};
  const BADGE={F:32,E:32,D:33,C:34,B:35,A:36,S:37};
  const pos=i=>`--x:${i%8};--y:${Math.floor(i/8)}`;
  const ico=(i,cls='')=>`<i class="sys-ico ${cls}" style="${pos(i)}" aria-hidden="true"></i>`;
  let timer=0,lastHtml='';
  function bar(label,v,max,color){const pct=Math.max(0,Math.min(100,v/Math.max(1,max)*100));return `<div class="sys-bar"><span>${label}</span><b style="--pct:${pct}%;--c:${color}"></b><em>${Math.round(v)} / ${Math.round(max)}</em></div>`;}
  function html(){
    const g=G(),q=g?.player,w=g?.world,v=V(),pr=P();if(!q||!w||!v)return '<p>Entre no jogo para abrir o Sistema.</p>';
    const st=v.stats(q),pts=v.attributePoints(q),rank=q.isekai?.rank||'F',sys=pr.systemState(w,q),goals=pr.systemProgress(w,q),done=goals.every(x=>x.have>=x.need);
    const title=q.isekai?.title?(v.isekai?.titleById?.[q.isekai.title]?.name||''):'',cls=v.classById[q.classId];
    const need=q.level*55,penalty=q.buffs?.penalty>w.time,rk=pr.ranking(w,g.player.id);
    return `<div class="sys">
      <section class="sys-head"><div class="sys-badge" style="${pos(BADGE[rank]??32)}"><b>${rank}</b></div><div><p class="sys-name">${esc(v.fullName(q))}</p><small>${esc(cls.name)} · Nível ${q.level}${title?' · '+esc(title):''}</small><small>Caçador rank ${rank} · posição ${rk.mine?.pos??'—'} na guilda</small></div></section>
      ${bar('VIDA',q.hp,st.hp,'#e0555a')}${bar('MANA',q.mana,st.mana,'#4aa8ff')}${bar('EXP',q.xp,need,'#ffd35a')}
      ${penalty?`<p class="sys-warn">${ico(ICON.skull)} [PENALIDADE] Velocidade reduzida por mais ${Math.ceil(q.buffs.penalty-w.time)} s.</p>`:''}
      <h3>${ico(ICON.crystal)} Atributos · <span class="sys-pts">${pts} ${pts===1?'ponto':'pontos'}</span></h3>
      <div class="sys-attrs">${Object.entries(v.attributeDefs).map(([id,a])=>{const n=q.attributes?.[id]||0,off=pts<1||n>=20;return `<div class="sys-attr">${ico(ICON[id]??ICON.crystal)}<span><b>${a.short||a.name} · ${n}</b><small>${esc(a.desc)}</small></span><button class="sys-plus" data-attribute="${id}" ${off?'disabled':''} aria-label="Aumentar ${esc(a.name)}">${ico(ICON.plus)}</button></div>`;}).join('')}</div>
      <p class="sys-stats">ATQ ${st.atk} · DEF ${Math.round(st.def)} · VEL ${st.speed.toFixed(2)} · CRIT ${(st.crit*100).toFixed(1)}% · ALC ${st.range.toFixed(2)}</p>
      <h3>${ico(ICON.quest)} Treino diário${sys.streak?` · sequência ${sys.streak}`:''}</h3>
      <div class="sys-goals">${goals.map(x=>`<div class="sys-goal ${x.have>=x.need?'ok':''}">${ico(x.have>=x.need?ICON.check:ICON.sword)}<span>${esc(x.name)}</span><b>${x.have} / ${x.need}</b></div>`).join('')}</div>
      <button class="sys-claim" data-system-claim ${done&&!sys.claimed?'':'disabled'}>${ico(ICON.gift)}${sys.claimed?'Recompensa recebida hoje':done?'Receber recompensa':'Conclua o treino para receber'}</button>
      <small class="sys-note">Recompensa: +1 ponto de atributo e experiência. Se o dia virar sem concluir, a velocidade cai por 60 s — nada é perdido.</small>
      <h3>${ico(ICON.crown)} Ranking da guilda</h3>
      <ol class="sys-rank">${rk.top.map(e=>`<li class="${e.me?'me':''}"><span class="sys-badge sm" style="${pos(BADGE[e.rank]??32)}"><b>${e.rank}</b></span><span>${esc(e.name)}${e.player&&!e.me?' · jogador':''}</span><b>Nv ${e.level}</b></li>`).join('')}</ol>
      ${rk.mine&&rk.mine.pos>10?`<p class="sys-note">Você está na posição ${rk.mine.pos}.</p>`:''}
    </div>`;
  }
  function render(){const body=document.getElementById('modal-body');if(!body||document.getElementById('modal')?.dataset.panel!=='system'){stop();return;}const h=html();if(h!==lastHtml){const y=body.scrollTop;body.innerHTML=h;body.scrollTop=y;lastHtml=h;}}
  function stop(){clearInterval(timer);timer=0;}
  function open(){const g=G();if(!g?.modal)return;lastHtml=html();g.modal('system','Sistema',lastHtml,false);stop();timer=setInterval(render,400);}
  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-system-claim]');if(b&&!b.disabled){G()?.command('systemClaim');setTimeout(render,120);}
    if(e.target.closest?.('#system-button,[data-system-open]')){e.preventDefault();open();}});
  return {open,render};
})();
