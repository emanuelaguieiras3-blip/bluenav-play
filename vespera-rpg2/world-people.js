'use strict';
// Procedural pixel-art villagers. Each look (see assignLooks in world-core.js) becomes a
// small sprite sheet built on demand: directional walks, job actions and blink, with bounded caches.
window.WorldPeople=(()=>{
  const W=32,H=58,FOOT=55,cache=new Map(),OUT='#241c26';
  function shade(color,amount){const n=parseInt(color.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+amount)).toString(16).padStart(2,'0')).join('');}
  function sprite(look,dir,frame,blink,action='walk'){
    const key=JSON.stringify(look)+'|'+dir+'|'+frame+'|'+(blink?1:0)+'|'+action;if(cache.has(key))return cache.get(key);
    const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
    if(dir===1){const right=sprite(look,2,frame,blink,action);g.translate(W,0);g.scale(-1,1);g.drawImage(right,0,0);cache.set(key,c);return c;}
    draw(g,look,dir,frame,blink,action);if(cache.size>1536)cache.delete(cache.keys().next().value);cache.set(key,c);return c;
  }
  function draw(g,L,dir,frame,blink,action){
    const P=(x,y,w,h,col)=>{if(w<=0||h<=0)return;g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),w,h);};
    const O=(x,y,w,h,col)=>{P(x-1,y-1,w+2,h+2,OUT);P(x,y,w,h,col);};
    const child=L.body==='child',elder=L.body==='elder',female=L.body==='woman'||['dress','gown'].includes(L.outfit)&&!child;
    const side=dir===2,back=dir===3,cx=16;
    const legH=child?7:10,torsoH=child?9:13,head=child?11:12,bend=elder?1:0;
    const working=!['walk','idle','sleep'].includes(action),beat=[0,1,0,-1][frame],step=action==='walk'?beat:0,bob=action==='play'&&frame%2?-3:frame%2?1:0,swing=working?beat*3:step*2;
    const waist=FOOT-legH,shoulder=waist-torsoH+bob,headTop=shoulder-head+1+bend;
    const skin=L.skin,skinD=shade(skin,-28),main=L.main,mainD=shade(main,-34),mainL=shade(main,26),acc=L.accent,hair=L.hairColor,hairD=shade(hair,-30),hairL=shade(hair,28);
    const pants=L.outfit==='armor'?'#4a4f5c':shade(main,-70),boot='#3a2a24';
    const long=['dress','gown','robe'].includes(L.outfit),coat=L.outfit==='coat';
    const tw=side?9:child?10:12,tx=cx-Math.floor(tw/2);
    // Cape and back-carried items sit behind the body.
    if(L.cape){const flow=Math.round(Math.sin(frame*1.6)*1);const capeC=L.outfit==='noble'||L.outfit==='gown'?shade(main,-12):shade(acc,-20);
      if(back)O(tx-1,shoulder,tw+2,FOOT-shoulder-2,capeC);else if(side)O(tx-4-flow,shoulder+1,5,FOOT-shoulder-4,capeC);else{P(tx-2,shoulder+1,2,FOOT-shoulder-5,capeC);P(tx+tw,shoulder+1,2,FOOT-shoulder-5,capeC);}}
    if(L.item==='spear'&&!side)held(true);
    // Legs and boots.
    if(!long){
      if(side){const a=cx-2+swing,b=cx-2-swing;O(b,waist,4,legH-2,shade(pants,-12));O(b-1,FOOT-3,6,3,boot);O(a,waist,4,legH-2,pants);O(a,FOOT-3,6,3,boot);}
      else{const lift=[0,2,0,0][frame],lift2=[0,0,0,2][frame];O(cx-5,waist,4,legH-2-lift,pants);O(cx-6,FOOT-3-lift,5,3,boot);O(cx+1,waist,4,legH-2-lift2,pants);O(cx+1,FOOT-3-lift2,5,3,boot);}
    }
    // Torso and outfit.
    if(long){const hem=FOOT-2,flare=L.outfit==='gown'?4:2,sway=side?0:step;
      g.fillStyle=OUT;g.beginPath();g.moveTo(tx-1,waist-1);g.lineTo(tx+tw+1,waist-1);g.lineTo(tx+tw+flare+1+sway,hem+1);g.lineTo(tx-flare-1+sway,hem+1);g.closePath();g.fill();
      g.fillStyle=main;g.beginPath();g.moveTo(tx,waist);g.lineTo(tx+tw,waist);g.lineTo(tx+tw+flare+sway,hem);g.lineTo(tx-flare+sway,hem);g.closePath();g.fill();
      P(tx+tw-2+sway,waist+2,2,hem-waist-2,mainD);P(tx+1,waist+1,1,hem-waist-3,mainL);
      if(L.outfit==='gown'){P(tx-flare+sway,hem-3,tw+flare*2,2,acc);for(let i=0;i<3;i++)P(tx+2+i*4+sway,waist+4+i*2,1,1,acc);}
      if(L.outfit==='robe'){P(cx-1,waist,2,hem-waist,mainD);}
      P(side?cx-2:cx-5,hem-1,side?5:4,2,boot);if(!side)P(cx+1,hem-1,4,2,boot);
    }
    O(tx,shoulder,tw,torsoH,main);P(tx+tw-2,shoulder+1,2,torsoH-1,mainD);P(tx+1,shoulder+1,1,torsoH-2,mainL);
    if(L.outfit==='armor'){P(tx,shoulder,tw,torsoH,'#9aa6b2');P(tx+tw-3,shoulder,3,torsoH,'#6f7a88');P(tx+1,shoulder+1,2,torsoH-3,'#d3dce4');if(!back&&!side)P(cx-2,shoulder+2,4,torsoH-2,main);P(tx-2,shoulder,4,3,'#c3ccd6');P(tx+tw-2,shoulder,4,3,'#8b95a3');}
    else if(L.outfit==='apron'){if(!back){P(tx+2,shoulder+4,tw-4,torsoH-3,'#f1efe6');P(tx+2,waist,tw-4,side?6:9,'#f1efe6');P(tx+tw-4,waist,2,side?6:9,'#d6d2c4');}P(tx,waist-2,tw,1,acc);}
    else if(L.outfit==='noble'){P(tx,shoulder,tw,2,acc);if(!back)P(cx-1,shoulder+2,2,torsoH-2,acc);P(tx,waist-2,tw,2,shade(acc,-30));}
    else if(L.outfit==='gown'){P(tx,shoulder,tw,2,acc);if(!back)P(cx-2,shoulder+2,4,3,shade(main,40));}
    else if(L.outfit==='robe'){P(tx,waist-3,tw,2,acc);}
    else if(coat){O(tx-1,waist-2,tw+2,legH-3,main);P(tx+tw-2,waist-1,2,legH-4,mainD);if(!back&&!side)for(let i=0;i<3;i++)P(cx,shoulder+3+i*4,1,1,acc);}
    else{P(tx,waist-3,tw,2,shade(acc,-40));if(!back&&!side)P(cx-1,waist-3,2,2,acc);P(tx+1,shoulder,tw-2,1,acc);}
    // Arms swing opposite to the legs.
    const arm=L.outfit==='armor'?'#8b95a3':L.outfit==='apron'||long?shade(main,-10):main;
    if(working){const ay=shoulder+4+beat*3;O(cx+tw/2,ay,3,6,arm);P(cx+tw/2,ay+5,3,2,skin);if(action==='smith'){P(cx+tw/2+3,ay-5,2,10,'#94623e');O(cx+tw/2,ay-6,7,3,'#b8c8cc');}if(action==='garden'||action==='sweep'){P(cx+tw/2+3,ay-1,1,16,'#94623e');O(cx+tw/2,ay+13,7,3,action==='garden'?'#8b9f9c':'#d8b968');}if(action==='eat'||action==='cook'){O(cx+tw/2-2,ay+4,6,3,'#cc8f54');P(cx+tw/2-1,ay+3,4,1,'#f3d89c');}if(action==='read'){O(cx+tw/2-3,ay+2,7,5,'#794851');P(cx+tw/2-2,ay+3,5,3,'#eee1bd');}if(action==='wave'||action==='social'){P(cx+tw/2+3,shoulder-2+beat*2,3,5,skin);}}
    if(side){O(cx-1-swing,shoulder+2,3,torsoH-3,shade(arm,-10));P(cx-1-swing,shoulder+torsoH-1,3,2,skin);}
    else{O(tx-3,shoulder+1+step,3,torsoH-3,arm);P(tx-3,shoulder+torsoH-2+step,3,2,skin);O(tx+tw,shoulder+1-step,3,torsoH-3,shade(arm,-16));P(tx+tw,shoulder+torsoH-2-step,3,2,skinD);}
    // Head.
    const hx=side?cx-4:cx-Math.floor(head/2),hw=side?9:head;
    O(hx,headTop,hw,head,skin);P(hx+hw-2,headTop+1,2,head-2,skinD);
    if(!back){const ey=headTop+Math.floor(head*.5);
      if(side){P(hx+hw-3,ey,1,blink?1:2,OUT);P(hx+hw,ey+2,1,1,skinD);if(!elder)P(hx+hw-4,ey+3,1,1,'#e59a90');}
      else{if(blink){P(cx-3,ey+1,2,1,OUT);P(cx+1,ey+1,2,1,OUT);}else{P(cx-3,ey,2,2,OUT);P(cx+1,ey,2,2,OUT);P(cx-3,ey,1,1,'#ffffff');P(cx+1,ey,1,1,'#ffffff');}
        P(cx-1,ey+3,2,1,shade(skin,-45));if(female||child){P(cx-5,ey+2,1,1,'#e59a90');P(cx+4,ey+2,1,1,'#e59a90');}if(elder){P(cx-4,ey-1,2,1,skinD);P(cx+2,ey-1,2,1,skinD);}}
      if(L.beard==='full'){P(hx+(side?3:1),headTop+head-4,side?6:hw-2,4,hair);P(hx+(side?3:2),headTop+head,side?5:hw-4,2,hairD);}
      else if(L.beard==='mustache'){P(side?hx+hw-4:cx-3,headTop+head-4,side?3:6,1,hair);}
      else if(L.beard==='goatee'){P(side?hx+hw-3:cx-1,headTop+head-2,side?2:2,3,hair);}
    }
    // Hair.
    const hs=L.hair,covered=['hood','helmet','chef','wizard'].includes(L.hat);
    if(hs!=='bald'||back){
      const top=headTop-1;
      if(back){O(hx,top,hw,head-2,hair);P(hx+hw-2,top,2,head-2,hairD);}
      else if(side){O(hx,top,hw-2,4,hair);O(hx-1,top+1,4,head-3,hair);P(hx,top,hw-3,1,hairL);}
      else{O(hx,top,hw,4,hair);P(hx-1,top+2,2,5,hair);P(hx+hw-1,top+2,2,5,hair);P(hx+1,top,hw-3,1,hairL);if(hs==='spiky')for(let i=0;i<4;i++)P(hx+1+i*3,top-2,2,2,hair);if(hs==='curly')for(let i=0;i<4;i++)P(hx+i*3,top-1+(i%2),3,2,hairL);}
      if(hs==='long'||hs==='braids'){const len=hs==='long'?12:14;if(back)O(hx,top+head-3,hw,len-6,hair);else if(side)O(hx-1,top+3,4,len,hair);else{O(hx-1,top+3,3,len,hair);O(hx+hw-2,top+3,3,len,hair);if(hs==='braids'){P(hx-1,top+len,3,2,acc);P(hx+hw-2,top+len,3,2,acc);}}}
      if(hs==='bun')O(back||side?hx+(side?-1:hw/2-3):hx+hw/2-3,top-4,6,5,hair);
      if(hs==='ponytail'){const sway=Math.round(Math.sin(frame*1.57)*1);if(back)O(cx-2+sway,top+4,4,11,hair);else if(side)O(hx-3+sway,top+3,3,10,hair);else P(hx+hw,top+4,2,6,hairD);}
    }
    else if(!covered&&!back){P(hx,headTop+3,1,3,hairD);P(hx+hw-1,headTop+3,1,3,hairD);}
    // Hats.
    const hatTop=headTop-1,H2=L.hat;
    if(H2==='straw'){O(hx-3,hatTop+2,hw+6,2,'#e2c26a');O(hx+1,hatTop-3,hw-2,5,'#d7b456');P(hx+1,hatTop,hw-2,1,'#b0452f');}
    else if(H2==='cap'){O(hx,hatTop-1,hw,4,main===L.main?shade(acc,-60):acc);if(!back)P(side?hx+hw-1:hx+1,hatTop+2,side?4:hw-2,1,shade(acc,-80));}
    else if(H2==='hood'){O(hx-1,hatTop-1,hw+2,head-1,mainD);if(!back)P(hx+(side?4:1),hatTop+3,side?hw-4:hw-2,head-5,skin);if(!back&&!side){P(cx-3,headTop+Math.floor(head*.5),2,2,OUT);P(cx+1,headTop+Math.floor(head*.5),2,2,OUT);}}
    else if(H2==='helmet'){O(hx-1,hatTop-1,hw+2,6,'#a7b1bb');P(hx-1,hatTop-1,hw+2,1,'#dfe6ec');P(hx+hw-1,hatTop,2,5,'#76808d');if(!back&&!side)P(cx-1,hatTop+4,2,4,'#8a94a0');P(cx-1,hatTop-4,2,3,shade(main,10));}
    else if(H2==='crown'){O(hx+1,hatTop-2,hw-2,3,'#e8c14a');for(let i=0;i<3;i++)P(hx+2+i*(hw-5)/2,hatTop-5,2,3,'#f3d56a');P(cx-1,hatTop-1,2,1,'#c0304a');P(hx+2,hatTop-1,1,1,'#3a7fd0');}
    else if(H2==='tiara'){P(hx+1,hatTop,hw-2,1,'#f3d56a');P(cx-1,hatTop-2,2,2,'#f3d56a');P(cx-1,hatTop-1,2,1,'#79c3e8');}
    else if(H2==='chef'){O(hx,hatTop-7,hw,8,'#f4f2ea');O(hx-1,hatTop-9,hw+2,4,'#ffffff');P(hx+hw-2,hatTop-7,2,7,'#d9d6cb');}
    else if(H2==='wizard'){O(hx-3,hatTop+1,hw+6,2,mainD);g.fillStyle=OUT;g.beginPath();g.moveTo(hx-1,hatTop+2);g.lineTo(cx+4+(side?3:0),hatTop-13);g.lineTo(hx+hw+1,hatTop+2);g.fill();g.fillStyle=main;g.beginPath();g.moveTo(hx,hatTop+1);g.lineTo(cx+4+(side?3:0),hatTop-11);g.lineTo(hx+hw,hatTop+1);g.fill();P(hx+2,hatTop-1,hw-4,1,acc);}
    else if(H2==='bandana'){O(hx,hatTop,hw,3,acc);if(back||side)P(side?hx-2:cx-1,hatTop+2,3,3,shade(acc,-20));}
    else if(H2==='feather'){O(hx,hatTop-1,hw,3,mainD);P(side?hx:hx+hw-3,hatTop-7,2,6,acc);P(side?hx+1:hx+hw-2,hatTop-8,1,2,'#ffffff');}
    if(L.item!=='spear'||side)held(false);
    function held(behind){
      if(back&&!behind&&L.item!=='spear')return;
      const hxr=side?cx+2-swing:tx+tw+1,hy=shoulder+torsoH-1+(side?0:-step);
      switch(L.item){
        case'spear':O(side?cx+4:tx+tw+1,headTop-10,1,FOOT-headTop+8,'#7a5a3a');P((side?cx+4:tx+tw+1)-1,headTop-13,3,4,'#d8dee6');break;
        case'staff':O(hxr,headTop-4,2,FOOT-headTop+2,'#6b4a2e');P(hxr-1,headTop-6,4,3,'#8fd3e0');break;
        case'basket':O(hxr-2,hy,6,4,'#b58a4e');P(hxr-2,hy-1,6,1,'#e5c07a');P(hxr-1,hy-2,2,1,'#c0304a');P(hxr+2,hy-2,1,1,'#7fb04a');break;
        case'book':O(hxr-1,hy-2,4,5,'#7a3b3b');P(hxr,hy-1,2,3,'#f1e6c8');break;
        case'bag':if(!side){P(tx+tw-1,shoulder,2,torsoH,'#6b4a2e');O(tx+tw-1,waist-2,5,5,'#8a6a3e');}else O(cx-4,waist-3,5,5,'#8a6a3e');break;
        case'lute':O(side?cx:cx-4,shoulder+3,8,6,'#b0743a');P(side?cx+7:cx+3,shoulder-2,2,6,'#6b4a2e');P(side?cx+3:cx-1,shoulder+5,2,2,'#4a2f1e');break;
        case'broom':O(hxr,shoulder-4,1,FOOT-shoulder,'#8a6a3e');O(hxr-2,FOOT-5,5,4,'#d4b36a');break;
        case'sword':O(hxr,hy-8,1,10,'#dfe6ec');P(hxr-1,hy+1,3,1,'#c9a45c');break;
        case'flowers':O(hxr-1,hy-3,4,4,'#4f7a45');P(hxr-1,hy-4,2,2,'#f08aa8');P(hxr+1,hy-4,2,2,'#f3d56a');break;
        case'bell':O(hxr-1,hy-1,4,4,'#e0b24a');P(hxr,hy+2,2,1,'#8a6a2e');break;
        case'fish':O(hxr-3,hy,7,3,'#8fb4c8');P(hxr+4,hy,1,3,'#6f94a8');break;
      }
    }
  }
  // Blink every few seconds, desynchronised per villager.
  // ---------- Painted villagers ----------
  // Same painted walk cycle as the heroes, repainted per person (palette swap) and dressed in
  // layers (paper doll): hats, crowns, beards, skirts, aprons, armour, capes and held items.
  const painted=new Map(),baseData=new Map(),lookKeys=new WeakMap();let genLeft=Infinity,genGap=0,genAt=-1e9,idleQueued=false;const wanted=new Map();
  // JSON of a look is built once per look object, not on every draw call.
  function lookKey(look){let k=lookKeys.get(look);if(!k){k=JSON.stringify(look);lookKeys.set(look,k);}return k;}
  function rgb(hex){const n=parseInt(hex.slice(1),16);return [n>>16,(n>>8)&255,n&255];}
  function tone(target,lum,ref){const f=lum/ref;return f<=1?target.map(v=>v*f):target.map(v=>v+(255-v)*Math.min(.7,(f-1)*.45));}
  function paintedSprite(look,dir,frame,action='walk',blink=false){
    const assets=window.GameAssets;if(!assets)return null;
    const female=look.body==='woman'||look.female===true||(look.body==='child'&&['ponytail','braids','long','bun'].includes(look.hair)),app=female?'female':'male';
    const side=dir===1||dir===2,drawDir=dir===1?2:dir,base=action==='walk'&&frame?assets.get(`walk-${app}-${drawDir}-${frame-1}`):assets.get(`idle-${app}-${drawDir}`);if(!base)return null;
    const lk=lookKey(look),eyes=blink?'|1':'',key=lk+'|'+dir+'|'+frame+'|'+(action||'')+eyes;if(painted.has(key))return painted.get(key);
    // Over this frame's budget: show another frame of the same person already painted instead of stalling.
    const now=performance.now();if(genLeft<=0||now-genAt<genGap){const open=blink&&painted.get(lk+'|'+dir+'|'+frame+'|'+(action||''));if(open){wanted.set(key,[look,dir,frame,action,blink]);queueIdle();return open;}const tail='|'+(action||'');for(let f=0;f<7;f++){const other=painted.get(lk+'|'+dir+'|'+f+tail)||painted.get(lk+'|'+dir+'|'+f+'|walk')||painted.get(lk+'|0|'+f+tail);if(other){wanted.set(key,[look,dir,frame,action,blink]);queueIdle();return other;}}}
    // Facing left mirrors the right-facing sprite; a stand-in frame is shown mirrored but never cached as the real one.
    if(dir===1){const art=paintedSprite(look,2,frame,action,blink);if(!art)return null;const out=document.createElement('canvas');out.width=art.width;out.height=art.height;const g=out.getContext('2d');g.translate(out.width,0);g.scale(-1,1);g.drawImage(art,0,0);out.foot=art.foot;out.center=out.width-art.center;
      if(painted.get(lk+'|2|'+frame+'|'+(action||'')+eyes)===art){if(painted.size>=2048)painted.delete(painted.keys().next().value);painted.set(key,out);}else{wanted.set(key,[look,dir,frame,action,blink]);queueIdle();}return out;}
    genLeft--;genAt=now;
    const Wd=base.width,Hd=base.height,c=document.createElement('canvas');c.width=Wd+16;c.height=Hd+14;const g=c.getContext('2d'),OX=8,OY=12;
    if(action==='play')g.translate(0,frame%2?-3:0);
    // getImageData reads back from the GPU on phones: do it once per base frame and copy the pixels.
    let bd=baseData.get(base);if(!bd){const px=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,Wd,Hd),q=px.data;
      // Anchor on the face: top of silhouette, head centre from skin in the top rows. Depends only on the base frame.
      let top=Hd,sx=0,sn=0,faceTop=Hd;for(let i=3;i<q.length;i+=4)if(q[i]>100){top=Math.floor((i>>2)/Wd);break;}
      for(let y=top;y<Math.min(Hd,top+22);y++)for(let x=0;x<Wd;x++){const i=(y*Wd+x)*4,R=q[i],G=q[i+1],B=q[i+2];if(q[i+3]>100&&R>150&&G>95&&R-G<75&&G-B>20){sx+=x;sn++;faceTop=Math.min(faceTop,y);}}
      bd={px,top,sx,sn,faceTop};baseData.set(base,bd);}
    const src=new ImageData(new Uint8ClampedArray(bd.px.data),Wd,Hd),d=src.data,{top,sx,sn,faceTop}=bd;
    const cx=sn?sx/sn:Wd/2,back=dir===3||!sn,headLimit=female?top+26:top+15,headHalf=female?10:8.5;
    const hairT=rgb(look.hairColor),mainT=rgb(look.outfit==='armor'?'#8f9aa6':look.main),accT=rgb(look.accent),skinT=rgb(look.skin),skinBase=[236,188,142];
    const hooded=['hood','helmet'].includes(look.hat),bald=look.hair==='bald';
    for(let y=0;y<Hd;y++)for(let x=0;x<Wd;x++){const i=(y*Wd+x)*4;if(d[i+3]<30)continue;const R=d[i],G=d[i+1],B=d[i+2],L=(R*.3+G*.59+B*.11)/255;
      const skin=R>150&&G>95&&R-G<75&&G-B>20,white=R>175&&G>165&&B>130&&R-B<70,red=R>G*1.25&&!skin&&!white;
      let out=null;
      if(skin)out=skinT.map((v,k)=>[R,G,B][k]*v/skinBase[k]);
      else if(red&&(y<=top+9+(back?4:0)||y<=headLimit&&Math.abs(x-cx)<=headHalf+(y<faceTop+8?2:0)))out=hooded?tone(rgb(look.hat==='helmet'?'#9aa6b2':look.main),L,.3):bald&&y<=top+6?skinT.map((v,k)=>v*.82):tone(hairT,L,.3);
      else if(red&&R>165&&G>85&&B<90)out=tone(accT,L,.5);
      else if(red)out=tone(mainT,L,.2);
      else if(look.outfit==='armor'&&!white&&y>headLimit&&y<Hd*.62)out=tone(rgb('#b8c2cc'),L,.3);
      if(out){d[i]=Math.max(0,Math.min(255,out[0]));d[i+1]=Math.max(0,Math.min(255,out[1]));d[i+2]=Math.max(0,Math.min(255,out[2]));}}
    const body=document.createElement('canvas');body.width=Wd;body.height=Hd;body.getContext('2d').putImageData(src,0,0);
    const P=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(Math.round(x+OX),Math.round(y+OY),Math.round(w),Math.round(h));};
    const Q=(pts,col)=>{g.fillStyle=col;g.beginPath();pts.forEach(([x,y],k)=>k?g.lineTo(x+OX,y+OY):g.moveTo(x+OX,y+OY));g.closePath();g.fill();};
    const E2=(x,y,rx,ry,col)=>{g.fillStyle=col;g.beginPath();g.ellipse(x+OX,y+OY,rx,ry,0,0,Math.PI*2);g.fill();};
    const main=look.main,mainD=shade(main,-40),mainL=shade(main,30),acc=look.accent,hair=look.hairColor,hairD=shade(hair,-35),OUTL='#1d1418';
    const hx=cx+(side?(dir===2?1:-1)*0:0),waist=top+34,feet=Hd-4,swing=[0,1,0,-1,0,1,0][frame]||0;
    // Behind the body: cape, spear.
    if(look.cape){const col=look.outfit==='noble'||look.outfit==='gown'?shade(main,-15):shade(acc,-25);if(back)Q([[cx-11,top+18],[cx+11,top+18],[cx+14+swing,feet-4],[cx-14+swing,feet-4]],col);else if(side)Q([[cx-4,top+18],[cx-14-swing,feet-6],[cx-6,feet-6]],col);else{Q([[cx-12,top+19],[cx-9,top+19],[cx-14,feet-8],[cx-17,feet-10]],col);Q([[cx+12,top+19],[cx+9,top+19],[cx+14,feet-8],[cx+17,feet-10]],col);}}
    const hand=side?[cx+(dir===2?5:-5),top+33]:[cx+13,top+33];
    if(look.item==='spear'){P(hand[0],top-10,2,feet-top+8,OUTL);P(hand[0]+.5,top-9,1,feet-top+6,'#8a6a3e');Q([[hand[0]-2,top-9],[hand[0]+1,top-18],[hand[0]+4,top-9]],'#d8dee6');}
    g.drawImage(body,OX,OY);
    // Long garments cover the legs; they sway with the walk.
    if(['dress','gown','robe'].includes(look.outfit)){const flare=look.outfit==='gown'?12:look.outfit==='robe'?8:10,w0=side?5:6,sw=swing*1.2,y0=waist+2;
      // Bell-shaped skirt with folds and a curved hem.
      const shape=(inset,col)=>{g.fillStyle=col;g.beginPath();g.moveTo(cx-w0-inset+OX,y0-inset+OY);g.lineTo(cx+w0+inset+OX,y0-inset+OY);g.quadraticCurveTo(cx+w0+3+inset+OX,y0+8+OY,cx+flare+inset+sw+OX,feet+inset+OY);g.quadraticCurveTo(cx+sw+OX,feet+3+inset+OY,cx-flare-inset+sw+OX,feet+inset+OY);g.quadraticCurveTo(cx-w0-3-inset+OX,y0+8+OY,cx-w0-inset+OX,y0-inset+OY);g.fill();};
      shape(1,OUTL);shape(0,main);
      for(let k=-2;k<=2;k++){const fx=cx+k*flare*.36+sw*.7;g.strokeStyle=k>0?mainD:shade(main,-18);g.lineWidth=1;g.beginPath();g.moveTo(cx+k*2+OX,y0+3+OY);g.lineTo(fx+OX,feet-1+OY);g.stroke();}
      g.strokeStyle=mainL;g.beginPath();g.moveTo(cx-w0+1+OX,y0+2+OY);g.quadraticCurveTo(cx-w0-1+OX,y0+10+OY,cx-flare+3+sw+OX,feet-2+OY);g.stroke();
      if(look.outfit==='gown'){g.strokeStyle=acc;g.lineWidth=2;g.beginPath();g.moveTo(cx-flare+1+sw+OX,feet-2+OY);g.quadraticCurveTo(cx+sw+OX,feet+1+OY,cx+flare-1+sw+OX,feet-2+OY);g.stroke();g.lineWidth=1;P(cx-w0,y0-1,w0*2,2,acc);for(let k=0;k<5;k++)P(cx-7+k*3.5+sw*.5,y0+9+(k%2)*5,1,1,'#fff2c0');}
      if(look.outfit==='robe'){P(cx-w0-1,y0-2,w0*2+2,2,acc);P(cx+2,y0,1,10,acc);E2(cx+2,y0+11,1.5,1.5,acc);}
      if(look.outfit==='dress'){P(cx-w0,y0-1,w0*2,2,shade(acc,-25));}
      P(cx-4+sw,feet,3,2,'#3a2a24');if(!side)P(cx+2+sw,feet,3,2,'#3a2a24');}
    if(look.outfit==='apron'&&!back){const w0=side?5:7;P(cx-w0,top+23,w0*2,waist-top-22,'#efe9dc');P(cx-w0-1,waist,w0*2+2,16,'#f4efe4');P(cx+w0-3,waist,3,16,'#d6d0c2');P(cx-w0-1,waist-1,w0*2+2,1,shade(acc,-40));}
    if(look.outfit==='armor'){if(!back&&!side){P(cx-3,top+22,6,waist-top-20,main);P(cx-3,top+22,1,waist-top-20,mainL);}P(cx-14,top+19,8,4,'#d3dce4');P(cx+6,top+19,8,4,'#aab4c0');}
    if(look.outfit==='noble'&&!back){P(cx-1,top+22,2,waist-top-22,acc);P(cx-8,waist-1,16,2,acc);}
    if(blink&&!back){const ey=faceTop+4;if(side)P(cx+2,ey,3,1,shade(look.skin,-55));else{P(cx-5,ey,3,1,shade(look.skin,-55));P(cx+2,ey,3,1,shade(look.skin,-55));}}
    // Beard.
    if(!back&&['full','mustache','goatee'].includes(look.beard)){const by=top+(female?19:14),bx=side?cx+(dir===2?2:-6):cx-5;
      if(look.beard==='full'){P(bx,by,side?6:10,5,hair);P(bx+1,by+5,side?4:8,2,hairD);}else if(look.beard==='mustache')P(side?bx+1:cx-4,by-1,side?4:8,2,hair);else P(side?bx+2:cx-1,by+2,3,4,hair);}
    // Hair add-ons.
    if(look.hair==='bun')E2(cx+(side?(dir===2?-5:5):0),top-1,5,4,hair);
    if(look.hair==='ponytail'&&(back||side))Q([[cx-2+(side?(dir===2?-7:7):0),top+6],[cx+2+(side?(dir===2?-7:7):0),top+6],[cx+1+swing+(side?(dir===2?-9:9):0),top+22],[cx-2+swing+(side?(dir===2?-9:9):0),top+22]],hair);
    if(look.hair==='braids'&&!back){P(cx-11,top+14,3,16,hair);P(cx+8,top+14,3,16,hair);P(cx-11,top+29,3,2,acc);P(cx+8,top+29,3,2,acc);}
    // Hats.
    const ht=top,hw=female?20:18,hl=cx-hw/2;
    switch(look.hat){
      case'straw':E2(cx,ht+7,hw/2+6,3.5,'#b8923e');E2(cx,ht+6,hw/2+5,3,'#e2c26a');P(hl+2,ht-2,hw-4,8,'#d7b456');P(hl+2,ht+3,hw-4,2,'#b0452f');break;
      case'cap':P(hl+1,ht,hw-2,6,shade(acc,-70));P(hl+1,ht,hw-2,1,shade(acc,-40));if(!back)P(side?(dir===2?cx+2:cx-10):hl+3,ht+5,side?8:hw-6,2,shade(acc,-90));break;
      case'hood':P(hl-1,ht-1,hw+2,3,mainD);break;
      case'helmet':E2(cx,ht+5,hw/2+1,6,'#a7b1bb');P(hl,ht+5,hw,4,'#8a94a0');P(hl+2,ht+1,hw-6,1,'#e3eaf0');if(!back&&!side)P(cx-1,ht+6,2,8,'#8a94a0');P(cx-1,ht-4,2,4,main);break;
      case'crown':P(hl+2,ht-1,hw-4,4,'#e8c14a');P(hl+2,ht+2,hw-4,1,'#a8862e');for(let k=0;k<3;k++)Q([[hl+2+k*(hw-8)/2,ht-1],[hl+4+k*(hw-8)/2,ht-6],[hl+6+k*(hw-8)/2,ht-1]],'#f3d56a');P(cx-1,ht,2,2,'#c0304a');P(hl+4,ht,1,1,'#3a7fd0');P(hl+hw-5,ht,1,1,'#3a9a5a');break;
      case'tiara':P(hl+3,ht+3,hw-6,1,'#f3d56a');Q([[cx-3,ht+3],[cx,ht-2],[cx+3,ht+3]],'#f3d56a');P(cx-1,ht+1,2,2,'#79c3e8');break;
      case'chef':P(hl+1,ht-9,hw-2,11,'#f4f2ea');E2(cx,ht-9,hw/2+1,4,'#ffffff');P(hl+hw-4,ht-8,2,10,'#d9d6cb');break;
      case'wizard':E2(cx,ht+5,hw/2+6,3,mainD);Q([[hl-1,ht+5],[cx+(side?(dir===2?-6:6):3),ht-20],[hl+hw+1,ht+5]],main);Q([[cx,ht+5],[cx+(side?(dir===2?-6:6):3),ht-20],[hl+hw+1,ht+5]],mainD);P(hl+1,ht+2,hw-2,2,acc);break;
      case'bandana':P(hl+1,ht+3,hw-2,4,acc);P(hl+1,ht+6,hw-2,1,shade(acc,-40));if(back||side)P(side?(dir===2?hl-2:hl+hw-1):cx-1,ht+5,3,6,shade(acc,-20));break;
      case'feather':E2(cx,ht+2,hw/2+1,4,mainD);P(hl,ht+3,hw,2,shade(main,-60));Q([[hl+hw-3,ht+1],[hl+hw+3,ht-12],[hl+hw,ht+1]],acc);P(hl+hw+2,ht-12,1,3,'#ffffff');break;
    }
    // Held items (in front).
    const beat=[0,1,0,-1][frame%4],working=!['walk','idle','sleep'].includes(action);
    if(working){hand[1]+=beat*3;const [ax,ay]=hand;P(ax-2,ay-8,4,8,main);P(ax-2,ay-1,4,3,look.skin);if(action==='wave'||action==='social'){P(ax+2,top+13+beat*2,3,9,look.skin);}if(action==='smith'){P(ax+2,ay-11,2,13,'#936342');P(ax-1,ay-13,8,4,'#b7c9cb');}if(action==='garden'||action==='sweep'){P(ax+3,ay-4,2,18,'#94774d');P(ax,ay+12,8,3,action==='garden'?'#abbab5':'#d2b272');}if(action==='eat'||action==='cook'){P(ax-4,ay-1,9,4,'#b88350');P(ax-3,ay-2,7,2,'#f1d2a0');}if(action==='read'){P(ax-4,ay-4,10,7,'#793f54');P(ax-3,ay-3,8,5,'#ece3c4');P(ax+1,ay-3,1,5,'#a59a82');}}
    if(action==='trade'){P(hand[0]-4,hand[1]+2,10,5,'#704e38');P(hand[0]-1,hand[1]-3,4,4,'#edc266');P(hand[0],hand[1]-3,1,3,'#fff1ac');}
    if(action==='play'){const ballY=feet-3-Math.abs(beat)*9;E2(cx+15,ballY,4,4,'#c87854');P(cx+13,ballY-2,3,2,'#f0d697');}
    if(action==='music'){P(cx-3+beat*2,top+28,7,3,look.skin);P(cx+18,top+4-beat*3,1,7,'#e9cc76');P(cx+19,top+4-beat*3,3,1,'#e9cc76');P(cx+16,top+10-beat*3,3,2,'#e9cc76');}
    if(action==='guard'){P(hand[0]-2,hand[1]-7,4,9,'#adb8bf');P(hand[0]-1,hand[1]+1,3,3,look.skin);}
    const [ix,iy]=hand;
    switch(look.item){
      case'staff':P(ix,top-6,3,feet-top+4,OUTL);P(ix+1,top-5,1,feet-top+2,'#7a5a3a');E2(ix+1.5,top-7,3,3,'#8fd3e0');P(ix+1,top-8,1,1,'#ffffff');break;
      case'basket':P(ix-4,iy,10,7,OUTL);P(ix-3,iy+1,8,5,'#b58a4e');P(ix-3,iy+1,8,1,'#e5c07a');E2(ix-1,iy,2,2,'#c0304a');E2(ix+2,iy,2,2,'#7fb04a');P(ix-3,iy-4,1,4,'#8a6a3e');P(ix+4,iy-4,1,4,'#8a6a3e');P(ix-3,iy-5,8,1,'#8a6a3e');break;
      case'book':P(ix-3,iy-2,8,9,OUTL);P(ix-2,iy-1,6,7,'#7a3b3b');P(ix-1,iy,4,5,'#f1e6c8');P(ix+1,iy,1,5,'#c9b690');break;
      case'bag':if(!back){P(cx-9,top+20,2,16,'#6b4a2e');P(ix-5,waist-4,9,8,OUTL);P(ix-4,waist-3,7,6,'#8a6a3e');P(ix-4,waist-3,7,2,'#a8844e');}break;
      case'lute':P(cx-6,top+24,11,9,OUTL);E2(cx-1,top+29,5,4,'#b0743a');E2(cx-1,top+29,2,2,'#4a2f1e');P(cx+3,top+16,2,10,'#6b4a2e');break;
      case'broom':P(ix,top+8,2,feet-top-6,'#8a6a3e');Q([[ix-3,feet-8],[ix+5,feet-8],[ix+6,feet],[ix-4,feet]],'#d4b36a');break;
      case'sword':P(ix,iy-14,2,15,OUTL);P(ix,iy-13,1,13,'#e3eaf0');P(ix-2,iy,6,2,'#c9a45c');P(ix,iy+2,2,3,'#6b4a2e');break;
      case'flowers':P(ix-1,iy-2,2,8,'#4f7a45');E2(ix-2,iy-3,2.5,2.5,'#f08aa8');E2(ix+2,iy-4,2.5,2.5,'#f3d56a');E2(ix,iy-6,2,2,'#ffffff');break;
      case'bell':P(ix,iy-4,1,4,'#6b4a2e');Q([[ix-3,iy+4],[ix-2,iy],[ix+3,iy],[ix+4,iy+4]],'#e0b24a');P(ix,iy+4,2,2,'#8a6a2e');break;
      case'fish':E2(ix,iy+2,5,2,'#8fb4c8');Q([[ix+4,iy+2],[ix+7,iy],[ix+7,iy+4]],'#6f94a8');break;
    }
    const child=look.body==='child',out=child?document.createElement('canvas'):c;
    if(child){const k=.74;out.width=c.width;out.height=c.height;const o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(c,Math.round(c.width*(1-k)/2),Math.round(c.height*(1-k)),Math.round(c.width*k),Math.round(c.height*k));}
    out.foot=Hd-3+OY;out.center=OX+Wd/2;if(painted.size>2048)painted.delete(painted.keys().next().value);painted.set(key,out);return out;
  }
  function frameFor(n,time){const seed=Array.from(n.id).reduce((s,c)=>s+c.charCodeAt(0)*.13,0),moving=!n.idle,action=moving?'walk':n.greeting&&Math.floor(time+seed)%8<2?'wave':n.state||'idle',frame=moving?1+Math.floor(time*(n.state==='flee'?13:n.speed>.9?11:7)+seed)%6:Math.floor(time*3+seed)%4;const phase=(time+seed)%4.1;return {frame,blink:action==='sleep'||phase<.14,action};}
  function best(look,dir,frame,blink,action='walk'){return paintedSprite(look,dir,frame,action,blink)||sprite(look,dir,frame%4,blink,action);}
  // Paints missing frames of people on screen until the deadline, so walking never waits for them.
  // Frames that were asked for but postponed are painted one per idle slot, never inside a busy frame.
  function queueIdle(){if(idleQueued)return;idleQueued=true;(window.requestIdleCallback||(f=>setTimeout(()=>f({timeRemaining:()=>16}),120)))(idle,{timeout:1500});}
  function idle(deadline){idleQueued=false;for(const [key,[look,dir,frame,action,blink]] of wanted){wanted.delete(key);if(painted.has(key))continue;const keep=genLeft;genLeft=1;genAt=-1e9;paintedSprite(look,dir,frame,action,blink);genLeft=keep;break;}if(wanted.size)queueIdle();}
  function frameBudget(n,gapMs=0){genLeft=n;genGap=gapMs;}
  return {sprite:best,chibi:sprite,frameFor,frameBudget,size:{w:W,h:H,foot:FOOT}};

})();
