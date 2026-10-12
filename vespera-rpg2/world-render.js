'use strict';
window.WorldArt = (() => {
  const V=window.Vespera, cache=new Map(),tileCache=new Map();
  const canvas=document.getElementById('world');let ctx=canvas.getContext('2d',{alpha:false});
  let camera={x:128.5*32,y:129*32},zoom=2,seed=0,originX=0,reducedMotion=false;const creatureStates=new Map();
  const displayPositions=new Map(),motionStates=new Map(),groundTextures=new Map(),pigeons=new Map();
  const groundChunks=new Map();let chunkBudget=1,chunkQuality='medium';
  document.addEventListener('game-art-ready',()=>groundChunks.clear());
  function staticGround(t){return !t.deep&&!t.underground&&!t.lawn&&!t.cobble&&!['water','citywall'].includes(t.kind)&&(chunkQuality==='low'||V.biomes[t.biome].surface!=='forest');}
  function cachedGround(t,x,y,wx,wy,time,here){if(!staticGround(t)){ground(t,x,y,wx,wy,time);return;}const cx=Math.floor(wx/8),cy=Math.floor(wy/8),key=cx+','+cy+':'+(here?.id||'surface')+':'+chunkQuality;let c=groundChunks.get(key);if(!c&&chunkBudget>0){chunkBudget--;c=surface(256,256);const target=ctx;try{ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const gx=cx*8+xx,gy=cy*8+yy,a=tile(gx,gy,{seed});if(V.dungeonAt(gx,gy)===here&&staticGround(a))ground(a,xx*32,yy*32,gx,gy,0);}}finally{ctx=target;}if(groundChunks.size>=(chunkQuality==='low'?24:48))groundChunks.delete(groundChunks.keys().next().value);groundChunks.set(key,c);}if(c)ctx.drawImage(c,(wx-cx*8)*32,(wy-cy*8)*32,32,32,x,y,32,32);else ground(t,x,y,wx,wy,time);}
  function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
  // Solid-colour ellipses come from a small stamp cache: one drawImage instead of a path fill each frame.
  const ellStamps=new Map();
  function ellipse(c,x,y,rx,ry,color){rx=Math.max(1,Math.round(rx));ry=Math.max(1,Math.round(ry));if(color[0]!=='#'||rx>64||ry>64){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();return;}
    const k=color+rx+'_'+ry;let s=ellStamps.get(k);if(!s){if(ellStamps.size>600)ellStamps.clear();s=surface(rx*2,ry*2);const g=s.getContext('2d');g.fillStyle=color;g.beginPath();g.ellipse(rx,ry,rx,ry,0,0,Math.PI*2);g.fill();ellStamps.set(k,s);}c.drawImage(s,Math.round(x-rx),Math.round(y-ry));}
  function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function darken(color,amount){const n=parseInt(color.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+amount)).toString(16).padStart(2,'0')).join('');}
  document.addEventListener('game-art-ready',()=>{cache.clear();if(typeof clearChunks==='function')clearChunks();});
  function walkFrame(q,time){
    let state=motionStates.get(q.id);if(!state){state={x:q.x,y:q.y,phase:0,time};motionStates.set(q.id,state);return 0;}
    const distance=Math.hypot(q.x-state.x,q.y-state.y);if(time<state.time||distance>3)state.phase=0;
    const moving=!q.dead&&time>=state.time&&distance>.0008&&distance<3;
    if(moving)state.phase=(state.phase+distance*2.8)%6;
    state.x=q.x;state.y=q.y;state.time=time;return moving?1+Math.floor(state.phase):0;
  }
  // Custom look: the villagers' paper doll, re-framed like the painted hero (centred, feet 4px above the bottom).
  function customSprite(look,dir,frame,blink){const P=window.WorldPeople;if(!P)return null;const key='look|'+JSON.stringify(look)+'|'+dir+'|'+frame+'|'+(blink?1:0);if(cache.has(key))return cache.get(key);
    const art=P.sprite(look,dir,frame,blink,frame?'walk':'idle'),foot=art.foot??P.size.foot,center=art.center??art.width/2,half=Math.ceil(Math.max(center,art.width-center)),out=surface(half*2,Math.ceil(foot)+4);
    out.getContext('2d').drawImage(art,Math.round(half-center),0);if(cache.size>600)cache.delete(cache.keys().next().value);cache.set(key,out);return out;}
  function classMarks(g,id,dir,frame){
    const shine=frame<0&&(-frame-1)%4===2,back=dir===3;
    switch(id){
      case 'guardiao':rect(g,10,19,5,5,'#435875');rect(g,11,19,3,2,'#b9d5df');rect(g,32,19,5,5,'#435875');rect(g,33,19,3,2,'#b9d5df');rect(g,22,5,4,5,'#d8ecf1');break;
      case 'guerreiro':rect(g,14,20,4,4,'#bdc8c5');rect(g,31,21,4,4,'#bdc8c5');rect(g,22,27,3,3,shine?'#ffe18b':'#c69b55');break;
      case 'arqueiro':rect(g,34,14,5,17,'#5c4430');for(let i=0;i<3;i++){rect(g,35+i,8+i%2*2,1,12,'#d8c591');rect(g,34+i,9+i%2*2,3,2,'#728d5d');}break;
      case 'mago':rect(g,17,5,14,3,'#6c3151');rect(g,20,3,8,3,'#9d4861');rect(g,23,2,3,2,shine?'#fff1b1':'#dcb96a');break;
      case 'ladino':rect(g,15,4,18,5,'#33344b');rect(g,13,8,4,12,'#34344c');rect(g,31,8,4,12,'#34344c');rect(g,18,7,12,2,'#777198');break;
      case 'clerigo':rect(g,22,1,4,9,'#f7e2a0');rect(g,19,4,10,3,'#f7e2a0');rect(g,23,2,2,6,'#fff8da');break;
      case 'druida':rect(g,14,11,6,3,'#5d9a53');rect(g,16,8,3,5,'#9bc777');rect(g,28,6,4,6,'#4d8050');rect(g,31,8,3,3,shine?'#d9f6a4':'#aaca75');break;
      case 'berserker':rect(g,10,18,8,5,'#b6a292');rect(g,30,18,8,5,'#b6a292');rect(g,12,16,3,3,'#dfc5a3');rect(g,33,16,3,3,'#dfc5a3');break;
      case 'paladino':rect(g,15,18,4,5,'#f0db9b');rect(g,30,18,4,5,'#f0db9b');rect(g,22,5,4,5,'#fff5ce');rect(g,23,6,2,4,'#d6a658');break;
      case 'necromante':rect(g,15,4,18,5,'#30243f');rect(g,13,8,4,10,'#30243f');rect(g,31,8,4,10,'#30243f');rect(g,22,4,4,3,shine?'#c291e5':'#765292');break;
      case 'bardo':rect(g,13,6,22,3,'#603448');rect(g,17,3,15,4,'#8f4560');rect(g,33,0,3,9,'#f0d7a0');rect(g,35,0,2,5,'#fff3cb');break;
      case 'artifice':rect(g,15,8,7,5,'#b88945');rect(g,26,8,7,5,'#b88945');rect(g,17,9,4,3,'#a9d6da');rect(g,27,9,4,3,'#a9d6da');rect(g,22,10,4,2,'#634e37');break;
    }
    if(back&&['mago','necromante','ladino'].includes(id))rect(g,20,18,8,2,'#c8aa70');
  }
  function sprite(classId,dir=0,frame=0,appearance=null,look=null,blink=false){
    if(look){const c=customSprite(look,dir,frame,blink);if(c)return c;}
    if(classId==='monarca'&&window.GameAssets?.get('walk-monarca-0-0'))return window.GameAssets.get(frame>0?`walk-monarca-${dir}-${Math.round((frame-1)*8/6)%8}`:`idle-monarca-${dir}`);
    const idlePose=frame<0?(-frame-1)%4:null;
    const walking=appearance&&(frame>0?window.GameAssets?.get(`walk-${appearance}-${dir}-${frame-1}`):idlePose!==null?window.GameAssets?.get(`idle-${appearance}-${dir}-${idlePose}`):window.GameAssets?.get(`idle-${appearance}-${dir}`));if(walking){const key=`clothed-${classId}-${appearance}-${dir}-${frame}`;if(cache.has(key))return cache.get(key);const out=surface(walking.width,walking.height),g=out.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(walking,0,0);const px=g.getImageData(0,0,out.width,out.height),d=px.data,col=V.classById[classId]?.color||'#ac7755',rgb=[1,3,5].map(i=>parseInt(col.slice(i,i+2),16));for(let y=Math.floor(out.height*.32);y<out.height*.8;y++)for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4;if(d[i+3]&&d[i]>d[i+1]*1.35&&d[i+1]>d[i+2]*1.12&&d[i]<180){const l=Math.max(.23,d[i]/165);for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(rgb[k]*l));}}g.putImageData(px,0,0);classMarks(g,classId,dir,frame);cache.set(key,out);return out;}
    const art=appearance&&window.GameAssets?.get(`hero-${appearance==='male'?1:0}-${dir}`);
    if(art){
      const key=`hero-${appearance}-${dir}-${frame}`;if(cache.has(key))return cache.get(key);
      const out=surface(48,64),g=out.getContext('2d');g.imageSmoothingEnabled=false;
      const scale=Math.min(46/art.width,61/art.height),w=art.width*scale,h=art.height*scale;
      g.drawImage(art,(48-w)/2,63-h-(frame===1?1:0),w,h);cache.set(key,out);return out;
    }
    const key=`p-${classId}-${dir}-${frame}`;if(cache.has(key))return cache.get(key);
    const c=surface(32,44),g=c.getContext('2d'),cls=V.classById[classId]||V.classes[0],color=cls.color,shade=darken(color,-33),skin='#edc79c',hair=['#645341','#453d3a','#855e40'][V.classes.indexOf(cls)%3];
    const step=frame>0?Math.round(Math.sin((frame-1)/6*Math.PI*2)*3):0;
    rect(g,9,31,6,8+step,'#35413b');rect(g,18,31,6,8-step,'#35413b');rect(g,8,38+step,8,3,'#3d3d33');rect(g,18,38-step,8,3,'#3d3d33');
    rect(g,7,19,19,16,'#334238');rect(g,8,20,17,14,shade);rect(g,10,19,13,12,color);rect(g,12,21,4,9,darken(color,20));rect(g,8,31,17,3,'#726047');rect(g,15,31,4,3,'#d6ba70');
    rect(g,5,21,4,12,shade);rect(g,25,21,3,11,shade);rect(g,5,31,4,4,skin);rect(g,25,30,3,4,skin);
    rect(g,9,6,15,15,'#3f4033');rect(g,10,7,13,14,skin);rect(g,9,6,15,7,hair);rect(g,8,9,3,7,hair);rect(g,22,9,3,5,hair);rect(g,11,5,11,3,hair);
    if(dir!==3){rect(g,dir===1?10:13,14,2,2,'#353e39');if(dir!==1)rect(g,20,14,2,2,'#353e39');rect(g,15,19,4,1,'#c79377');}else rect(g,10,12,13,8,hair);
    if(['mago','necromante','clerigo'].includes(classId)){poly(g,[[5,11],[13,0],[18,0],[27,12]],shade);rect(g,4,10,23,3,color);rect(g,13,5,4,3,darken(color,40));rect(g,27,14,2,27,'#8c7150');rect(g,25,12,6,6,classId==='clerigo'?'#efdc97':'#b0d6db');}
    if(['ladino','druida','arqueiro'].includes(classId)){rect(g,8,6,17,5,shade);rect(g,8,7,3,13,shade);rect(g,23,7,3,13,shade);rect(g,11,4,12,4,color);if(classId==='arqueiro'){rect(g,22,1,2,7,'#d3bb80');poly(g,[[27,17],[31,24],[29,35],[27,35],[29,24]],'#b39468');}}
    if(['guardiao','paladino','guerreiro'].includes(classId)){rect(g,9,5,15,6,'#9baaaa');rect(g,8,8,18,3,'#c5ccc1');rect(g,15,3,4,7,color);rect(g,4,23,7,13,'#3e4841');rect(g,5,24,5,10,color);rect(g,7,25,1,8,'#ddc482');rect(g,26,19,2,15,'#d4ded1');rect(g,24,31,6,2,'#b79b60');}
    if(classId==='berserker'){rect(g,8,8,4,4,'#caa67a');rect(g,21,8,4,4,'#caa67a');rect(g,26,18,2,22,'#8e7351');rect(g,25,17,7,7,'#a8b3ad');}
    if(classId==='bardo'){rect(g,7,7,19,3,color);rect(g,11,3,12,5,color);rect(g,21,0,2,7,'#e7cc84');ellipse(g,27,28,4,6,'#b79556');rect(g,26,15,2,14,'#b79556');}
    if(classId==='artifice'){rect(g,9,6,16,5,'#bd965b');rect(g,9,11,16,3,'#655646');rect(g,10,11,5,3,'#aed2ce');rect(g,19,11,5,3,'#aed2ce');rect(g,12,25,11,10,'#9c774e');}
    if(classId==='mago'){
      poly(g,[[7,19],[24,19],[29,36],[20,39],[16,31],[10,39],[4,35]],'#6e2636');
      rect(g,9,20,5,15,'#b64040');rect(g,20,20,5,15,'#992f39');rect(g,14,21,6,13,'#ded1ad');
      rect(g,9,6,15,5,'#822b3d');rect(g,8,10,4,16,'#b34143');rect(g,21,9,4,12,'#692638');rect(g,11,5,9,3,'#cd5847');
      rect(g,26,17,5,7,'#f58e39');rect(g,27,19,3,4,'#fff0ad');rect(g,28,14,2,4,'#d85037');
    }
    if(classId==='necromante'){
      poly(g,[[8,16],[24,16],[29,38],[20,36],[16,41],[5,38]],'#302c43');
      rect(g,10,20,4,14,'#484159');rect(g,13,7,10,11,'#ddcf99');rect(g,14,10,3,4,'#302c43');rect(g,20,10,3,4,'#302c43');rect(g,17,15,3,2,'#71614c');
      poly(g,[[10,10],[6,5],[8,0],[8,5],[13,7]],'#51435e');poly(g,[[22,7],[27,1],[27,7],[24,12]],'#51435e');
      rect(g,8,19,17,2,'#af8953');rect(g,26,27,5,8,'#b88949');rect(g,27,28,3,5,'#ffe19b');
    }
    cache.set(key,c);return c;
  }
  function portrait(target,classId,appearance=null,look=null){if(!target)return;const c=target.getContext('2d');c.clearRect(0,0,target.width,target.height);const classArt=target.dataset.person&&!look?window.GameAssets?.get('portrait-'+classId):null;if(classArt){const size=Math.min(target.width,target.height);c.imageSmoothingEnabled=false;c.drawImage(classArt,Math.round((target.width-size)/2),target.height-size,size,size);return;}c.imageSmoothingEnabled=false;const s=sprite(classId,0,0,appearance,look);const scale=Math.min(target.width/s.width,target.height/s.height);c.drawImage(s,(target.width-s.width*scale)/2,(target.height-s.height*scale)/2,s.width*scale,s.height*scale);}
  // Item icons from the town atlas; weapons get their material colour on the metal (bright grey pixels).
  const ICON_ART={potion:'potionRed',mana:'potionBlue',elixir:'potionGreen',tonic:'potionGreen',soup:'stew',stone:'stones',campfire:'campfire',lantern:'lantern',bench:'bench',fiber:'rope2',espada:'sword',arco:'bow',cajado:'staff',lanca:'trident'},iconArt=new Map();
  function artIcon(target,id,item){const name=ICON_ART[id.split('-')[0]]||ICON_ART[id];if(!name||!window.GameAssets?.get('town-'+name))return false;
    const size=target.width,key=id+'|'+size;let c=iconArt.get(key);
    if(!c){const src=window.GameAssets.get('town-'+name),k=Math.min(size*.86/src.width,size*.86/src.height),w=Math.max(1,Math.round(src.width*k)),h=Math.max(1,Math.round(src.height*k)),f=window.GameAssets.fit('town-'+name,w,h);
      c=surface(size,size);const g=c.getContext('2d');g.drawImage(f,Math.round((size-w)/2),Math.round((size-h)/2));
      if(item.type==='equipment'&&item.color){const d=g.getImageData(0,0,size,size),px=d.data,n=parseInt(item.color.slice(1),16),tr=n>>16,tg=(n>>8)&255,tb=n&255;
        for(let i=0;i<px.length;i+=4){const r=px[i],gg=px[i+1],b=px[i+2],mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),l=(r+gg+b)/3;if(px[i+3]&&mx-mn<34&&l>70){const t=Math.min(1.35,l/150);px[i]=Math.min(255,tr*t);px[i+1]=Math.min(255,tg*t);px[i+2]=Math.min(255,tb*t);}}
        g.putImageData(d,0,0);}
      iconArt.set(key,c);}
    const g=target.getContext('2d');g.clearRect(0,0,size,target.height);g.drawImage(c,0,Math.round((target.height-size)/2));return true;}
  function icon(target,id){if(!target)return;const g=target.getContext('2d'),item=V.items[id];g.clearRect(0,0,target.width,target.height);if(!item)return;if(artIcon(target,id,item))return;g.save();g.scale(target.width/32,target.height/32);g.imageSmoothingEnabled=false;const c=item.color,edge=darken(c,-55),light=darken(c,35),key=id.split('-')[0];
    if(item.type==='equipment'){
      if(item.slot==='weapon'){
        if(key==='arco'){poly(g,[[11,3],[22,8],[25,16],[21,25],[11,29],[11,26],[19,22],[22,16],[19,10],[11,6]],c);rect(g,11,4,1,23,'#e5dbb3');rect(g,5,15,22,2,'#c1a77c');}
        else if(key==='cajado'){rect(g,14,7,4,23,edge);rect(g,15,8,2,20,c);poly(g,[[16,1],[22,7],[16,13],[10,7]],light);rect(g,14,5,3,4,'#fff0ca');}
        else {g.translate(16,16);g.rotate(.65);rect(g,-2,-13,5,22,edge);rect(g,-1,-13,3,18,c);rect(g,-1,-12,1,14,light);rect(g,-6,6,13,3,'#ad935c');rect(g,-2,9,5,6,'#736047');if(['machado','martelo','foice'].includes(key)){rect(g,-7,-12,15,7,c);rect(g,-7,-12,15,2,light);}}
      }else if(item.slot==='armor'){poly(g,[[8,6],[13,4],[19,4],[24,6],[29,12],[24,17],[23,29],[9,29],[8,17],[3,12]],edge);poly(g,[[9,7],[14,7],[18,7],[23,7],[26,12],[21,15],[21,27],[11,27],[11,15],[6,12]],c);rect(g,14,9,4,16,light);rect(g,9,23,14,3,'#826e48');}
      else if(item.slot==='head'){poly(g,[[5,24],[5,12],[11,5],[21,5],[27,12],[27,24],[21,24],[21,17],[11,17],[11,24]],edge);rect(g,7,12,18,5,c);rect(g,11,7,10,9,c);rect(g,15,6,3,11,light);}
      else if(item.slot==='feet'){for(const x of [4,18]){rect(g,x,7,8,15,edge);rect(g,x+1,8,6,14,c);rect(g,x,21,11,5,c);rect(g,x,26,11,2,edge);rect(g,x,12,8,2,light);}}
      else{g.strokeStyle=edge;g.lineWidth=4;g.beginPath();g.arc(16,18,8,0,Math.PI*2);g.stroke();g.strokeStyle=c;g.lineWidth=2;g.stroke();poly(g,[[16,3],[22,9],[16,15],[10,9]],light);}
    }else if(item.type==='consumable') {rect(g,12,3,8,5,'#a68b5a');rect(g,10,8,12,3,'#dae2d3');rect(g,7,12,18,14,'#6b8277');rect(g,8,13,16,12,c);rect(g,10,11,12,4,c);rect(g,9,25,14,3,edge);rect(g,10,15,3,7,light);}
    else if(id==='wood'||id==='fence'||id==='bench'){rect(g,6,9,21,15,'#705b40');rect(g,5,8,21,13,c);rect(g,8,10,15,2,light);rect(g,6,18,18,2,edge);rect(g,4,10,5,9,'#d2af77');rect(g,5,12,2,5,'#957148');}
    else if(['herb','fiber','seed','wheat'].includes(id)){rect(g,15,12,2,16,'#72915d');poly(g,[[15,20],[5,14],[5,8],[12,10],[16,17]],c);poly(g,[[17,17],[20,5],[28,4],[26,12]],light);poly(g,[[15,13],[10,3],[17,1],[20,9]],c);}
    else if(id==='fish'){ellipse(g,15,16,9,6,c);poly(g,[[22,15],[29,9],[29,24],[22,18]],edge);rect(g,9,14,2,2,'#293c36');rect(g,12,12,9,2,light);}
    else if(id==='campfire'||id==='lantern'){rect(g,5,24,22,4,'#8c6b45');poly(g,[[7,24],[11,12],[14,17],[18,4],[24,23]],c);poly(g,[[12,25],[17,15],[21,24]],'#f8d797');}
    else {poly(g,[[5,23],[3,14],[11,6],[22,5],[29,16],[25,25],[12,28]],edge);poly(g,[[5,14],[12,8],[21,7],[25,16],[20,23],[8,23]],c);poly(g,[[7,14],[12,9],[19,8],[15,16]],light);}
    g.restore();
  }
  // Text is rasterised once per string, font and colour, then stamped: fillText is slow on phones.
  const textStamps=new Map();
  function txt(c,text,x,y){text=String(text);const font=c.font,fill=c.fillStyle;if(typeof fill!=='string'||(c.textBaseline&&c.textBaseline!=='alphabetic')){c.fillText(text,x,y);return;}
    const k=font+'|'+fill+'|'+text;let s=textStamps.get(k);if(!s){if(textStamps.size>400)textStamps.clear();const size=parseFloat((/(\d+(?:\.\d+)?)px/.exec(font)||[0,10])[1]);c.save();c.font=font;const w=Math.ceil(c.measureText(text).width);c.restore();
      s=surface(w+4,Math.ceil(size*1.5)+4);const g=s.getContext('2d');g.font=font;g.fillStyle=fill;g.textBaseline='alphabetic';g.fillText(text,2,Math.ceil(size*1.15)+2);s.base=Math.ceil(size*1.15)+2;s.textW=w;textStamps.set(k,s);}
    const a=c.textAlign,dx=a==='center'?s.textW/2:a==='right'||a==='end'?s.textW:0;c.drawImage(s,Math.round(x-dx-2),Math.round(y-s.base));}
  function tree(b,variant){
    const assetId=b===4?'world-0-1':b===2?'world-1-0':b===6?'world-1-1':b===7?null:'world-0-0';
    const art=b!==3&&assetId&&window.GameAssets?.get(assetId);
    if(art){const key=`atlas-tree-${b}-${variant}`;if(cache.has(key))return cache.get(key);const c=surface(80,104),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(art,0,0,80,104);cache.set(key,c);return c;}
const key=`tree${b}-${variant}`;if(cache.has(key))return cache.get(key);const c=surface(64,87),g=c.getContext('2d'),base=['#507445','#8b8744','#4c7861','#889360','#8cafa2','#436953','#777c43','#3f5849'][b];rect(g,27,58,10,27,'#5b533d');rect(g,29,57,5,26,'#8b7150');rect(g,26,80,14,4,'#776044');
    if(b===3){rect(g,29,18,7,51,'#6b9064');rect(g,15,32,8,22,'#6b9064');rect(g,20,49,13,6,'#6b9064');rect(g,39,22,7,21,'#7c9a69');rect(g,33,39,12,6,'#7c9a69');rect(g,31,20,2,44,'#9eb57b');}
    else if(b===4||b===7){for(let i=0;i<4;i++)poly(g,[[32,3+i*12],[7-i*2,39+i*10],[57+i*2,39+i*10]],i%2?base:darken(base,-15));for(let i=0;i<(b===4?3:0);i++)poly(g,[[32,4+i*12],[18-i*2,27+i*12],[46+i*2,27+i*12]],'#dce4d2');}
    else{const shape=[[22,9,26,16],[10,22,43,19],[4,38,54,22],[13,58,38,9]];shape.forEach(([x,y,w,h])=>rect(g,x,y,w,h,darken(base,-20)));rect(g,19,10,26,15,base);rect(g,11,23,43,19,base);rect(g,5,39,49,17,base);rect(g,16,54,32,9,base);rect(g,18,17,20,5,darken(base,21));rect(g,11,30,15,5,darken(base,15));rect(g,32,26,16,5,darken(base,15));rect(g,10,43,12,4,darken(base,13));rect(g,33,47,16,4,darken(base,-8));for(let i=0;i<14;i++){const x=10+Math.floor(V.hash(i,variant+b)*39),y=22+Math.floor(V.hash(i+8,b+variant)*28);rect(g,x,y,3,2,i%2?darken(base,24):darken(base,-14));}}
    cache.set(key,c);return c;}
  function tile(x,y,w){const key=`${x},${y}`;if(tileCache.has(key))return tileCache.get(key);const t=V.tileAt(x,y,w.seed);if(tileCache.size>=8192)tileCache.delete(tileCache.keys().next().value);tileCache.set(key,t);return t;}
  function texturedGround(t,variant,color){
    const key=`${t.biome}-${t.kind}-${variant}-${color}`;if(groundTextures.has(key))return groundTextures.get(key);
    const out=surface(32,32),g=out.getContext('2d'),b=V.biomes[t.biome];rect(g,0,0,32,32,color);
    const natural=!['path','water','bridge','farm'].includes(t.kind),sand=b.surface==='sand',snow=b.surface==='snow';
    for(let i=0;i<(natural?24:16);i++){
      const x=Math.floor(V.hash(i,variant+8,t.biome+35)*30),y=Math.floor(V.hash(variant,i+4,91)*30),n=V.hash(i+42,variant,t.biome+70);
      if(natural&&!sand&&!snow){
        const shade=darken(color,n>.55?9:-9);rect(g,x,y,2+(i%3),1,shade);if(n>.45){rect(g,x+1,y-2,1,3,shade);rect(g,x+3,y-1,1,2,darken(color,14));}
        if(b.surface==='forest'&&i%4===0){rect(g,x,y,3,2,'#786b4580');rect(g,x+1,y,2,1,'#baa37580');}
      }else {rect(g,x,y,n>.8?3:1,1,darken(color,n>.5?12:-11));if(n>.87)rect(g,x+1,y+1,2,1,darken(color,-16));}
    }
    if(natural&&variant%5===0&&!sand&&!snow){for(let i=0;i<3;i++){const x=8+i*4,y=17-i%2*3;rect(g,x,y,1,5,b.dark);rect(g,x-1,y-1,3,2,variant%2?'#d6c5a0':'#b7be88');rect(g,x,y-1,1,1,'#f0ddae');}}
    if(groundTextures.size>2048)groundTextures.clear();groundTextures.set(key,out);return out;
  }
  function shoreline(t,x,y,wx,wy,time){
    for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
      const other=tile(wx+dx,wy+dy,{seed});if(other.kind==='water'||other.kind==='bridge')continue;
      for(let i=0;i<8;i++){const depth=2+Math.floor(V.hash(wx+i,wy+i,seed)*3),xx=x+(dx<0?0:dx>0?32-depth:i*4),yy=y+(dy<0?0:dy>0?32-depth:i*4);
        rect(ctx,xx,yy,dx?depth:4,dy?depth:4,'#83998a');rect(ctx,xx+(dx<0?depth:dx>0?-1:0),yy+(dy<0?depth:dy>0?-1:0),dx?1:4,dy?1:4,Math.sin(time*2+wx+wy+i*.7)>.3?'#c8e7d8':'#81b9b5');}
    }
    if(t.biome===2&&V.hash(wx,wy,seed)>.7){ellipse(ctx,x+12,y+18,5,2,'#7f9368');rect(ctx,x+12,y+16,2,2,'#d0c198');}
  }
  let activeWorld=null,lights=[],lightCanvas=null,bannerKey='',bannerAt=0,baking=null;
  // ---------- Quality profiles ----------
  // budget: ms per frame spent baking chunks; preload: ring of chunks baked ahead of the camera;
  // animated: which animated ground tiles are redrawn every frame (1 water/lava, 2 +gardens/runes, 3 +forest breeze).
  const QUALITY={leve:{budget:3,maxChunks:48,preload:1,animated:1,particles:.35,sway:false,heavyFx:false},
    medio:{budget:4,maxChunks:72,preload:1,animated:2,particles:1,sway:true,heavyFx:true},
    ultra:{budget:8,maxChunks:140,preload:2,animated:3,particles:1.8,sway:true,heavyFx:true}};
  let quality='medio',Q=QUALITY.medio;
  // ---------- Chunks: the ground is baked once into 8×8-tile canvases (like Minecraft chunk loading) ----------
  // Visible chunks bake first within the frame budget; the rest load around the camera in the background.
  // A chunk that is not ready yet is drawn tile by tile, so the world never shows holes.
  const CHUNK=8,CPX=CHUNK*32,chunks=new Map(),chunkPool=[];let chunkFrame=0,chunkStats={loaded:0,baked:0,pending:0,ms:0};
  function clearChunks(){for(const ch of chunks.values())if(ch.canvas&&chunkPool.length<12)chunkPool.push(ch.canvas);chunks.clear();}
  function setQuality(q){q=QUALITY[q]?q:'medio';window.WorldTown?.setQuality?.(q);if(q!==quality){quality=q;Q=QUALITY[q];clearChunks();}}
  function animLevel(t,x,y,n){
    if(t.deep||t.citadel){if(['water','lava','seal'].includes(t.kind))return 1;if(t.kind!=='wall'&&(t.theme==='magma'||t.citadel&&['mire','ash','bridge','ante','arena'].includes(t.theme)))return 2;return 0;}
    if(t.cobble||t.kind==='citywall'||t.underground)return 0;
    if(t.lawn)return hash2(x,y,21)>.9||!t.decor&&y>=70&&y<=78&&(x<=122||x>=134)&&V.hash(x,y,31)>.72?2:0;
    if(t.kind==='water')return 1;if(['path','bridge','farm'].includes(t.kind))return 0;
    if(V.biomes[t.biome].surface==='forest'&&(n>.38||n<.12||n>.94))return 3;return 0;}
  function hash2(x,y,s){const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return v-Math.floor(v);}
  function hasFeature(t,x,y,w){
    if(t.palace)return !!(t.furn&&window.WorldPalace?.TALL.has(t.furn)&&t.fx===0&&t.fy===0);
    if(t.prop)return t.fx===0&&t.fy===0;
    if(['tree','rock','herb','berry'].includes(t.kind))return true;
    if(t.deep){if(['stal','mushroom','water'].includes(t.kind))return true;if(t.kind==='cavefloor'&&(t.citadel||['hall','tunnel','magma','roost','web'].includes(t.theme)))return true;return false;}
    return t.kind==='grass'&&!t.lawn&&!t.underground&&[0,1,2,5,7].includes(t.biome)&&V.hash(x+73,y,w.seed)>.88;}
  function chunkAt(cx,cy,scope,here,w){const key=scope+':'+cx+','+cy;let ch=chunks.get(key);if(ch)return ch;
    ch={key,cx,cy,canvas:null,lights:[],anim:[],features:[],mask:false,used:0};const x0=cx*CHUNK,y0=cy*CHUNK;
    for(let y=y0;y<y0+CHUNK;y++)for(let x=x0;x<x0+CHUNK;x++){if(V.dungeonAt(x,y)!==here){ch.mask=true;continue;}const t=tile(x,y,w),lv=animLevel(t,x,y,V.hash(x,y,seed));if(lv)ch.anim.push({x,y,t,lv});if(hasFeature(t,x,y,w))ch.features.push({x,y,t,key:x+','+y});}
    chunks.set(key,ch);return ch;}
  function maskTile(x,y,sx,sy,here){rect(ctx,sx,sy,32,32,here?'#07060b':'#3d3b46');if(!here&&V.hash(x,y,5)>.5)rect(ctx,sx+6,sy+8,14,8,'#4b4957');}
  function bakeChunk(ch,here,deadline=Infinity){
    // Built a row at a time and resumed next frame when the budget runs out, so no frame pays for a whole chunk.
    if(!ch.work){ch.work=chunkPool.pop()||surface(CPX,CPX);ch.step=0;ch.workLights=[];}
    const g=ch.work.getContext('2d');g.imageSmoothingEnabled=false;const prev=ctx;ctx=g;baking={lights:ch.workLights};
    try{while(ch.step<CHUNK*CHUNK){const x=ch.step%CHUNK,y=(ch.step/CHUNK)|0;ch.step++;const wx=ch.cx*CHUNK+x,wy=ch.cy*CHUNK+y;if(V.dungeonAt(wx,wy)!==here){maskTile(wx,wy,x*32,y*32,here);continue;}const t=tile(wx,wy,activeWorld),lv=animLevel(t,wx,wy,V.hash(wx,wy,seed));baking.skip=lv>0&&lv<=Q.animated;ground(t,x*32,y*32,wx,wy,0);if(x===CHUNK-1&&performance.now()>deadline)break;}}
    finally{ctx=prev;baking=null;}
    if(ch.step>=CHUNK*CHUNK){ch.canvas=ch.work;ch.lights=ch.workLights;ch.work=null;chunkStats.baked++;}}
  function evictChunks(){if(chunks.size<=Q.maxChunks)return;const old=[...chunks.values()].filter(c=>c.used<chunkFrame).sort((a,b)=>a.used-b.used);
    for(const ch of old){if(chunks.size<=Q.maxChunks)break;chunks.delete(ch.key);if(ch.canvas&&chunkPool.length<12)chunkPool.push(ch.canvas);ch.work=null;}}
  const deepFloor={hall:'#4a4238',lake:'#303e46',crystal:'#343a52',mushroom:'#2c3b36',web:'#39343f',geode:'#3a3150',roost:'#3d3833',magma:'#3b2520',tunnel:'#383842'};
  const deepWall={hall:'#5b4f41',lake:'#3b5560',crystal:'#45547a',mushroom:'#35584a',web:'#4b4456',geode:'#5b4880',roost:'#51493f',magma:'#6a3326',tunnel:'#4a4958',wall:'#45434f'};
  function nightOf(w){return window.WorldLife?.night?window.WorldLife.night(w):0;}
  // Town lamps also light the night: the glow is pushed before the lamp sprite is drawn.
  function lampAt(x,y,time,n){light(x,y-24,110,'#ffc978',1,'66');window.WorldTown.lamp(ctx,x,y,time,n);}
  function light(x,y,r,color,strength=1,glow='55'){if(baking){if(!baking.skip)baking.lights.push({x,y,r,color,strength,glow});return;}lights.push({x,y,r,color,strength,glow});}
  function deepGround(t,x,y,wx,wy,time){const n=V.hash(wx,wy,seed),theme=t.theme;
    if(t.kind==='wall'){const below=tile(wx,wy+1,{seed}),near=['hall','lake','crystal','mushroom','web','geode','roost','magma','tunnel'].find(k=>k===below.theme)||tile(wx,wy-1,{seed}).theme;const top=deepWall[near]||deepWall.wall;
      rect(ctx,x,y,32,32,'#16141c');if(below.kind!=='wall'){rect(ctx,x,y,32,20,darken(top,-6));poly(ctx,[[x,y+20],[x+32,y+20],[x+32,y+32],[x,y+32]],darken(top,22));for(let i=0;i<4;i++)rect(ctx,x+3+i*8,y+21+(i%2)*3,5,1,darken(top,34));rect(ctx,x,y+19,32,2,darken(top,-18));if(n>.7)rect(ctx,x+8+n*10,y+6,6,3,darken(top,-24));}
      else if(n>.5){rect(ctx,x+4,y+5,10,6,'#1d1b26');rect(ctx,x+17,y+15,9,5,'#1b1a23');}
      if(near==='geode'||near==='crystal')if(n>.78){poly(ctx,[[x+10,y+18],[x+14,y+4],[x+18,y+18]],near==='geode'?'#b48be0':'#7fb4e8');light(x+14,y+12,34,near==='geode'?'#b48be0':'#7fc8ff',.5);}
      return;}
    const base=deepFloor[theme]||'#3a3a44';rect(ctx,x,y,32,32,darken(base,Math.floor(n*6)-3));
    for(let i=0;i<4;i++){const px=V.hash(wx+i,wy,seed)*29,py=V.hash(wx,wy+i,seed)*29;rect(ctx,x+px,y+py,2,1,darken(base,n>.5?10:-12));}
    if(t.kind==='water'){rect(ctx,x,y,32,32,'#10303a');const o=Math.floor(time*3+wx*3)%24;rect(ctx,x+4+o%20,y+9,8,1,'#2f6674');rect(ctx,x+20-o%14,y+22,7,1,'#285866');if(n>.8){rect(ctx,x+14,y+14,2,2,'#78d7e2');light(x+15,y+15,22,'#4fb7c9',.35);}
      for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){const o2=tile(wx+dx,wy+dy,{seed});if(o2.kind!=='water'){rect(ctx,x+(dx>0?29:0),y+(dy>0?29:0),dx?3:32,dy?3:32,'#5d8792');}}return;}
    if(t.kind==='lava'){const pulse=Math.sin(time*2+wx*.7+wy*.5);rect(ctx,x,y,32,32,'#b8421c');for(let i=0;i<5;i++){const cx=x+V.hash(wx+i,wy+3,seed)*32,cy=y+V.hash(wx+3,wy+i,seed)*32;ellipse(ctx,cx,cy,5+i,3+i%3,i%2?'#d9581f':'#8e2f18');}for(let i=0;i<3;i++){const bx=x+6+V.hash(wx+i,wy,seed)*20,by=y+6+V.hash(wx,wy+i,seed)*20,r=2+((time*2+i+wx)%3);ellipse(ctx,bx,by,r,r*.7,i===0?'#ffd36b':'#ff9a3c');}if(pulse>.3)rect(ctx,x+10,y+14,12,3,'#ffe08a');if(n>.6){ellipse(ctx,x+8,y+6,5,2,'#4a1d15');}if(n<.3){ellipse(ctx,x+24,y+26,6,2,'#4a1d15');}if(n>.55)light(x+16,y+16,80,'#ff7a2e',.8,'1c');return;}
    if(theme==='hall'){rect(ctx,x,y+15,32,1,'#3a332c');rect(ctx,x+(wy%2?8:22),y,1,15,'#3a332c');rect(ctx,x+(wy%2?20:6),y+16,1,16,'#3a332c');}
    if(theme==='lake'&&n>.7)ellipse(ctx,x+12,y+20,6,2,'#3f5c66');
    if(theme==='crystal'&&n>.72){poly(ctx,[[x+8,y+24],[x+10,y+15],[x+13,y+24]],'#6fa9d8');rect(ctx,x+10,y+17,1,4,'#cdeeff');}
    if(theme==='geode'&&n>.66){poly(ctx,[[x+18,y+26],[x+21,y+14],[x+25,y+26]],'#a07ad0');rect(ctx,x+21,y+17,1,5,'#ead7ff');}
    if(theme==='mushroom'){if(n>.4)ellipse(ctx,x+10+n*10,y+18,7,3,'#35584a');if(n>.85){rect(ctx,x+20,y+10,1,1,'#b6ffcf');rect(ctx,x+7,y+24,1,1,'#b6ffcf');}}
    if(theme==='web'){ctx.strokeStyle='#cfc8dc40';ctx.lineWidth=1;if(n>.55){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+14,y+12);ctx.moveTo(x+14,y+12);ctx.lineTo(x+30,y+4);ctx.moveTo(x+14,y+12);ctx.lineTo(x+8,y+30);for(let r=4;r<12;r+=4){ctx.moveTo(x+14-r,y+12-r*.6);ctx.lineTo(x+14+r,y+12-r*.3);}ctx.stroke();}if(n<.07){rect(ctx,x+9,y+20,10,2,'#d9d2c0');rect(ctx,x+8,y+19,3,4,'#d9d2c0');rect(ctx,x+18,y+19,3,4,'#d9d2c0');}}
    if(theme==='roost'){if(n>.6){rect(ctx,x+6,y+9,3,2,'#b9b29a');rect(ctx,x+19,y+21,2,2,'#b9b29a');}if(n<.08){rect(ctx,x+9,y+18,12,2,'#e0d8c2');ellipse(ctx,x+22,y+18,3,3,'#e0d8c2');}}
    if(theme==='magma'){ctx.strokeStyle=n>.5?'#ff7a2e':'#c24a22';ctx.globalAlpha=.55+Math.sin(time*2+wx)*.25;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+2,y+8+n*10);ctx.lineTo(x+14,y+16);ctx.lineTo(x+30,y+10+n*12);ctx.stroke();ctx.globalAlpha=1;}
    if(theme==='tunnel'&&n>.75)ellipse(ctx,x+16,y+22,4,2,'#2c2c35');
    if(t.bones)window.LairArt?.floorBits(ctx,t,x,y);
    if(t.kind==='seal'&&t.lair){if(activeWorld?.lair?.open){rect(ctx,x+3,y+20,9,5,'#4a2e1c');rect(ctx,x+19,y+22,8,4,'#4a2e1c');}else{rect(ctx,x,y+4,32,26,'#3a2416');for(let i=0;i<4;i++){rect(ctx,x+2+i*8,y-10,6,40,'#6a4428');rect(ctx,x+3+i*8,y-10,2,40,'#8a5a36');poly(ctx,[[x+2+i*8,y-10],[x+5+i*8,y-17],[x+8+i*8,y-10]],'#6a4428');}rect(ctx,x,y+2,32,4,'#3a3a44');rect(ctx,x,y+20,32,4,'#3a3a44');window.LairArt?.skull(ctx,x+16,y+12,1);}}
    else if(t.kind==='seal'){const open=activeWorld?.deep?.sealOpen;if(open){rect(ctx,x+3,y+18,8,6,'#51465e');rect(ctx,x+20,y+22,7,5,'#51465e');rect(ctx,x+6,y+19,2,2,'#8a6fb0');}
      else{const glow=.55+Math.sin(time*3+wx)*.3;ctx.globalAlpha=glow;rect(ctx,x,y+6,32,20,'#6b3fb0');ctx.globalAlpha=1;for(let i=0;i<4;i++){rect(ctx,x+3+i*8,y-4,3,30,'#2b2240');rect(ctx,x+4+i*8,y-2,1,26,'#c9a6ff');}rect(ctx,x+11,y+10,10,10,'#e3d0ff');rect(ctx,x+13,y+12,6,6,'#6b3fb0');light(x+16,y+14,60,'#a36bff',.8);}}
  }
  function ground(t,x,y,wx,wy,time){if(t.palace){window.PalaceArt?.ground(ctx,t,x,y);return;}const b=V.biomes[t.biome],n=V.hash(wx,wy,seed),T=window.WorldTown;
    if(t.citadel&&T){
      if(t.kind==='wall'){const below=tile(wx,wy+1,{seed}),above=tile(wx,wy-1,{seed});T.citadelWallTile(ctx,below.kind!=='wall'?below.theme:above.theme,x,y,wx,wy,below.kind!=='wall');return;}
      if(t.kind==='lava'||t.kind==='water'){deepGround(t,x,y,wx,wy,time);return;}
      T.citadelGround(ctx,t,x,y,wx,wy,time);
      if(t.kind==='seal'){const info=V.citadelInfo(activeWorld||{}),open=info.open;if(open){rect(ctx,x+4,y+20,8,5,'#5e4c34');rect(ctx,x+20,y+22,7,4,'#5e4c34');}
        else{const glowA=.5+Math.sin(time*3+wy)*.3;ctx.globalAlpha=glowA;rect(ctx,x,y+4,32,24,'#b8862e');ctx.globalAlpha=1;for(let i=0;i<4;i++){rect(ctx,x+3+i*8,y-6,3,34,'#3a2a18');rect(ctx,x+4+i*8,y-4,1,30,'#ffd98a');}
          const lit=info.bosses;rect(ctx,x+10,y+8,12,12,'#3a2a18');for(let i=0;i<4;i++)rect(ctx,x+11+(i%2)*6,y+9+Math.floor(i/2)*6,4,4,i<lit?'#ffe27a':'#5a4232');light(x+16,y+14,60,'#e8b04a',.8);}}
      return;}
    if(t.deep){deepGround(t,x,y,wx,wy,time);return;}
    if(T&&(t.cobble||t.lawn||t.kind==='citywall')){
      if(t.cobble){T.cobble(ctx,x,y,wx,wy);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){const o=tile(wx+dx,wy+dy,{seed});if(o.lawn){rect(ctx,x+(dx>0?30:0),y+(dy>0?30:0),dx?2:32,dy?2:32,'#8a8272');}}return;}
      T.lawn(ctx,x,y,wx,wy,time);
      if(t.lawn&&!t.decor&&wy>=70&&wy<=78&&(wx<=122||wx>=134)&&V.hash(wx,wy,31)>.72)T.flowerBed(ctx,x,y,time,wx,wy);
      return;}
    if(t.underground){
      if(t.theme==='frost'){
        rect(ctx,x,y,32,32,t.kind==='wall'?'#395a70':'#668994');
        if(t.kind==='wall'){rect(ctx,x+1,y+2,30,23,'#82b6c6');rect(ctx,x+2,y+2,28,3,'#daeff0');rect(ctx,x+3,y+6,2,16,'#adcfd8');poly(ctx,[[x+6,y+25],[x+9,y+32],[x+11,y+25]],'#b8e5ed');}
        else {rect(ctx,x,y+31,32,1,'#4e7387');rect(ctx,x+(wy%2?9:24),y,1,31,'#547b8b');if(n>.68){rect(ctx,x+8,y+10,9,1,'#b5d4d7');rect(ctx,x+12,y+6,1,9,'#b5d4d7');}if(n<.2){rect(ctx,x,y,12,3,'#c4dddd');rect(ctx,x,y+3,5,2,'#b9d6d8');}}
        return;
      }
      rect(ctx,x,y,32,32,t.kind==='wall'?'#232330':darken('#3d3e4b',Math.floor(n*7)));
      if(t.kind==='wall'){poly(ctx,[[x,y+30],[x+3,y+5],[x+15,y],[x+30,y+7],[x+32,y+30]],'#343445');poly(ctx,[[x+3,y+5],[x+15,y],[x+28,y+7],[x+18,y+14]],'#575166');rect(ctx,x+6,y+23,13,2,'#202432');
        for(let i=0;i<3;i++){const xx=x+5+i*9;poly(ctx,[[xx-3,y+13],[xx,y+25+i%2*7],[xx+4,y+13]],i%2?'#464353':'#242637');rect(ctx,xx,y+13,1,7,'#696078');}
        if(n>.72){rect(ctx,x+6,y+19,1,5,'#8ac3be');rect(ctx,x+3,y+18,7,2,'#91b9bc');rect(ctx,x+16,y+23,1,4,'#799fa5');rect(ctx,x+13,y+22,6,2,'#6fa2ac');}}

      else {if(n>.55){poly(ctx,[[x+3,y+9],[x+14,y+4],[x+28,y+15],[x+20,y+25],[x+7,y+27]],n>.8?'#454653':'#383c48');ctx.strokeStyle='#2e3341';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+5,y+12);ctx.lineTo(x+15,y+17);ctx.lineTo(x+13,y+25);ctx.stroke();}for(let i=0;i<3;i++){const px=V.hash(wx+i,wy,seed)*28,py=V.hash(wx,wy+i,seed)*28;rect(ctx,x+px,y+py,2,1,n>.6?'#656473':'#303541');}if(n>.91){ellipse(ctx,x+14,y+24,7,3,'#42616a');rect(ctx,x+10,y+23,5,1,'#739698');}}
      return;
    }
    let color=b.color;if(t.kind==='path')color='#b6a57a';if(t.kind==='farm')color='#a0845d';if(t.kind==='water')color=t.biome===2?'#52685c':'#4c7075';if(t.kind==='bridge')color='#9e865d';if(t.kind==='grass')color=darken(color,Math.round((Math.sin(wx*.22)+Math.cos(wy*.19))*3));ctx.drawImage(texturedGround(t,Math.floor(n*16),color),x,y);
    if(t.kind==='water'){
      rect(ctx,x,y,32,32,t.biome===2?'#386c68':'#306b82');
      for(let i=0;i<4;i++){const yy=i*8+Math.floor(Math.sin(time*1.3+wx*.8+i)*2),xx=((wx*7+wy*3+i*11+Math.floor(time*(i%2?3:-2)))%24+24)%24;rect(ctx,x,y+Math.max(0,yy),32,3,i%2?'#357b8b':'#337386');rect(ctx,x+xx,y+Math.max(1,yy)+2,Math.min(32-xx,5+i),1,i%2?'#69b5bd':'#4b99a9');}
      if(n>.62){const glint=Math.sin(time*2+wx+wy);if(glint>.35){rect(ctx,x+15,y+12,5,1,'#b2ded7');rect(ctx,x+17,y+10,1,5,'#8fcfcf');}}
      if(n<.035){const fx=x+16+Math.sin(time*.6+wx)*8,fy=y+20;rect(ctx,fx,fy,5,2,'#224e68');rect(ctx,fx-2,fy-1+Math.round(Math.sin(time*6)),2,4,'#285d77');}
      shoreline(t,x,y,wx,wy,time);return;
    }
    if(t.kind==='bridge'){for(let i=0;i<32;i+=6){rect(ctx,x,y+i,32,1,'#675c44');rect(ctx,x+1,y+i+1,30,1,'#b39a6a');}return;}
    if(t.kind==='farm'){for(let i=0;i<4;i++){rect(ctx,x+3,y+4+i*7,25,2,'#735f46');for(let j=0;j<4;j++){rect(ctx,x+5+j*6,y+2+i*7,2,3,'#b6b775');rect(ctx,x+4+j*6,y+1+i*7,4,1,'#d6c778');}}return;}
    for(let i=0;i<5;i++){const px=Math.floor(V.hash(wx+i,wy,seed)*29),py=Math.floor(V.hash(wx,wy+i+1,seed)*29);rect(ctx,x+px,y+py,t.kind==='path'?3:2,1,darken(color,i%2?8:-10));}
    if(t.kind==='path'){
      if(n>.5)rect(ctx,x+8,y+20,4,2,'#9b906a');
      for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const adjacent=V.tileAt(wx+dx,wy+dy,seed);if(adjacent.kind!=='path'&&adjacent.kind!=='building'&&adjacent.kind!=='water'){for(let i=0;i<8;i++){const depth=2+Math.floor(V.hash(wx+i,wy+i)*4);rect(ctx,x+(dx<0?0:dx>0?32-depth:i*4),y+(dy<0?0:dy>0?32-depth:i*4),dx?depth:4,dy?depth:4,V.biomes[adjacent.biome].color);}}}return;
    }
    if(b.surface==='sand'){
      for(let i=0;i<3;i++){const yy=6+i*10+Math.sin(wx*.5+i)*3;rect(ctx,x+3, y+yy,24,1,'#af976c');rect(ctx,x+5,y+yy+1,21,1,'#d1ba8c');}return;
    }
    if(b.surface==='snow'){
      if(n>.65){poly(ctx,[[x+3,y+23],[x+12,y+14],[x+23,y+16],[x+29,y+24]],'#989f99');rect(ctx,x+10,y+15,12,3,'#e2e5df');}return;
    }
    if(b.surface==='wetland'){
      if(n>.5)ellipse(ctx,x+16,y+22,10,4,'#62674c');
      for(let i=0;i<3;i++){rect(ctx,x+9+i*5,y+14-i%2*4,1,11,'#4f6440');rect(ctx,x+9+i*5,y+12-i%2*4,2,4,'#786346');}return;
    }
    if(b.surface==='savanna'){
      for(let i=0;i<4;i++){rect(ctx,x+4+i*7,y+15+(i%2)*5,1,6,'#7c7b45');rect(ctx,x+5+i*7,y+13+(i%2)*5,1,6,'#c2b780');}return;
    }
    if(b.surface==='forest'){
      const breeze=Math.round(Math.sin(time*1.7+wx*.6+wy)*1.3);
      if(n>.38)for(let i=0;i<3;i++){const xx=x+6+i*9,yy=y+22-i%2*7;rect(ctx,xx,yy-6,1,8,'#315b46');for(let j=0;j<3;j++){rect(ctx,xx-3+j+breeze,yy-5+j*2,3-j,1,'#6a9c65');rect(ctx,xx+1+breeze,yy-5+j*2,3-j,1,'#83ac6f');}}
      if(n>.8){rect(ctx,x+9,y+20,2,4,'#ded2ad');rect(ctx,x+6,y+18,7,3,'#bb7561');rect(ctx,x+8,y+18,2,1,'#ffe0b0');}
      if(n<.12)for(let i=0;i<3;i++){const xx=x+6+i*7+breeze,yy=y+10+i%2*7;rect(ctx,xx,yy,1,6,'#41664c');rect(ctx,xx-1,yy-1,3,2,i%2?'#d8c18d':'#bdaccf');}
      if(n>.94){const xx=x+15+Math.sin(time+wx)*9,yy=y+8+Math.cos(time*.8+wy)*5,wing=1+Math.abs(Math.round(Math.sin(time*9)*2));rect(ctx,xx-wing,yy,wing,2,'#f3d28c');rect(ctx,xx+1,yy,wing,2,'#e3ba75');rect(ctx,xx,yy,1,3,'#65533e');}
    }
    if(n<.23){rect(ctx,x+9,y+13,1,4,b.dark);rect(ctx,x+7,y+12,1,3,b.dark);rect(ctx,x+11,y+11,1,3,b.dark);}
    if(t.biome===0&&n>.55&&n<.68){const colors=['#e5ce8f','#ece2b9','#d5a6ad'];for(let i=0;i<3;i++){rect(ctx,x+7+i*7,y+10+(i%2)*8,2,4,b.dark);rect(ctx,x+6+i*7,y+9+(i%2)*8,4,2,colors[(wx+wy+i)%3]||colors[0]);}}
  }
  function villagerAt(n,x,y,time,near){
    const people=window.WorldPeople;if(!people||!n.look)return false;
    const fb=people.frameFor(n,time),frame=quality==='leve'&&fb.frame?fb.frame-((fb.frame-1)%2):fb.frame,blink=fb.blink,action=fb.action,art=people.sprite(n.look,n.dir??0,frame,blink,action),breathe=n.idle&&Math.sin(time*2.2+n.id.length)>.6?1:0,foot=art.foot??people.size.foot,center=art.center??16;
    ellipse(ctx,x,y+2,10,3,'#192e344d');if(n.state==='sleep'){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(-Math.PI/2);ctx.drawImage(art,-center,-foot+5);ctx.restore();}else ctx.drawImage(art,Math.round(x-center),Math.round(y-foot+2+breathe));if(n.emotion){ctx.fillStyle='#f5e4b5';ctx.font='bold 9px monospace';ctx.fillText(n.emotion,Math.round(x+8),Math.round(y-51-Math.sin(time*2)*2));}
    const head=y-(n.look.body==='child'?46:66);
    if(n.bard){for(let i=0;i<3;i++){const k=(time*.6+i/3)%1;ctx.globalAlpha=1-k;ctx.font='bold 8px monospace';ctx.fillStyle=i%2?'#f3d56a':'#ffffff';txt(ctx,i%2?'♪':'♫',x+8+Math.sin(k*6+i)*6,head-k*22);}ctx.globalAlpha=1;}
    if(n.role==='merchant'){const cy=Math.round(head-8+Math.sin(time*3)*1.5);ellipse(ctx,x,cy,6,6,'#6b4a1c');ellipse(ctx,x,cy,5,5,'#f2c65a');ellipse(ctx,x-1,cy-1,3,3,'#ffe7a0');rect(ctx,x-1,cy-3,2,6,'#b8862e');}
    else if(n.royal){for(let i=0;i<3;i++){const a=time*2+i*2.1;rect(ctx,x+Math.cos(a)*11,head+4+Math.sin(a)*4,1,1,'#fff2c0');}}
    else if(near){ellipse(ctx,x,head-4,4,4,'#f6e7bf');rect(ctx,x-1,head-6,2,3,'#253845');}
    return true;
  }
  function citizen(n,x,y,time,near){
    if(n.wagon){const wagon=window.GameAssets?.get('royal-wagon',{state:n.idle?'idle':'moving',seed:n.id.length});if(wagon){const h=50,w=Math.round(h*wagon.width/wagon.height),left=n.dir===1,rattle=Math.abs(Math.sin(time*6))*.8;ellipse(ctx,x+(left?22:-22),y+3,w*.42,6,'#18293244');ctx.save();ctx.translate(Math.round(x+(left?22:-22)),Math.round(y-h+4+rattle));if(left)ctx.scale(-1,1);ctx.drawImage(wagon,-Math.round(w/2),0,w,h);ctx.restore();}}
    villagerAt(n,x,y,time,near);
  }
  function palace(b,x,y,time){
    const k=V.kingdoms.find(k=>k.id===b.kingdom),w=b.w*32,h=b.h*32;
    ellipse(ctx,x+w/2+22,y+h+8,w*.63,22,'#10283b55');
    const art=window.GameAssets?.get('royal-'+k.id);
    if(art){
      // Painted palace: steps overhang the footprint so the door lines up with the entrance tile.
      const dw=w+56,dh=Math.round(dw*art.height/art.width),cx=x+w/2;ctx.drawImage(art,Math.round(cx-dw/2),Math.round(y+h+14-dh),dw,dh);
      for(let i=0;i<4;i++){const k=(time*.5+i*.27)%1;if(k>.25)continue;const gx=cx-dw*.36+V.hash(i,b.x,3)*dw*.72,gy=y+h+14-dh*(.3+V.hash(b.y,i,5)*.5),r=Math.sin(k/.25*Math.PI)*3;rect(ctx,gx-r,gy,r*2+1,1,'#fffbe0');rect(ctx,gx,gy-r,1,r*2+1,'#fffbe0');}
      const ly=Math.round(y+h+6-dh);ctx.textAlign='center';ctx.font='bold 7px monospace';ctx.lineWidth=3;ctx.strokeStyle='#172633';ctx.strokeText(k.name.toUpperCase(),cx,ly);ctx.fillStyle='#fbe8bd';txt(ctx,k.name.toUpperCase(),cx,ly);ctx.textAlign='left';
      return;
    }
    // Ashlar walls, recessed windows, copper roof lines and four distinct towers.
    rect(ctx,x+18,y-26,w-36,h+26,'#586577');rect(ctx,x+22,y-24,w-44,h+22,'#c9c8bd');
    for(let row=-20;row<h;row+=12){rect(ctx,x+22,y+row,w-44,1,'#a1a8ab');for(let col=26+(row%24?0:14);col<w-22;col+=28)rect(ctx,x+col,y+row,1,12,'#b0b5b1');}
    poly(ctx,[[x+12,y-24],[x+48,y-66],[x+w-48,y-66],[x+w-12,y-24]],k.roof);rect(ctx,x+48,y-66,w-96,3,k.color);
    for(let row=-57;row<-26;row+=7)rect(ctx,x+42,y+row,w-84,1,'#e7e7d32b');
    for(const tx of [x+2,x+w-46])for(const front of [false,true]){
      const ty=front?y+h-82:y-38,th=front?82:108;
      rect(ctx,tx+5,ty,38,th,'#8795a1');rect(ctx,tx+5,ty,25,th,'#d0d3cb');rect(ctx,tx+9,ty+4,3,th-5,'#f0e9d4');
      poly(ctx,[[tx,ty],[tx+24,ty-46],[tx+48,ty]],k.roof);poly(ctx,[[tx+24,ty-46],[tx+48,ty],[tx+27,ty]],'#23354866');rect(ctx,tx,ty-1,48,3,k.color);
      rect(ctx,tx+22,ty-64,2,20,'#ebd6a0');poly(ctx,[[tx+24,ty-64],[tx+42,ty-60+Math.sin(time*2+tx-originX)*2],[tx+24,ty-54]],k.color);
      for(let dy=16;dy<th-5;dy+=29){rect(ctx,tx+18,ty+dy,11,18,'#334754');rect(ctx,tx+20,ty+dy+2,7,13,'#e9d08e');rect(ctx,tx+23,ty+dy+2,1,13,'#a4845e');}
      rect(ctx,tx+3,ty+th-7,42,7,'#98a4aa');
    }
    for(const dx of [65,w-81]){rect(ctx,x+dx,y+10,17,30,'#425466');rect(ctx,x+dx+3,y+13,11,23,'#efd5a1');rect(ctx,x+dx+8,y+13,2,23,'#957b5d');rect(ctx,x+dx,y+55,18,42,k.roof);poly(ctx,[[x+dx,y+97],[x+dx+9,y+106],[x+dx+18,y+97]],k.roof);ctx.font='13px Georgia';ctx.fillStyle=k.color;txt(ctx,k.sigil,x+dx+3,y+80);}
    const cx=x+w/2;rect(ctx,cx-23,y+h-57,46,57,'#e9dfc4');rect(ctx,cx-18,y+h-51,36,51,'#293b4a');ellipse(ctx,cx,y+h-49,18,13,'#293b4a');rect(ctx,cx-15,y+h-48,30,48,'#615447');rect(ctx,cx-1,y+h-48,2,48,'#b6945c');rect(ctx,cx+7,y+h-25,3,3,'#f4d58b');
    for(let i=0;i<3;i++)rect(ctx,cx-25-i*4,y+h+i*3,50+i*8,3,i%2?'#879593':'#d9d6bc');
    ctx.textAlign='center';ctx.font='bold 7px monospace';ctx.fillStyle='#243745';txt(ctx,k.name.toUpperCase(),cx,y+h-77);ctx.font='17px Georgia';ctx.fillStyle=k.color;txt(ctx,k.sigil,cx,y+h-96);ctx.textAlign='left';
  }
  // Throne hall (14x9), after classic 16-bit throne rooms: stained glass, marble, royal carpet, dais, pillars and banners.
  // Castle staff looks (paper-doll villagers), tinted with the kingdom colours.
  const STAFF_LOOKS={guard:k=>({body:'man',skin:'#d9a882',hair:'short',hairColor:'#3a2a1a',outfit:'armor',main:k.roof,accent:k.color,hat:'helmet',item:'spear'}),cook:k=>({body:'woman',skin:'#e0b08a',hair:'bun',hairColor:'#6a3a24',outfit:'apron',main:'#c8b8a0',accent:k.color,hat:'chef'}),scholar:k=>({body:'elder',skin:'#d9b08a',hair:'bald',hairColor:'#dcdcdc',beard:'full',outfit:'robe',main:'#3a4a6a',accent:k.color,item:'book'}),priest:k=>({body:'man',skin:'#c98f68',hair:'short',hairColor:'#2a1f1a',outfit:'robe',main:'#efe9dc',accent:k.color,item:'staff'}),maid:k=>({body:'woman',skin:'#f0c8a0',hair:'ponytail',hairColor:'#3a2418',outfit:'apron',main:'#2a2a3a',accent:k.roof,item:'broom'}),innkeeper:k=>({body:'man',skin:'#d9a07a',hair:'short',hairColor:'#7a4a2a',beard:'mustache',outfit:'apron',main:'#6a4a3a',accent:k.color}),bard:k=>({body:'man',skin:'#e0b08a',hair:'long',hairColor:'#c8a040',outfit:'noble',main:'#2a6a6a',accent:'#e8c14a',hat:'feather',item:'lute',cape:true}),barmaid:k=>({body:'woman',skin:'#f0c8a0',hair:'braids',hairColor:'#8a3a1a',outfit:'dress',main:'#6a2a3a',accent:'#efe6d0'}),patron0:k=>({body:'man',skin:'#c98f68',hair:'spiky',hairColor:'#3a2a1a',beard:'goatee',outfit:'coat',main:'#4a5a3a',accent:'#a8704a'}),patron1:k=>({body:'woman',skin:'#b8805a',hair:'curly',hairColor:'#1c1614',outfit:'shirt',main:'#3a4a6a',accent:'#c8a040',hat:'bandana'}),patron2:k=>({body:'elder',skin:'#d9b08a',hair:'bald',hairColor:'#bbbbbb',beard:'full',outfit:'coat',main:'#6a3a2a',accent:'#8a6a40'}),gardener:k=>({body:'man',skin:'#b8805a',hair:'short',hairColor:'#5a3a1a',outfit:'shirt',main:'#5a7a3a',accent:'#c8a040',hat:'straw',item:'basket'})};
  function royalHall(b,x,y,time){
    const k=V.kingdoms.find(k=>k.id===b.kingdom),w=b.w*32,h=b.h*32,cx=x+w/2,gold='#e8c14a',goldD='#a8862e',still=reducedMotion;
    const stoneD='#2a3140',stone='#3c4556',stoneL='#566174';
    // Floor: two-tone marble checker with diamond inlays.
    rect(ctx,x,y,w,h,'#1c2230');
    for(let r=0;r*16<h-56;r++)for(let c=0;c*16<w;c++){const fx=x+c*16,fy=y+56+r*16;rect(ctx,fx,fy,16,16,(r+c)%2?'#b9b3a3':'#d6d0c0');rect(ctx,fx,fy,16,1,'#ece6d6');rect(ctx,fx,fy+15,16,1,'#9c9686');}
    for(let r=1;r*32<h-56;r++)for(let c=1;c*32<w;c++){const dx=x+c*32,dy=y+56+r*32;poly(ctx,[[dx,dy-4],[dx+4,dy],[dx,dy+4],[dx-4,dy]],'#8e7f63');}
    // Back wall: stone blocks, stained glass windows with light shafts, torches between them.
    rect(ctx,x,y,w,58,stoneD);for(let r=0;r<4;r++)for(let c=-1;c*28<w;c++){const bx=x+c*28+(r%2)*14,by=y+4+r*13;if(bx<x-28)continue;rect(ctx,Math.max(x,bx),by,Math.min(26,x+w-bx),11,r%2?stone:stoneL);rect(ctx,Math.max(x,bx),by+10,Math.min(26,x+w-bx),1,stoneD);}
    rect(ctx,x,y+54,w,4,'#1a1f2a');rect(ctx,x,y+52,w,2,goldD);
    const glass=[k.color,k.roof,'#c0304a','#3a7fd0',gold,'#4f9a5a'];
    for(const f of [.18,.5,.82]){const wx=Math.round(x+w*f),ww=f===.5?40:30,wy=y+6,wh=44;
      rect(ctx,wx-ww/2-3,wy-2,ww+6,wh+4,'#1a1f2a');ellipse(ctx,wx,wy+8,ww/2+3,10,'#1a1f2a');
      for(let r=0;r<5;r++)for(let c=0;c<4;c++){const col=glass[(r*2+c+(f*10|0))%glass.length];rect(ctx,wx-ww/2+c*(ww/4),wy+4+r*8,ww/4-1,7,col);}
      ellipse(ctx,wx,wy+6,ww/2,8,glass[(f*7|0)%glass.length]);rect(ctx,wx-1,wy,2,wh,'#1a1f2a');rect(ctx,wx-ww/2,wy+22,ww,2,'#1a1f2a');
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.10+(still?0:Math.sin(time*.7+f*5)*.02);ctx.fillStyle=k.color;ctx.beginPath();ctx.moveTo(wx-ww/2,wy+wh);ctx.lineTo(wx+ww/2,wy+wh);ctx.lineTo(wx+ww/2+34,y+h-30);ctx.lineTo(wx-ww/2+14,y+h-30);ctx.closePath();ctx.fill();ctx.restore();}
    for(const f of [.34,.66,.06,.94]){const tx=Math.round(x+w*f),ty=y+26,fl=still?0:Math.round(Math.sin(time*11+f*9)*1.5);rect(ctx,tx-2,ty,4,10,'#5a4030');rect(ctx,tx-4,ty-2,8,3,'#8a6a40');rect(ctx,tx-2,ty-8-fl,4,6+fl,'#ff9a3a');rect(ctx,tx-1,ty-6-fl,2,4,'#ffe7a0');light(tx,ty-6,70,'#ffb45a',.9,'66');}
    // Side walls.
    rect(ctx,x,y+56,8,h-56,stone);rect(ctx,x+w-8,y+56,8,h-56,stone);rect(ctx,x+7,y+56,1,h-56,stoneD);rect(ctx,x+w-8,y+56,1,h-56,stoneD);
    // Royal carpet from the door to the dais, gold trimmed.
    const cw=52,cy0=y+104;rect(ctx,cx-cw/2-3,cy0,cw+6,h-(cy0-y),goldD);rect(ctx,cx-cw/2,cy0,cw,h-(cy0-y),k.roof);rect(ctx,cx-cw/2+3,cy0,2,h-(cy0-y),gold);rect(ctx,cx+cw/2-5,cy0,2,h-(cy0-y),gold);
    for(let yy=cy0+14;yy<y+h-8;yy+=26){poly(ctx,[[cx,yy-6],[cx+6,yy],[cx,yy+6],[cx-6,yy]],gold);rect(ctx,cx-1,yy-1,2,2,k.color);}
    // Dais with three steps and two thrones (the king's back is taller).
    for(let s=0;s<3;s++){const dw=190-s*30,dy=y+60+s*14;rect(ctx,cx-dw/2,dy+30,dw,14,s%2?'#8f8878':'#a9a291');rect(ctx,cx-dw/2,dy+30,dw,2,'#d6cfbc');rect(ctx,cx-dw/2,dy+42,dw,2,'#6e685c');}
    rect(ctx,cx-cw/2,y+90,cw,16,k.roof);rect(ctx,cx-cw/2,y+90,cw,2,gold);
    const throne=(tx,tall)=>{const th=tall?44:34,ty=y+92-th;rect(ctx,tx-13,ty,26,th,goldD);rect(ctx,tx-11,ty+2,22,th-4,gold);rect(ctx,tx-8,ty+5,16,th-16,'#8a1f2e');rect(ctx,tx-6,ty+7,12,th-20,'#b02a3c');poly(ctx,[[tx-13,ty],[tx,ty-(tall?10:6)],[tx+13,ty]],gold);rect(ctx,tx-1,ty-(tall?7:4),2,3,k.color);rect(ctx,tx-14,ty+th-12,28,8,goldD);rect(ctx,tx-12,ty+th-11,24,6,'#8a1f2e');};
    throne(cx-18,true);throne(cx+18,false);
    // Pillars with banners in the kingdom's colours, and a candle chandelier.
    for(const f of [.2,.8])for(const py of [118,178,238]){const px=Math.round(x+w*f),top=y+py-54;if(py>h-6)continue;
      ellipse(ctx,px,y+py+2,14,4,'#11151e55');rect(ctx,px-10,top+6,20,48,'#b8b2a4');rect(ctx,px-10,top+6,4,48,'#d9d3c3');rect(ctx,px+5,top+6,5,48,'#8e887a');rect(ctx,px-13,top,26,7,'#cfc8b8');rect(ctx,px-13,y+py-4,26,6,'#9c9686');
      const bx=px+(f<.5?14:-14),sway=still?0:Math.round(Math.sin(time*1.3+py)*1);rect(ctx,bx-6,top+8,12,2,goldD);rect(ctx,bx-5+sway,top+10,10,26,k.color);rect(ctx,bx-5+sway,top+10,10,3,gold);poly(ctx,[[bx-5+sway,top+36],[bx+sway,top+41],[bx+5+sway,top+36]],k.color);rect(ctx,bx-2+sway,top+18,4,4,gold);}
    const chx=cx,chy=y+150;rect(ctx,chx-1,y+58,2,chy-y-58,'#3a3440');ellipse(ctx,chx,chy,26,6,'#5a4a3a');ellipse(ctx,chx,chy-1,24,4,'#8a6a40');
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,lx=chx+Math.cos(a)*22,ly=chy+Math.sin(a)*4,fl=still?0:(Math.sin(time*9+i)>0?1:0);rect(ctx,lx-1,ly-6,2,5,'#efe6d0');rect(ctx,lx-1,ly-9-fl,2,3,'#ffcf6a');}
    light(chx,chy-4,120,'#ffd27a',1,'55');
    // Potted plants and guards at the door.
    for(const f of [.05,.95])for(const py of [70,h-26]){const px=Math.round(x+w*f),yy=y+py;rect(ctx,px-6,yy,12,10,'#8a5a3a');rect(ctx,px-7,yy,14,3,'#a8704a');ellipse(ctx,px,yy-4,9,7,'#3f7a45');ellipse(ctx,px-3,yy-7,5,4,'#5aa04a');}
    const guardLook={body:'man',skin:'#d9a882',hair:'short',hairColor:'#3a2a1a',outfit:'armor',main:k.roof,accent:k.color,hat:'helmet',item:'spear'};
    for(const s of [-1,1]){const gx=cx+s*(cw/2+22),gy=y+h-14;if(!villagerAt({id:'hall-guard'+s,look:guardLook,dir:0,idle:true,speed:0,state:'guard'},gx,gy,time,false))rect(ctx,gx-6,gy-30,12,30,'#8a94a0');}
    // Court: king and queen seated, prince and princess standing on the dais.
    const spots=[[cx-18,y+96],[cx+18,y+96],[cx+62,y+104],[cx-62,y+104]];
    k.court.forEach((n,i)=>{const [px,py]=spots[i]||spots[0];ellipse(ctx,px,py+3,11,3,'#23374455');if(!villagerAt({...n,dir:0,idle:true,speed:0,state:i<2?'read':i===3?'guard':'social'},px,py,time,false)){const art=sprite(['paladino','clerigo','mago','guerreiro'][i],0,0,i===0||i===3?'male':'female');if(art)ctx.drawImage(art,px-art.width/2,py-art.height+4);}});
    rect(ctx,cx-16,y+h-6,32,6,'#e7d6ac');
  }
  function building(z,sx,sy,time){
    if(z.kind==='palace'){palace(z,sx,sy,time);return;}
    if(z.kind==='guild'&&window.GuildArt){window.GuildArt.exterior(ctx,z,sx,sy,time,nightOf(world)*.24);return;}
    // Forge, inn and manor from the town atlas (pixel art); the older generic house art is the fallback.
    // [sprite, width, where the painted door sits across the sprite]: the art is shifted so its door lines up with the real doorway (centre of the footprint).
    const town=(window.GameAssets?.frontBuildings?{forge:['forge',150,.5],inn:['inn',180,.5],house:['house4',140,.5]}:{})[z.kind];
    if(town&&window.GameAssets?.get('town-'+town[0])){const cx=sx+z.w*16+(.5-town[2])*town[1],base=sy+z.h*32+6,a=window.GameAssets.get('town-'+town[0]),h=town[1]*a.height/a.width;ellipse(ctx,cx+6,base-4,z.w*18,9,'#23382b44');window.GameAssets.place(ctx,'town-'+town[0],cx,base,town[1]);
      if(z.kind==='forge'){const f=reducedMotion?0:Math.sin(time*9)*.5;light(cx+12,base-38,70+f*10,'#ff9a4a',.9,'55');}
      if(activeWorld&&nightOf(activeWorld)>.1)light(cx,base-h*.4,90,'#ffb45a',.7,'44');
      if(z.name){ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillStyle='#f4deb1';txt(ctx,z.name,cx,base-h-4);ctx.textAlign='left';}return;}
    const art=window.GameAssets?.get('world-0-2');
    if(art){const w=z.w*32+20,h=z.h*32+56;ellipse(ctx,sx+z.w*16,sy+z.h*32, z.w*18,10,'#23382b44');ctx.drawImage(art,sx-10,sy-51,w,h);for(let i=0;i<3;i++){const k=(time*.23+i/3)%1;ellipse(ctx,sx+w*.67+Math.sin(k*4)*7,sy-35-k*32,2+k*5,2+k*3,`rgba(221,212,191,${.22*(1-k)})`);}if(z.kind==='forge'){rect(ctx,sx+w*.35,sy+z.h*32-19,8,2,'#ffc780');}if(z.name){ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillStyle='#f4deb1';txt(ctx,z.name,sx+z.w*16,sy+z.h*32-48);ctx.textAlign='left';}return;}
const w=z.w*32,h=z.h*32,wallY=sy-18;ellipse(ctx,sx+w/2+9,sy+h+3,w*.65,12,'#233d333a');rect(ctx,sx,wallY,w,h+17,'#675e46');rect(ctx,sx+3,wallY+3,w-6,h+10,'#dcc79c');rect(ctx,sx+3,sy+h-18,w-6,19,'#a48e69');for(let i=0;i<w;i+=24){rect(ctx,sx+i,wallY,4,h+18,'#786c4b');}rect(ctx,sx+w*.45,sy+h-35,20,34,'#605d46');rect(ctx,sx+w*.45+3,sy+h-32,14,30,'#847450');rect(ctx,sx+w*.45+14,sy+h-16,2,2,'#e7c875');for(const k of [.12,.73]){rect(ctx,sx+w*k,sy+h-48,17,22,'#675e44');rect(ctx,sx+w*k+2,sy+h-46,13,17,'#e2c77b');rect(ctx,sx+w*k+8,sy+h-46,2,18,'#8a7950');rect(ctx,sx+w*k+2,sy+h-37,13,2,'#8a7950');}
    const roof=z.kind==='forge'?'#637f77':z.kind==='inn'?'#a5664b':'#818d56',top=sy-48;poly(ctx,[[sx-9,wallY+10],[sx+9,top],[sx+w-9,top],[sx+w+9,wallY+10]],'#514e3e');poly(ctx,[[sx-7,wallY+5],[sx+10,top],[sx+w-10,top],[sx+w+7,wallY+5]],roof);for(let y=top+7;y<wallY+5;y+=7){const inset=(wallY+5-y)*.35;rect(ctx,sx-5+inset,y,w+10-inset*2,1,darken(roof,-20));for(let x=sx+4+(Math.floor(y/7)%2)*8;x<sx+w-2;x+=15)rect(ctx,x,y-4,1,4,darken(roof,16));}rect(ctx,sx+12,top-2,w-24,3,darken(roof,24));rect(ctx,sx+w-31,top-17,14,28,'#898579');rect(ctx,sx+w-33,top-19,18,5,'#b0a892');for(let i=0;i<3;i++){const k=(time*.45+i*.33)%1;ellipse(ctx,sx+w-24+Math.sin(k*4)*8,top-20-k*40,4+k*8,3+k*6,`rgba(225,223,196,${.24*(1-k)})`);}
    if(z.name){ctx.font='5px monospace';const tw=ctx.measureText(z.name).width;rect(ctx,sx+w/2-tw/2-4,sy+h-57,tw+8,10,'#8b7450');ctx.fillStyle='#f2dfac';txt(ctx,z.name,sx+w/2-tw/2,sy+h-50);}
    for(let i=0;i<3;i++){rect(ctx,sx+3+i*8,sy+h+1,6,5,'#9b8156');rect(ctx,sx+4+i*8,sy+h-3,4,4,'#7d9e5c');rect(ctx,sx+4+i*8,sy+h-5,3,3,i%2?'#e0b196':'#e4d28d');}
  }
  function prop(name,x,y,height){
    const art=window.GameAssets?.get('prop-'+name,{seed:x*.07+y*.13});if(!art)return false;
    if(name==='campfire'||name==='lantern'||name==='forge')light(x,y-height*.55,name==='campfire'?120:95,name==='lantern'?'#ffd98a':'#ff9a4a',1,'66');
    const width=Math.round(height*art.width/art.height);ctx.drawImage(art,Math.round(x-width/2),Math.round(y-height),width,height);return true;
  }
  function interior(b,x,y,time){if(b.kind==='guild'&&window.GuildArt){window.GuildArt.interior(ctx,b,x,y,time);return;}
    if(b.kind==='palace'){royalHall(b,x,y,time);return;}
    const w=b.w*32,h=b.h*32;
    rect(ctx,x,y,w,h,'#302e36');rect(ctx,x+5,y+8,w-10,h-13,'#a07850');
    for(let row=12;row<h-5;row+=9){rect(ctx,x+5,y+row,w-10,1,'#785636');for(let col=8+(row%2)*15;col<w-5;col+=31)rect(ctx,x+col,y+row-8,1,8,'#87613e');}
    rect(ctx,x,y,w,20,'#66514a');rect(ctx,x+3,y+3,w-6,13,'#baa07c');
    rect(ctx,x+w/2-20,y+h-43,40,28,'#6f4249');rect(ctx,x+w/2-17,y+h-40,34,22,'#995956');
    rect(ctx,x+w/2-14,y+h-5,28,5,'#d1b788');
    if(b.kind==='forge'&&window.GameAssets?.get('prop-forge')){prop('forge',x+35,y+56,47);prop('bookcase',x+w-25,y+42,35);}
    else if(b.kind==='forge'){
      rect(ctx,x+10,y+14,30,21,'#4a4145');rect(ctx,x+15,y+18,20,13,'#d26538');rect(ctx,x+21,y+20,8,10,'#ffd279');
      rect(ctx,x+w-41,y+22,29,7,'#59626b');rect(ctx,x+w-34,y+29,15,8,'#363c49');
    }else if(window.GameAssets?.get('prop-bed')){prop('bed',x+31,y+64,49);prop('bookcase',x+w-25,y+48,40);}
    else{
      rect(ctx,x+10,y+16,27,21,'#503c37');rect(ctx,x+12,y+18,23,6,'#e4d6b6');rect(ctx,x+12,y+25,23,10,b.kind==='inn'?'#5a8990':'#789057');
      rect(ctx,x+w-36,y+19,24,17,'#654934');rect(ctx,x+w-34,y+18,20,12,'#bc935b');rect(ctx,x+w-28,y+20,7,6,'#dfcc9c');
    }
    // Shelves, crockery, stitched rugs, nails and masonry retain the same pixel scale.
    for(let i=0;i<3;i++){rect(ctx,x+43+i*8,y+7,6,11,['#7e4b4c','#657e71','#a78a55'][i]);rect(ctx,x+44+i*8,y+8,1,8,'#d4bd85');}rect(ctx,x+41,y+18,29,3,'#584536');
    for(let i=0;i<5;i++){rect(ctx,x+w/2-15+i*7,y+h-39,2,2,'#d9af7b');rect(ctx,x+w/2-15+i*7,y+h-22,2,2,'#d9af7b');}
    rect(ctx,x+w-30,y+22,3,6,'#d7ded1');rect(ctx,x+w-29,y+22,1,2,'#81aa9a');rect(ctx,x+w-23,y+24,5,2,'#efe0bb');
    for(let i=0;i<4;i++)rect(ctx,x+7+i*22,y+h-9,1,1,'#e0bd7b');
    rect(ctx,x+w-12,y+6,5,9,'#f5c671');ellipse(ctx,x+w-9,y+11,14,9,'#f5be5720');
    if(b.kind==='forge'){for(let i=0;i<5;i++){const phase=(time*2+i*.23)%1;rect(ctx,x+17+i*3,y+29-phase*15,2,2,phase>.5?'#efa04a':'#ffdf83');}rect(ctx,x+11,y+35,26,3,'#4a3d3c');}

  }
  function landmark(l,x,y,time,world){
    if(['town','inn','forge','farm','kingdom','camp'].includes(l.kind))return;
    // Covil dos Goblins: the cave mouth with skull stakes, torches and a war banner.
    if(l.kind==='lair'){const art=window.GameAssets?.get('detail-cave',{seed:3}),width=110;if(art){const height=Math.round(width*art.height/art.width);ellipse(ctx,x,y+4,width*.45,9,'#171d2c66');ctx.drawImage(art,Math.round(x-width/2),Math.round(y-height+8),width,height);}
      const L=window.LairArt;for(const s of [-1,1]){rect(ctx,x+s*52-1,y-34,3,38,'#5a3a24');L?.skull(ctx,x+s*52,y-36,1.1);rect(ctx,x+s*38-2,y-26,4,28,'#4a3a2a');const f=reducedMotion?0:Math.sin(time*11+s)*2;poly(ctx,[[x+s*38-4,y-26],[x+s*38,y-38-f],[x+s*38+4,y-26]],'#ff9b3d');light(x+s*38,y-30,70,'#ffb45a',.8,'55');}
      rect(ctx,x-1,y-86,3,40,'#4a2e1c');const sw=reducedMotion?0:Math.sin(time*2)*3;poly(ctx,[[x+2,y-86],[x+26+sw,y-82],[x+22+sw,y-66],[x+2,y-70]],'#8a1f24');L?.skull(ctx,x+13+sw*.5,y-77,.8);
      ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1a140e';ctx.strokeText(l.name.toUpperCase(),x,y-92);ctx.fillStyle='#ffd2a0';txt(ctx,l.name.toUpperCase(),x,y-92);ctx.textAlign='left';return;}
    if(l.kind==='citadel'){const art=window.GameAssets?.get('detail-cave'),width=104;if(art){const height=Math.round(width*art.height/art.width);ellipse(ctx,x,y+4,width*.45,9,'#171d2c66');ctx.drawImage(art,Math.round(x-width/2),Math.round(y-height+8),width,height);}
      for(const side of [-1,1])window.WorldTown?.totem(ctx,{homeX:side,area:side>0?'ash':'roots'},x+side*50,y+6,time,false,false);
      for(let i=0;i<5;i++)rect(ctx,x+Math.sin(time+i*2)*34,y-20-(time*12+i*11)%34,1,2,'#ffd26a');light(x,y-20,80,'#e8b04a',.6);
      ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1a140e';ctx.strokeText(l.name.toUpperCase(),x,y-76);ctx.fillStyle='#ffe2a8';txt(ctx,l.name.toUpperCase(),x,y-76);ctx.textAlign='left';return;}
    const rank=l.kind==='raid'&&V.gates?.find(g=>g.id===l.id)?.rank,gateArt=rank&&window.GameAssets?.get('gate-'+rank);
    if(gateArt){const width=84,height=Math.round(width*gateArt.height/gateArt.width),pulse=reducedMotion?0:Math.sin(time*3)*.12;ellipse(ctx,x,y+4,width*.42,8,'#1a0f2e66');ctx.globalAlpha=.35+pulse;ellipse(ctx,x,y-height*.45,width*.5,height*.5,'#9d7bff');ctx.globalAlpha=1;ctx.drawImage(gateArt,Math.round(x-width/2),Math.round(y-height+8),width,height);
      ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillStyle='#fff1cf';txt(ctx,l.name,x,y-height-1);ctx.textAlign='left';return;}
    const landmarkArt=window.GameAssets?.get('detail-'+(['cave','raid','exit'].includes(l.kind)?'cave':l.kind));
    if(landmarkArt&&['cave','raid','exit','guild'].includes(l.kind)){
      const width=l.kind==='guild'?66:94,height=Math.round(width*landmarkArt.height/landmarkArt.width);ellipse(ctx,x,y+4,width*.45,9,'#171d2c66');ctx.drawImage(landmarkArt,Math.round(x-width/2),Math.round(y-height+8),width,height);
      const flame=l.kind==='raid'?'#c5a0ed':'#ffd995';for(let i=0;i<4;i++)rect(ctx,x+Math.sin(time+i*2)*width*.32,y-20-(time*12+i*11)%30,1,2,flame);
      ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillStyle='#fff1cf';txt(ctx,l.name,x,y-height-1);ctx.textAlign='left';return;
    }
    if(['cave','raid','exit'].includes(l.kind)){
      const glow=l.kind==='raid'?'#b77dd9':l.kind==='exit'?'#f1d39b':'#78bfc7';
      ellipse(ctx,x,y+5,26,8,'#1c202c88');poly(ctx,[[x-27,y+4],[x-26,y-27],[x-15,y-43],[x+12,y-46],[x+27,y-25],[x+29,y+4]],'#535364');
      poly(ctx,[[x-16,y+3],[x-16,y-22],[x-8,y-33],[x+8,y-33],[x+17,y-20],[x+17,y+3]],'#171b29');
      ctx.strokeStyle=glow;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-13,17,Math.PI,Math.PI*2);ctx.stroke();
      for(let i=0;i<5;i++)rect(ctx,x-17+i*8,y-15-Math.sin(time*2+i)*15,2,3,glow);
      rect(ctx,x-31,y-3,4,8,'#946748');rect(ctx,x+28,y-3,4,8,'#946748');ellipse(ctx,x-29,y-7,3,6,'#ffd28c');ellipse(ctx,x+30,y-7,3,6,'#ffd28c');
      ctx.font='6px monospace';ctx.textAlign='center';ctx.fillStyle='#eee1c7';txt(ctx,l.name,x,y-52);ctx.textAlign='left';return;
    }
    if(l.kind==='guild'){rect(ctx,x-20,y-37,4,42,'#715039');rect(ctx,x+16,y-37,4,42,'#715039');rect(ctx,x-23,y-39,46,28,'#ad8859');rect(ctx,x-20,y-36,40,22,'#3c4e65');rect(ctx,x-15,y-31,12,13,'#e8d6ab');rect(ctx,x+2,y-31,12,13,'#c3ac7d');ctx.font='bold 7px monospace';ctx.fillStyle='#ffe6a1';ctx.textAlign='center';txt(ctx,'GUILDA',x,y-46);ctx.textAlign='left';window.GuildArt?.board(ctx,x,y,time,world.players[activeMe]);return;}

    if(l.kind==='deep'){ellipse(ctx,x,y+8,58,14,'#10101a66');poly(ctx,[[x-56,y+8],[x-50,y-40],[x-30,y-66],[x,y-76],[x+30,y-66],[x+50,y-40],[x+56,y+8]],'#4f4c5b');poly(ctx,[[x-50,y-40],[x-30,y-66],[x,y-76],[x+30,y-66],[x+10,y-58],[x-26,y-50]],'#6c6878');
      poly(ctx,[[x-34,y+6],[x-32,y-30],[x-18,y-48],[x+18,y-48],[x+32,y-30],[x+34,y+6]],'#0b0a12');const pulse=.5+Math.sin(time*2)*.2;ctx.globalAlpha=pulse;ellipse(ctx,x,y-10,24,20,'#ff7a2e33');ellipse(ctx,x,y-4,14,9,'#ff9a3c44');ctx.globalAlpha=1;
      for(let i=0;i<5;i++)rect(ctx,x-24+i*3,y-4+i*2,48-i*6,2,'#2a2733');for(const s of [-1,1]){rect(ctx,x+s*44-3,y-22,6,28,'#5a4535');ellipse(ctx,x+s*44,y-26,6,3,'#3b2a20');const f=Math.sin(time*12+s)*2;poly(ctx,[[x+s*44-5,y-26],[x+s*44,y-42-f],[x+s*44+5,y-26]],'#ff9b3d');poly(ctx,[[x+s*44-2,y-26],[x+s*44,y-35-f],[x+s*44+2,y-26]],'#ffe28a');}
      for(let i=0;i<4;i++)rect(ctx,x-20+i*13+Math.sin(time+i)*3,y-20-((time*10+i*9)%30),2,2,'#ffb45a');
      ctx.font='bold 7px monospace';ctx.textAlign='center';const tw=ctx.measureText(l.name).width;rect(ctx,x-tw/2-5,y-94,tw+10,13,'#1b1a26cc');ctx.fillStyle='#ffcf8a';txt(ctx,l.name,x,y-84);ctx.textAlign='left';return;}
    if(l.kind==='hoard'){const boss=world?.monsters?.['abyss:boss:'+l.area],guarded=boss&&boss.hp>0;ellipse(ctx,x,y+5,20,5,'#0b0a1266');
      for(let i=0;i<7;i++)ellipse(ctx,x-14+i*5,y+3-(i%3),4,2,'#e8b84a');if(!prop('chest',x,y+5,34)){rect(ctx,x-13,y-12,26,16,'#6b4f33');rect(ctx,x-12,y-19,24,9,'#9c7443');rect(ctx,x-2,y-11,4,6,'#f0d27a');}
      if(guarded){ctx.strokeStyle='#8f86a0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-15,y-16);ctx.lineTo(x+15,y);ctx.moveTo(x+15,y-16);ctx.lineTo(x-15,y);ctx.stroke();rect(ctx,x-3,y-10,6,6,'#b5aec2');}
      else{for(let i=0;i<3;i++)rect(ctx,x-8+i*8,y-26-((time*14+i*9)%16),2,2,'#fff1a8');light(x,y-8,60,'#ffd36b',.7);}
      return;}
    if(l.kind==='seat'){const h=V.houseById[l.house];ellipse(ctx,x,y+5,34,9,'#1f2c2544');
      if(h.noble){rect(ctx,x-30,y-30,60,34,'#b8ad97');rect(ctx,x-30,y-30,60,3,'#d7ceb4');for(let i=0;i<4;i++)rect(ctx,x-24+i*14,y-24,7,9,'#3b4a5c');rect(ctx,x-6,y-12,12,16,'#5a4032');rect(ctx,x-36,y-50,14,54,'#a39a86');rect(ctx,x+22,y-50,14,54,'#a39a86');poly(ctx,[[x-39,y-50],[x-29,y-66],[x-19,y-50]],'#6f4f4a');poly(ctx,[[x+19,y-50],[x+29,y-66],[x+39,y-50]],'#6f4f4a');for(let i=0;i<5;i++)rect(ctx,x-30+i*14,y-35,7,5,'#b8ad97');
        const wave=Math.sin(time*3)*2;rect(ctx,x-1,y-62,2,30,'#5b4a3b');poly(ctx,[[x+1,y-62],[x+17,y-58+wave],[x+1,y-52]],h.color);poly(ctx,[[x-5,y-67],[x-5,y-72],[x-2,y-69],[x,y-74],[x+2,y-69],[x+5,y-72],[x+5,y-67]],'#e8c65a');}
      else{rect(ctx,x-22,y-20,44,24,'#9b7a55');rect(ctx,x-22,y-20,44,3,'#b8946a');poly(ctx,[[x-27,y-19],[x,y-40],[x+27,y-19]],'#7b5a3c');poly(ctx,[[x-23,y-20],[x,y-37],[x+23,y-20]],'#a8834f');rect(ctx,x-5,y-10,10,14,'#4d3526');rect(ctx,x-17,y-13,7,6,'#e9d59a');rect(ctx,x+10,y-13,7,6,'#e9d59a');
        const wave=Math.sin(time*3)*2;rect(ctx,x+26,y-30,2,34,'#5b4a3b');poly(ctx,[[x+28,y-30],[x+40,y-27+wave],[x+28,y-22]],h.color);for(let i=0;i<3;i++)rect(ctx,x+14+Math.sin(time+i)*2,y-44-((time*9+i*8)%18),2,2,'#d6d2c666');}
      ctx.font='bold 6px monospace';ctx.textAlign='center';const label=h.sigil+' '+l.name,sub=h.title+' · '+h.status,tw=Math.max(ctx.measureText(label).width,ctx.measureText(sub).width);rect(ctx,x-tw/2-4,y-(h.noble?92:62),tw+8,16,'#1d2622bb');ctx.fillStyle=h.noble?'#f1d27a':'#e8dcc0';txt(ctx,label,x,y-(h.noble?85:55));ctx.font='5px monospace';ctx.fillStyle='#cfd9bd';txt(ctx,sub,x,y-(h.noble?78:48));ctx.textAlign='left';return;}
    if(l.kind==='npc')return;
    if(l.kind==='well'&&prop('well',x,y+7,60))return;
    if(l.kind==='chest'&&prop('chest',x,y+5,25))return;
    if(l.kind==='well'){ellipse(ctx,x,y+4,17,5,'#2c423144');rect(ctx,x-13,y-11,26,17,'#727b69');rect(ctx,x-15,y-15,30,6,'#c2bd95');rect(ctx,x-9,y-14,18,4,'#47666b');rect(ctx,x-17,y-35,3,29,'#836d4c');rect(ctx,x+14,y-35,3,29,'#836d4c');poly(ctx,[[x-23,y-32],[x,y-47],[x+23,y-32]],'#a77950');rect(ctx,x-24,y-33,48,3,'#735a40');return;}
    if(l.kind==='chest'){rect(ctx,x-10,y-10,20,13,'#745c3f');rect(ctx,x-9,y-16,18,8,'#b89457');rect(ctx,x-10,y-9,20,3,'#c9af6c');rect(ctx,x-2,y-9,4,5,'#e9ce86');return;}
    ellipse(ctx,x,y+4,24,8,'#3b514947');rect(ctx,x-15,y-3,30,8,'#817e76');rect(ctx,x-11,y-7,22,6,'#b7af99');rect(ctx,x-8,y-29,16,23,'#928f89');rect(ctx,x-6,y-28,12,19,'#b5b19d');poly(ctx,[[x,y-48],[x-10,y-32],[x,y-20],[x+10,y-32]],l.kind==='boss'?'#bca4d2':'#acd4b8');rect(ctx,x-1,y-39,2,11,'#e6f0d0');for(let i=0;i<4;i++)rect(ctx,x+Math.sin(time+i*1.6)*20,y-18+Math.cos(time+i)*20,2,2,'#dfeab795');
  }
  const tintFrames=new WeakMap();
  function tinted(img,color){let byColor=tintFrames.get(img);if(!byColor){byColor=new Map();tintFrames.set(img,byColor);}const key=color;if(byColor.has(key))return byColor.get(key);const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,0,0);g.globalCompositeOperation='source-atop';g.globalAlpha=.38;g.fillStyle=color;g.fillRect(0,0,c.width,c.height);byColor.set(key,c);return c;}
  function bossPlate(m,spec,x,top,time){const house=V.houseById[spec.house];ctx.font='bold 6px monospace';ctx.textAlign='center';const label=spec.name,sub=V.bossLineage(m.kind);const tw=Math.max(ctx.measureText(label).width,ctx.measureText(sub).width);rect(ctx,x-tw/2-4,top-19,tw+8,16,'#1b1a26cc');ctx.fillStyle=m.enraged?'#ffb08a':'#fff0c9';txt(ctx,label,x,top-12);ctx.font='5px monospace';ctx.fillStyle=house?.noble?'#f1cf72':house?'#c9d7b4':'#f0a98a';txt(ctx,sub,x,top-5);ctx.textAlign='left';
    if(house?.noble){const cy=top-25+Math.sin(time*2)*1;poly(ctx,[[x-7,cy+5],[x-7,cy-1],[x-4,cy+2],[x,cy-4],[x+4,cy+2],[x+7,cy-1],[x+7,cy+5]],'#e8c65a');rect(ctx,x-7,cy+4,15,2,'#b58f38');rect(ctx,x-1,cy,2,2,house.color);}}
  const caveHeights={totem:66,greatTotem:132,bat:30,spider:26,golem:44,spiderQueen:52,colossus:88,batQueen:62,wyrm:84};
  function drawBat(x,y,time,k,color,enraged){const flap=Math.sin(time*16+x-originX)*k*9,hover=Math.sin(time*3+x-originX)*k*3-12*k;ctx.save();ctx.translate(x,y+hover);
    poly(ctx,[[-3*k,-6*k],[-18*k,-12*k-flap],[-26*k,-2*k-flap*.5],[-19*k,-3*k],[-13*k,2*k],[-6*k,0]],darken(color,-30));poly(ctx,[[3*k,-6*k],[18*k,-12*k-flap],[26*k,-2*k-flap*.5],[19*k,-3*k],[13*k,2*k],[6*k,0]],darken(color,-30));
    ctx.strokeStyle=darken(color,20);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-4*k,-5*k);ctx.lineTo(-20*k,-11*k-flap);ctx.moveTo(4*k,-5*k);ctx.lineTo(20*k,-11*k-flap);ctx.stroke();
    ellipse(ctx,0,-4*k,7*k,8*k,color);poly(ctx,[[-6*k,-10*k],[-5*k,-17*k],[-2*k,-11*k]],color);poly(ctx,[[6*k,-10*k],[5*k,-17*k],[2*k,-11*k]],color);
    rect(ctx,-4*k,-7*k,2*k,2*k,enraged?'#ffdf6a':'#ff4a5a');rect(ctx,2*k,-7*k,2*k,2*k,enraged?'#ffdf6a':'#ff4a5a');rect(ctx,-2*k,-2*k,1*k,2*k,'#f3eee0');rect(ctx,1*k,-2*k,1*k,2*k,'#f3eee0');ctx.restore();ellipse(ctx,x,y+3,9*k,2.5*k,'#00000040');}
  function drawSpider(x,y,time,k,color,queen){const walk=time*10+x;ctx.strokeStyle=darken(color,-35);ctx.lineWidth=Math.max(1,1.4*k);
    for(let i=0;i<4;i++)for(const side of [-1,1]){const ph=Math.sin(walk+i*1.3+(side>0?1.5:0))*3*k,bx=x+side*5*k,by=y-9*k+i*2*k;ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+side*(11+i*1.5)*k,by-8*k+ph);ctx.lineTo(bx+side*(17+i*2)*k,y+ph*.4);ctx.stroke();}
    ellipse(ctx,x,y-12*k,11*k,9*k,darken(color,-18));ellipse(ctx,x,y-13*k,9*k,7*k,color);rect(ctx,x-1*k,y-19*k,2*k,10*k,queen?'#f0c65a':'#d7c4e8');rect(ctx,x-4*k,y-15*k,8*k,1.5*k,queen?'#f0c65a':'#d7c4e8');
    ellipse(ctx,x,y-4*k,6*k,5*k,darken(color,-28));for(const [ex,ey] of [[-3,-6],[3,-6],[-1.5,-7.5],[1.5,-7.5]])rect(ctx,x+ex*k,y+ey*k,1.5*k,1.5*k,'#ff5a4a');
    if(queen){for(let i=0;i<5;i++)poly(ctx,[[x-8*k+i*4*k,y-20*k],[x-6*k+i*4*k,y-27*k-(i%2)*3*k],[x-4*k+i*4*k,y-20*k]],'#e8c65a');}
    ellipse(ctx,x,y+2,14*k,3*k,'#00000040');}
  function drawGolem(x,y,time,k,color,enraged){const step=Math.sin(time*4+x-originX)*k*1.5;ellipse(ctx,x,y+2,16*k,4*k,'#00000055');
    rect(ctx,x-9*k,y-9*k+step,7*k,10*k,'#4b4658');rect(ctx,x+2*k,y-9*k-step,7*k,10*k,'#4b4658');
    poly(ctx,[[x-14*k,y-12*k],[x-11*k,y-30*k],[x,y-35*k],[x+11*k,y-30*k],[x+14*k,y-12*k],[x,y-8*k]],'#5c5670');poly(ctx,[[x-11*k,y-30*k],[x,y-35*k],[x+4*k,y-22*k],[x-8*k,y-16*k]],'#77708c');
    rect(ctx,x-19*k,y-28*k,6*k,16*k,'#5c5670');rect(ctx,x+13*k,y-28*k,6*k,16*k,'#5c5670');rect(ctx,x-20*k,y-13*k,8*k,6*k,'#6a6480');rect(ctx,x+12*k,y-13*k,8*k,6*k,'#6a6480');
    rect(ctx,x-6*k,y-40*k,12*k,8*k,'#6a6480');rect(ctx,x-4*k,y-37*k,3*k,2*k,enraged?'#ff8a6a':'#c9f6ff');rect(ctx,x+1*k,y-37*k,3*k,2*k,enraged?'#ff8a6a':'#c9f6ff');
    for(let i=0;i<4;i++){const cx=x-9*k+i*6*k,h=(8+(i%2)*6)*k;poly(ctx,[[cx-3*k,y-30*k],[cx,y-30*k-h],[cx+3*k,y-30*k]],i%2?color:darken(color,-20));rect(ctx,cx,y-28*k-h,1,h*.6,'#ffffffaa');}
    rect(ctx,x-3*k,y-24*k,6*k,6*k,color);}
  function drawWyrm(m,x,y,time,k){const color=V.monsterTypes[m.kind].color,segs=7;const dir=m.x>=m.homeX?-1:1;
    for(let i=segs;i>=1;i--){const sx=x+dir*i*9*k,sy=y-10*k+Math.sin(time*3-i*.8)*5*k,r=(13-i*1.2)*k;ellipse(ctx,sx,sy+r*.8,r,r*.3,'#00000033');ellipse(ctx,sx,sy,r+1.5,r*.85+1.5,'#2a0f0b');ellipse(ctx,sx,sy,r,r*.85,i%2?'#8a2e1c':'#a8391f');for(let j=-1;j<=1;j++)rect(ctx,sx+j*r*.45-1,sy-r*.1,2,2,'#ffb45a88');ellipse(ctx,sx,sy-r*.35,r*.7,r*.35,'#d9562a');if(i%2)poly(ctx,[[sx-3*k,sy-r*.8],[sx,sy-r-7*k],[sx+3*k,sy-r*.8]],'#3a1a14');}
    const hy=y-26*k+Math.sin(time*3)*3*k;ellipse(ctx,x,y+4,26*k,6*k,'#00000055');ellipse(ctx,x,hy+14*k,16.5*k,14.5*k,'#2a0f0b');ellipse(ctx,x,hy+14*k,15*k,13*k,'#a8391f');for(let i=0;i<4;i++)rect(ctx,x-9*k+i*6*k,hy+20*k,3*k,3*k,'#5a1d12');ellipse(ctx,x,hy+10*k,10*k,6*k,'#ff9a3c');
    poly(ctx,[[x-14*k,hy],[x-10*k,hy-14*k],[x,hy-18*k],[x+10*k,hy-14*k],[x+14*k,hy],[x+8*k,hy+10*k],[x-8*k,hy+10*k]],'#8a2e1c');poly(ctx,[[x-10*k,hy-12*k],[x-20*k,hy-26*k],[x-6*k,hy-15*k]],'#2e1510');poly(ctx,[[x+10*k,hy-12*k],[x+20*k,hy-26*k],[x+6*k,hy-15*k]],'#2e1510');
    rect(ctx,x-7*k,hy-6*k,4*k,3*k,m.enraged?'#fff4a0':'#ffd36b');rect(ctx,x+3*k,hy-6*k,4*k,3*k,m.enraged?'#fff4a0':'#ffd36b');poly(ctx,[[x-8*k,hy+3*k],[x,hy+13*k],[x+8*k,hy+3*k]],'#2e1510');for(let i=0;i<4;i++)poly(ctx,[[x-6*k+i*4*k,hy+3*k],[x-5*k+i*4*k,hy+6*k],[x-4*k+i*4*k,hy+3*k]],'#f3e6c8');rect(ctx,x-3*k,hy-10*k,2*k,2*k,'#2e1510');rect(ctx,x+1*k,hy-10*k,2*k,2*k,'#2e1510');
    const breath=m.windup>activeWorld.time||m.enraged;if(breath)for(let i=0;i<6;i++){const fx=x+Math.sin(time*9+i)*6*k,fy=hy+14*k+i*4*k;ellipse(ctx,fx,fy,(4-i*.4)*k,(3-i*.3)*k,i%2?'#ffd36b':'#ff7a2e');}
    for(let i=0;i<5;i++)rect(ctx,x+Math.sin(time*2+i*1.7)*30*k,y-40*k-((time*18+i*13)%40)*k,2,2,'#ffb45a');}
  const caveArt={totem:(m,x,y,t)=>{window.WorldTown?.totem(ctx,m,x,y,t,false,m.hurtAt>t-.12);light(x,y-40,60,'#e8b04a',.7);},greatTotem:(m,x,y,t)=>{window.WorldTown?.totem(ctx,m,x,y,t,true,m.hurtAt>t-.12);light(x,y-70,140,m.enraged?'#ff6a3a':'#e8b04a',.95);},bat:(m,x,y,t)=>drawBat(x,y,t,1,V.monsterTypes.bat.color,m.enraged),batQueen:(m,x,y,t)=>drawBat(x,y-6,t,2.1,V.monsterTypes.batQueen.color,m.enraged),spider:(m,x,y,t)=>drawSpider(x,y,t,1,V.monsterTypes.spider.color,false),spiderQueen:(m,x,y,t)=>drawSpider(x,y,t,2.1,V.monsterTypes.spiderQueen.color,true),golem:(m,x,y,t)=>drawGolem(x,y,t,1,V.monsterTypes.golem.color,m.enraged),colossus:(m,x,y,t)=>drawGolem(x,y,t,2.1,V.monsterTypes.colossus.color,m.enraged),wyrm:(m,x,y,t)=>drawWyrm(m,x,y,t,1.7)};
  // Facing: monsters look where they walk (so a chaser turns with you); standing still they face the nearest player.
  const facing=new Map();
  function faceLeft(m){const w=activeWorld,st=facing.get(m.id)||{x:m.x,y:m.y,left:false};const dx=m.x-st.x;
    if(Math.abs(dx)>.004)st.left=dx<0;
    else if(w){let best=null,bd=6;for(const p of Object.values(w.players)){if(p.dead||p.online===false)continue;const d=Math.hypot(p.x-m.x,p.y-m.y);if(d<bd){bd=d;best=p;}}if(best&&Math.abs(best.x-m.x)>.25)st.left=best.x<m.x;}
    st.x=m.x;st.y=m.y;facing.set(m.id,st);if(facing.size>600)facing.delete(facing.keys().next().value);return st.left;}
  // Bandits are people: drawn with the villager paper doll (dark hood, sword), facing their target.
  const BANDIT_LOOKS=[{body:'man',skin:'#c98f68',hair:'short',hairColor:'#2a1f1a',beard:'full',outfit:'coat',main:'#3b3038',accent:'#7a2a2a',hat:'hood',item:'sword',cape:true},{body:'woman',skin:'#e0b08a',hair:'ponytail',hairColor:'#1c1614',outfit:'coat',main:'#2f3a34',accent:'#6a2424',hat:'bandana',item:'sword'}];
  function bandit(m,x,y,time){const P=window.WorldPeople;if(!P)return false;const fst=facing.get(m.id),mv=fst&&Math.hypot(m.x-fst.x,m.y-fst.y)>.004,left=faceLeft(m),look=BANDIT_LOOKS[m.id.length%2],frame=mv&&!reducedMotion?1+Math.floor(time*9+m.homeX)%6:0;
    const art=P.sprite(look,left?1:2,frame,false,mv?'walk':activeWorld.time-(m.attackAt??-99)<.35?'smith':'guard');ellipse(ctx,x,y+2,10,3,'#1a292866');if(m.hurtAt>activeWorld.time-.12)ctx.globalAlpha=.55;
    ctx.drawImage(art,Math.round(x-(art.center??16)),Math.round(y-(art.foot??55)+2));ctx.globalAlpha=1;const top=y-(art.foot??55)-4;rect(ctx,x-12,top,24,4,'#252936');rect(ctx,x-11,top+1,22*Math.max(0,m.hp/m.maxHp),2,'#d0604a');return true;}
  // Monarca das Sombras: its army reuses the monster painter, recoloured as living shadow.
  const shadowScratch=typeof document!=='undefined'?document.createElement('canvas'):null;
  function shadowSoldier(c,x,y,time){if(!shadowScratch||!V.monsterTypes[c.kind])return;const S=shadowScratch,size=c.boss?300:200;if(S.width!==size){S.width=size;S.height=size;}const g=S.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.clearRect(0,0,size,size);
    const main=ctx,savedLights=lights;ctx=g;lights=[];try{monster({id:'shadow-'+c.id,kind:c.kind,x:c.x,y:c.y,homeX:c.x*7,homeY:c.y,hp:1,maxHp:1,tier:c.tier||0,hurtAt:-5,attackAt:c.attackAt??-5,dir:c.dir||0,enraged:false},size/2,size-24,time);}finally{ctx=main;lights=savedLights;}
    g.globalCompositeOperation='source-atop';g.fillStyle='#140a26e6';g.fillRect(0,0,size,size);g.globalCompositeOperation='source-over';
    ellipse(ctx,x,y+3,c.boss?20:12,4,'#3b1f7a66');const pulse=.55+Math.sin(time*3+c.x)*.2;ctx.globalAlpha=pulse*.45;ctx.drawImage(S,x-size/2-1,y-size+24,size+2,size+1);ctx.globalAlpha=1;ctx.drawImage(S,x-size/2,y-size+24);
    for(let i=0;i<3;i++){const k=(time*.7+i/3+c.x)%1;rect(ctx,x-8+i*8,y-6-k*30,2,3,`rgba(157,123,255,${.7*(1-k)})`);}
    const h=(V.monsterTypes[c.kind].size||40)*.78;rect(ctx,x-3,y-h,2,2,'#b9a2ff');rect(ctx,x+2,y-h,2,2,'#b9a2ff');}
  function monster(m,x,y,time){if(m.kind==='bandit'&&bandit(m,x,y,time))return;const spec=V.monsterTypes[m.kind],color=spec.color,bob=Math.sin(time*4+m.homeX)*2,artKind=spec.art||m.kind;ellipse(ctx,x,y+3,spec.boss?18:11,4,'#22352c4a');if(m.hp<=0)return;if(m.hurtAt>activeWorld.time-.12)ctx.globalAlpha=.5;
    if(m.windup>activeWorld.time){ctx.strokeStyle='#ff956e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,22,9,0,0,Math.PI*2);ctx.stroke();rect(ctx,x-1,y-42,3,9,'#ffdd99');}
    if(spec.boss){if(m.enraged){ctx.fillStyle='#ff5a3a'+(Math.sin(time*10)>0?'33':'1c');ctx.beginPath();ctx.ellipse(x,y-4,36,15,0,0,Math.PI*2);ctx.fill();}ctx.strokeStyle=(m.enraged?'#ff7a5a':color)+'aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-7,28,11,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<5;i++){const a=time+i*Math.PI*2/5;poly(ctx,[[x+Math.cos(a)*26,y-55+Math.sin(a)*8],[x+Math.cos(a)*26-3,y-61+Math.sin(a)*8],[x+Math.cos(a)*26+3,y-61+Math.sin(a)*8]],'#dfc693');}}
    const fst=facing.get(m.id),mv=fst&&Math.hypot(m.x-fst.x,m.y-fst.y)>.004;const pose={state:m.windup>activeWorld.time?'windup':activeWorld.time-(m.attackAt??-99)<.35?'attack':mv?'moving':'idle',seed:m.homeX};const bossArt=spec.boss&&window.GameAssets?.get('boss-'+m.kind,pose);let detailed=bossArt||window.GameAssets?.get('creature-'+artKind,pose)||window.GameAssets?.get('v3-'+(m.kind==='necromancer'?'necromancerV3':artKind),pose)||window.GameAssets?.get('detail-'+artKind,pose);let ownArt=false;{const own=window.GameAssets?.walk?.(m.kind,m.homeX),wk=own?m.kind:bossArt?m.kind:artKind,step=own||window.GameAssets?.walk?.(wk,m.homeX);if(step&&(pose.state==='moving'||own&&!bossArt))detailed=pose.state==='moving'?step:window.GameAssets.frame('mwalk-'+wk,0);else if(step&&!detailed)detailed=window.GameAssets.frame('mwalk-'+wk,0);ownArt=!!own&&!bossArt;const atkFrames=(pose.state==='windup'||pose.state==='attack')&&window.GameAssets?.frame('matk-'+m.kind,0);if(atkFrames){const since=activeWorld.time-(m.attackAt??-99);detailed=window.GameAssets.frame('matk-'+m.kind,pose.state==='windup'?Math.floor(time*6)%2:2+Math.min(1,Math.floor(since/.18)));ownArt=true;}}if(detailed&&!bossArt&&!ownArt&&spec.art&&artKind!=='yeti'&&typeof document!=='undefined')detailed=tinted(detailed,color);
    if(detailed){
      const heights={fenrir:78,patrasche:70,qilin:66,salamander:34,kitsune:52,phoenix:60,cerberus:62,nekomata:44,brambleBoar:56,mossTurtle:55,moonMoth:50,glassScorpion:54,frostLynx:58,crystalStag:69,stormHawk:57,yeti:110,goblin:46,goblinShaman:56,slime:35,wolf:48,wisp:49,scarab:39,ice:68,ember:66,necromancer:77,boss:106},bossHeights={boss:108,rootBoss:108,ashBoss:112,frostBoss:108,tideBoss:105,greatTotem:132,murk:96,grol:99,goblinKing:112,spiderQueen:115,colossus:128,batQueen:108,wyrm:143},h=bossArt?bossHeights[m.kind]:spec.size||heights[artKind]||50,w=Math.round(h*detailed.width/detailed.height),phase=time*(m.kind==='wolf'?8:3)+m.homeX;
      const hover=['wisp','necromancer'].includes(m.kind)?Math.round(Math.sin(phase)*3):0,squish=m.kind==='slime'?Math.sin(phase)*2:Math.sin(phase)*1.1;
      ctx.save();ctx.translate(Math.round(x),Math.round(y+3+hover));if(faceLeft(m))ctx.scale(-1,1);ctx.drawImage(detailed,Math.round(-w/2-squish),Math.round(-h+squish),Math.round(w+squish*2),Math.round(h-squish));ctx.restore();
      if(m.kind==='wisp'||m.kind==='ember')for(let i=0;i<4;i++)rect(ctx,x+Math.sin(time*2+i)*16,y-12-i*10+Math.sin(time*4+i)*3,1,2,color);
    }
    else if(caveArt[m.kind]){caveArt[m.kind](m,x,y,time);if(m.kind==='wyrm')light(x,y-40,150,'#ff7a2e',.9);else if(m.kind==='colossus'||m.kind==='golem')light(x,y-30,m.kind==='golem'?40:80,V.monsterTypes[m.kind].color,.5);}
    else if(m.kind==='duneWraith'){
      const sway=Math.sin(time*2+m.homeX)*3;
      ctx.save();ctx.globalAlpha=.88;
      const haze=ctx.createRadialGradient(x,y-22,3,x,y-22,29);haze.addColorStop(0,'#f9e4b899');haze.addColorStop(1,'#d4aa6b00');
      ellipse(ctx,x,y-21,28,30,haze);
      poly(ctx,[[x-4+sway,y-49],[x-15+sway,y-33],[x-11+sway,y-17],[x-22+sway,y-2],[x-5+sway,y-10],[x+3+sway,y+2],[x+17+sway,y-8],[x+11+sway,y-30],[x+5+sway,y-48]],'#b9936c');
      poly(ctx,[[x-3+sway,y-46],[x-9+sway,y-32],[x+9+sway,y-28],[x+4+sway,y-45]],'#ead0a4');
      ellipse(ctx,x-5+sway,y-28,2,3,'#2d2029');ellipse(ctx,x+5+sway,y-28,2,3,'#2d2029');
      for(let i=0;i<4;i++)ellipse(ctx,x+Math.sin(time*2+i*2)*16,y-4-i*8,2,1,'#f6dfb7aa');
      ctx.restore();
    }
    else if(m.kind==='glacierHound'){
      const stride=Math.sin(time*8+m.homeX)*3;
      ellipse(ctx,x-2,y-17,17,12,'#739bae');
      poly(ctx,[[x-12,y-24],[x-19,y-34],[x-10,y-31],[x-5,y-23]],'#bde8ee');
      poly(ctx,[[x-2,y-25],[x+5,y-39],[x+12,y-28],[x+8,y-21]],'#d6f4f5');
      poly(ctx,[[x+7,y-28],[x+20,y-33],[x+24,y-22],[x+16,y-16],[x+9,y-18]],'#a8d6e4');
      poly(ctx,[[x+13,y-34],[x+16,y-44],[x+21,y-33]],'#d6f4f5');
      ellipse(ctx,x+17,y-25,2,2,'#213342');
      for(const sx of [-11,5]){rect(ctx,x+sx,y-10+stride*(sx<0?1:-1),4,10,'#7fa8ba');rect(ctx,x+sx+7,y-10-stride*(sx<0?1:-1),4,10,'#9bc7d5');}
      poly(ctx,[[x-17,y-21],[x-28,y-29],[x-22,y-14]],'#9ac6d4');
    }
    else if(m.kind==='ice'){for(let i=0;i<5;i++){const dx=(i-2)*6;poly(ctx,[[x+dx-5,y-6],[x+dx,y-37+(i%2)*10],[x+dx+7,y-5]],i%2?'#81b9cf':'#c1edf1');}rect(ctx,x-8,y-20,17,14,'#6893bb');rect(ctx,x-6,y-18,4,3,'#eaffff');rect(ctx,x+3,y-18,4,3,'#eaffff');rect(ctx,x-10,y-2,6,5,'#507a9f');rect(ctx,x+5,y-2,6,5,'#507a9f');}
    else if(m.kind==='scarab'){for(let i=0;i<3;i++){const step=Math.sin(time*7+i)*3;poly(ctx,[[x-8,y-14+i*5],[x-20,y-19+i*8+step],[x-15,y-12+i*7]],'#83654e');poly(ctx,[[x+8,y-14+i*5],[x+20,y-19+i*8-step],[x+15,y-12+i*7]],'#83654e');}ellipse(ctx,x,y-12,13,16,'#695a44');ellipse(ctx,x,y-14,11,13,'#d4aa63');rect(ctx,x-1,y-26,2,25,'#806944');rect(ctx,x-7,y-22,3,13,'#efce88');poly(ctx,[[x-5,y-27],[x-8,y-36],[x,y-30],[x+8,y-36],[x+5,y-27]],'#b39054');rect(ctx,x-5,y-28,2,2,'#f1e9af');rect(ctx,x+4,y-28,2,2,'#f1e9af');}
    else if(m.kind==='wolf'){rect(ctx,x-14,y-16,25,14,'#566255');rect(ctx,x-12,y-17,22,12,color);rect(ctx,x-10+Math.sin(time*8)*2,y-4,4,7,'#776f5c');rect(ctx,x+5-Math.sin(time*8)*2,y-4,4,7,'#776f5c');rect(ctx,x-8,y-17,15,2,'#e0d9b9');rect(ctx,x+7,y-21,11,12,color);poly(ctx,[[x+8,y-20],[x+9,y-29],[x+14,y-21]],'#8b8e77');rect(ctx,x+13,y-19,2,2,'#414b3f');rect(ctx,x-18,y-18,6,5,color);}
    else if(m.kind==='ember'){for(let i=0;i<5;i++){const dx=(i-2)*5;poly(ctx,[[x+dx-5,y-1],[x+dx-2,y-30-Math.sin(time*8+i)*7],[x+dx+7,y-4]],i%2?'#ef913e':'#b94b40');}ellipse(ctx,x,y-10,8,10,'#ffd26d');rect(ctx,x-4,y-14,3,3,'#572e32');rect(ctx,x+3,y-14,3,3,'#572e32');}
    else if(m.kind==='wisp'){ctx.strokeStyle='#c7a7f399';ctx.beginPath();ctx.ellipse(x,y-13,16,6,time,0,Math.PI*2);ctx.stroke();poly(ctx,[[x,y-31+bob],[x-10,y-10+bob],[x-5,y+1+bob],[x+8,y-2+bob],[x+11,y-12+bob]],darken(color,-20));rect(ctx,x-6,y-17+bob,13,12,color);rect(ctx,x-3,y-18+bob,6,9,darken(color,28));rect(ctx,x-4,y-9+bob,2,2,'#4b4a60');rect(ctx,x+4,y-9+bob,2,2,'#4b4a60');}
    else if(spec.boss||m.kind==='necromancer'){
      const art=window.GameAssets?.get('world-0-3');
      if(art){const h=spec.boss?98:67,w=h*art.width/art.height;ctx.drawImage(art,x-w/2,y-h+4+bob,w,h);}
      else {
      const scale=spec.boss?1.6:1;ctx.save();ctx.translate(x,y+bob);ctx.scale(scale,scale);
      poly(ctx,[[-8,-28],[8,-28],[17,-1],[6,-4],[1,2],[-5,-3],[-16,0]],'#302b42');
      poly(ctx,[[-8,-25],[-1,-23],[-4,-4],[-12,-1]],'#4b435e');
      rect(ctx,-8,-39,17,15,'#d7c796');rect(ctx,-7,-35,5,5,'#302b42');rect(ctx,3,-35,5,5,'#302b42');rect(ctx,-2,-28,4,3,'#806c55');
      poly(ctx,[[-8,-35],[-15,-44],[-12,-51],[-11,-42],[-4,-40]],'#5a4869');poly(ctx,[[7,-37],[14,-49],[14,-39],[9,-32]],'#5a4869');
      rect(ctx,-9,-24,19,3,'#bd9558');rect(ctx,-2,-21,3,11,'#aa864c');
      rect(ctx,-18,-17,2,8,'#ae8b5e');rect(ctx,-21,-10,8,9,'#99704a');rect(ctx,-19,-8,4,5,'#ffdd7f');
      for(let i=0;i<4;i++)rect(ctx,8+i*3,-36-i*3+Math.sin(time*3+i)*2,5,5,'#8cd8cc');
      ctx.restore();}
    }
    else {const squish=Math.sin(time*3+m.homeX)*1.5;rect(ctx,x-13,y-12+squish,26,12-squish,darken(color,-28));rect(ctx,x-11,y-17+squish,22,15-squish,color);rect(ctx,x-7,y-20+squish,14,8,color);rect(ctx,x-7,y-16+squish,6,3,darken(color,28));rect(ctx,x-6,y-9,3,3,'#3c5447');rect(ctx,x+5,y-9,3,3,'#3c5447');rect(ctx,x-1,y-5,4,1,'#667e52');ellipse(ctx,x-6,y-15+squish,3,2,'#eaf5b8');rect(ctx,x+10,y-5,2,2,'#c6e994');if(m.kind==='scarab'){rect(ctx,x-16,y-10,4,2,'#756646');rect(ctx,x+12,y-10,4,2,'#756646');}}
    if(m.shield&&activeWorld?.monsters?.[m.shield]?.hp>0){ctx.globalAlpha=.22+Math.sin(time*4)*.08;ellipse(ctx,x,y-30,34,42,'#f3d56a');ctx.globalAlpha=.8;ctx.strokeStyle='#ffe7a0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y-30,34,42,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<6;i++){const a=time*1.5+i*Math.PI/3;rect(ctx,x+Math.cos(a)*34,y-30+Math.sin(a)*42,2,2,'#fff2c0');}}
    ctx.globalAlpha=1;if(m.hp<m.maxHp||m.raid){const top=y-(detailed?spec.size?spec.size+7:({yeti:110,goblin:46,goblinShaman:56,slime:35,wolf:48,wisp:49,scarab:39,ice:68,ember:66,necromancer:77,boss:106}[artKind]+7):(caveHeights[m.kind]||34)),bw=spec.boss?44:30;rect(ctx,x-bw/2,top,bw,4,'#252936');rect(ctx,x-bw/2+1,top+1,(bw-2)*Math.max(0,m.hp/m.maxHp),2,spec.boss?(m.enraged?'#ff7a5a':'#e6c15f'):'#dbad80');}if(spec.boss)bossPlate(m,spec,x,y+42,time);
  }
  const oreSprites=new Map();
  function oreArt(tier){if(oreSprites.has(tier))return oreSprites.get(tier);const base=window.GameAssets?.get('v3-'+(tier<6?'oreMetal':'oreCrystal'));if(!base)return null;const out=surface(44,48),g=out.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(base,0,0,44,48);const pixels=g.getImageData(0,0,44,48),d=pixels.data,c=V.materialColors[tier],rgb=[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];for(let i=0;i<d.length;i+=4){const mineral=tier<6?d[i]>d[i+2]*1.35&&d[i]>d[i+1]*1.12:d[i+2]>d[i]*1.3&&d[i+2]>d[i+1]*1.1;if(mineral){const lum=Math.max(d[i],d[i+1],d[i+2])/220;for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(rgb[k]*lum));}}g.putImageData(pixels,0,0);oreSprites.set(tier,out);return out;}
  function grimoire(q,x,y,time){if(!['mago','necromante'].includes(q.classId))return;const art=window.GameAssets?.get('v3-grimoire');if(!art)return;const d=[[0,1],[-1,0],[1,0],[0,-1]][q.dir]||[0,1],cast=activeWorld.time-q.attackAt>=0&&activeWorld.time-q.attackAt<.48,xx=x+d[0]*17,yy=y-20+d[1]*6+Math.round(Math.sin(time*3)*2);ctx.drawImage(art,xx-13,yy-12,26,26);if(cast){for(let i=0;i<5;i++)rect(ctx,xx+Math.sin(i*1.8+time*5)*15,yy-6-i*3,1,2,q.classId==='mago'?'#ffdb82':'#9af4d3');}}
  function meleeEffect(e,x,y,age){const t=age/.48;if(t>1)return;const dir=[[0,1],[-1,0],[1,0],[0,-1]][e.text]||[0,1],angle=Number.isFinite(e.targetX)?Math.atan2(e.targetY-e.y,e.targetX-e.x):Math.atan2(dir[1],dir[0]),id=e.classId,heavy=id==='berserker',shield=id==='guardiao',holy=id==='paladino';const swing=t<.2?-1.7-t: t<.5?-1.9+(t-.2)*10:1.1-(t-.5)*.8;
    ctx.save();ctx.translate(x,y-18);ctx.rotate(angle);if(t>.2&&t<.65){const radius=heavy?35:30,pts=[];for(let i=0;i<=12;i++){const a=-1.65+i*.24;pts.push([Math.cos(a)*radius,Math.sin(a)*radius]);}for(let i=12;i>=0;i--){const a=-1.65+i*.24;pts.push([Math.cos(a)*(radius-3-i*.5),Math.sin(a)*(radius-3-i*.5)]);}poly(ctx,pts,heavy?'#ff9778':holy?'#ffe392':'#fff2d5');}
    ctx.rotate(swing);rect(ctx,4,-2,26,4,'#2b283f');rect(ctx,10,-2,22,2,holy?'#ffe7a7':'#dce9e9');rect(ctx,10,0,20,2,'#9dabc6');rect(ctx,8,-6,3,12,'#c39755');rect(ctx,1,-2,7,4,'#624133');if(heavy){poly(ctx,[[23,-2],[21,-11],[34,-9],[36,9],[22,11],[25,2]],'#aab6c6');rect(ctx,33,-8,2,15,'#f0e1ce');}if(shield){poly(ctx,[[10,-10],[23,-8],[25,5],[17,13],[9,5]],'#7195b0');rect(ctx,16,-7,2,15,'#dfc589');}if(id==='ladino'){rect(ctx,3,8,16,3,'#d1b6e5');rect(ctx,5,5,2,9,'#ae854e');}ctx.restore();
    if(t>.3&&t<.6){const xx=Number.isFinite(e.targetX)?x+(e.targetX-e.x)*32:x+dir[0]*30,yy=Number.isFinite(e.targetY)?y+(e.targetY-e.y)*32-15:y-15+dir[1]*30;for(let i=0;i<7;i++){const a=i*2.4;rect(ctx,xx+Math.cos(a)*t*25,yy+Math.sin(a)*t*25,2,2,holy?'#ffe492':'#f6c47b');}}
  }
  function pixelFlame(x,y,size,frame){const colors=['#743044','#c95335','#f4933e','#ffd66e','#fff2bc'];for(let i=0;i<5;i++){const r=size*(1-i*.17);poly(ctx,[[x-r,y+r*.4],[x-r*.8,y-r*.45],[x-r*.35,y-r*.9],[x-r*.15,y-r*(1.5+(frame%3)*.18)],[x+r*.15,y-r*.6],[x+r*.55,y-r],[x+r,y],[x+r*.65,y+r*.45]],colors[i]);}}
  // Grimoire spells: each school has its own motion and palette.
  function spellEffect(e,x,y,age,ox,oy){
    const t=Math.min(1,age/1.1),hits=(e.hits||[]).map(h=>({x:h.x*32+ox,y:h.y*32+oy-18})),col=e.color,sy=y-20;
    const spark=(px,py,n,r,c2)=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2+age*3,d=r*(.4+age);rect(ctx,px+Math.cos(a)*d,py+Math.sin(a)*d*.6,2,2,c2);}};
    const ring=(px,py,r,c2,w=2)=>{ctx.strokeStyle=c2;ctx.lineWidth=w;ctx.beginPath();ctx.ellipse(px,py,r,r*.45,0,0,Math.PI*2);ctx.stroke();};
    // Casting circle under the caster for every spell.
    if(age<.5){ctx.save();ctx.globalAlpha*=1-age*2;ring(x,y+2,14+age*20,col);for(let i=0;i<6;i++){const a=i*Math.PI/3+age*4;rect(ctx,x+Math.cos(a)*(16+age*20),y+2+Math.sin(a)*(7+age*9),2,2,'#fff6d8');}ctx.restore();}
    const shadowFx=['adaga','troca','autoridade','dominio','furtividade'].includes(e.spell);
    if(shadowFx){const pts=hits.length?hits:[{x,y:sy}],frame=window.GameAssets?.frame?.('fx-'+e.spell,Math.min(7,Math.floor(t*8)));
      for(const h of pts){if(frame){const hh=Math.min(90,frame.height),ww=Math.round(hh*frame.width/frame.height);ctx.drawImage(frame,Math.round(h.x-ww/2),Math.round(h.y+22-hh),ww,hh);continue;}
        if(e.spell==='adaga'){ctx.strokeStyle=col;ctx.lineWidth=2;for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(h.x-16+i*8,h.y-14);ctx.lineTo(h.x+16-i*8,h.y+10);ctx.stroke();}spark(h.x,h.y,8,10,'#e6dcff');}
        else if(e.spell==='troca'){ring(h.x,h.y+20,14+age*10,col,2);for(let i=0;i<6;i++){const k=(age*1.5+i/6)%1;rect(ctx,h.x-12+i*5,h.y+18-k*34,2,4,'#1a0f2e');}}
        else if(e.spell==='autoridade'){ring(x,y,(e.radius||5.5)*32*(1-t),col,2);rect(ctx,h.x-2,h.y-2,4,4,'#c9b8ff');}
        else if(e.spell==='dominio'){ring(h.x,h.y+20,10+age*16,col,2);for(let i=0;i<3;i++)rect(ctx,h.x-5+i*4,h.y-10-age*14-(i===1?3:0),2,4,'#b9a2ff');}
        else {ctx.globalAlpha*=.6;ellipse(ctx,h.x,h.y+4,16,22,'#140a26');for(let i=0;i<8;i++){const k=(age*1.2+i/8)%1;rect(ctx,h.x-14+i*4,h.y+20-k*40,2,3,col);}}}
      return;}
    switch(e.spell){
      case'learn':for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=10+age*40;rect(ctx,x+Math.cos(a)*r,sy-age*30+Math.sin(a)*r*.4,2,3,i%2?col:'#fff6d8');}ring(x,y,10+age*50,col,3);break;
      case'fagulha':{const h=hits[0];if(!h)break;const k=Math.min(1,age/.28),px=x+(h.x-x)*k,py=sy+(h.y-sy)*k-Math.sin(k*Math.PI)*22;for(let i=0;i<6;i++){const b=Math.max(0,k-i*.05);rect(ctx,x+(h.x-x)*b-1,sy+(h.y-sy)*b-Math.sin(b*Math.PI)*22-1,3-i*.3,3-i*.3,i?col:'#ffffff');}if(k>=1)spark(h.x,h.y,10,12,col);ellipse(ctx,px,py,5,5,col+'88');break;}
      case'cura':for(const h of hits){for(let i=0;i<8;i++){const k=(age*1.4+i/8)%1,px=h.x+Math.sin(i*2.1)*14,py=h.y+18-k*40;ctx.globalAlpha=Math.max(0,1-k);rect(ctx,px-1,py-3,2,7,'#fff1a8');rect(ctx,px-3,py-1,7,2,'#fff1a8');}ctx.globalAlpha=1;ring(h.x,h.y+20,12+age*12,'#fff1a8');}break;
      case'gelo':{const r=(e.radius||2.8)*32*Math.min(1,age/.35);ring(x,y,r,'#e9fbff',3);ring(x,y,r*.8,col,1);for(let i=0;i<16;i++){const a=i/16*Math.PI*2;poly(ctx,[[x+Math.cos(a)*r,y+Math.sin(a)*r*.45],[x+Math.cos(a)*(r-10),y+Math.sin(a)*(r-10)*.45-12],[x+Math.cos(a+.08)*(r-4),y+Math.sin(a+.08)*(r-4)*.45]],i%2?'#e9fbff':col);}for(const h of hits)spark(h.x,h.y,6,8,'#e9fbff');break;}
      case'raio':{if(!hits.length)break;ctx.strokeStyle=Math.sin(age*60)>0?'#ffffff':col;ctx.lineWidth=2;ctx.beginPath();let px=x,py=sy;ctx.moveTo(px,py);for(const h of hits){for(let s2=1;s2<=4;s2++){const k=s2/4;ctx.lineTo(px+(h.x-px)*k+(s2<4?(V.hash(s2,Math.floor(age*20))-.5)*16:0),py+(h.y-py)*k+(s2<4?(V.hash(Math.floor(age*20),s2)-.5)*16:0));}px=h.x;py=h.y;}ctx.stroke();for(const h of hits)ellipse(ctx,h.x,h.y,6+Math.sin(age*40)*2,6,col+'88');break;}
      case'egide':{const r=26,pulse=Math.sin(age*10)*2;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=6;i++){const a=i*Math.PI/3+age;ctx[i?'lineTo':'moveTo'](x+Math.cos(a)*(r+pulse),sy+Math.sin(a)*(r+pulse)*.9);}ctx.stroke();ctx.globalAlpha*=.25;ellipse(ctx,x,sy,r,r*.9,col);break;}
      case'vento':for(const h of hits)for(let i=0;i<5;i++){const k=(age*2+i*.2)%1,px=h.x-30+k*60,py=h.y+10-i*6;rect(ctx,px,py,14,1,'#e9fff2');rect(ctx,px+4,py+2,8,1,col);}break;
      case'totem':for(const h of hits){for(let i=0;i<4;i++){const a=age*3+i*Math.PI/2,px=h.x+Math.cos(a)*18,py=h.y+Math.sin(a)*8;rect(ctx,px-3,py-6,6,8,'#5a4232');rect(ctx,px-2,py-5,4,2,col);rect(ctx,px-2,py-2,1,1,'#fff2c0');rect(ctx,px+1,py-2,1,1,'#fff2c0');}ring(h.x,h.y+18,16+age*14,col,2);}break;
      case'raizes':for(const h of hits)for(let i=0;i<5;i++){const a=i/5*Math.PI*2,grow=Math.min(1,age/.3)*18,bx=h.x+Math.cos(a)*10,by=h.y+18+Math.sin(a)*4;ctx.strokeStyle=i%2?'#4f7a3f':col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx+Math.cos(a)*6,by-grow*.6,h.x+Math.cos(a+1)*4,h.y+18-grow);ctx.stroke();if(i%2)rect(ctx,h.x+Math.cos(a+1)*4,h.y+17-grow,3,2,'#8fd06a');}break;
      case'pacto':{const h=hits[0];if(!h)break;for(let i=0;i<10;i++){const k=((age*1.6)+i/10)%1,px=h.x+(x-h.x)*k+Math.sin(k*9+i)*8,py=h.y+(sy-h.y)*k+Math.cos(k*7+i)*6;rect(ctx,px,py,3,3,i%3?col:'#2a1438');}ellipse(ctx,h.x,h.y,8+Math.sin(age*20)*2,8,'#3a1a5a88');break;}
      case'meteoro':{const h=hits[0];if(!h)break;if(window.GameAssets?.frame?.('fx-meteoro',0)){ctx.save();ctx.globalCompositeOperation='lighter';if(age<.4){const k=age/.4,art=window.GameAssets.frame('fx-meteoro',Math.min(3,Math.floor(k*4)));ctx.drawImage(art,Math.round(h.x-120*(1-k)-70),Math.round(h.y-220*(1-k)-70),140,140);}else if(age<1.1){const art=window.GameAssets.frame('fx-meteoro',4+Math.min(3,Math.floor((age-.4)/.7*4)));ctx.globalAlpha=age>.95?(1.1-age)/.15:1;ctx.drawImage(art,Math.round(h.x-80),Math.round(h.y-80),160,160);}ctx.restore();break;}if(age<.4){const k=age/.4,px=h.x+120*(1-k),py=h.y-220*(1-k);for(let i=0;i<8;i++)ellipse(ctx,px+i*6,py-i*11,7-i*.7,7-i*.7,i?'#ffb45a':'#fff2c0');}else{const k=(age-.4)/.7,r=(e.radius||3)*32*Math.min(1,k*1.6);ring(h.x,h.y+18,r,'#ffe08a',4);ring(h.x,h.y+18,r*.7,col,2);ctx.globalAlpha*=Math.max(0,1-k);ellipse(ctx,h.x,h.y+8,r*.5,r*.3,'#ff7a2e');for(let i=0;i<14;i++){const a=i/14*Math.PI*2;rect(ctx,h.x+Math.cos(a)*r*.8,h.y+18+Math.sin(a)*r*.35-k*20,3,3,i%2?'#ffd36b':'#ff5a2a');}light(h.x,h.y,160,'#ff7a2e',1);}break;}
    }
  }
  // "Ergam-se!": a shadow soldier climbs out of a violet portal where the monster fell (assets/fx-arise.png, 8 frames).
  function ariseEffect(x,y,age){const t=Math.min(1,age/1.3),art=window.GameAssets?.frame?.('fx-arise',Math.min(7,Math.floor(t*8)));
    if(art){const h=Math.min(96,art.height),w=Math.round(h*art.width/art.height);ctx.drawImage(art,Math.round(x-w/2),Math.round(y-h+10),w,h);}
    else{const open=Math.min(1,age*3)*(1-Math.max(0,t-.75)*4);ctx.globalAlpha=Math.max(0,open);ellipse(ctx,x,y+2,22*open,8*open,'#12081f');ctx.strokeStyle='#9d7bff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+2,22*open,8*open,0,0,Math.PI*2);ctx.stroke();
      const rise=Math.min(1,age*1.4);ctx.globalAlpha=Math.max(0,open)*.9;ellipse(ctx,x,y-8-rise*16,9,6+rise*14,'#140a26');rect(ctx,x-4,y-14-rise*26,2,2,'#c7b2ff');rect(ctx,x+2,y-14-rise*26,2,2,'#c7b2ff');
      for(let i=0;i<6;i++){const k=(age*1.3+i/6)%1;rect(ctx,x-18+i*7,y-k*44,2,3,`rgba(157,123,255,${(.8*(1-k)).toFixed(2)})`);}}
    ctx.globalAlpha=Math.max(0,1-age/1.3);ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillStyle='#1a0f2e';txt(ctx,'ERGAM-SE!',x+1,y-58-age*12+1);ctx.fillStyle='#b9a2ff';txt(ctx,'ERGAM-SE!',x,y-58-age*12);ctx.textAlign='left';ctx.globalAlpha=1;}
  function classEffect(e,x,y,age){
    const c=V.classById[e.classId],skill=e.type==='skill';if(!skill&&c.id==='mago'&&e.type==='projectile'&&window.GameAssets?.frame?.('fx-fireball',0)){const t=age/.5;if(t>=1)return;const d=[[0,1],[-1,0],[1,0],[0,-1]][e.text]||[0,1],tx=Number.isFinite(e.targetX)?(e.targetX-e.x)*32:d[0]*45,ty=Number.isFinite(e.targetY)?(e.targetY-e.y)*32:d[1]*45,fly=.55;ctx.save();ctx.globalCompositeOperation='lighter';if(t<fly){const k=t/fly,art=window.GameAssets.frame('fx-fireball',Math.floor(age*16)%4);ctx.translate(x+tx*k,y-14+ty*k);ctx.rotate(Math.atan2(ty,tx));ctx.drawImage(art,-32,-32,64,64);}else{const art=window.GameAssets.frame('fx-fireball',4+Math.min(3,Math.floor((t-fly)/(1-fly)*4)));ctx.drawImage(art,Math.round(x+tx-45),Math.round(y-14+ty-45),90,90);}ctx.restore();return;}if(skill){const fx=window.GameAssets?.frame?.('fx-'+c.id,0);if(fx){const t=age/1.1;if(t>=1)return;const art=window.GameAssets.frame('fx-'+c.id,Math.min(7,Math.floor(t*8))),size=150;ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=t>.85?(1-t)/.15:1;ctx.drawImage(art,Math.round(x-size/2),Math.round(y-14-size/2),size,size);ctx.restore();return;}}if(!skill&&['guerreiro','berserker','guardiao','paladino','ladino'].includes(c.id)){meleeEffect(e,x,y,age);return;}const t=Math.min(1,age/(skill?1.1:.5));if(t>=1)return;
    const d=[[0,1],[-1,0],[1,0],[0,-1]][e.text]||[0,1],dx=Number.isFinite(e.targetX)?(e.targetX-e.x)*32:d[0]*45,dy=Number.isFinite(e.targetY)?(e.targetY-e.y)*32:d[1]*45;
    ctx.save();ctx.translate(x,y-14);ctx.strokeStyle=c.color;ctx.fillStyle=c.color;ctx.lineWidth=skill?3:2;ctx.globalAlpha=1-t;
    const radius=(skill?25:10)+t*(skill?65:23),arc=(r,a,b)=>{ctx.beginPath();ctx.arc(0,0,r,a,b);ctx.stroke();},line=(a,b,c,d)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();};
    switch(c.id){
      case 'guardiao': poly(ctx,[[-radius*.6,-radius],[radius*.6,-radius],[radius*.6,0],[0,radius*.5],[-radius*.6,0]],'#779fc488');arc(radius,-2.5,.5);break;
      case 'guerreiro': ctx.rotate(Math.atan2(dy,dx));arc(radius,-1+t,1+t);line(0,0,radius,0);if(skill)for(let i=0;i<5;i++)line(i*12,0,i*12+8,(i%2?1:-1)*18);break;
      case 'arqueiro': for(let i=0;i<(skill?9:1);i++){const ax=skill?(i-4)*12:dx*t,ay=skill?-80+t*110+Math.abs(i-4)*5:dy*t;line(ax-8,ay-12,ax,ay);poly(ctx,[[ax,ay],[ax-6,ay-2],[ax-1,ay-7]],'#f2dfa5');}break;
      case 'mago': {const progress=Math.min(1,t*1.6),ax=skill?0:dx*progress,ay=skill?0:dy*progress;for(let i=4;i>=0;i--){const trail=Math.max(0,progress-i*.045);pixelFlame(skill?Math.sin(i*2)*radius:dx*trail,skill?Math.cos(i*2)*radius*.45:dy*trail,(skill?13:8)-i,Math.floor(age*18)+i);}pixelFlame(ax,ay,skill?radius*.5:10,Math.floor(age*18));break;}
      case 'ladino': ctx.strokeStyle='#c9a5f1';line(-radius,-radius,radius,radius);line(radius,-radius,-radius,radius);arc(radius,2+t,3+t);break;
      case 'clerigo': rect(ctx,-3,-radius,6,radius*2,'#fff0ba');rect(ctx,-radius,-3,radius*2,6,'#f9dc91');arc(radius,0,Math.PI*2);break;
      case 'druida': for(let i=0;i<6;i++){const a=i*Math.PI/3+t;line(0,0,Math.cos(a)*radius,Math.sin(a)*radius);ellipse(ctx,Math.cos(a)*radius,Math.sin(a)*radius,5,9,'#87cf8d');}break;
      case 'berserker': ctx.strokeStyle='#f77765';for(let i=0;i<3;i++)arc(radius-i*7,t*8+i,t*8+i+2.5);break;
      case 'paladino': ctx.strokeStyle='#f5ce69';arc(radius,0,Math.PI*2);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(Math.cos(a)*radius*.6,Math.sin(a)*radius*.6,Math.cos(a)*radius,Math.sin(a)*radius);}break;
      case 'necromante': for(let i=0;i<5;i++){const a=t*7+i*1.25,r=radius*(1-t);ellipse(ctx,dx*t+Math.cos(a)*r,dy*t+Math.sin(a)*r,4,6,'#99dfbd');}arc(radius,-2+t,1+t);break;
      case 'bardo': for(let i=0;i<3;i++){arc(radius+i*8,-1,1);const ax=Math.cos(i*2+t)*radius,ay=Math.sin(i*2+t)*radius;ellipse(ctx,ax,ay,4,3,'#f6c4a4');line(ax+3,ay,ax+3,ay-14);}break;
      case 'monarca': for(let i=0;i<7;i++){const a=i*Math.PI*2/7+t*2,r=radius*(.35+t*.65);ellipse(ctx,Math.cos(a)*r,Math.sin(a)*r*.5,4,9,'#7a5cffaa');rect(ctx,Math.cos(a)*r-2,Math.sin(a)*r*.5-7,1,1,'#e6dcff');rect(ctx,Math.cos(a)*r+1,Math.sin(a)*r*.5-7,1,1,'#e6dcff');}ctx.strokeStyle='#9d7bff';arc(radius,0,Math.PI*2);break;
      case 'artifice': ctx.rotate(t*3);for(let i=0;i<8;i++){const a=i*Math.PI/4;rect(ctx,Math.cos(a)*radius-3,Math.sin(a)*radius-3,6,6,'#dfb67c');}arc(radius*.8,0,Math.PI*2);line(-radius,0,radius,0);line(0,-radius,0,radius);break;
    }
    ctx.restore();
  }
  let activeMe=null;
  function reflections(world,people,ox,oy,left,top,right,bottom,options){
    if(options.quality==='low'||options.effects===false)return;
    let budget=8;const time=options.reducedMotion?0:world.time;
    for(const q of [...Object.values(world.players),...people]){
      if(!budget||q.dead||q.online===false||V.dungeonAt(q.x,q.y)||q.x<left||q.x>right||q.y<top||q.y>bottom)continue;
      const cells=[];for(let dy=0;dy<3;dy++)for(let dx=-1;dx<=1;dx++){const tx=Math.floor(q.x)+dx,ty=Math.floor(q.y)+dy;if(tile(tx,ty,world).kind==='water')cells.push([tx,ty]);}
      if(!cells.length)continue;budget--;
      const f=q.look?WorldPeople.frameFor(q,time):null,art=q.look?WorldPeople.sprite(q.look,q.dir||0,f.frame,f.blink,f.action):sprite(q.classId,q.dir,0,q.appearance||'female');
      const center=art.center??art.width/2,foot=art.foot??art.height-4,x=q.x*32+ox,y=q.y*32+oy+2;
      ctx.save();ctx.beginPath();for(const [tx,ty]of cells)ctx.rect(tx*32+ox,ty*32+oy,32,32);ctx.clip();ctx.globalAlpha=.2;
      for(let row=0;row<Math.ceil(art.height*.4);row+=4){ctx.save();ctx.beginPath();ctx.rect(x-art.width,y+row,art.width*2,4);ctx.clip();ctx.translate(Math.round(x+Math.sin(time*2+row*.5)*1.5),y);ctx.scale(1,-.4);ctx.drawImage(art,-center,-foot);ctx.restore();}ctx.restore();
    }
  }
  function render(world,me,options={}){activeMe=me;
    if(options.online){
      const players={},blend=1-Math.exp(-18*(options.dt||1/60));
      for(const q of Object.values(world.players)){if(q.id===me){players[q.id]=q;continue;}let shown=displayPositions.get(q.id);if(!shown||Math.hypot(shown.x-q.x,shown.y-q.y)>4)shown={x:q.x,y:q.y};shown.x+=(q.x-shown.x)*blend;shown.y+=(q.y-shown.y)*blend;displayPositions.set(q.id,shown);players[q.id]={...q,x:shown.x,y:shown.y};}
      for(const id of displayPositions.keys())if(!players[id]&&!String(id).startsWith('m:'))displayPositions.delete(id);
      // Monsters arrive ~14 times a second: glide between updates like other players.
      const monsters={};for(const [id,m] of Object.entries(world.monsters||{})){const key='m:'+id;let shown=displayPositions.get(key);if(!shown||Math.hypot(shown.x-m.x,shown.y-m.y)>3)shown={x:m.x,y:m.y};shown.x+=(m.x-shown.x)*blend;shown.y+=(m.y-shown.y)*blend;shown.seen=world.time;displayPositions.set(key,shown);monsters[id]={...m,x:shown.x,y:shown.y};}
      for(const [id,v] of displayPositions)if(String(id).startsWith('m:')&&!world.monsters?.[id.slice(2)])displayPositions.delete(id);
      world={...world,players,monsters};
    }else displayPositions.clear();
    if(seed!==world.seed){seed=world.seed;tileCache.clear();clearChunks();}{const q=world.players[me];if(q&&!worldBase&&!(q.x>=0&&q.y>=0&&q.x<V.SIZE&&q.y<V.SIZE))buildWorldBase(world,1.2);}chunkBudget=1;chunkQuality=options.quality||'medium';
    // Ultra renders the world at twice the internal resolution so detailed sprites stay sharp (capped for huge screens).
    const width=Math.ceil(innerWidth/zoom),height=Math.ceil(innerHeight/zoom),ks=quality==='ultra'&&width*height*4<=4.2e6?2:1;if(canvas.width!==width*ks||canvas.height!==height*ks){canvas.width=width*ks;canvas.height=height*ks;}ctx.setTransform(ks,0,0,ks,0,0);ctx.imageSmoothingEnabled=false;
    reducedMotion=!!options.reducedMotion;const p=world.players[me]||{x:128.5,y:129.5};if(Math.hypot(camera.x-p.x*32,camera.y-p.y*32)>1280)camera={x:p.x*32,y:p.y*32};camera.x+=(p.x*32-camera.x)*.13;camera.y+=(p.y*32-camera.y)*.13;
    if(options.home){camera.x=128.5*32+(reducedMotion?0:Math.sin(world.time*.035)*32);camera.y=128*32;}
    const ox=Math.round(width/2-camera.x),_o=(originX=ox,window.WorldTown?.setOrigin?.(ox)),focusY=document.documentElement.dataset.device==='mobile'&&height>width?.4:.53,oy=Math.round(height*focusY-camera.y),time=reducedMotion?0:world.time;activeWorld=world;lights=[];ctx.fillStyle='#688e51';ctx.fillRect(0,0,width,height);
    const here=options.home?undefined:V.dungeonAt(p.x,p.y),left=Math.floor(-ox/32)-2,top=Math.floor(-oy/32)-3,right=left+Math.ceil(width/32)+5,bottom=top+Math.ceil(height/32)+7,layers=[];
    const people=window.WorldPeople;people?.frameBudget?.(quality==='ultra'?3:1,quality==='leve'?140:quality==='medio'?60:0);const seenLooks=[];
    chunkFrame++;const scope=here?.id||'surface',budgetStart=performance.now(),cx0=Math.floor(left/CHUNK),cy0=Math.floor(top/CHUNK),cx1=Math.floor((right-1)/CHUNK),cy1=Math.floor((bottom-1)/CHUNK),visible=[];
    // Pass 1: ground. Baked chunks are one drawImage each; animated tiles are redrawn on top.
    for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){const ch=chunkAt(cx,cy,scope,here,world);ch.used=chunkFrame;visible.push(ch);const bx=cx*CPX+ox,by=cy*CPX+oy;
      if(!ch.canvas&&performance.now()-budgetStart<Q.budget)bakeChunk(ch,here,budgetStart+Q.budget);
      if(ch.canvas){ctx.drawImage(ch.canvas,bx,by);for(const l of ch.lights)lights.push({x:l.x+bx,y:l.y+by,r:l.r,color:l.color,strength:l.strength,glow:l.glow});}
      else{const rows=ch.work?Math.floor(ch.step/CHUNK):0;if(rows)ctx.drawImage(ch.work,0,0,CPX,rows*32,bx,by,CPX,rows*32);
      for(let y=Math.max(top,cy*CHUNK+rows);y<Math.min(bottom,cy*CHUNK+CHUNK);y++)for(let x=Math.max(left,cx*CHUNK);x<Math.min(right,cx*CHUNK+CHUNK);x++){if(V.dungeonAt(x,y)!==here){maskTile(x,y,x*32+ox,y*32+oy,here);continue;}ground(tile(x,y,world),x*32+ox,y*32+oy,x,y,time);}}
      for(const a of ch.anim)if(a.lv<=Q.animated&&a.x>=left&&a.x<right&&a.y>=top&&a.y<bottom)ground(a.t,a.x*32+ox,a.y*32+oy,a.x,a.y,time);}
    // Background loading: bake the ring around the view, nearest first, with what is left of the budget.
    if(Q.preload&&performance.now()-budgetStart<Q.budget){const ring=[];for(let cy=cy0-Q.preload;cy<=cy1+Q.preload;cy++)for(let cx=cx0-Q.preload;cx<=cx1+Q.preload;cx++){if(cx>=cx0&&cx<=cx1&&cy>=cy0&&cy<=cy1)continue;const ch=chunkAt(cx,cy,scope,here,world);ch.used=chunkFrame;if(!ch.canvas)ring.push(ch);}
      const mx=(cx0+cx1)/2,my=(cy0+cy1)/2;ring.sort((a,b)=>Math.hypot(a.cx-mx,a.cy-my)-Math.hypot(b.cx-mx,b.cy-my));for(const ch of ring){if(performance.now()-budgetStart>=Q.budget)break;bakeChunk(ch,here,budgetStart+Q.budget);}chunkStats.pending=ring.filter(c=>!c.canvas).length;}else chunkStats.pending=0;
    evictChunks();chunkStats.loaded=chunks.size;chunkStats.ms=performance.now()-budgetStart;
    // Pass 2: things standing on the ground (trees, rocks, herbs, cave props) from each chunk's feature list.
    for(const ch of visible)for(const f of ch.features){const x=f.x,y=f.y,t=f.t;if(x<left||x>=right||y<top||y>=bottom)continue;const sx=x*32+ox,sy=y*32+oy;if(t.palace){window.PalaceArt?.feature(ctx,layers,t,x,y,sx,sy,time,reducedMotion,light);continue;}if(t.prop){window.LairArt?.feature(ctx,layers,t,x,y,sx,sy,time,reducedMotion,light);continue;}const harvested=world.harvested[f.key]>world.time;
      if(t.kind==='tree'&&!harvested){ellipse(ctx,sx+23,sy+26,27,8,'#263c3034');layers.push({y:y+.95,draw(){const treeImg=tree(t.biome,Math.floor(V.hash(x,y)*3));const near=Math.abs(x+.5-p.x)<1.7&&y+.95>p.y&&y-p.y<3.8;if(near)ctx.globalAlpha=.32;const scale=(V.biomes[t.biome].surface==='forest'?1:.88)+V.hash(x+9,y,world.seed)*.23,tw=Math.round(treeImg.width*scale),th=Math.round(treeImg.height*scale),sway=Q.sway?WorldMotion.wind(time,x,y,1,reducedMotion):0;ctx.drawImage(treeImg,sx+16-tw/2+sway,sy+29-th,tw,th);ctx.globalAlpha=1;}});}
      if(t.kind==='rock'&&!harvested){layers.push({y:y+.8,draw(){const c=V.materialColors[t.ore],mineral=oreArt(t.ore);if(mineral){ellipse(ctx,sx+16,sy+25,19,6,'#18213266');ctx.drawImage(mineral,sx-6,sy-21,44,48);if(t.ore>5&&Math.sin(time*3+x+y)>.75)rect(ctx,sx+14,sy-12,2,2,'#f1ffff');return;}if(t.underground){const art=t.ore>=8&&window.GameAssets?.get('detail-crystal');if(art){ellipse(ctx,sx+16,sy+22,23,11,c+'28');ctx.drawImage(art,sx-8,sy-27,48,54);return;}ellipse(ctx,sx+16,sy+23,22,13,c+'18');poly(ctx,[[sx+3,sy+25],[sx+6,sy+9],[sx+19,sy+4],[sx+29,sy+21],[sx+23,sy+29]],'#535165');for(let i=0;i<3;i++){const xx=sx+8+i*7,yy=sy+20-i%2*5;poly(ctx,[[xx-4,yy],[xx-3,yy-12-i*3],[xx,yy-19-i*2],[xx+4,yy-10],[xx+3,yy+3]],c);poly(ctx,[[xx,yy-18-i*2],[xx+4,yy-10],[xx+3,yy+2],[xx,yy]],darken(c,-25));rect(ctx,xx-2,yy-12,1,7,darken(c,45));}return;}ellipse(ctx,sx+16,sy+26,13,4,'#3c4e3438');poly(ctx,[[sx+2,sy+23],[sx+5,sy+9],[sx+14,sy+3],[sx+26,sy+8],[sx+30,sy+23],[sx+22,sy+27],[sx+8,sy+27]],'#747d6c');poly(ctx,[[sx+5,sy+10],[sx+15,sy+5],[sx+25,sy+9],[sx+21,sy+18],[sx+10,sy+18]],'#a0a18a');rect(ctx,sx+9,sy+11,5,4,c);rect(ctx,sx+20,sy+19,4,3,c);}});}
      if(t.deep){
        if(t.kind==='stal')layers.push({y:y+.85,draw(){const h=26+V.hash(x,y,5)*18,c=deepWall[t.theme]||'#4a4958';ellipse(ctx,sx+16,sy+26,12,4,'#0c0b1266');poly(ctx,[[sx+6,sy+27],[sx+12,sy+27-h*.6],[sx+16,sy+27-h],[sx+21,sy+27-h*.55],[sx+27,sy+27]],c);poly(ctx,[[sx+16,sy+27-h],[sx+21,sy+27-h*.55],[sx+27,sy+27],[sx+18,sy+27]],darken(c,-18));rect(ctx,sx+14,sy+27-h*.7,1,h*.4,darken(c,26));}});
        if(t.kind==='mushroom'&&!harvested)layers.push({y:y+.7,draw(){for(let i=0;i<3;i++){const mx=sx+7+i*8+V.hash(x+i,y,3)*4,h=7+V.hash(x,y+i,3)*9,cap=i===1?'#6fe0b0':'#58c7d8',bob=Math.sin(time*2+i+x)*.8;rect(ctx,mx,sy+26-h,2,h,'#cfe7d2');ellipse(ctx,mx+1,sy+26-h+bob,5+i%2,3,cap);rect(ctx,mx-2,sy+25-h+bob,2,1,'#e9fff4');}}});
        if(t.kind==='mushroom'&&!harvested)light(sx+16,sy+16,46,'#5fe3c0',.7);
        if(t.kind==='mushroom'&&harvested){rect(ctx,sx+12,sy+22,3,4,'#8faa9c');rect(ctx,sx+19,sy+23,3,3,'#8faa9c');}
        if(t.kind==='rock'&&!harvested&&t.ore>=8)light(sx+16,sy+10,48,V.materialColors[t.ore],.6);
        if(t.kind==='cavefloor'&&(t.citadel||['hall','tunnel','magma','roost','web'].includes(t.theme))&&tile(x,y-1,world).kind==='wall'&&V.hash(x,y,17)>(t.theme==='hall'||t.theme==='gate'||t.theme==='arena'?.55:.8))layers.push({y:y-.4,draw(){const f=Math.sin(time*12+x*3)*1.5;rect(ctx,sx+15,sy-8,3,12,'#5a4535');rect(ctx,sx+12,sy-9,9,3,'#7d6446');poly(ctx,[[sx+12,sy-9],[sx+16,sy-22-f],[sx+21,sy-9]],'#ff9b3d');poly(ctx,[[sx+14,sy-9],[sx+16,sy-17-f],[sx+19,sy-9]],'#ffe28a');}});
        if(t.kind==='cavefloor'&&(t.citadel||['hall','tunnel','magma','roost','web'].includes(t.theme))&&tile(x,y-1,world).kind==='wall'&&V.hash(x,y,17)>(t.theme==='hall'||t.theme==='gate'||t.theme==='arena'?.55:.8))light(sx+16,sy-12,110,'#ffb45a',.95);
        if(t.kind==='cavefloor'&&t.theme==='roost'&&V.hash(x,y,23)>.9)layers.push({y:y-.9,draw(){const sway=Math.sin(time*2+x)*1.5;ellipse(ctx,sx+16+sway,sy-2,4,6,'#2a2233');rect(ctx,sx+12+sway,sy-6,2,3,'#2a2233');rect(ctx,sx+19+sway,sy-6,2,3,'#2a2233');rect(ctx,sx+14+sway,sy,1,1,'#ff5a6a');rect(ctx,sx+17+sway,sy,1,1,'#ff5a6a');}});
        if(t.kind==='water'&&V.hash(x,y,41)>.93)light(sx+16,sy+16,40,'#4fb7c9',.5);
      }
      if((t.kind==='herb'||t.kind==='berry')&&!harvested){rect(ctx,sx+12,sy+15,11,10,'#45734b');rect(ctx,sx+10,sy+18,14,5,'#5a8b55');for(let i=0;i<3;i++)rect(ctx,sx+12+i*4,sy+16+(i%2)*4,3,3,t.kind==='berry'?'#b27b91':'#d5c686');}
      if(t.kind==='grass'&&!t.lawn&&!t.underground&&[0,1,2,5,7].includes(t.biome)&&V.hash(x+73,y,world.seed)>.88){const art=window.GameAssets?.get('detail-undergrowth');if(art)layers.push({y:y+.85,draw(){const scale=.7+V.hash(x,y+33)*.3;ctx.drawImage(art,sx-8+WorldMotion.wind(time,x,y,.7,reducedMotion),sy-15,Math.round(47*scale),Math.round(42*scale));}});}
      if(t.kind==='tree'&&harvested){rect(ctx,sx+11,sy+21,10,5,'#8b7150');rect(ctx,sx+12,sy+20,8,3,'#b29b6d');}
    }
    if((here?.kind==='palace'||here?.kind==='tavern')&&window.WorldPalace){const k=V.kingdoms.find(k=>k.id===here.kingdom),ppl=window.WorldPalace.people(here);
      k.court.forEach((n,i)=>{const s=ppl.court[i];if(s)layers.push({y:s.y,draw(){ellipse(ctx,s.x*32+ox,s.y*32+oy+2,10,3,'#23374455');villagerAt({...n,dir:0,idle:true,speed:0,state:i<2?'read':'social'},s.x*32+ox,s.y*32+oy,time,false);}});});
      ppl.staff.forEach((s,i)=>{const look=STAFF_LOOKS[s.look]?.(k);if(look)layers.push({y:s.y,draw(){ellipse(ctx,s.x*32+ox,s.y*32+oy+2,10,3,'#23374455');villagerAt({id:'staff-'+here.kingdom+i,look,dir:0,idle:true,speed:0,state:s.look==='innkeeper'?'trade':s.look==='bard'?'music':s.look.startsWith('patron')?'eat':s.look==='barmaid'?'social':s.look==='guard'?'guard':s.look==='cook'?'cook':s.look==='scholar'?'read':s.look==='gardener'?'garden':s.look==='maid'?'sweep':'idle'},s.x*32+ox,s.y*32+oy,time,false);}});});}
    const visiblePeople=V.npcsAt(world).filter(n=>!n.inside);if(!here)reflections(world,visiblePeople,ox,oy,left,top,right,bottom,options);
    const night=nightOf(world)*.24,T=window.WorldTown;
    if(!here)for(const k of V.kingdoms){
      const B=k.bounds;
      if(B?(B.x1<left-3||B.x0>right+3||B.y1<top-3||B.y0>bottom+4):(k.x<left-12||k.x>right+12||k.y<top-12||k.y>bottom+12))continue;
      const x=k.x*32+ox,y=k.y*32+oy;
      for(const d of V.kingdomDecor)if(d.kingdom===k.id&&d.x<=right+2&&d.x+d.w>=left-2&&d.y<=bottom+(d.kind==='windmill'||d.kind==='clocktower'?8:3)&&d.y+d.h>=top-1)layers.push({y:d.kind==='pond'?d.y:d.y+d.h-(d.kind==='ctree'?.05:0),draw(){
        const sx=d.x*32+ox,sy=d.y*32+oy;
        if(T&&d.kind==='house'){if(night>.02)light(sx+(d.w||3)*16,sy+(d.h||2)*16,80,'#ffb45a',.7,'44');T.house(ctx,d,sx,sy,time,night);return;}
        if(T&&T[d.kind]&&['windmill','wheat','pond','barracks','dummy','clocktower'].includes(d.kind)){T[d.kind](ctx,d,sx,sy,time,night,quality);return;}
        if(T&&d.kind==='chapel'){T.chapel(ctx,d,sx,sy,time,night);return;}
        if(T&&d.kind==='tavern'){T.tavern(ctx,d,sx,sy,time,night);return;}
        if(T&&d.kind==='stall'&&B){T.stall(ctx,d,sx,sy,time);return;}
        if(T&&d.kind==='tower'){T.tower(ctx,sx,sy,time,k.roof,night);return;}
        if(T&&d.kind==='hedge'){T.hedge(ctx,sx,sy,time,d.x);return;}
        if(T&&d.kind==='grandFountain'){T.grandFountain(ctx,sx,sy,time,window.GameAssets?.get('royal-fountain'));return;}
        if(d.kind==='ctree'){const img=tree(0,Math.floor(V.hash(d.x,d.y)*3)),near=Math.abs(d.x+.5-p.x)<1.4&&d.y+1>p.y&&d.y-p.y<3;if(near)ctx.globalAlpha=.4;const sway=WorldMotion.wind(time,d.x,d.y,1,reducedMotion),tw=Math.round(img.width*.85),th=Math.round(img.height*.85);ellipse(ctx,sx+18,sy+28,20,6,'#1c2a2244');ctx.drawImage(img,sx+16-tw/2+sway,sy+30-th,tw,th);ctx.globalAlpha=1;return;}
        const art=window.GameAssets?.get('royal-'+d.kind),cx=(d.x+d.w/2)*32+ox,base=(d.y+d.h)*32+oy+4;
        ellipse(ctx,cx+4,base-3,d.w*18,7,'#18293240');
        if(art){const dw=d.kind==='fountain'?74:70,dh=Math.round(dw*art.height/art.width);ctx.drawImage(art,Math.round(cx-dw/2),base-dh,dw,dh);
          if(d.kind==='fountain'&&options.effects!==false)for(let i=0;i<6;i++){const a=time*1.7+i*1.05,r=12+Math.sin(a*1.3)*4;rect(ctx,Math.round(cx+Math.cos(a)*r),Math.round(base-dh*.45+Math.sin(a)*r*.35),2,1,'#e9fbff');}}
        else{rect(ctx,cx-d.w*14,base-22,d.w*28,20,d.kind==='fountain'?'#d8cfb2':'#8b6345');rect(ctx,cx-d.w*11,base-19,d.w*22,8,d.kind==='fountain'?'#6cc7de':k.color);}
      }});
      if(B&&T){
        // Walls, corner towers, the south gate and street lamps.
        for(let wx=Math.max(B.x0,left-1);wx<=Math.min(B.x1,right+1);wx++)for(const wy of [B.y0,B.y1]){if(Math.abs(wx-128)<=2)continue;if(wy<top-3||wy>bottom+3)continue;layers.push({y:wy+.98,draw(){T.wall(ctx,wy===B.y0?'n':'s',wx*32+ox,wy*32+oy+32,wx,time);}});}
        for(let wy=Math.max(B.y0+1,top-2);wy<=Math.min(B.y1-1,bottom+2);wy++)for(const wx of [B.x0,B.x1]){if(wx<left-2||wx>right+2)continue;layers.push({y:wy+.98,draw(){T.wall(ctx,wx===B.x0?'w':'e',wx*32+ox,wy*32+oy,wx,time);}});}
        for(const [cx2,cy2] of [[B.x0,B.y0],[B.x1,B.y0],[B.x0,B.y1],[B.x1,B.y1]])layers.push({y:cy2+1,draw(){T.cornerTower(ctx,cx2*32+ox-6,cy2*32+oy,time,k.roof);}});
        layers.push({y:B.y1+1.02,draw(){T.gateArch(ctx,126*32+ox,B.y1*32+oy+32,time,night);}});
        if(B.y0>=top-8)layers.push({y:B.y0+1.02,draw(){T.gateArch(ctx,126*32+ox,B.y0*32+oy+32,time,night);}});
        for(let ly=49;ly<=66;ly+=4)for(const lx of [126,130])layers.push({y:ly+.6,draw(){lampAt(lx*32+ox+(lx===126?6:24),ly*32+oy+20,time,night);}});
        for(const lx of [114,122,134,142])layers.push({y:70.6,draw(){lampAt(lx*32+ox+16,70*32+oy+20,time,night);}});
        if(quality!=='leve'&&T.fireflies)layers.push({y:B.y1+3,draw(){T.fireflies(ctx,113*32+ox,59*32+oy,6*32,7*32,time,night,quality==='ultra'?10:5);T.fireflies(ctx,113*32+ox,70*32+oy,31*32,9*32,time+40,night,quality==='ultra'?16:7);}});
        for(let ly=86;ly<=111;ly+=4)for(const lx of [126,130])if(Math.hypot(lx+.5-V.capitalPlaza.x,ly+.5-V.capitalPlaza.y)>V.capitalPlaza.r+.5)layers.push({y:ly+.6,draw(){lampAt(lx*32+ox+(lx===126?6:24),ly*32+oy+20,time,night);}});
        for(const lx of [120,136])layers.push({y:82.6,draw(){lampAt(lx*32+ox+16,82*32+oy+20,time,night);}});
        // Pigeons on the plaza scatter when someone walks close, then settle again.
        for(let i=0;i<7;i++)layers.push({y:94.9,draw(){const a=i*.9+Math.sin(time*.1+i)*.3,bx=(V.capitalPlaza.x+Math.cos(a)*3.6)*32+ox,by=(V.capitalPlaza.y+Math.sin(a)*2.6)*32+oy,near=Object.values(world.players).some(q=>Math.hypot(q.x*32+ox-bx,q.y*32+oy-by)<70);
          let st=pigeons.get(i)||{fly:-99};if(near&&!reducedMotion&&time-st.fly>6)st={fly:time};pigeons.set(i,st);const k2=time-st.fly;
          if(k2<5){const up=Math.min(1,k2/1.2)*(k2<3.5?1:(5-k2)/1.5),fx=bx+Math.cos(i*2.4)*up*140,fy=by-up*120,flap=Math.sin(time*22+i)>0;rect(ctx,fx-3,fy,7,3,'#9aa6b2');rect(ctx,fx-6,fy-(flap?3:-1),4,2,'#c3ccd6');rect(ctx,fx+3,fy-(flap?3:-1),4,2,'#c3ccd6');return;}
          const peck=Math.sin(time*5+i*3)>.7?2:0;ellipse(ctx,bx,by+2,4,1.5,'#1c2a2233');rect(ctx,bx-3,by-4,7,4,'#8a94a0');rect(ctx,bx+2,by-6+peck,3,3,'#6f7a88');rect(ctx,bx+4,by-5+peck,1,1,'#e8a040');rect(ctx,bx-2,by-4,4,1,'#b8c7d9');}});
        // Butterflies over the palace gardens.
        for(let i=0;i<5;i++){const fx=(116+i*5+Math.sin(time*.4+i)*2.5)*32+ox,fy=(75+Math.sin(time*.6+i*2)*1.6)*32+oy,wing=Math.abs(Math.round(Math.sin(time*14+i)*3));layers.push({y:79,draw(){rect(ctx,fx-wing,fy-8,wing,3,i%2?'#f3d56a':'#f08aa8');rect(ctx,fx+1,fy-8,wing,3,i%2?'#e0b25c':'#e070a0');rect(ctx,fx,fy-8,1,4,'#3a2a20');}});}
        continue;
      }
      // Small kingdoms: hedged flower beds and wrought-iron lamps.
      for(const side of [-1,1])for(let j=0;j<3;j++){const bx=x+side*180-16,by=y+j*47-26;if(T)T.flowerBed(ctx,bx,by,time,k.x+side*6,j);}
      for(const side of [-1,1]){const lx=x+side*83,ly=y+35;layers.push({y:k.y+1.2,draw(){if(T)lampAt(lx,ly,time,Math.max(night,.02));}});}
    }
    for(const b of here?[]:V.buildings){
      if(b.x>right||b.x+b.w<left||b.y>bottom||b.y+b.h<top)continue;
      if(V.buildingAt(p.x,p.y)===b)interior(b,b.x*32+ox,b.y*32+oy,time);
      else layers.push({y:b.y+b.h,draw:()=>building(b,b.x*32+ox,b.y*32+oy,time)});
    }
    if(here?.kind==='citadel'&&window.WorldTown){const arena=V.citadelAreas.find(a=>a.id==='arena'),info=V.citadelInfo(world);V.citadelWings.forEach((a,i)=>{const px=here.rx+arena.x+[-8,8,-8,8][i],py=here.ry+arena.y+[-6,-6,7,7][i];layers.push({y:py,draw(){const lit=!!world.citadel?.slain?.[a.boss],color=['#8fbf6a','#97b073','#ef8a5c','#9fd3e6'][i];window.WorldTown.pillar(ctx,px*32+ox,py*32+oy,time,lit,color);if(lit)light(px*32+ox,py*32+oy-78,90,color,.8);}});});}
    const currentDungeon=V.dungeonAt(p.x,p.y);if(currentDungeon?.kind==='raid'){
      const cx=(currentDungeon.rx+currentDungeon.w/2)*32+ox,cy=(currentDungeon.ry+currentDungeon.h/2)*32+oy;
      ctx.strokeStyle='#91789966';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,115,76,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(cx,cy,98,62,0,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<12;i++){const a=i*Math.PI/6;const xx=cx+Math.cos(a)*107,yy=cy+Math.sin(a)*69;rect(ctx,xx,yy,2,6,'#b9a6ba77');rect(ctx,xx-2,yy+2,6,1,'#b9a6ba77');}
    }
    window.WorldWeather?.floor(ctx,world,p,ox,oy,options);
    for(const a of world.life?.animals||[]){if(here||a.x<left||a.x>right||a.y<top||a.y>bottom)continue;layers.push({y:a.y,draw:()=>window.WorldWeather?.animal(ctx,a,a.x*32+ox,a.y*32+oy,options.reducedMotion?0:time)});}
    // Pact companions (tamed monsters and mystic creatures such as Patrasche) walk beside their owners.
    for(const q of Object.values(world.players)){if(!q.shadows?.length||q.online===false&&q.id!==me)continue;for(const c of q.shadows){if(V.dungeonAt(c.x,c.y)!==here||c.x<left-2||c.x>right+2||c.y<top-2||c.y>bottom+3)continue;layers.push({y:c.y,draw:()=>shadowSoldier(c,Math.round(c.x*32+ox),Math.round(c.y*32+oy),time)});}}
    if(window.IsekaiArt){window.IsekaiArt.begin(ctx);window.IsekaiArt.companionLayers(layers,world,me,here,ox,oy,time,monster,{left,right,top,bottom});}
    for(const n of visiblePeople){if(here||n.x<left-3||n.x>right+3||n.y<top-3||n.y>bottom+3)continue;if(n.look)seenLooks.push(n.look);layers.push({y:n.y,draw(){const x=n.x*32+ox,y=n.y*32+oy;if(n.citizen){citizen(n,x,y,time,Math.hypot(n.x-p.x,n.y-p.y)<3);return;}if(villagerAt(n,x,y,time,Math.hypot(n.x-p.x,n.y-p.y)<3))return;const step=walkFrame(n,time),idle=!step&&!reducedMotion?-1-Math.floor((time*1.1+n.id.length*2)%4):0,art=n.id==='elder'?window.GameAssets?.get('v3-cartographer'):sprite(n.classId,n.dir,step||idle,n.id==='miner'?'male':'female');ellipse(ctx,x,y+2,10,3,'#1a292855');if(art){const h=n.id==='elder'?57:58,w=Math.round(h*art.width/art.height);ctx.drawImage(art,x-w/2,y-h+4+(reducedMotion?0:Math.round(Math.sin(time*2+n.x)*.7)),w,h);}ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillStyle='#ffecb0';txt(ctx,n.name,x,y-62);if(n.role==='quest'){ctx.font='bold 12px monospace';txt(ctx,'!',x,y-72);}ctx.textAlign='left';}});}
    for(const l of V.landmarks)if(V.dungeonAt(l.x,l.y)===here&&Math.abs(l.x*32+ox)<width+100&&Math.abs(l.y*32+oy)<height+100)layers.push({y:l.y+.6,draw:()=>landmark(l,(l.x+.5)*32+ox,(l.y+.5)*32+oy,time,world)});
    // Wooden garden borders, street lamps and flower beds give the village a handmade silhouette.
    if(!here)for(let i=0;i<6;i++)layers.push({y:134.15,draw(){const x=(135+i)*32+ox,y=134*32+oy;rect(ctx,x,y-12,3,15,'#968254');rect(ctx,x+1,y-12,1,13,'#c2ac72');rect(ctx,x,y-8,32,3,'#b29c67');rect(ctx,x,y-2,32,3,'#9b8457');}});
    if(!here)for(const [x,y]of [[126,125],[130,128],[126,132],[132,132]])layers.push({y:y+.5,draw(){const sx=x*32+ox,sy=y*32+oy;if(prop('lantern',sx,sy+3,54)){ellipse(ctx,sx+9,sy-28,10,10,'#f8bd5420');return;}rect(ctx,sx-1,sy-27,3,28,'#7b6a45');rect(ctx,sx-5,sy-34,11,9,'#657051');rect(ctx,sx-3,sy-33,7,6,'#f0d586');ellipse(ctx,sx,sy-30,12,9,'#edd78413');}});
    for(const o of world.placed)if(V.dungeonAt(o.x,o.y)===here)layers.push({y:o.y,draw(){const x=o.x*32+ox,y=o.y*32+oy;if(o.id==='lantern'&&prop('lantern',x,y+3,54))return;if(o.id==='campfire'&&prop('campfire',x,y+4,36)){for(let i=0;i<3;i++)rect(ctx,x+Math.sin(time*3+i)*7,y-10-(time*12+i*7)%25,1,2,'#ffc578');return;}if(o.id==='campfire'){rect(ctx,x-10,y-2,21,5,'#8a6b43');poly(ctx,[[x-6,y-3],[x-3,y-17],[x,y-10],[x+4,y-23+Math.sin(time*10)*3],[x+8,y-2]],'#e6ac67');poly(ctx,[[x-2,y],[x+1,y-13],[x+5,y]],'#ffe2a2');}else {rect(ctx,x-10,y-13,20,5,'#a48e5f');rect(ctx,x-8,y-8,3,9,'#806a47');rect(ctx,x+7,y-8,3,9,'#806a47');if(o.id==='lantern')rect(ctx,x-5,y-25,10,10,'#e9d38a');}}});
    for(const grave of world.graves)if(V.dungeonAt(grave.x,grave.y)===here)layers.push({y:grave.y,draw(){const x=grave.x*32+ox,y=grave.y*32+oy;if(prop('grave',x,y+3,31))return;rect(ctx,x-7,y-20,15,23,'#8d9387');rect(ctx,x-6,y-22,13,3,'#bac0ac');rect(ctx,x-4,y-14,9,2,'#d1cfb2');rect(ctx,x,y-18,2,12,'#d1cfb2');}});
    for(const m of Object.values(world.monsters))if((m.hp>0||world.time-(m.diedAt??-99)<.45)&&V.dungeonAt(m.x,m.y)===here&&m.x>left-2&&m.x<right+2&&m.y>top-2&&m.y<bottom+2)layers.push({y:m.y,draw(){
      const x=m.x*32+ox,y=m.y*32+oy,old=creatureStates.get(m.id),moving=old&&Math.hypot(m.x-old.x,m.y-old.y)>.001;
      const facing=moving?Math.atan2(m.y-old.y,m.x-old.x):old?.facing||0;creatureStates.set(m.id,{x:m.x,y:m.y,facing});
      if(m.hp<=0){if(!reducedMotion){const age=world.time-m.diedAt;ctx.save();ctx.globalAlpha=1-age/.45;for(let i=0;i<6;i++)rect(ctx,x+Math.cos(i*2.4)*age*30,y-12+Math.sin(i*2.4)*age*20,3,3,V.monsterTypes[m.kind].color);ctx.restore();}return;}
      const recoil=reducedMotion?0:Math.max(0,1-(world.time-(m.hurtAt??-99))/.18)*3;
      const lunge=reducedMotion?0:Math.max(0,1-(world.time-(m.attackAt??-99))/.25)*4;
      ctx.save();ctx.translate(Math.cos(facing)*(lunge-recoil),Math.sin(facing)*(lunge-recoil));
      monster(m,x,y+(moving&&!reducedMotion?Math.round(Math.sin(time*11)*1.5):0),time);ctx.restore();
    }});
    for(const id of creatureStates.keys())if(!world.monsters[id])creatureStates.delete(id);

    for(const q of Object.values(world.players))if((q.online!==false||q.id===me)&&V.dungeonAt(q.x,q.y)===here)layers.push({y:q.y,draw(){
      const x=Math.round(q.x*32+ox),y=Math.round(q.y*32+oy),M=window.WorldMotion;
      if(q.dead){ctx.globalAlpha=.6;ellipse(ctx,x,y-13+Math.sin(time*2)*3,8,12,'#cbdcc1');rect(ctx,x-4,y-16,2,3,'#526b64');rect(ctx,x+3,y-16,2,3,'#526b64');ctx.globalAlpha=1;return;}
      ellipse(ctx,x,y+2,10,3,'#29422e55');const frame=walkFrame(q,world.time),pose=M.pose(q,world.time,reducedMotion);
      if(q.progress?.pet)WorldFauna.draw(ctx,{kind:q.progress.pet,dir:q.dir===1?-1:1,moving:!!frame,phase:q.id.length},x-25,y+10,time,reducedMotion);
      if(q.progress?.mounted)M.mount(ctx,x,y,time,!!frame,q.dir,reducedMotion,q.progress.mountKind||'horse');
      let rider=q.progress?.mounted?M.riderOffset(q.progress.mountKind||'horse'):0,idleFrame=!frame&&!pose.kind&&!q.look&&!reducedMotion?-1-Math.floor((time*1.1+q.id.length*3)%4):0,playerArt=sprite(q.classId,q.dir,pose.kind?0:frame||idleFrame,q.appearance||'female',q.look,!!q.look&&!reducedMotion&&(time+q.x)%4.3<.14),ownHero=q.classId==='monarca'&&!q.look&&!!window.GameAssets?.get('walk-monarca-0-0');
      {const cast=world.time-(q.castAt??-9),pose6=ownHero&&cast>=0&&cast<.9&&window.GameAssets.get('cast-monarca-'+Math.min(5,Math.floor(cast/.9*6)));if(pose6)playerArt=pose6;}
      {const since=world.time-(q.attackAt??-9),atk=ownHero&&!(world.time-(q.castAt??-9)<.9)&&since>=0&&since<.4&&window.GameAssets.get(`atk-monarca-${q.dir||0}-${Math.min(5,Math.floor(since/.4*6))}`);if(atk)playerArt=atk;}
      // Dust kicked up behind the feet while walking (not on water, floors indoors or when riding).
      if(frame&&!reducedMotion&&quality!=='leve'&&!q.progress?.mounted&&!V.dungeonAt(q.x,q.y)){const [bx,by]=[[0,-1],[1,0],[-1,0],[0,1]][q.dir||0];for(let i=0;i<3;i++){const k=(time*2.4+i/3+q.x*.1)%1;ellipse(ctx,x+bx*(5+k*9)+(i-1)*3,y+1+by*(3+k*6)-k*4,1.5+k*3,1+k*1.6,`rgba(196,184,150,${(.34*(1-k)).toFixed(2)})`);}}
      const armed=pose.kind!=='sleep'&&!pose.kind&&!q.dead;if(armed&&!ownHero&&q.dir===3)M.weapon(ctx,q,x,y+rider,world.time,reducedMotion);
      ctx.save();if(q.hurtAt>world.time-.2)ctx.globalAlpha=.65;
      ctx.translate(x+pose.x,y+rider+pose.y+(!frame&&!pose.kind&&!reducedMotion?Math.round(Math.sin(time*2+q.x)*.65):0));ctx.rotate(pose.angle);
      if(q.progress?.mounted&&pose.kind!=='sleep'){const h=playerArt.height,w=playerArt.width;ctx.drawImage(playerArt,0,0,w,h-18,-w/2,-h+4,w,h-18);ctx.drawImage(playerArt,0,h-18,w,18,-w/2,-14,w,9);}else ctx.drawImage(playerArt,-playerArt.width/2,-playerArt.height+4);ctx.restore();
      if(armed&&!ownHero&&q.dir!==3)M.weapon(ctx,q,x,y+rider,world.time,reducedMotion);
      if(pose.kind!=='sleep')grimoire(q,x,y+rider,time);
      M.drawAction(ctx,q,x,y+rider,world.time,reducedMotion);
      if(q.buffs?.shield>world.time){ctx.strokeStyle='#e0d59c';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y-18,15,22,0,0,Math.PI*2);ctx.stroke();}
      if(q.id!==me){ctx.font='6px monospace';ctx.textAlign='center';ctx.fillStyle='#fff2cd';ctx.fillText(q.name,x,y-45+rider);ctx.textAlign='left';}
    }});
    for(const id of motionStates.keys())if(!world.players[id]&&!V.npcDefs.some(n=>n.id===id))motionStates.delete(id);
    layers.sort((a,b)=>a.y-b.y);for(const layer of layers)layer.draw();window.WorldWeather?.possessions(ctx,world,p,ox,oy,options.reducedMotion?0:time);
    window.GuildArt?.effects(ctx,world,ox,oy,time);if(window.IsekaiArt){window.IsekaiArt.effects(ctx,world,me,ox,oy,time,quality);window.IsekaiArt.appraisal(ctx,world,me,ox,oy,time);}
    for(const e of world.events){const age=world.time-e.time;if(age<0||age>1.3)continue;const x=e.x*32+ox,y=e.y*32+oy;if(e.type==='notice'||window.IsekaiArt?.owns(e.type))continue;ctx.globalAlpha=Math.max(0,1-age/1.3);
      if(e.type==='arise'){ctx.globalAlpha=1;ariseEffect(x,y,age);continue;}
      if(['slash','projectile','skill'].includes(e.type)&&e.classId){classEffect(e,x,y,age);if(e.type!=='skill'&&Number.isFinite(e.targetX)&&Number.isFinite(e.targetY)&&age>=.12&&age<.52&&!reducedMotion){const hit=window.GameAssets?.frame?.('fx-hit',Math.min(5,Math.floor((age-.12)/.4*6)));if(hit)ctx.drawImage(hit,e.targetX*32+ox-20,e.targetY*32+oy-37,40,40);}}
      else if(e.type==='spell'){spellEffect(e,x,y,age,ox,oy);}
      else if(e.type==='warning'){ctx.strokeStyle=e.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,16+age*15,7+age*5,0,0,Math.PI*2);ctx.stroke();}
      else if(e.type==='slash'||e.type==='skill'){ctx.strokeStyle=e.color;ctx.beginPath();ctx.arc(x,y,15+age*30,0,Math.PI*2);ctx.stroke();}
      else if(e.type==='projectile'){rect(ctx,x,y-15,5,5,e.color);}
      else{ctx.font=`bold ${e.type==='loot'?6:9}px monospace`;ctx.textAlign='center';ctx.fillStyle='#354332';txt(ctx,String(e.text),x+1,y-30-(reducedMotion?0:age*20)+1);ctx.fillStyle=e.color;txt(ctx,String(e.text),x,y-30-(reducedMotion?0:age*20));ctx.textAlign='left';}ctx.globalAlpha=1;
    }
    if(!here&&V.biomes[V.biomeAt(p.x,p.y)].surface==='forest'&&options.effects!==false&&Q.heavyFx){
      for(let i=0;i<4;i++){ctx.globalAlpha=.035;poly(ctx,[[i*width/3-50,-40],[i*width/3+5,-40],[i*width/3+170,height],[i*width/3+70,height]],'#ffefd0');}ctx.globalAlpha=1;
      for(let i=0;i<Math.round(18*Q.particles);i++){const xx=(V.hash(i,7)*width+Math.sin(time*.5+i)*12+width)%width,yy=(V.hash(i,9)*height+time*(3+i%4))%height;rect(ctx,xx,yy,2+i%2,1,i%3?'#a4ba77aa':'#e8d399bb');}
    }
    if(!here&&!reducedMotion&&options.effects!==false&&Q.heavyFx){const period=38,phase=(time%period)/period;if(phase<.55){const k=phase/.55,dir=Math.floor(time/period)%2?-1:1,bx=dir>0?-60+k*(width+120):width+60-k*(width+120),by=height*(.18+.12*Math.sin(Math.floor(time/period)*1.7));
      for(let i=0;i<5;i++){const off=Math.abs(i-2),fx=bx-dir*off*14,fy=by+off*9+Math.sin(time*2+i)*2,flap=Math.sin(time*14+i*1.3)>0;ctx.globalAlpha=.18;ellipse(ctx,fx-dir*40,fy+120,5,2,'#10202a');ctx.globalAlpha=1;rect(ctx,fx-1,fy,3,2,'#2c3440');rect(ctx,fx-5,fy-(flap?3:0),4,1,'#2c3440');rect(ctx,fx+2,fy-(flap?3:0),4,1,'#2c3440');}}}
    // Low-opacity daylight shafts and drifting cloud shade keep silhouettes readable.
    if(!here&&options.effects!==false&&Q.heavyFx){ctx.save();ctx.globalCompositeOperation='soft-light';const sun=ctx.createLinearGradient(0,0,width,height);sun.addColorStop(0,'#ffe7ab44');sun.addColorStop(.55,'#efd5b608');sun.addColorStop(1,'#527b9729');ctx.fillStyle=sun;ctx.fillRect(0,0,width,height);ctx.restore();
      for(let i=0;i<3;i++){const cx=((time*3+i*width*.55)%(width+300))-150,cy=height*(.15+i*.32);const cloud=ctx.createRadialGradient(cx,cy,10,cx,cy,150);cloud.addColorStop(0,'#112b4313');cloud.addColorStop(1,'#112b4300');ctx.fillStyle=cloud;ctx.fillRect(cx-150,cy-150,300,300);}}
    // Warm daylight, drifting pollen and a slow evening tint.
    const inAbyss=['deep','citadel'].includes(V.dungeonAt(p.x,p.y)?.kind);
    if(inAbyss){lightCanvas||=document.createElement('canvas');lightCanvas.width=width;lightCanvas.height=height;const g=lightCanvas.getContext('2d');g.globalCompositeOperation='source-over';g.fillStyle=V.dungeonAt(p.x,p.y)?.kind==='citadel'?'rgba(8,6,10,.84)':'rgba(5,5,12,.93)';g.fillRect(0,0,width,height);g.globalCompositeOperation='destination-out';
      const flick=Math.sin(time*9)*4+Math.sin(time*23)*2;const hole=(x,y,r,a)=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(0,0,0,'+a+')');gr.addColorStop(.55,'rgba(0,0,0,'+(a*.6)+')');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);};
      for(const q of Object.values(world.players))if(q.online!==false&&!q.dead)hole(q.x*32+ox,q.y*32+oy-14,(q.id===me?175:120)+flick,1);
      for(const l of lights)hole(l.x,l.y,l.r*(1.4+Math.sin(time*5+l.x)*.04),Math.min(1,.55+l.strength*.45));
      ctx.drawImage(lightCanvas,0,0);ctx.globalCompositeOperation='lighter';for(const l of lights){const gr=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);gr.addColorStop(0,l.color+l.glow);gr.addColorStop(1,l.color+'00');ctx.fillStyle=gr;ctx.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);}ctx.globalCompositeOperation='source-over';
      for(let i=0;i<24;i++){const dx=(V.hash(i,3)*width+time*(4+i%5))%width,dy=(V.hash(i,8)*height-time*(6+i%3)*2+height*10)%height;rect(ctx,dx,dy,1,1,i%3?'#ffb45a88':'#9fe8ff66');}}
    else if(V.dungeonAt(p.x,p.y)&&!['palace','tavern'].includes(V.dungeonAt(p.x,p.y).kind)){const light=ctx.createRadialGradient(width/2,height*focusY,30,width/2,height*focusY,Math.max(width,height)*.65);light.addColorStop(0,'#11132300');light.addColorStop(1,'#090b18dd');ctx.fillStyle=light;ctx.fillRect(0,0,width,height);}
    if(options.effects!==false){ctx.globalCompositeOperation='soft-light';ctx.fillStyle='#c6b8980b';ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='source-over';for(let i=0;i<(inAbyss?0:Math.round(18*Q.particles));i++){const underground=!!V.dungeonAt(p.x,p.y),snow=V.biomeAt(p.x,p.y)===4,x=(V.hash(i,5)*width+time*(snow?7:3+i%4))%width,y=(V.hash(i,9)*height+(snow?time*9:Math.sin(time*.5+i)*8))%height;rect(ctx,x,y,1,i%3?1:2,underground?'#99bbcf40':snow?'#e9f3f0bb':'#f3edbb65');}}
    // Day and night: dusk tint, then darkness with holes of light around players, lamps and fires.
    if(!V.dungeonAt(p.x,p.y)&&!options.home){const nightK=nightOf(world),duskK=window.WorldLife?.dusk?window.WorldLife.dusk(world):0;
      if(duskK>0){ctx.save();ctx.globalCompositeOperation='soft-light';ctx.fillStyle='rgba(255,120,50,'+(.38*duskK)+')';ctx.fillRect(0,0,width,height);ctx.restore();}
      if(nightK>.01){lightCanvas||=document.createElement('canvas');if(lightCanvas.width!==width||lightCanvas.height!==height){lightCanvas.width=width;lightCanvas.height=height;}const g=lightCanvas.getContext('2d');
        g.globalCompositeOperation='source-over';g.clearRect(0,0,width,height);g.fillStyle='rgba(6,10,30,'+(.68*nightK)+')';g.fillRect(0,0,width,height);g.globalCompositeOperation='destination-out';
        const hole=(x,y,rad,a)=>{if(x<-rad||y<-rad||x>width+rad||y>height+rad)return;const gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,'rgba(0,0,0,'+a+')');gr.addColorStop(.5,'rgba(0,0,0,'+(a*.55)+')');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);};
        for(const q of Object.values(world.players))if(q.online!==false&&!q.dead&&!V.dungeonAt(q.x,q.y))hole(q.x*32+ox,q.y*32+oy-14,q.id===me?150:100,.9);
        const lit=lights.length>48?[...lights].sort((a,b)=>Math.hypot(a.x-width/2,a.y-height/2)-Math.hypot(b.x-width/2,b.y-height/2)).slice(0,48):lights;
        for(const l of lit)hole(l.x,l.y,l.r*1.5,Math.min(1,.5+l.strength*.45));
        ctx.drawImage(lightCanvas,0,0);ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=Math.min(1,nightK*1.2);for(const l of lit){const gr=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);gr.addColorStop(0,l.color+l.glow);gr.addColorStop(1,l.color+'00');ctx.fillStyle=gr;ctx.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);}ctx.restore();}}
    const expedition=V.dungeonAt(p.x,p.y);if(expedition?.kind==='citadel'){const area=V.citadelArea(p.x,p.y),info=V.citadelInfo(world),bkey='c'+area?.id+'|'+info.totems+'|'+info.bosses+'|'+info.open;if(bkey!==bannerKey){bannerKey=bkey;bannerAt=performance.now();}const fade=Math.max(0,Math.min(1,(7000-(performance.now()-bannerAt))/1000));if(fade>0){ctx.globalAlpha=fade;ctx.fillStyle='#1a140edd';ctx.fillRect(width/2-150,108,300,38);ctx.fillStyle='#e8b04a';ctx.fillRect(width/2-150,108,300,1);ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle='#ffe2a8';txt(ctx,'CIDADELA · '+(area?.name||'').toUpperCase(),width/2,119);ctx.font='6px monospace';ctx.fillStyle='#e7d3ae';txt(ctx,(area?.sub||'').slice(0,82),width/2,129);ctx.fillStyle='#ffd26a';txt(ctx,info.cleared?'O Grande Totem caiu. A cidadela desperta em alguns minutos.':info.open?'Selo aberto · o Grande Totem espera no leste':`Totens ${info.totems}/${info.total} · chefes ${info.bosses}/${info.total}`,width/2,139);ctx.textAlign='left';ctx.globalAlpha=1;}}
    else if(expedition?.kind==='deep'){const area=V.abyssArea(p.x,p.y),info=V.abyssInfo(world),bkey=area?.id+'|'+info.slain+'|'+info.sealOpen+'|'+info.wyrmSlain;if(bkey!==bannerKey){bannerKey=bkey;bannerAt=performance.now();}const fade=Math.max(0,Math.min(1,(7000-(performance.now()-bannerAt))/1000));ctx.globalAlpha=fade;ctx.fillStyle='#120f18dd';ctx.fillRect(width/2-130,108,260,27);ctx.fillStyle='#ff9a3c';ctx.fillRect(width/2-130,108,260,1);ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle='#ffd9a8';txt(ctx,'ABISMO · '+(area?.name||'').toUpperCase(),width/2,119);ctx.font='6px monospace';ctx.fillStyle='#e7d3ae';txt(ctx,info.wyrmSlain?'Ignarok derrotado · o Abismo está em silêncio':'Guardiões '+info.slain+'/3 · selo '+(info.sealOpen?'ROMPIDO: Ignarok desperta':'fechado'),width/2,129);ctx.textAlign='left';ctx.globalAlpha=1;}
    else if(expedition?.kind==='lair'){const info=V.lairInfo(world);ctx.fillStyle='#1b1a14dd';ctx.fillRect(width/2-125,108,250,27);ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle='#d8e6a8';txt(ctx,expedition.name,width/2,119);ctx.font='6px monospace';txt(ctx,info.kingSlain?'Gorzak derrotado · pegue o tesouro no salão do trono':'Campeões '+info.slain+'/2 · portão do rei '+(info.open?'ABERTO':'fechado'),width/2,129);ctx.textAlign='left';}
    else if(expedition&&!['palace','tavern'].includes(expedition.kind)){const state=world.raids?.[expedition.id];ctx.fillStyle='#171b2bdd';ctx.fillRect(width/2-115,108,230,27);ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle='#e7d3ae';txt(ctx,expedition.name,width/2,119);ctx.font='6px monospace';txt(ctx,expedition.kind==='cave'?'E: minerar veios · portal ao sul: sair':state?.active?`Onda ${state.wave}/3 · ${Object.values(world.monsters).filter(m=>m.raid===expedition.id&&m.hp>0).length} inimigos restantes`:'Expedição encerrada · retorne pelo portal ao sul',width/2,129);ctx.textAlign='left';}
    if(quality==='ultra'&&!here&&options.effects!==false){const surf=V.biomes[V.biomeAt(p.x,p.y)].surface,nightK=nightOf(world);
      if(surf==='forest')for(let i=0;i<10;i++){const fx=(V.hash(i,31)*width+Math.sin(time*.9+i)*30+time*6)%width,fy=(V.hash(i,37)*height+time*(14+i%5*3))%height,flip=Math.sin(time*4+i)>0;rect(ctx,fx,fy,flip?3:2,flip?2:3,i%3?'#c8843e':'#d9a441');}
      if(nightK>.25&&surf!=='snow'&&surf!=='sand'&&window.WorldTown)window.WorldTown.fireflies(ctx,0,0,width,height,time,nightK*.24,12);}
    if(options.debug){ctx.save();ctx.strokeStyle='#ffe28a88';ctx.lineWidth=1;for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){const ch=chunks.get(scope+':'+cx+','+cy);ctx.strokeStyle=ch?.canvas?'#9fe8ff66':'#ff7a5a99';ctx.strokeRect(cx*CPX+ox+.5,cy*CPX+oy+.5,CPX-1,CPX-1);}
      const lines=['VÉSPERA · depuração (F3)',`FPS ${options.fps||0} · qualidade ${quality}`,`chunks ${chunkStats.loaded}/${Q.maxChunks} · assados ${chunkStats.baked} · fila ${chunkStats.pending}`,`bloco ${Math.floor(p.x)}, ${Math.floor(p.y)} · chunk ${Math.floor(p.x/CHUNK)}, ${Math.floor(p.y/CHUNK)}`,`camadas ${layers.length} · orçamento ${chunkStats.ms.toFixed(1)}/${Q.budget} ms`];
      ctx.fillStyle='#0b0f16cc';ctx.fillRect(4,height-8-lines.length*9,178,lines.length*9+4);ctx.font='6px monospace';ctx.fillStyle='#e8f0d8';lines.forEach((l,i)=>txt(ctx,l,8,height-lines.length*9+i*9));ctx.restore();}
    window.WorldWeather?.draw(ctx,world,p,ox,oy,width,height,options);
    if(options.waypoint){const wx=options.waypoint.x*32+ox,wy=options.waypoint.y*32+oy;ctx.strokeStyle='#efd48f';ctx.lineWidth=1;ctx.beginPath();ctx.arc(Math.max(20,Math.min(width-20,wx)),Math.max(55,Math.min(height-65,wy)),6,0,Math.PI*2);ctx.stroke();}
  }
  const regionCenters=[[128,128],[187,99],[191,177],[128,219],[48,203],[36,120],[65,42],[176,35]];
  const markerColors={town:'#f0dc9e',npc:'#f7e7b0',forge:'#e0a46c',inn:'#e6c28a',well:'#9fd1d6',chest:'#d9b25c',farm:'#c7d67e',guild:'#e4b95c',shrine:'#8fd3b0',boss:'#e0705e',cave:'#78bfc7',raid:'#c08ae6',exit:'#f1d39b',seat:'#e8c65a',deep:'#f08a4b',hoard:'#f1c75a',citadel:'#e8b04a',lair:'#9ac05a',camp:'#c98a4a'};
  let labelScale=1;
  function mapLabel(g,text,x,y,color='#243a31',size=9,align='left',bold=false){g.font=(bold?'bold ':'')+Math.round(size*labelScale)+'px monospace';g.textAlign=align;g.lineJoin='round';g.lineWidth=3;g.strokeStyle='#f3ebcfdd';g.strokeText(text,x,y);g.fillStyle=color;g.fillText(text,x,y);g.textAlign='left';}
  function mapMarker(g,l,x,y,large,status,time){const c=markerColors[l.kind]||'#f0dc9e',k=large?labelScale*1.1:.75;g.save();g.translate(Math.round(x),Math.round(y));g.scale(k,k);g.lineWidth=1.5;g.strokeStyle='#1f2a26';
    const shape=(pts,fill)=>{g.beginPath();pts.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fillStyle=fill;g.fill();g.stroke();};
    if(l.kind==='kingdom'){shape([[-8,6],[-8,-5],[-4,0],[0,-8],[4,0],[8,-5],[8,6]],V.kingdoms.find(k=>k.id===l.id).color);}
    else if(l.kind==='town'){shape([[-7,1],[0,-7],[7,1],[5,1],[5,6],[-5,6],[-5,1]],c);}
    else if(l.kind==='shrine'){shape([[0,-7],[5,0],[0,7],[-5,0]],status==='done'?'#9aa89c':c);if(status==='done'){g.strokeStyle='#23433a';g.beginPath();g.moveTo(-3,0);g.lineTo(-1,3);g.lineTo(4,-3);g.stroke();}}
    else if(l.kind==='boss'){g.beginPath();g.arc(0,-1,6,0,Math.PI*2);g.fillStyle=status==='done'?'#9aa89c':c;g.fill();g.stroke();g.fillStyle='#2a1f24';g.fillRect(-3,-3,2,2);g.fillRect(1,-3,2,2);g.fillRect(-2,2,4,2);}
    else if(l.kind==='cave'){shape([[-7,5],[0,-6],[7,5]],c);g.fillStyle='#1f2a36';g.fillRect(-2,1,4,4);}
    else if(l.kind==='raid'){if(status==='active'){g.fillStyle='#ff6a4a'+(Math.sin(time*6)>0?'66':'22');g.beginPath();g.arc(0,0,11,0,Math.PI*2);g.fill();}const pts=[];for(let i=0;i<10;i++){const r=i%2?3:7,a=-Math.PI/2+i*Math.PI/5;pts.push([Math.cos(a)*r,Math.sin(a)*r]);}shape(pts,status==='cooldown'?'#9d8fae':c);}
    else if(l.kind==='seat'){const h=V.houseById[l.house];if(h.noble){shape([[-7,5],[-7,-3],[-3.5,1],[0,-6],[3.5,1],[7,-3],[7,5]],c);g.fillStyle=h.color;g.fillRect(-2,0,4,4);}else{shape([[-6,6],[-6,-1],[0,-6],[6,-1],[6,6]],'#b98f62');g.fillStyle=h.color;g.fillRect(-2,1,4,5);}}
    else if(l.kind==='deep'){shape([[-8,6],[-7,-3],[-3,-7],[3,-7],[7,-3],[8,6]],c);g.fillStyle='#1b1520';g.fillRect(-3,-1,6,7);}if(l.kind==='citadel'){shape([[-3,7],[-3,-6],[0,-9],[3,-6],[3,7]],c);g.fillStyle='#1b1520';g.fillRect(-2,-4,1,2);g.fillRect(1,-4,1,2);g.fillRect(-2,1,4,1);}
    else if(l.kind==='hoard'){shape([[-5,-3],[5,-3],[5,4],[-5,4]],status==='done'?'#9aa89c':c);g.fillStyle='#6b4f33';g.fillRect(-5,-1,10,1);}
    else if(l.kind==='guild'){shape([[-5,-6],[5,-6],[5,1],[0,6],[-5,1]],c);}
    else if(l.kind==='lair'){shape([[-8,6],[-7,-3],[-3,-7],[3,-7],[7,-3],[8,6]],c);g.fillStyle='#1b1520';g.fillRect(-3,-1,6,7);g.fillStyle='#e8e0c8';g.fillRect(-2,-5,4,3);}
    else if(l.kind==='camp'){shape([[-7,5],[0,-6],[7,5]],status==='done'?'#9aa89c':c);g.fillStyle='#3a2a1a';g.fillRect(-1,0,2,5);}
    else {g.fillStyle=c;g.fillRect(-3,-3,6,6);g.strokeRect(-3,-3,6,6);}
    g.restore();}
  function landmarkStatus(l,world,p){if(l.kind==='hoard')return p.hoards?.includes(l.id)?'done':'';if(l.kind==='deep')return V.abyssInfo(world).wyrmSlain?'done':'';if(l.kind==='citadel')return V.citadelInfo(world).cleared?'done':'';if(l.kind==='shrine')return p.shrineDone?.includes(l.id)?'done':'';if(l.kind==='boss')return p.bossKilled?'done':'';if(l.kind==='raid'){const r=world.raids?.[l.id];return r?.active?'active':r?.readyAt>world.time?'cooldown':'ready';}return '';}
  // Minimap: one pixel per block, built once per world (a few rows at a time) and then scaled with drawImage.
  let mapBase=null,mapKey='',mapRow=0,mapData=null;
  function tileColor(t,world){let c=V.biomes[t.biome].color;if(t.kind==='water')c='#659a9b';if(t.kind==='path'||t.kind==='bridge')c='#c9b684';if(t.kind==='tree')c=V.biomes[t.biome].dark;if(t.kind==='rock'&&!t.underground)c=darken(V.biomes[t.biome].color,18);if(t.kind==='farm')c='#a88d52';if(t.kind==='building')c='#b78962';if(t.kind==='citywall')c='#8a8577';if(t.decor)c='#a86a52';if(t.cobble)c='#bdb6a2';
    if(t.underground)c=t.kind==='wall'?'#242331':t.kind==='rock'?'#92bfc7':t.kind==='water'?'#1f4f60':t.kind==='lava'?'#d4582c':t.kind==='seal'?(t.citadel?(world.citadel?.open?'#8a7a55':'#f0c050'):world.deep?.sealOpen?'#7a6a95':'#b58cff'):t.kind==='mushroom'?'#5fae8a':t.kind==='stal'?'#3a3848':t.deep?(deepFloor[t.theme]?darken(deepFloor[t.theme],-30):'#686075'):'#686075';return c;}
  function buildMapBase(world,ms){const key=world.seed+'|'+!!world.citadel?.open+'|'+!!world.deep?.sealOpen,S=V.SIZE;if(key!==mapKey){mapKey=key;mapRow=0;mapBase=null;mapData=new ImageData(S,S);}
    if(mapBase)return true;const end=performance.now()+ms,d=mapData.data;
    while(mapRow<S&&performance.now()<end){for(let x=0;x<S;x++){const n=parseInt(tileColor(tile(x,mapRow,world),world).slice(1,7),16),i=(mapRow*S+x)*4;d[i]=n>>16;d[i+1]=(n>>8)&255;d[i+2]=n&255;d[i+3]=255;}mapRow++;}
    if(mapRow<S)return false;mapBase=surface(S,S);mapBase.getContext('2d').putImageData(mapData,0,0);mapData=null;return true;}
  // The whole world (2560x2560) at one pixel per 4x4 tiles, built a few rows per call; the valley keeps its full-detail base.
  let worldBase=null,worldKey='',worldRow=0,worldData=null,lastView={cx:128,cy:128,span:256},fogKey='',fogCanvas=null;
  const WB=4;
  function buildWorldBase(world,ms){const Wd=V.WORLD,S=(Wd.x1-Wd.x0)/WB,key=world.seed+'|'+S;if(key!==worldKey){worldKey=key;worldRow=0;worldBase=null;worldData=new ImageData(S,S);}
    if(worldBase)return true;const end=performance.now()+ms,d=worldData.data;
    while(worldRow<S&&performance.now()<end){const wy=Wd.y0+worldRow*WB+2;for(let x=0;x<S;x++){const n=parseInt(tileColor(tile(Wd.x0+x*WB+2,wy,world),world).slice(1,7),16),i=(worldRow*S+x)*4;d[i]=n>>16;d[i+1]=(n>>8)&255;d[i+2]=n&255;d[i+3]=255;}worldRow++;}
    if(worldRow<S)return false;worldBase=surface(S,S);worldBase.getContext('2d').putImageData(worldData,0,0);worldData=null;return true;}
  // Fog of war: one pixel per 8x8 block over the whole world, rebuilt when the explored count changes.
  function fog(p){const Wd=V.WORLD,S=(Wd.x1-Wd.x0)/8,keys=Object.keys(p.discovered||{}),key=p.id+'|'+keys.length;if(key===fogKey&&fogCanvas)return fogCanvas;fogKey=key;
    fogCanvas||=surface(S,S);const g=fogCanvas.getContext('2d'),img=g.createImageData(S,S),d=img.data;for(let i=0;i<d.length;i+=4){d[i]=211;d[i+1]=202;d[i+2]=165;d[i+3]=150;}
    const bx0=Wd.x0/8,by0=Wd.y0/8;for(const k of keys){const [bx,by]=k.split(',').map(Number),x=bx-bx0,y=by-by0;if(x>=0&&y>=0&&x<S&&y<S)d[(y*S+x)*4+3]=0;}g.putImageData(img,0,0);return fogCanvas;}
  function viewFor(p,large,mode){const H=V.SIZE,Wd=V.WORLD,inHeart=p.x>=0&&p.y>=0&&p.x<H&&p.y<H;mode=mode||(inHeart?'vale':'arredores');
    if(mode==='mundo')return {mode,cx:(Wd.x0+Wd.x1)/2,cy:(Wd.y0+Wd.y1)/2,span:Wd.x1-Wd.x0};
    if(mode==='arredores')return {mode,cx:Math.max(Wd.x0+256,Math.min(Wd.x1-256,p.x)),cy:Math.max(Wd.y0+256,Math.min(Wd.y1-256,p.y)),span:512};
    return {mode:'vale',cx:H/2,cy:H/2,span:H};}
  // Returns false while the world base is still being built (the caller redraws on the next frame).
  function map(target,world,me,large=false,waypoint=null,options={}){const g=target.getContext('2d'),p=world.players[me];if(!p)return true;const width=target.width,height=target.height,time=world.time||0;g.imageSmoothingEnabled=false;g.fillStyle='#d3caa5';g.fillRect(0,0,width,height);
    const view=large?viewFor(p,true,options.view):null;if(large)lastView=view;const scale=large?width/view.span:4,cx=large?view.cx:p.x,cy=large?view.cy:p.y;const minX=Math.floor(cx-width/scale/2),minY=Math.floor(cy-height/scale/2);const toX=x=>(x-cx)*scale+width/2,toY=y=>(y-cy)*scale+height/2;labelScale=large?Math.max(1,width/560):1;
    const inHeart=p.x>=0&&p.y>=0&&p.x<V.SIZE&&p.y<V.SIZE;let complete=true;
    if(large){const Wd=V.WORLD;if(view.mode!=='vale'||!inHeart){complete=buildWorldBase(world,40);if(worldBase)g.drawImage(worldBase,Math.round(toX(Wd.x0)),Math.round(toY(Wd.y0)),(Wd.x1-Wd.x0)*scale,(Wd.y1-Wd.y0)*scale);}
      if(buildMapBase(world,40))g.drawImage(mapBase,Math.round(toX(0)),Math.round(toY(0)),V.SIZE*scale,V.SIZE*scale);else complete=false;
      g.drawImage(fog(p),Math.round(toX(Wd.x0)),Math.round(toY(Wd.y0)),(Wd.x1-Wd.x0)*scale,(Wd.y1-Wd.y0)*scale);}
    else if(inHeart&&buildMapBase(world,4))g.drawImage(mapBase,Math.round(toX(0)),Math.round(toY(0)),V.SIZE*scale,V.SIZE*scale);
    else for(let y=minY;y<cy+height/scale/2;y++)for(let x=minX;x<cx+width/scale/2;x++){const t=tile(x,y,world),discovered=p.discovered?.[`${Math.floor(x/8)},${Math.floor(y/8)}`];let c=V.biomes[t.biome].color;if(t.kind==='water')c='#659a9b';if(t.kind==='path'||t.kind==='bridge')c='#c9b684';if(t.kind==='tree')c=V.biomes[t.biome].dark;if(t.kind==='rock'&&!t.underground)c=darken(V.biomes[t.biome].color,18);if(t.kind==='farm')c='#a88d52';if(t.kind==='building')c='#b78962';if(t.kind==='citywall')c='#8a8577';if(t.decor)c='#a86a52';if(t.cobble)c='#bdb6a2';if(t.underground)c=t.kind==='wall'?'#242331':t.kind==='rock'?'#92bfc7':t.kind==='water'?'#1f4f60':t.kind==='lava'?'#d4582c':t.kind==='seal'?(t.citadel?(world.citadel?.open?'#8a7a55':'#f0c050'):world.deep?.sealOpen?'#7a6a95':'#b58cff'):t.kind==='mushroom'?'#5fae8a':t.kind==='stal'?'#3a3848':t.deep?(deepFloor[t.theme]?darken(deepFloor[t.theme],-30):'#686075'):'#686075';if(large&&!discovered&&!t.underground)c=darken(c,-25);rect(g,toX(x),toY(y),Math.ceil(scale),Math.ceil(scale),c);}
    if(large){
      const step=view.span>=2000?256:view.span>=500?64:32;for(let i=Math.ceil((cx-view.span/2)/step)*step;i<cx+view.span/2;i+=step){g.strokeStyle='#2f3a2c26';g.lineWidth=1;g.beginPath();g.moveTo(toX(i)+.5,0);g.lineTo(toX(i)+.5,height);g.moveTo(0,toY(i)+.5);g.lineTo(width,toY(i)+.5);g.stroke();mapLabel(g,String(i),toX(i)+2,height-4,'#5e5a44',8);mapLabel(g,String(i),2,toY(i)-2,'#5e5a44',8);}
      [[132,104],[212,88],[216,158],[98,240],[28,182],[40,100],[40,70],[160,58]].forEach(([x,y],i)=>{const b=V.biomes[i];mapLabel(g,b.name.toUpperCase(),toX(x),toY(y),'#3a3226cc',10,'center',true);mapLabel(g,'Nível '+b.level+' · '+V.monsterTypes[b.monster].name,toX(x),toY(y)+11,'#5b5240',8,'center');});
      for(const d of V.expeditions){if(d.kind==='citadel'){g.strokeStyle='#e8b04a';g.lineWidth=1;g.strokeRect(toX(d.rx)+.5,toY(d.ry)+.5,d.w*scale,d.h*scale);for(const a of V.citadelAreas)mapLabel(g,a.name,toX(d.rx+a.x),toY(d.ry+a.y)+3,a.boss?'#7a2d25':'#3b3050',7,'center',!!a.boss);continue;}if(d.kind==='deep'){g.strokeStyle='#f08a4b';g.lineWidth=1;g.strokeRect(toX(d.rx)+.5,toY(d.ry)+.5,d.w*scale,d.h*scale);continue;}const x=toX(d.rx),y=toY(d.ry);g.strokeStyle=d.kind==='raid'?'#c08ae6':'#78bfc7';g.lineWidth=1;g.strokeRect(x+.5,y+.5,d.w*scale,d.h*scale);mapLabel(g,d.name.replace('Raide ','R. ').replace('Caverna ','Cav. '),x+d.w*scale/2,y+d.h*scale+10,'#3b3050',8,'center');}
      if(view.mode!=='mundo')mapLabel(g,'CIDADELA DO TOTEM · SUBTERRÂNEO',toX(123),toY(41)+2,'#6b4f12',8,'center',true);{const k=V.kingdoms.find(k=>k.bounds);if(k)mapLabel(g,'CAPITAL DE AURÓRIA',toX((k.bounds.x0+k.bounds.x1)/2),toY(k.bounds.y0)-3,'#3a2a12',9,'center',true);}for(const a of V.abyssAreas)mapLabel(g,a.name,toX(V.abyss.rx+a.x),toY(V.abyss.ry+a.y)+3,a.lair?'#7a2d25':'#3b3050',7,'center',!!a.lair);
      const rx=width-34,ry=height-40;g.fillStyle='#f3ebcfcc';g.beginPath();g.arc(rx,ry,22,0,Math.PI*2);g.fill();g.strokeStyle='#6d5d3e';g.lineWidth=1;g.stroke();g.fillStyle='#8b3d32';g.beginPath();g.moveTo(rx,ry-18);g.lineTo(rx-5,ry);g.lineTo(rx+5,ry);g.fill();g.fillStyle='#4c4a3c';g.beginPath();g.moveTo(rx,ry+18);g.lineTo(rx-5,ry);g.lineTo(rx+5,ry);g.fill();mapLabel(g,'N',rx,ry-22,'#8b3d32',9,'center',true);mapLabel(g,'S',rx,ry+30,'#4c4a3c',9,'center',true);mapLabel(g,'O',rx-31,ry+3,'#4c4a3c',9,'center',true);mapLabel(g,'L',rx+31,ry+3,'#4c4a3c',9,'center',true);
    }
    const village=['npc','forge','inn','well','chest','farm','guild'];
    for(const l of V.landmarks){if(l.kind==='exit'&&large)continue;const skipLabel=large&&(l.kind==='hoard'||l.kind==='camp'&&view.span>600);const x=toX(l.x+.5),y=toY(l.y+.5);if(x<-10||y<-10||x>width+10||y>height+10)continue;const status=landmarkStatus(l,world,p);if(large&&village.includes(l.kind)){if(l.kind==='guild')mapMarker(g,l,x,y,false,status,time);else rect(g,x-1,y-1,3,3,markerColors[l.kind]);continue;}
      const hl=options.highlight===l.id;if(hl){g.strokeStyle='#fff4c5';g.lineWidth=2;g.beginPath();g.arc(x,y,11+Math.sin(time*5)*2,0,Math.PI*2);g.stroke();}
      mapMarker(g,l,x,y,large,status,time);
      if(large&&!skipLabel){const own=l.kind==='seat'&&V.familyOf(p).id===l.house;let label=l.name;if(l.kind==='raid'){const boss=V.monsterTypes[V.expeditions.find(d=>d.id===l.id)?.boss];label+=boss?' ('+boss.name.split(' ').slice(-1)[0]+')':'';}if(own)label='★ '+label;mapLabel(g,label,x+8*labelScale,y+3*labelScale,l.kind==='raid'?'#4b2d63':l.kind==='boss'?'#7a2d25':l.kind==='seat'?(l.noble?'#6b4f12':'#4f3a24'):'#233f37',l.kind==='town'?10:8,'left',l.kind==='town'||own);}
    }
    for(const grave of world.graves||[])if(grave.owner===me){const x=toX(grave.x),y=toY(grave.y);rect(g,x-3,y-5,6,8,'#6f6a73');rect(g,x-1,y-3,2,4,'#e8e1ea');if(large)mapLabel(g,'Sua lápide · '+grave.gold+' moedas',x+6,y+3,'#4d4452',8);}
    if(waypoint){const wx=toX(waypoint.x),wy=toY(waypoint.y);g.setLineDash([4,4]);g.strokeStyle='#fff4c5cc';g.lineWidth=1.5;g.beginPath();g.moveTo(toX(p.x),toY(p.y));g.lineTo(wx,wy);g.stroke();g.setLineDash([]);g.strokeStyle='#fff4c5';g.lineWidth=2;g.beginPath();g.arc(wx,wy,6,0,Math.PI*2);g.stroke();g.strokeStyle='#8b3d32';g.lineWidth=1;g.beginPath();g.arc(wx,wy,3,0,Math.PI*2);g.stroke();}
    for(const q of Object.values(world.players)){if(q.online===false&&q.id!==me)continue;const x=toX(q.x),y=toY(q.y);rect(g,x-3,y-3,7,7,'#334b40');rect(g,x-2,y-2,5,5,q.id===me?'#fff1ca':'#9aceda');if(q.id===me){const d=[[0,1],[-1,0],[1,0],[0,-1]][q.dir||0];g.strokeStyle='#fff1ca';g.lineWidth=2;g.beginPath();g.moveTo(x+.5,y+.5);g.lineTo(x+.5+d[0]*8,y+.5+d[1]*8);g.stroke();}if(large)mapLabel(g,q.id===me?'Você':q.name,x+6,y-5,q.id===me?'#1f3a2c':'#2d5563',9,'left',true);}
    return complete;
  }
  function mapPick(canvasX,canvasY,width,radius=12){const v=lastView,scale=width/v.span,ox=v.cx-v.span/2,oy=v.cy-v.span/2;let best=null,bestD=radius;for(const l of V.landmarks){if(l.kind==='exit')continue;const d=Math.hypot((l.x+.5-ox)*scale-canvasX,(l.y+.5-oy)*scale-canvasY);if(d<bestD){bestD=d;best=l;}}return best;}
  return {tree,walkFrame,render,map,mapPick,mapView:()=>({...lastView}),landmarkStatus,portrait,icon,sprite,setQuality,get quality(){return quality;},chunkStats:()=>({...chunkStats}),setZoom(value){zoom=value;},resetCamera(p){camera={x:p.x*32,y:p.y*32};motionStates.clear();creatureStates.clear();displayPositions.clear();}};
})();
