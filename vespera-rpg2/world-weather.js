'use strict';
window.WorldWeather=(()=>{
  let trackWorld=null,lastTrackTime=-1;const tracks=[],positions=new Map(),mod=(x,n)=>((x%n)+n)%n;
  function animal(g,a,x,y,t){
    // Wild horses reuse the mount sprite: a riderless horse grazing or fleeing.
    if(a.kind==='horse'&&window.WorldMotion){const last=horseSeen.get(a.id);const dir=last!==undefined&&a.x<last?1:2;horseSeen.set(a.id,a.x);if(horseSeen.size>200)horseSeen.delete(horseSeen.keys().next().value);const art=window.GameAssets?.get('creature-horse',{state:a.moving?'moving':'idle',seed:a.phase});if(art){const h=42,wd=Math.round(h*art.width/art.height);g.save();g.translate(Math.round(x),Math.round(y+6));if(dir===1)g.scale(-1,1);g.drawImage(art,Math.round(-wd/2),-h,wd,h);g.restore();return;}window.WorldMotion.mount(g,x,y+6,t,!!a.moving,dir,t===0);return;}
    window.WorldFauna.draw(g,a,x,y,t);}
  const horseSeen=new Map();
  function floor(g,w,p,ox,oy,options){if(trackWorld!==w.seed||w.time<lastTrackTime){tracks.length=0;positions.clear();trackWorld=w.seed;}lastTrackTime=w.time;for(const id of positions.keys())if(!w.players[id])positions.delete(id);if(window.Vespera.dungeonAt(p.x,p.y))return;const quality=options.quality||'medium',t=w.time,V=window.Vespera,reduce=options.reducedMotion;for(const q of Object.values(w.players)){const old=positions.get(q.id),biome=V.biomeAt(q.x,q.y);if(old&&Math.hypot(old.x-q.x,old.y-q.y)>.48){if([2,3,4,7].includes(biome))tracks.push({x:q.x,y:q.y,t,dir:q.dir});positions.set(q.id,{x:q.x,y:q.y});}else if(!old)positions.set(q.id,{x:q.x,y:q.y});}while(tracks.length>(quality==='low'?24:100)||tracks.length&&t-tracks[0].t>12)tracks.shift();for(const a of tracks){g.globalAlpha=Math.max(0,.35*(1-(t-a.t)/12));g.fillStyle='#3f4148';g.fillRect(Math.round(a.x*32+ox)-3,Math.round(a.y*32+oy),2,3);g.fillRect(Math.round(a.x*32+ox)+3,Math.round(a.y*32+oy)+3,2,3);}g.globalAlpha=1;}

  // Rain: a wet tint, two layers of slanted streaks anchored to the ground (they drift with the camera),
  // splashes that ring out on the floor, a fade in/out when the weather turns, and lightning in storms.
  function rainAmount(w,biome){const at=dt=>{const k=WorldLife.climate({...w,time:Math.max(0,w.time+dt)},biome).kind;return k==='storm'?1.35:k==='rain'?1:0;};
    const now=at(0);if(!now)return 0;const slot=mod(w.time,100),before=at(-slot-.5),after=at(100-slot+.5);let k=now;if(before<now)k*=Math.min(1,slot/9);if(after<now)k*=Math.min(1,(100-slot)/9);return Math.max(.08,k);}
  function rain(g,w,c,ox,oy,width,height,t,quality,still){const V=window.Vespera,amount=rainAmount(w,c.biome??0),storm=c.kind==='storm';
    const k=Math.min(1.35,amount),base=quality==='low'||quality==='leve'?70:quality==='ultra'?280:160,n=Math.round(base*k),slant=.22+(c.wind||0)*.06+(storm?.18:0);
    g.fillStyle=`rgba(28,40,62,${(storm?.2:.11)*Math.min(1,k)})`;g.fillRect(0,0,width,height);
    const layers=[{share:.55,len:8,speed:430,par:.6,col:'rgba(160,196,220,.30)',lw:1},{share:.45,len:15,speed:720,par:1,col:'rgba(214,234,246,.55)',lw:1.2}];
    for(const [L,a] of layers.entries()){const m=Math.round(n*a.share),H=height+a.len*2,W=width+60;g.strokeStyle=a.col;g.lineWidth=a.lw;g.beginPath();
      for(let i=0;i<m;i++){const sp=a.speed*(.85+V.hash(i,L+3,w.seed)*.3),y=mod(V.hash(i,72+L,w.seed)*H+(still?0:t*sp)+oy*a.par,H)-a.len,x=mod(V.hash(i,91+L,w.seed)*W+(still?0:t*sp*slant)+ox*a.par,W)-30;
        g.moveTo(Math.round(x),Math.round(y));g.lineTo(Math.round(x-a.len*slant),Math.round(y-a.len));}
      g.stroke();}
    if(!still){const splashes=Math.round(n*.3);g.lineWidth=1;for(let i=0;i<splashes;i++){const rate=2.4,ph=t*rate+V.hash(i,5,w.seed),cycle=Math.floor(ph),f=ph-cycle,x=mod(V.hash(i,cycle,11)*width+ox,width),y=mod(V.hash(cycle,i,13)*height+oy,height);
        if(f<.28){g.fillStyle=`rgba(220,238,248,${.7-f*2})`;const u=f*14;g.fillRect(Math.round(x-2-u*.4),Math.round(y-u),1,1);g.fillRect(Math.round(x+2+u*.4),Math.round(y-u),1,1);g.fillRect(Math.round(x),Math.round(y-u*1.3),1,1);}
        else{g.strokeStyle=`rgba(200,226,240,${.45*(1-f)})`;g.beginPath();g.ellipse(Math.round(x),Math.round(y),1+f*6,.5+f*2.2,0,0,Math.PI*2);g.stroke();}}}
    if(storm&&!still){const slot=Math.floor(t/9),at=V.hash(slot,3,w.seed)*7,dt=t-slot*9-at;if(dt>=0&&dt<.35){const flash=dt<.08||dt>.16&&dt<.22;if(flash){g.fillStyle='rgba(225,236,255,.35)';g.fillRect(0,0,width,height);}
      if(dt<.22){let x=width*(.15+V.hash(slot,9,w.seed)*.7),y=0;g.strokeStyle='rgba(245,248,255,.95)';g.lineWidth=2;g.beginPath();g.moveTo(x,y);for(let s2=0;s2<9;s2++){x+=(V.hash(slot,s2,17)-.5)*44;y+=height*.05+V.hash(s2,slot,19)*height*.03;g.lineTo(Math.round(x),Math.round(y));}g.stroke();g.strokeStyle='rgba(160,190,255,.35)';g.lineWidth=6;g.stroke();}}}
  }
  function draw(g,w,p,ox,oy,width,height,options){const V=window.Vespera;if(V.dungeonAt(p.x,p.y))return;const biome=V.biomeAt(p.x,p.y),c={...WorldLife.climate(w,biome),biome},t=options.reducedMotion?0:w.time,quality=options.quality||'medium',count=quality==='low'?28:quality==='ultra'?150:70;
    g.save();if(options.effects!==false){if(c.kind==='fog'){for(let i=0;i<6;i++){g.fillStyle='#b6c9cc0a';g.fillRect(mod(i*width/4+t*4,width+120)-120,i*height/6,width*.8,45);}}
      if(c.kind==='rain'||c.kind==='storm')rain(g,w,c,ox,oy,width,height,t,quality,options.reducedMotion);
      else if(['snow','sand'].includes(c.kind)){g.fillStyle=c.kind==='snow'?'#e7edf0b0':c.kind==='sand'?'#d8bd8190':'#afd4e579';for(let i=0;i<count;i++){const x=mod(V.hash(i,91,w.seed)*width+t*(c.kind==='sand'?35:8+c.wind*5),width),y=mod(V.hash(i,72,w.seed)*height+t*(c.kind==='snow'?12:90),height);g.fillRect(Math.round(x),Math.round(y),c.kind==='sand'?4:c.kind==='snow'?2:1,c.kind==='rain'||c.kind==='storm'?6:2);}}
      if(c.event==='Chuva de meteoros'&&c.night&&!options.reducedMotion){g.fillStyle='#fce8b9';const k=mod(t,9);if(k<1.5)for(let i=0;i<12;i++)g.fillRect(Math.round(width*.2+k*90-i*3),Math.round(height*.1+k*25-i),2,1);}
    }
    const darkness=c.night?.40:c.hour<7||c.hour>18?.15:0;
    if(darkness){g.fillStyle=c.event==='Lua de sangue'?'rgba(66,13,32,.32)':`rgba(12,22,47,${darkness})`;g.fillRect(0,0,width,height);g.globalCompositeOperation='screen';const lamps=[[126,125],[130,128],[126,132],[132,132],...V.kingdoms.flatMap(k=>[[k.x-3,k.y+1],[k.x+3,k.y+1]])];for(const [x,y]of lamps){const sx=x*32+ox,sy=y*32+oy-25;if(sx< -80||sy< -80||sx>width+80||sy>height+80)continue;const gr=g.createRadialGradient(sx,sy,1,sx,sy,quality==='low'?48:72);gr.addColorStop(0,'#f5b35280');gr.addColorStop(1,'#f5b35200');g.fillStyle=gr;g.fillRect(sx-72,sy-72,144,144);}g.globalCompositeOperation='source-over';}
    if(c.event==='Eclipse'&&c.hour>10&&c.hour<14){g.fillStyle='#17223955';g.fillRect(0,0,width,height);}g.restore();
  }
  function possessions(g,w,p,ox,oy,t){const P=(x,y,ww,hh,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),ww,hh);};for(const q of Object.values(w.players)){if(window.Vespera.dungeonAt(q.x,q.y)!==window.Vespera.dungeonAt(p.x,p.y))continue;const s=q.progress;if(!s)continue;const x=q.x*32+ox,y=q.y*32+oy;if(s.home)for(const d of s.decor||[]){const xx=(s.home.x-3+d.slot%4*1.5)*32+ox,yy=(s.home.y+1+Math.floor(d.slot/4))*32+oy;if(d.id==='lantern'){P(xx,yy-22,3,25,'#5c5143');P(xx-3,yy-25,9,7,'#eed58c');}else if(d.id==='bench'){P(xx-10,yy-10,23,4,'#a98256');P(xx-8,yy-6,3,7,'#76583e');P(xx+8,yy-6,3,7,'#76583e');}else if(d.id==='fence'){P(xx-9,yy-14,3,16,'#b59767');P(xx+9,yy-14,3,16,'#b59767');P(xx-8,yy-9,20,3,'#997d58');}else {P(xx-7,yy-4,17,5,'#71563f');P(xx-3,yy-13+Math.sin(t*8)*2,7,10,'#df9150');P(xx,yy-10,3,6,'#ffe5a1');}}}
    for(const k of window.Vespera.kingdoms){const choice=w.realmChanges?.[k.id];if(!choice)continue;for(let i=0;i<5;i++){const x=(k.x-3+i*1.5)*32+ox,y=(k.y+6)*32+oy;if(choice==='gardens'){P(x,y-7,2,8,'#476b4c');P(x-2,y-10,6,5,i%2?'#dfadba':'#eed082');}else{P(x,y-26,2,28,'#8a6b43');P(x+2,y-25,12,13,k.roof);P(x+6,y-23,3,8,'#e9ce89');}}}

  }
  return {rainAmount,draw,floor,animal,possessions};
})();
