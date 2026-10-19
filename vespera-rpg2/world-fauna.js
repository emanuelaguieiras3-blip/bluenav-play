'use strict';
// Small pixel sprites are built once per species/action/frame and reused at native resolution.
window.WorldFauna=(()=>{
  const cache=new Map(),kinds=['cat','dog','chicken','sheep','deer','rabbit','fox','frog'];
  function sprite(kind,frame,moving){
    if(!kinds.includes(kind))kind='cat';frame=((frame%4)+4)%4;
    const key=kind+':'+frame+':'+!!moving;if(cache.has(key))return cache.get(key);
    const c=document.createElement('canvas');c.width=48;c.height=42;const g=c.getContext('2d');
    const P=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),w,h);};
    const E=(cx,cy,rx,ry,color)=>{for(let y=-ry;y<=ry;y++){const half=Math.floor(rx*Math.sqrt(Math.max(0,1-y*y/(ry*ry))));P(cx-half,cy+y,half*2+1,1,color);}};
    const O='#302d32',light='#f0d7ac',step=moving?[0,2,0,-2][frame]:0,bob=moving&&frame%2?-1:0;
    const blink=!moving&&frame===3,head=!moving&&frame===2?2:0;
    g.translate(0,bob);
    const eye=(x,y)=>{P(x,y,2,blink?1:2,O);if(!blink)P(x,y,1,1,'#f9e9ba');};
    const leg=(x,y,len,color,phase)=>{P(x+phase,y,3,len,O);P(x+phase,y,2,len-2,color);P(x+phase-1,y+len-1,4,2,O);};
    if(kind==='chicken'){
      leg(21,29,7,'#c99855',step);leg(28,29,7,'#c99855',-step);
      P(11,20,7,8,O);P(10,17,5,8,'#74534b');P(13,18,7,7,'#f0d9aa');
      E(24,24,11,8,O);E(24,23,10,7,'#dbc99f');E(22,22,7,5,'#f5e6c2');
      P(18,22,9,5,'#b8aa88');P(18,21,8,3,'#eee0b7');P(21,24,5,1,'#9b927b');
      E(32,17+head,5,7,O);E(32,16+head,4,6,'#f4e5c3');P(29,8+head,3,4,'#b54b48');P(33,7+head,3,5,'#d65f50');
      P(36,17+head,5,2,'#dcaa56');P(33,23+head,3,4,'#bd5449');eye(33,15+head);
    }else if(kind==='frog'){
      const hop=moving&&frame%2?3:0;g.translate(0,-hop);
      E(17,31,7,4,O);E(31,31,7,4,O);E(17,30,6,3,'#72965b');E(31,30,6,3,'#72965b');
      E(24,26,10,9,O);E(24,25,9,8,'#759d64');E(24,29,6,4,'#c3c58a');
      E(19,20,4,4,O);E(29,20,4,4,O);E(19,19,3,3,'#9dbb72');E(29,19,3,3,'#9dbb72');eye(19,19);eye(29,19);
      P(21,26,7,1,'#4f694d');P(15-step,33,7,2,'#acc081');P(28+step,33,7,2,'#acc081');P(19,25,2,2,'#556e50');
    }else if(kind==='rabbit'){
      E(21,27,10,8,O);E(21,26,9,7,'#b7b1a0');E(19,25,6,4,'#d9d0b6');E(11,28,4,4,'#e3d9c0');
      E(32,22+head,6,7,O);E(32,21+head,5,6,'#c6beaa');
      P(28,5+head,4,15,O);P(29,5+head,2,14,'#c7bfa9');P(29,8+head,1,9,'#bc9790');
      P(34,7+head,4,13,O);P(35,7+head,2,12,'#d8cdb5');P(35,10+head,1,7,'#bc9790');
      leg(16,30,5,'#aca795',step);leg(30,29,6,'#d2c7ae',-step);eye(34,20+head);P(37,24+head,2,1,'#c59b91');
    }else{
      const palette={cat:['#b97f53','#dfb176','#916045'],dog:['#9d754e','#ccac76','#745942'],sheep:['#ddd4b9','#f3e8cb','#aba58f'],deer:['#a77951','#c79b67','#79553f'],fox:['#bc6844','#e69b58','#7d4939']}[kind];
      const [main,hi,shade]=palette,deer=kind==='deer',sheep=kind==='sheep',cat=kind==='cat',base=deer?24:28,len=deer?11:7;
      leg(16,base,len,shade,step);leg(28,base,len,shade,-step);leg(12,base,len,main,-step);leg(32,base,len,main,step);
      if(kind==='fox'){E(9,25-step,8,4,O);E(9,24-step,7,3,main);P(2,22-step,5,4,'#e5d7b3');}
      else if(cat){P(6,21,3,10,O);P(5,16-step,3,8,O);P(6,17-step,1,11,hi);P(7,27,7,3,main);}
      else if(kind==='dog'){P(7,23-step,8,4,O);P(5,20-step,5,4,main);}
      E(23,base-4,14,8,O);E(23,base-5,13,7,main);E(20,base-7,9,4,hi);P(15,base,16,3,shade);
      if(sheep){for(const [xx,yy]of [[12,18],[18,16],[25,16],[31,18],[12,24],[19,24],[26,25]]){E(xx,yy,4,4,'#b9b49e');E(xx,yy-1,4,3,hi);}P(33,18,5,11,'#6e6257');}
      const hy=(deer?10:sheep?18:19)+head;
      if(deer){P(30,14,6,13,shade);P(31,13,4,13,main);P(33,11,3,11,hi);}
      E(35,hy+2,7,6,O);E(35,hy+1,6,5,sheep?'#867768':main);P(37,hy+3,7,3,sheep?'#aca08a':hi);P(42,hy+3,2,2,O);
      if(deer){P(31,2,2,9,'#e0c18f');P(28,4,4,2,'#c1a276');P(29,1,1,4,'#c1a276');P(36,1,2,9,'#c1a276');P(37,3,4,2,'#dfc297');P(40,1,1,3,'#dfc297');}
      else if(kind==='dog'){P(30,hy-4,5,12,O);P(31,hy-3,3,10,shade);}
      else if(!sheep){P(30,hy-7,4,8,O);P(31,hy-5,2,5,hi);P(37,hy-6,4,7,O);P(38,hy-4,2,4,hi);}
      else {P(28,hy-1,5,3,'#716458');P(39,hy-1,5,3,'#716458');}
      eye(37,hy);if(cat){P(40,hy+5,5,1,'#d2c3a1');P(28,hy+5,5,1,'#d2c3a1');P(19,base-10,2,5,shade);P(24,base-10,2,4,shade);}
      if(deer)for(let i=0;i<4;i++)P(14+i*4,base-7+(i%2)*2,2,2,'#ebd0a0');
    }
    cache.set(key,c);return c;
  }
  function draw(g,a,x,y,time,reduced=false){
    const moving=!!a.moving,phase=Number(a.phase)||0,frame=reduced?0:Math.floor(time*(moving?8:1.2)+phase)%4;
    const art=sprite(a.kind,frame,moving);g.save();g.translate(Math.round(x),Math.round(y));g.scale(a.dir===-1?-1:1,1);
    g.fillStyle='#17302d44';g.fillRect(-12,0,25,3);g.imageSmoothingEnabled=false;g.drawImage(art,-24,-35);g.restore();
  }
  return {sprite,draw,kinds};
})();
