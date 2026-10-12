(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorldMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const directions=[[0,1],[-1,0],[1,0],[0,-1]];
  const durations={chop:.65,mine:.65,harvest:1,cook:1.5,brew:1.5,craft:1.5,fish:4,reel:.65,sleep:2,read:3,parry:.3,cast:.48};
  function pose(q,time,reduced=false){
    const a=q.activity,kind=a&&a.until>time?a.kind:null;
    const duration=durations[kind]||1,start=Number.isFinite(a?.start)?a.start:(a?.until||0)-duration;
    const phase=kind?Math.max(0,Math.min(1,(time-start)/Math.max(.01,(a.until-start)))):0;
    const beat=reduced?0:Math.sin(phase*Math.PI*4),dir=directions[q.dir]||directions[0];
    const attackAge=time-(q.attackAt??-99),swing=!reduced&&attackAge>=0&&attackAge<.48?Math.sin(attackAge/.48*Math.PI):0;
    let x=dir[0]*swing*4,y=dir[1]*swing*2,angle=dir[0]*swing*.06;
    if(!reduced){
      if(['chop','mine','craft'].includes(kind)){angle+=beat*.055;y+=Math.max(0,beat)*2;}
      if(kind==='harvest'){y+=Math.sin(phase*Math.PI)*5;angle+=Math.sin(phase*Math.PI)*.12;}
      if(kind==='cook'||kind==='brew')angle+=beat*.025;
      if(kind==='cast')y-=Math.sin(phase*Math.PI)*2;
    }
    if(kind==='sleep'){angle=-Math.PI/2;y-=8;x+=30;}
    return {kind,phase,beat,x,y,angle};
  }
  function wind(time,x=0,y=0,strength=1,reduced=false){return reduced?0:Math.round((Math.sin(time*1.4+x*.17+y*.09)+Math.sin(time*.47+x*.03)*.4)*Math.min(2,Math.max(0,strength)));}
  function tracker(){
    const states=new Map();
    return {
      sample(q,time){
        let s=states.get(q.id);
        if(!s){s={x:q.x,y:q.y,time,phase:0,frame:0,dir:0};if(states.size>=256)states.delete(states.keys().next().value);states.set(q.id,s);return s;}
        if(time===s.time)return s;
        const dx=q.x-s.x,dy=q.y-s.y,d=Math.hypot(dx,dy);
        if(time<s.time||d>3){s.phase=0;s.frame=0;}
        else if(d>.001){s.phase=(s.phase+d*2.8)%6;s.frame=1+Math.floor(s.phase);s.dir=Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?0:3;}
        else s.frame=0;
        Object.assign(s,{x:q.x,y:q.y,time});return s;
      },
      retain(ids){const live=new Set(ids);for(const id of states.keys())if(!live.has(id))states.delete(id);},
      clear(){states.clear();},get size(){return states.size;}
    };
  }
  // Painted mounts (assets/anim-v1.png, saddled row); the procedural horse below is the fallback.
  const mountHeight={horse:44,patrasche:46,qilin:48,fenrir:52};
  function paintedMount(kind){return typeof window!=='undefined'&&window.GameAssets?.get?.('mount-'+kind,{state:'idle'})?kind:null;}
  function riderOffset(kind='horse'){return paintedMount(kind)?3-Math.round(mountHeight[kind]*.34):-11;}
  function mount(g,x,y,time,moving,dir,reduced,kind='horse'){
    if(paintedMount(kind)){const art=window.GameAssets.get('mount-'+kind,{state:moving&&!reduced?'moving':'idle'}),h=mountHeight[kind],w=Math.round(h*art.width/art.height);
      g.save();g.translate(Math.round(x),Math.round(y+8));if(dir===1)g.scale(-1,1);g.drawImage(art,Math.round(-w/2),-h,w,h);g.restore();return;}
    const step=moving&&!reduced?Math.round(Math.sin(time*12)*3):0;
    g.save();g.translate(Math.round(x),Math.round(y));g.scale(dir===1?-1:1,1);
    const P=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
    P(-16,-13,30,13,'#42352f');P(-15,-14,29,11,'#916648');P(-12,-13,20,3,'#bb8754');
    P(-13,-2,4,9+step,'#624c3c');P(-7,-2,3,9-step,'#886045');P(6,-2,4,9-step,'#624c3c');P(11,-2,3,9+step,'#886045');
    P(10,-24,7,20,'#916648');P(12,-28,11,10,'#a97a50');P(12,-32,3,5,'#634737');P(19,-25,2,2,'#241f28');
    P(10,-25,3,15,'#44362f');P(-20,-12,6,3,'#44362f');P(-21,-10+step,3,10,'#44362f');
    P(-6,-16,15,5,'#493c3b');P(-5,-16,13,2,'#cfa369');P(20,-21,4,2,'#dbbb88');g.restore();
  }
  function drawAction(g,q,x,y,time,reduced=false){
    const a=pose(q,time,reduced),kind=a.kind;if(!kind)return;
    const P=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h);};
    g.save();g.translate(Math.round(x),Math.round(y));
    const facing=q.dir===1&&kind!=='sleep'?-1:1;g.scale(facing,1);
    const hand=12,lift=a.beat*5;
    if(['chop','mine','craft'].includes(kind)){
      g.translate(hand,-22);g.rotate(reduced?-.3:-.8+a.beat*.8);
      P(-1,-17,3,25,'#563e30');P(0,-16,1,23,'#bb9561');
      if(kind==='chop'){P(1,-17,9,9,'#a9bdc5');P(8,-16,2,7,'#eceddb');}
      else if(kind==='mine'){P(-8,-17,18,3,'#9caeb4');P(-10,-14,3,5,'#dce6dd');}
      else {P(-6,-18,13,7,'#a7b6b9');P(-6,-18,13,2,'#dfddc1');}
    }else if(kind==='harvest'){
      P(hand,-17+lift,4,10,'#dec096');P(hand-3,-5+lift,2,6,'#729555');P(hand-5,-7+lift,7,3,'#e6c56f');
    }else if(kind==='cook'||kind==='brew'){
      P(8,-11,17,9,kind==='brew'?'#666f83':'#48414a');P(7,-13,19,3,'#acb4b4');P(10,-12,13,2,kind==='brew'?'#87d5b9':'#cda568');
      P(16+a.beat*4,-25,2,15,'#c2a56f');P(15+a.beat*4,-17,4,3,'#80664e');
      for(let i=0;i<3;i++)P(12+i*4,-18-((a.phase*18+i*5)%15),2,2,'#d3e1d899');
    }else if(kind==='fish'||kind==='reel'){
      const target=q.activity,dx=Number.isFinite(target.x)?(target.x-q.x)*32*facing:47,dy=Number.isFinite(target.y)?(target.y-q.y)*32:12;
      const bite=q.progress?.fishing&&time>=q.progress.fishing.bite,bob=reduced?0:Math.sin(time*(bite?18:4))*(bite?3:1);
      g.strokeStyle='#bfa376';g.lineWidth=2;g.beginPath();g.moveTo(9,-18);g.lineTo(23,-40+(kind==='reel'?a.phase*13:0));g.stroke();
      g.strokeStyle='#dae6d6aa';g.lineWidth=1;g.beginPath();g.moveTo(23,-40);g.quadraticCurveTo(dx,dy-20,dx,dy+bob);g.stroke();
      P(dx-2,dy-3+bob,4,2,'#f0dfb2');P(dx-2,dy-1+bob,4,3,bite?'#f79060':'#d15c56');
      if(bite){g.strokeStyle='#f3deb4';g.beginPath();g.ellipse(dx,dy+3,6,2,0,0,Math.PI*2);g.stroke();}
    }else if(kind==='sleep'){
      P(-5,-13,32,11,'#6d87a0');P(-5,-13,32,2,'#b0c8cc');g.fillStyle='#dce1cd';g.font='8px monospace';g.fillText('z',0,-25-(reduced?0:a.phase*5));
    }else if(kind==='read'){
      P(8,-26,15,11,'#664151');P(9,-25,6,8,'#eee0b6');P(16,-25,6,8,'#d6c69d');P(15,-25,1,8,'#967c60');P(10,-23,4,1,'#a19476');P(17,-21,4,1,'#a19476');
    }else if(kind==='parry'){
      g.strokeStyle='#f9eac0';g.lineWidth=3;g.beginPath();g.arc(0,-15,20,-1.4,1.4);g.stroke();
    }else if(kind==='cast'){
      g.strokeStyle='#b7e4e5';g.lineWidth=1;g.beginPath();g.ellipse(0,0,reduced?15:10+a.phase*12,5,0,0,Math.PI*2);g.stroke();
    }
    g.restore();
  }
  // ---------- Class weapons: a held pixel weapon per class, animated on attack ----------
  const weaponOf={arqueiro:'bow',guerreiro:'sword',paladino:'holy',berserker:'axe',guardiao:'shield',ladino:'daggers',monarca:'daggers',mago:'staff',clerigo:'staff',druida:'staff',necromante:'staff',bardo:'lute',artifice:'hammer'};
  const orb={mago:'#b58cff',clerigo:'#ffe38a',druida:'#8fe07a',necromante:'#7dffb0'};
  function weapon(g,q,x,y,time,reduced=false){
    const kind=weaponOf[q.classId];if(!kind)return;
    // Painted weapon sheet (assets/wpn-v1.png): row 1 held poses, rows 2–3 attack (facing right), row 4 skill.
    const painted=typeof window!=='undefined'&&window.GameAssets?.frame?.('wpn-'+q.classId,0);
    if(painted){const dir=q.dir??0,age=time-(q.attackAt??-99),skillAge=time-((q.cooldowns?.skill??-99)-8);
      let i,mirror=false;
      if(!reduced&&skillAge>=0&&skillAge<.8){i=12+Math.min(3,Math.floor(skillAge/.2));mirror=dir===1;}
      else if(!reduced&&age>=0&&age<.48){i=4+Math.min(7,Math.floor(age/.48*8));mirror=dir===1;}
      else{i=dir===3?2:dir===0?0:1;mirror=dir===2;}
      const art=window.GameAssets.frame('wpn-'+q.classId,i),size=44,bob=reduced?0:Math.round(Math.sin(time*2.2+(q.x||0)));
      const hx=dir===1?-9:dir===3?-9:9;g.save();g.translate(Math.round(x+hx),Math.round(y-17+bob));if(mirror)g.scale(-1,1);g.drawImage(art,-size/2,-size/2,size,size);g.restore();return;}
    const age=time-(q.attackAt??-99),t=!reduced&&age>=0&&age<.48?age/.48:-1,dir=q.dir??0;
    const idle=reduced?0:Math.round(Math.sin(time*2.2+(q.x||0))*1);
    const P=(px,py,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(px),Math.round(py),w,h);};
    g.save();g.translate(Math.round(x),Math.round(y));if(dir===1)g.scale(-1,1);
    g.translate(dir===3?-9:dir===0?10:9,-17+idle);
    const swing=(from,to)=>{if(t>=0)g.rotate(from+(to-from)*Math.sin(Math.min(1,t*1.25)*Math.PI/2));else g.rotate(from*.35);};
    if(kind==='bow'){
      const pull=t<0?0:t<.55?t/.55*7:Math.max(0,7-(t-.55)*40);
      P(-1,-13,2,3,'#5a3a22');P(0,-15,2,2,'#8a5a32');P(1,-11,2,22,'#7a4a26');P(2,-10,1,20,'#b07a42');P(0,9,2,3,'#5a3a22');P(0,11,2,2,'#8a5a32');
      g.strokeStyle='#efe6c8';g.lineWidth=1;g.beginPath();g.moveTo(1.5,-14);g.lineTo(1.5-pull,0);g.lineTo(1.5,12);g.stroke();
      if(t>=0&&t<.55){P(1-pull,-1,14,1,'#c8a06a');P(13-pull,-2,3,3,'#dfe6ea');P(-1-pull,-2,2,3,'#e6f0d8');}
    }else if(kind==='sword'||kind==='holy'){
      swing(-1.9,1.3);const blade=kind==='holy'?'#fff0b0':'#dfe6ea',edge=kind==='holy'?'#e8c14a':'#9aa6b2';
      P(-1,-2,3,5,'#5a3a22');P(-4,-4,9,2,edge);P(-1,-19,3,16,blade);P(1,-19,1,16,edge);P(0,-21,1,2,blade);
      if(kind==='holy'&&t>=0){g.globalAlpha=.5;P(-3,-22,7,20,'#fff6c0');g.globalAlpha=1;}
    }else if(kind==='axe'){
      swing(-2.2,1.5);P(-1,-18,3,22,'#6a4028');P(1,-18,1,22,'#8a5a36');P(-7,-20,6,9,'#aab4bc');P(3,-20,6,9,'#aab4bc');P(-7,-20,2,9,'#dfe6ea');P(7,-20,2,9,'#dfe6ea');P(-1,-21,3,3,'#c83a2a');
    }else if(kind==='shield'){
      const push=t<0?0:Math.sin(t*Math.PI)*6;g.translate(push,0);
      P(-5,-8,11,15,'#3a4a6a');P(-4,-7,9,13,'#5a78a8');P(-1,-7,3,13,'#e8c14a');P(-4,-2,9,3,'#e8c14a');P(-5,6,11,2,'#2a3450');
    }else if(kind==='daggers'){
      const stab=t<0?0:Math.sin(t*Math.PI*2)*6,stab2=t<0?0:Math.sin(t*Math.PI*2+Math.PI)*6;
      g.save();g.translate(stab,0);g.rotate(1.3);P(-1,-1,2,4,'#3a2a3a');P(-1,-9,2,8,'#dfe6ea');P(0,-9,1,8,'#9aa6b2');g.restore();
      g.save();g.translate(-14+stab2,3);g.rotate(1.3);P(-1,-1,2,4,'#3a2a3a');P(-1,-8,2,7,'#dfe6ea');g.restore();
    }else if(kind==='staff'){
      const lift=t<0?0:Math.sin(t*Math.PI)*6,glow=orb[q.classId]||'#b58cff';g.translate(0,-lift);
      const wood=q.classId==='necromante'?'#3a3440':q.classId==='druida'?'#6a5030':'#7a5a3a';
      P(0,-20,2,30,wood);P(1,-20,1,30,'#a07a52');
      if(q.classId==='necromante'){P(-2,-26,6,5,'#e8e2d0');P(-1,-24,1,1,'#1a1a1a');P(2,-24,1,1,'#1a1a1a');}
      else if(q.classId==='druida'){P(-3,-23,3,3,'#5aa04a');P(2,-24,3,3,'#6cc05a');}
      const pulse=reduced?1:.7+Math.sin(time*5)*.3;g.globalAlpha=(t>=0?1:.55)*pulse;P(-2,-26+(q.classId==='necromante'?-3:0),6,6,glow);g.globalAlpha=1;P(0,-24+(q.classId==='necromante'?-3:0),2,2,'#ffffff');
      if(t>=0){g.globalAlpha=1-t;g.strokeStyle=glow;g.beginPath();g.arc(1,-23,4+t*10,0,Math.PI*2);g.stroke();g.globalAlpha=1;}
    }else if(kind==='lute'){
      const strum=t<0?0:Math.sin(t*Math.PI*4)*2;g.translate(-6,4);
      P(-2,-4,9,8,'#a8683a');P(-1,-3,7,6,'#c8884a');P(2,-1,2,2,'#4a2a1a');P(6,-12,2,10,'#6a4028');P(5,-14,4,3,'#4a2a1a');P(3+strum,0,2,2,'#f2c9a4');
      if(t>=0){g.globalAlpha=1-t;P(10,-10-t*14,2,4,'#ffe38a');P(11,-12-t*14,3,1,'#ffe38a');P(14,-5-t*10,2,3,'#ffe38a');g.globalAlpha=1;}
    }else if(kind==='hammer'){
      swing(-1.8,1.2);P(-1,-14,2,17,'#6a4028');P(-4,-19,9,6,'#8a94a0');P(-4,-19,9,2,'#c8d0d8');P(3,-18,2,4,'#e8c14a');
    }
    g.restore();
  }
  return {pose,wind,mount,riderOffset,drawAction,durations,tracker,weapon};
});
