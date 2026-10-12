(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ValeMeta=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const starters=['guardiao','arqueiro','mago','clerigo'],ranks=['Aprendiz','Escudeiro','Cavaleiro','Guardião','Lorde','Coroa','Lenda do Vale'];
  function fresh(){return {version:1,coins:0,xp:0,stars:0,login:0,lastLogin:null,heroes:[...starters],mastery:{},history:[],claimed:[],days:{},skins:[],season:0};}
  function migrate(m){return m?.version===1?{...fresh(),...m}:fresh();}
  function day(now){return new Date(now).toISOString().slice(0,10);}
  function login(m,now){const d=day(now);if(m.lastLogin===d)return false;m.lastLogin=d;m.login++;m.coins+=20+(m.login%7===0?80:0);return true;}
  function reward(m,result,now){if(m.claimed.includes(result.id))return false;m.claimed.push(result.id);m.claimed=m.claimed.slice(-100);const d=day(now),s=m.days[d]||={played:0,wins:0,damage:0,claimed:[]},first=result.win&&s.wins===0;s.played++;s.wins+=result.win?1:0;s.damage+=result.damage||0;m.coins+=35+(result.win?25:0)+(first?40:0);m.xp+=100+(result.win?50:0);m.stars=Math.max(0,m.stars+(result.win?1:result.score>=8?0:-1));m.mastery[result.hero]=(m.mastery[result.hero]||0)+50+(result.win?25:0);m.history.unshift({...result,at:now});m.history=m.history.slice(0,20);for(const key of Object.keys(m.days))if(new Date(d)-new Date(key)>8*86400000)delete m.days[key];return true;}
  function missions(m,now){const d=day(now),s=m.days[d]||{played:0,wins:0,damage:0,claimed:[]};return [{id:'play',name:'Conclua duas partidas',value:s.played,max:2},{id:'win',name:'Vença uma partida',value:s.wins,max:1},{id:'damage',name:'Cause 3.000 de dano',value:s.damage,max:3000}].map(q=>({...q,claimed:s.claimed.includes(q.id)}));}
  function claim(m,id,now){const mission=missions(m,now).find(q=>q.id===id);if(!mission||mission.claimed||mission.value<mission.max)return false;m.days[day(now)].claimed.push(id);m.coins+=60;m.xp+=80;return true;}
  function unlock(m,id){if(m.heroes.includes(id)||m.coins<200)return false;m.coins-=200;m.heroes.push(id);return true;}
  const rank=m=>ranks[Math.min(6,Math.floor(m.stars/5))],pass=m=>Math.min(50,1+Math.floor(m.xp/300));
  return {fresh,migrate,login,reward,missions,claim,unlock,rank,pass};
});
