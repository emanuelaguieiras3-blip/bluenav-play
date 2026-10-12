'use strict';
// Hand-placed pixel art for the capital and the Totem Citadel. Every function draws into the
// world canvas at world-pixel scale (32 px per tile) and animates from the world clock.
window.WorldTown=(()=>{
  const textures=new Map();
  function shade(color,amount){const n=parseInt(color.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+amount)).toString(16).padStart(2,'0')).join('');}
  function hash(x,y,s=0){const n=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return n-Math.floor(n);}
  const R=(g,x,y,w,h,c)=>{if(w<=0||h<=0)return;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  // Solid-colour ellipses are stamped from a cache (drawImage) instead of filling a path every frame.
  const stamps=new Map();let lod='medio';
  const E=(g,x,y,rx,ry,c)=>{rx=Math.max(1,Math.round(rx));ry=Math.max(1,Math.round(ry));if(c[0]!=='#'||rx>80||ry>80){g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();return;}
    const k=c+rx+'_'+ry;let s=stamps.get(k);if(!s){if(stamps.size>500)stamps.clear();s=document.createElement('canvas');s.width=rx*2;s.height=ry*2;const t=s.getContext('2d');t.fillStyle=c;t.beginPath();t.ellipse(rx,ry,rx,ry,0,0,Math.PI*2);t.fill();stamps.set(k,s);}g.drawImage(s,Math.round(x-rx),Math.round(y-ry));};
  const Poly=(g,pts,c)=>{g.fillStyle=c;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
  function texture(key,draw){if(textures.has(key))return textures.get(key);const c=document.createElement('canvas');c.width=32;c.height=32;draw(c.getContext('2d'));textures.set(key,c);return c;}

  // ---------- Ground ----------
  function cobble(g,x,y,wx,wy){
    const v=Math.floor(hash(wx,wy,3)*6);
    g.drawImage(texture('cobble'+v,t=>{R(t,0,0,32,32,'#8f8a7e');
      for(let row=0;row<4;row++){const off=(row+v)%2?8:0;for(let col=-1;col<3;col++){const sx=col*16+off,sy=row*8,tone=hash(col+v*3,row,9);const c=tone>.66?'#b9b2a1':tone>.33?'#aaa392':'#a09a8b';R(t,sx+1,sy+1,14,6,c);R(t,sx+1,sy+1,14,1,shade(c,18));R(t,sx+1,sy+6,14,1,shade(c,-22));if(tone>.85)R(t,sx+4,sy+3,3,1,'#7f9a5e');}}}),x,y);
  }
  function lawn(g,x,y,wx,wy,time){
    const v=Math.floor(hash(wx,wy,5)*4),stripe=(Math.floor(wx/2)+wy)%2;
    g.drawImage(texture('lawn'+v+stripe,t=>{R(t,0,0,32,32,stripe?'#6fa35a':'#76aa5f');for(let i=0;i<14;i++){const px=Math.floor(hash(i,v,11)*30),py=Math.floor(hash(v,i,12)*30);R(t,px,py,1,2,i%3?'#5d914d':'#8fc070');}}),x,y);
    const n=hash(wx,wy,21);
    if(n>.9){const sway=Math.round(Math.sin(time*2+wx)*1),cols=['#f3d56a','#f08aa8','#ffffff','#b8a2e8'];for(let i=0;i<3;i++){const fx=x+6+i*8+sway,fy=y+10+(i%2)*9;R(g,fx,fy+2,1,4,'#4f7a45');R(g,fx-1,fy,3,2,cols[(wx+wy+i)%4]);R(g,fx,fy,1,1,'#fff6c8');}}
  }
  // ---------- City wall ----------
  const wallCache=new Map();
  function wall(g,side,x,y,wx,time){
    // Stone is cached per side and column; only the south banners are drawn live.
    const ns=side==='n'||side==='s',k=side+(ns?wx%8:''),banner=side==='s'&&wx%6===0;let c=wallCache.get(k);
    if(!c){c=document.createElement('canvas');c.width=ns?44:32;c.height=ns?42:66;wallBody(c.getContext('2d'),side,ns?6:0,30,wx%8);wallCache.set(k,c);}
    g.drawImage(c,Math.round(x-(ns?6:0)),Math.round(y-30));
    if(banner){const top=y-30,wave=t=>Math.sin(time*3+wx+t)*2;g.fillStyle='#b73a3a';g.beginPath();g.moveTo(x+12,top+12);for(let t=0;t<=4;t++)g.lineTo(x+12+t*2,top+12+wave(t)*.2);for(let t=4;t>=0;t--)g.lineTo(x+12+t*2+wave(t)*.4,top+30+wave(t));g.fill();R(g,x+13,top+18,6,4,'#f3d56a');R(g,x+11,top+11,12,2,'#6b4a2e');}
  }
  function wallBody(g,side,x,y,wx){
    if(side==='n'||side==='s'){
      const top=y-30;R(g,x,top+8,32,30+(side==='s'?2:0),'#b9b3a3');
      for(let row=0;row<4;row++)for(let col=0;col<3;col++){const bx=x+col*12-(row%2?6:0),by=top+10+row*7;R(g,bx+1,by,10,6,hash(wx+col,row,3)>.5?'#cfc9b8':'#c3bdac');R(g,bx+1,by+5,10,1,'#9d9787');}
      R(g,x,top+36,32,2,'#8b8577');for(let i=0;i<4;i++){R(g,x+i*8,top+2,5,7,'#d8d2c1');R(g,x+i*8,top+2,5,1,'#efe9d8');R(g,x+i*8+4,top+3,1,6,'#a8a292');}
      R(g,x,top+8,32,2,'#e2dccb');
    }else{
      R(g,x+6,y-26,20,58,'#c3bdac');R(g,x+6,y-26,20,3,'#e2dccb');R(g,x+22,y-24,4,56,'#9d9787');for(let i=0;i<4;i++)R(g,x+8+(i%2)*6,y-22+i*14,8,6,'#cfc9b8');
      for(let i=0;i<2;i++){R(g,x+4,y-30+i*16,24,6,'#d8d2c1');R(g,x+4,y-30+i*16,24,1,'#efe9d8');}
    }
  }
  const towerCache=new Map();
  function cornerTower(g,x,y,time,roof){
    let c=towerCache.get(roof);if(!c){c=document.createElement('canvas');c.width=60;c.height=142;towerBody(c.getContext('2d'),12,102,roof);towerCache.set(roof,c);}
    g.drawImage(c,Math.round(x-12),Math.round(y-102));const w=Math.sin(time*4+x-originX)*2;Poly(g,[[x+17,y-100],[x+33,y-97+w],[x+17,y-92]],'#e8c14a');
  }
  function towerBody(g,x,y,roof){
    E(g,x+16,y+30,26,8,'#1c2a2244');R(g,x-6,y-40,44,72,'#c9c3b2');R(g,x+26,y-40,12,72,'#a39d8d');R(g,x-6,y-40,6,72,'#ddd7c6');
    for(let i=0;i<5;i++)R(g,x-6,y-30+i*14,44,1,'#aaa494');R(g,x+12,y-18,4,10,'#3a3440');
    Poly(g,[[x-10,y-40],[x+16,y-84],[x+42,y-40]],roof);Poly(g,[[x+16,y-84],[x+42,y-40],[x+22,y-40]],shade(roof,-28));for(let i=0;i<4;i++)R(g,x-4+i*3,y-46-i*9,40-i*6,1,shade(roof,22));
    R(g,x+15,y-100,2,18,'#6b4a2e');
  }
  function gateArch(g,x,y,time,night){
    // x,y = top-left of the 5-tile gate opening on the south wall row.
    const w=160,top=y-60;R(g,x-10,top,20,92,'#c9c3b2');R(g,x+w-10,top,20,92,'#a39d8d');
    R(g,x-6,top-4,w+12,22,'#d3cdbc');g.fillStyle='#d3cdbc';g.beginPath();g.moveTo(x+10,top+18);g.quadraticCurveTo(x+w/2,top-2,x+w-10,top+18);g.lineTo(x+w-10,top+26);g.quadraticCurveTo(x+w/2,top+8,x+10,top+26);g.fill();
    for(let i=0;i<9;i++){R(g,x-6+i*19,top-12,11,9,'#e2dccb');R(g,x-6+i*19,top-12,11,1,'#f3eddc');}
    for(let i=0;i<12;i++)R(g,x+14+i*11,top+22,2,7+(i%2)*3,'#4a4450');
    R(g,x+w/2-12,top+1,24,14,'#2c4f7a');R(g,x+w/2-10,top+3,20,10,'#3f6f8f');g.fillStyle='#f3d56a';g.font='bold 10px monospace';g.textAlign='center';g.fillText('☀',x+w/2,top+12);g.textAlign='left';
    for(const bx of [x-4,x+w-4]){const f=Math.sin(time*11+bx-originX)*1.5;R(g,bx,top+40,8,4,'#5a4535');Poly(g,[[bx,top+40],[bx+4,top+28-f],[bx+8,top+40]],'#ff9b3d');Poly(g,[[bx+2,top+40],[bx+4,top+33-f],[bx+6,top+40]],'#ffe28a');if(night>.05)glow(g,bx+4,top+34,46,'#ffb45a',night*2.4);}
  }
  // Glows are one radial gradient per colour and size, drawn once and stamped with alpha.
  const glows=new Map();
  function glow(g,x,y,r,color,strength){const a=Math.max(0,Math.min(1,strength));if(a<=.01||r<2)return;const R=Math.max(4,Math.round(r/4)*4),k=color+R;let s=glows.get(k);
    if(!s){s=document.createElement('canvas');s.width=s.height=R*2;const t=s.getContext('2d'),gr=t.createRadialGradient(R,R,0,R,R,R);gr.addColorStop(0,color+'6e');gr.addColorStop(1,color+'00');t.fillStyle=gr;t.fillRect(0,0,R*2,R*2);glows.set(k,s);}
    const pa=g.globalAlpha,po=g.globalCompositeOperation;g.globalCompositeOperation='lighter';g.globalAlpha=pa*a;g.drawImage(s,Math.round(x-R),Math.round(y-R));g.globalAlpha=pa;g.globalCompositeOperation=po;}
  // Screen-space phases are anchored to the world: camera scrolling must not speed animations up.
  let originX=0;function setOrigin(o){originX=o;}
  function setQuality(q){lod=q;}

  // ---------- Buildings ----------
  const houseStyles=[
    {wall:'#efe3c4',beam:'#6b4a2e',roof:'#b5483e',trim:'#e8c14a',sign:'bread'},
    {wall:'#e6dccb',beam:'#4f3a2a',roof:'#3f6f8f',trim:'#f1efe6',sign:null},
    {wall:'#d9c9a8',beam:'#5a4232',roof:'#5c7a3f',trim:'#e0c070',sign:'anvil'},
    {wall:'#f2ead6',beam:'#6e4f36',roof:'#8a4e7a',trim:'#f3d56a',sign:null},
    {wall:'#cdbfa4',beam:'#4a3a30',roof:'#a8672e',trim:'#e8d8b0',sign:'needle'},
    {wall:'#e9dfd0',beam:'#5f4a3a',roof:'#4f5c7a',trim:'#d9a0a0',sign:null},
    {wall:'#dfd3b8',beam:'#6b4a2e',roof:'#9a3b3b',trim:'#9ad0b0',sign:'potion'},
    {wall:'#f0e6d0',beam:'#3f3a36',roof:'#6b6b3a',trim:'#e0c070',sign:null}];
  // Pixel-art sprites from assets/town-v1.png, when loaded (bottom-centred; see GameAssets.place).
  const townArt=n=>window.GameAssets?.get('town-'+n),placeArt=(g,n,cx,base,w,flip)=>!!window.GameAssets?.place(g,'town-'+n,cx,base,w,flip);
  const houseCache=new Map();
  function houseBody(d,lit){
    // Static walls, windows, door, roof and chimney; drawn once per style and light state.
    const key=d.variant%houseStyles.length+'|'+(d.variant%2)+'|'+d.w+'|'+d.h+'|'+(lit?1:0);if(houseCache.has(key))return houseCache.get(key);
    const s=houseStyles[d.variant%houseStyles.length],w=d.w*32,H=d.h*32+112,c=document.createElement('canvas');c.width=w+24;c.height=H;const g=c.getContext('2d');
    const x=12,y=H-d.h*32-14,base=y+d.h*32,wallTop=base-46,roofTop=wallTop-36,flip=d.variant%2;
    E(g,x+w/2+6,base+2,w*.56,7,'#1c2a2244');
    R(g,x+2,wallTop,w-4,46,s.wall);R(g,x+w-10,wallTop,8,46,shade(s.wall,-26));R(g,x+2,base-6,w-4,6,shade(s.wall,-40));
    for(const bx of [x+2,x+w/2-2,x+w-6])R(g,bx,wallTop,4,40,s.beam);R(g,x+2,wallTop,w-4,3,s.beam);R(g,x+2,wallTop+20,w-4,3,s.beam);
    for(const wxp of [x+12,x+w-30]){R(g,wxp-1,wallTop+5,16,12,s.beam);R(g,wxp,wallTop+6,14,10,lit?'#ffd98a':'#39506a');R(g,wxp+6,wallTop+6,2,10,s.beam);R(g,wxp,wallTop+10,14,1,s.beam);if(!lit)R(g,wxp+1,wallTop+7,4,2,'#7fa6c9');
      R(g,wxp-4,wallTop+6,3,10,s.roof);R(g,wxp+15,wallTop+6,3,10,s.roof);R(g,wxp-1,wallTop+17,16,3,'#7a5a3a');}
    const dx=flip?x+w-28:x+w/2-8;R(g,dx-2,base-24,20,24,s.beam);R(g,dx,base-22,16,22,'#7a4e2e');R(g,dx,base-22,16,3,'#8f6039');R(g,dx+7,base-22,1,22,'#5a3a22');R(g,dx+12,base-12,2,2,s.trim);R(g,dx-2,base-2,20,2,'#9d9787');
    Poly(g,[[x-6,wallTop+2],[x+w/2,roofTop],[x+w+6,wallTop+2]],shade(s.roof,-36));Poly(g,[[x-4,wallTop],[x+w/2,roofTop+2],[x+w+4,wallTop]],s.roof);
    for(let i=1;i<6;i++){const yy=roofTop+2+i*6,inset=(yy-roofTop)*(w/2+4)/(wallTop-roofTop);R(g,x+w/2-inset,yy,inset*2,1,shade(s.roof,-22));for(let k=0;k<inset*2;k+=7)R(g,x+w/2-inset+k+(i%2)*3,yy-5,1,5,shade(s.roof,-14));}
    Poly(g,[[x+w/2,roofTop+2],[x+w+4,wallTop],[x+w/2+10,wallTop]],shade(s.roof,-18));R(g,x+w/2-1,roofTop,2,4,s.trim);
    const cxp=x+(flip?18:w-26);R(g,cxp,roofTop+12,10,18,'#8b7a6a');R(g,cxp-1,roofTop+10,12,3,'#a39282');
    const out={canvas:c,ox:12,oy:y};houseCache.set(key,out);return out;
  }
  function houseDecor(g,d,x,y,time,still){
    const s=houseStyles[d.variant%houseStyles.length],w=d.w*32,base=y+d.h*32,wallTop=base-46,flip=d.variant%2,dx=flip?x+w-28:x+w/2-8;
    for(const wxp of [x+12,x+w-30])for(let i=0;i<5;i++){const sway=still?0:Math.round(Math.sin(time*2+i+wxp)*.6);R(g,wxp+i*3+sway,wallTop+15,2,2,i%2?'#f08aa8':'#f3d56a');}
    if(s.sign){const sw=still?0:Math.sin(time*1.8+d.x)*2,sx=dx+(flip?-14:22),sy=wallTop+24;R(g,sx-2,sy-2,14,2,'#4a3a30');g.save();g.translate(sx+5,sy);g.rotate(sw*.04);R(g,-6,0,12,10,'#b58a4e');R(g,-5,1,10,8,'#e8d8b0');
      if(s.sign==='bread')E(g,0,5,4,2.5,'#c07a3a');if(s.sign==='anvil'){R(g,-3,3,6,2,'#4a4f5c');R(g,-1,5,2,2,'#4a4f5c');}if(s.sign==='needle'){R(g,-3,2,1,6,'#7a8a9a');R(g,-3,3,5,1,'#c0304a');}if(s.sign==='potion'){E(g,0,6,3,2.5,'#c0304a');R(g,-1,2,2,2,'#8fb4c8');}g.restore();}
  }
  function house(g,d,x,y,time,night){
    // x,y = top-left of the footprint (w x h tiles).
    {const n='house'+d.variant%8,a=townArt(n);if(a){const cx=x+d.w*16,b=y+d.h*32+5,H=d.w*35,lit2=night>.1&&hash(d.x,d.y,night>.2?1:2)>.25;E(g,cx+4,b-4,d.w*19,7,'#1c2a2244');placeArt(g,n,cx,b,a.width*H/a.height,Math.floor(d.variant/8)%2===1);if(lit2)glow(g,cx,b-H*.42,34,'#ffc46a',night*1.6);return;}}
    const s=houseStyles[d.variant%houseStyles.length],w=d.w*32,base=y+d.h*32,wallTop=base-46,roofTop=wallTop-36,flip=d.variant%2;
    const lit=night>.1&&hash(d.x,d.y,night>.2?1:2)>.25,body=houseBody(d,lit);
    // Leve: flowers and the shop sign are frozen into one cached picture of the house.
    if(lod==='leve'){const k='L|'+d.variant%houseStyles.length+'|'+(d.variant%2)+'|'+d.w+'|'+d.h+'|'+(lit?1:0);let still=houseCache.get(k);
      if(!still){still=document.createElement('canvas');still.width=body.canvas.width;still.height=body.canvas.height;const sg=still.getContext('2d');sg.drawImage(body.canvas,0,0);houseDecor(sg,d,body.ox,body.oy,0,true);houseCache.set(k,still);}
      g.drawImage(still,Math.round(x-body.ox),Math.round(y-body.oy));}
    else{g.drawImage(body.canvas,Math.round(x-body.ox),Math.round(y-body.oy));houseDecor(g,d,x,y,time,false);}
    if(lit)for(const wxp of [x+12,x+w-30])glow(g,wxp+7,wallTop+11,26,'#ffc46a',night*2);
    const cxp=x+(flip?18:w-26);
    if(lod==='leve'){const k=(time*.35+d.variant*.13)%1;R(g,cxp+4+Math.sin(k*5)*4,roofTop+6-k*30,4,3,'#e6e2d655');}
    else for(let i=0;i<4;i++){const k=(time*.35+i/4+d.variant*.13)%1,pa=g.globalAlpha;g.globalAlpha=pa*.4*(1-k);E(g,cxp+5+Math.sin(k*5+i)*6,roofTop+8-k*38,2+k*6,2+k*4,'#e6e2d6');g.globalAlpha=pa;}
  }

  function chapel(g,d,x,y,time,night){
    if(townArt('chapel')){const cx=x+d.w*16,b=y+d.h*32+6;E(g,cx+8,b-4,d.w*15,8,'#1c2a2244');placeArt(g,'chapel',cx,b,182);if(night>.05)glow(g,cx-30,b-70,40,'#ffcf7a',night*2);return;}
    const w=d.w*32,base=y+d.h*32,wallTop=base-54,cx=x+w/2;E(g,cx+8,base+2,w*.55,8,'#1c2a2244');
    R(g,x+4,wallTop,w-8,54,'#ddd6c4');R(g,x+w-16,wallTop,12,54,'#b8b0a0');for(let r=0;r<6;r++)for(let c=0;c<8;c++)R(g,x+6+c*22+(r%2)*11,wallTop+4+r*9,20,1,'#c8c0ae');
    Poly(g,[[x-4,wallTop+4],[x+w*.3,wallTop-34],[x+w*.7,wallTop-34],[x+w+4,wallTop+4]],'#5a4f6a');for(let i=0;i<5;i++)R(g,x+4+i*4,wallTop-2-i*7,w-8-i*8,1,'#716585');
    // Bell tower with a swinging bell.
    const tx=x+w-58;R(g,tx,wallTop-70,34,74,'#e2dccb');R(g,tx+26,wallTop-70,8,74,'#bdb5a4');R(g,tx+8,wallTop-60,18,20,'#3a3440');const swing=Math.sin(time*2.2)*.35;g.save();g.translate(tx+17,wallTop-58);g.rotate(swing);Poly(g,[[-6,10],[-4,0],[4,0],[6,10]],'#d7a94a');R(g,-1,10,2,2,'#8a6a2e');g.restore();
    Poly(g,[[tx-4,wallTop-70],[tx+17,wallTop-104],[tx+38,wallTop-70]],'#5a4f6a');R(g,tx+16,wallTop-116,2,14,'#e8c14a');R(g,tx+12,wallTop-111,10,2,'#e8c14a');
    // Rose window: stained glass cycling slowly.
    const rx=x+56,ry=wallTop+22;E(g,rx,ry,14,14,'#6b6070');for(let i=0;i<8;i++){const a=i*Math.PI/4+time*.1,col=['#c0304a','#3a7fd0','#f3d56a','#4f9a5a'][i%4];Poly(g,[[rx,ry],[rx+Math.cos(a)*12,ry+Math.sin(a)*12],[rx+Math.cos(a+.7)*12,ry+Math.sin(a+.7)*12]],col);}E(g,rx,ry,3,3,'#fff4c8');
    if(night>.05)glow(g,rx,ry,40,'#ffcf7a',night*2);
    R(g,cx-12,base-30,24,30,'#6b4a2e');E(g,cx,base-30,12,8,'#6b4a2e');R(g,cx-10,base-28,20,28,'#8a5a36');R(g,cx-1,base-30,2,30,'#5a3a22');
    for(const wx2 of [x+18,x+w-40])if(wx2<tx){R(g,wx2,wallTop+14,12,22,'#3a3440');R(g,wx2+1,wallTop+15,10,20,night>.1?'#ffd98a':'#5a7aa8');E(g,wx2+6,wallTop+15,6,4,'#3a3440');}
  }
  function tavern(g,d,x,y,time,night){
    if(townArt('tavern')){const cx=x+d.w*16,b=y+d.h*32+6;E(g,cx+8,b-4,d.w*15,8,'#1c2a2244');placeArt(g,'tavern',cx,b,192);if(night>.05){glow(g,cx-20,b-60,50,'#ffb45a',night*2.2);glow(g,cx+30,b-110,40,'#ffc46a',night*1.6);}return;}
    const w=d.w*32,base=y+d.h*32,wallTop=base-70,cx=x+w/2;E(g,cx+8,base+2,w*.55,8,'#1c2a2244');
    R(g,x+2,wallTop,w-4,70,'#e8dcc0');R(g,x+w-12,wallTop,10,70,'#c4b699');R(g,x+2,wallTop+34,w-4,4,'#5a4232');for(let i=0;i<7;i++)R(g,x+2+i*30,wallTop,4,70,'#5a4232');
    for(let i=0;i<6;i++){const lx=x+10+i*30,l1=night>.1&&(i+Math.floor(time/9))%3!==0;R(g,lx,wallTop+8,16,14,'#5a4232');R(g,lx+1,wallTop+9,14,12,l1?'#ffd98a':'#39506a');R(g,lx+7,wallTop+9,1,12,'#5a4232');if(i!==2&&i!==3){R(g,lx,wallTop+44,16,14,'#5a4232');R(g,lx+1,wallTop+45,14,12,night>.1?'#ffc46a':'#39506a');}}
    Poly(g,[[x-8,wallTop+4],[x+14,wallTop-30],[x+w-14,wallTop-30],[x+w+8,wallTop+4]],'#6a3a2a');for(let i=0;i<5;i++)R(g,x-2+i*4,wallTop-2-i*6,w+4-i*8,1,'#8a5040');
    R(g,cx-14,base-30,28,30,'#5a3a22');R(g,cx-12,base-28,24,28,'#7a4e2e');R(g,cx-1,base-28,2,28,'#4a2e1a');
    const sw=Math.sin(time*1.5)*.08;g.save();g.translate(cx+30,wallTop+40);R(g,-16,-2,32,2,'#3a2a20');g.rotate(sw);R(g,-12,0,24,16,'#6b4a2e');R(g,-10,2,20,12,'#e8c14a');R(g,-4,4,7,8,'#f1efe6');R(g,3,6,2,4,'#f1efe6');R(g,-4,4,7,2,'#ffffff');g.restore();
    for(const bx of [x+12,x+w-30]){E(g,bx+8,base-6,9,6,'#8a5a36');R(g,bx,base-12,16,2,'#4a3a30');R(g,bx,base-6,16,2,'#4a3a30');}
    R(g,cx-40,wallTop+30,4,6,'#3a3440');const f=Math.sin(time*9)*1;R(g,cx-41,wallTop+24,6,6,'#ffe28a');if(night>.05)glow(g,cx-38,wallTop+26,34,'#ffb45a',night*2.2);
    for(let i=0;i<3;i++){const k=(time*.3+i/3)%1;E(g,x+26+Math.sin(k*5)*5,wallTop-30-k*30,2+k*5,2+k*4,`rgba(230,226,214,${.35*(1-k)})`);}
  }
  const stallStyles=[
    {awning:['#e8d8b0','#4f9a5a'],goods:['#7fb04a','#c0304a','#f3d56a','#e0b25c']},
    {awning:['#f1efe6','#3a7fd0'],goods:['#c0304a','#8fd3e0','#9a6ad0','#4f9a5a']},
    {awning:['#e8d8b0','#6b6b7a'],goods:['#b87333','#9aa6b2','#4a4f5c','#2a2a30']},
    {awning:['#f1efe6','#2f7a8a'],goods:['#8fb4c8','#c8dce6','#e0c070','#8fb4c8']},
    {awning:['#e8d8b0','#a8672e'],goods:['#b58a4e','#e8c14a','#6b4a2e','#f3d56a']},
    {awning:['#f1efe6','#9a3b3b'],goods:['#4a4f5c','#c0304a','#6b4a2e','#e0c070']}];
  const stallBodies=new Map();
  function stall(g,d,x,y,time){
    const v=(d.variant||0)%stallStyles.length,s=stallStyles[v],w=d.w*32,base=y+32,top=base-52;
    let body=stallBodies.get(v+'|'+w);if(!body){body=document.createElement('canvas');body.width=w+20;body.height=70;const b=body.getContext('2d'),bx=6,bb=60,bt=bb-52;
      E(b,bx+w/2+4,bb+1,w*.55,5,'#1c2a2244');R(b,bx+4,bt+10,3,42,'#6b4a2e');R(b,bx+w-7,bt+10,3,42,'#6b4a2e');R(b,bx+2,bb-22,w-4,20,'#8a6a3e');R(b,bx+2,bb-22,w-4,3,'#b58a4e');R(b,bx+2,bb-4,w-4,2,'#5a4232');
      for(let i=0;i<8;i++){const gx=bx+6+(i%4)*14,gy=bb-27+Math.floor(i/4)*4;E(b,gx+4,gy+3,4,3,s.goods[i%4]);R(b,gx+2,gy+1,2,1,'#ffffff88');}stallBodies.set(v+'|'+w,body);}
    g.drawImage(body,Math.round(x-6),Math.round(base-60));
    const flap=t=>Math.round(Math.sin(time*3+t+d.x)*1.2);for(let i=0;i<w/8;i++){R(g,x-2+i*8,top,8,12,s.awning[i%2]);R(g,x-2+i*8,top+12+flap(i),8,3,s.awning[i%2]);}R(g,x-2,top-2,w+4,3,shade(s.awning[1],-30));
  }
  function tower(g,x,y,time,roof,night){cornerTower(g,x,y+20,time,roof);R(g,x+10,y-2,12,20,'#3a3440');const f=Math.sin(time*10+x-originX)*1.5;Poly(g,[[x+12,y+4],[x+16,y-6-f],[x+20,y+4]],'#ff9b3d');if(night>.05)glow(g,x+16,y,40,'#ffb45a',night*2.4);}
  // Royal plants: generated art (assets/royal-plants.png) when present, otherwise hand-placed pixel art.
  const plantArt=n=>window.GameAssets?.get('plant-'+n);
  function hedge(g,x,y,time,wx){
    // Boxwood hedge: rounded clipped top, clustered leaves lit from the upper left, a rose every few tiles.
    const art=plantArt('hedge');if(art){E(g,x+16,y+30,17,3,'#1c2a2244');g.drawImage(art,x,y+2,32,29);return;}
    E(g,x+16,y+30,17,3,'#1c2a2244');R(g,x,y+14,32,15,'#2c5a30');R(g,x,y+27,32,3,'#1f4424');
    for(let i=0;i<5;i++){const cx=x+3+i*6.5,top=y+10+((i+wx)%2);E(g,cx,top+5,5,5,'#2f6534');E(g,cx-1,top+3,4,3.5,'#3f7d3d');}
    R(g,x,y+13,32,3,'#3f7d3d');
    for(let i=0;i<9;i++){const lx=x+2+((i*11+wx*7)%28),ly=y+11+((i*5+wx)%14);R(g,lx,ly,2,2,i%3?'#5b9a4c':'#78b35c');R(g,lx+1,ly+1,1,1,'#2a5530');}
    for(let i=0;i<4;i++)R(g,x+4+i*8,y+10+(i%2),3,1,'#8fcb6a');
    if(hash(wx,y,4)>.45){const b=Math.round(Math.sin(time*1.5+wx)*.6),rx=x+9+((wx*5)%14);E(g,rx,y+12+b,2.5,2.5,'#c8304e');R(g,rx-1,y+11+b,2,1,'#f07a94');E(g,rx+7,y+17,2,2,'#f3d56a');}}
  function lamp(g,x,y,time,night){
    E(g,x+2,y+2,7,2,'#1c2a2233');R(g,x,y-40,3,42,'#2f3440');R(g,x-2,y-2,7,3,'#3f4450');R(g,x-3,y-44,9,4,'#3f4450');R(g,x-4,y-54,11,10,'#2f3440');
    const f=.75+Math.sin(time*9+x-originX)*.12+Math.sin(time*23+x-originX)*.08;R(g,x-2,y-52,7,7,night>.05?'#ffe7a0':'#e8e0c0');if(night>.05){R(g,x,y-50,3,3,'#fff6d8');glow(g,x+1,y-48,40*f,'#ffc46a',night*2.6*f);}
    R(g,x-3,y-57,9,3,'#3f4450');R(g,x,y-60,3,3,'#3f4450');
  }
  function grandFountain(g,x,y,time,art){
    // x,y = top-left of the 3x2 footprint.
    const cx=x+48,base=y+64;E(g,cx+4,base,62,12,'#1c2a2233');
    if(art){const dw=128,dh=Math.round(dw*art.height/art.width);g.drawImage(art,Math.round(cx-dw/2),base+8-dh,dw,dh);}
    else{E(g,cx,base-14,56,18,'#d8cfb2');E(g,cx,base-16,48,14,'#5fb7d0');}
    const top=base-72;for(let i=0;i<12;i++){const a=i/12*Math.PI*2,k=(time*1.3+i*.37)%1,r=6+k*26,hy=top+8-Math.sin(k*Math.PI)*16+k*30;R(g,cx+Math.cos(a)*r,hy,2,2,k<.5?'#e9fbff':'#a8e4f4');}
    for(let i=0;i<3;i++){const k=(time*.8+i/3)%1;g.strokeStyle=`rgba(233,251,255,${.55*(1-k)})`;g.lineWidth=1;g.beginPath();g.ellipse(cx,base-22,12+k*30,4+k*9,0,0,Math.PI*2);g.stroke();}
    R(g,cx-1,top-4+Math.sin(time*6)*2,3,14,'#e9fbff');
  }
  function flowerBed(g,x,y,time,wx,wy){
    // Stone planter with three kinds of flowers (roses, tulips, lavender) chosen per bed; generated art wins when loaded.
    {const pick=['roses','tulips','lavender','topiary'][(wx*3+wy)%4],art=plantArt(pick);if(art){const k=Math.min(34/art.width,42/art.height),w=Math.round(art.width*k),h=Math.round(art.height*k);E(g,x+16,y+28,15,4,'#1c2a2233');g.drawImage(art,Math.round(x+16-w/2),y+30-h,w,h);return;}
      const sway=i=>Math.round(Math.sin(time*1.8+i+wx)*.7);E(g,x+16,y+28,16,4,'#1c2a2233');
      R(g,x+1,y+20,30,9,'#8e8a80');R(g,x+1,y+20,30,2,'#b9b3a4');R(g,x+1,y+27,30,2,'#6a665e');for(let i=0;i<4;i++)R(g,x+3+i*8,y+23,1,4,'#77736a');R(g,x+3,y+18,26,3,'#4a3526');
      if(pick==='tulips'){const c=['#e5484d','#f3c23a','#f08aa8'][wy%3];for(let i=0;i<6;i++){const fx=x+4+i*4.5+sway(i),stem=6+(i%3)*2;R(g,fx+1,y+18-stem,1,stem,'#4f8a45');R(g,fx-1,y+14-stem+2,2,3,'#5b9a4c');E(g,fx+1,y+16-stem,2.2,2.6,c);R(g,fx,y+15-stem,1,1,'#fff2d8');}}
      else if(pick==='lavender'){for(let i=0;i<7;i++){const fx=x+4+i*4+sway(i),h=8+(i%3)*2;R(g,fx,y+18-h,1,h,'#5b8a55');for(let k=0;k<4;k++)R(g,fx-1+(k%2),y+17-h+k*2,2,2,k%2?'#9b7fd6':'#b8a2e8');}}
      else if(pick==='topiary'){R(g,x+15,y+8,2,11,'#5a3a24');E(g,x+16,y+8,8,8,'#2f6534');E(g,x+14,y+6,6,5,'#3f7d3d');E(g,x+13,y+5,2.5,2,'#78b35c');for(let i=0;i<3;i++)E(g,x+8+i*8,y+17,3.5,2.5,'#3f7d3d');}
      else{E(g,x+16,y+14,13,6,'#2f5a2f');E(g,x+15,y+12,11,5,'#3f7a3f');E(g,x+12,y+10,5,3,'#5a9a4f');const c1=['#d02e4c','#f3d56a','#ffffff'][wy%3];for(let i=0;i<6;i++){const fx=x+6+(i*7)%20+sway(i),fy=y+8+((i*5)%8);E(g,fx+1,fy+1,2,2,i%2?c1:'#f08aa8');R(g,fx+1,fy,1,1,'#fff6d8');}}
      return;}
  }

  // ---------- Citadel of the Totem ----------
  const citadelFloor={gate:'#3e3a36',gallery:'#463c33',roots:'#2f3a2a',mire:'#2c362e',bridge:'#3a2622',ash:'#3b2a24',frost:'#2e3e4c',ante:'#3a3148',arena:'#3d3326',crypt:'#35323a'};
  const citadelWall={gate:'#57504a',gallery:'#5e5044',roots:'#3f5236',mire:'#3a4a3c',bridge:'#5a3a2e',ash:'#5a3a30',frost:'#4a6a80',ante:'#524466',arena:'#5e4c34',crypt:'#4a4652',wall:'#45434f'};
  function citadelGround(g,t,x,y,wx,wy,time){
    const n=hash(wx,wy,77),theme=t.theme,base=citadelFloor[theme]||'#35323a';
    R(g,x,y,32,32,shade(base,Math.floor(n*8)-4));
    // Carved flagstones everywhere; each theme adds its own story.
    R(g,x,y+31,32,1,shade(base,-14));R(g,x+(wy%2?10:24),y,1,31,shade(base,-14));
    if(theme==='gallery'&&n>.86){R(g,x+6,y+14,16,6,'#7a5a3a');R(g,x+8,y+15,3,2,'#e8c14a');R(g,x+15,y+15,3,2,'#e8c14a');R(g,x+10,y+18,6,1,'#3a2a20');}
    if((theme==='gate'||theme==='gallery')&&n<.07){R(g,x+8,y+20,12,2,'#d9d2c0');E(g,x+22,y+19,3,3,'#d9d2c0');R(g,x+21,y+19,1,1,'#2a2230');}
    if(theme==='roots'&&n>.5){g.strokeStyle='#4f6a3f';g.lineWidth=2;g.beginPath();g.moveTo(x,y+8+n*10);g.quadraticCurveTo(x+16,y+n*30,x+32,y+14);g.stroke();}
    if(theme==='mire'){if(n>.55){const k=(time*.7+n*5)%1;E(g,x+10+n*12,y+16,2+k*4,1+k*2,`rgba(120,160,110,${.5*(1-k)})`);}if(n<.2)E(g,x+16,y+22,8,3,'#3a4a34');}
    if(theme==='ash'||theme==='bridge'){if(n>.7){const a=.4+Math.sin(time*3+wx)*.3;g.globalAlpha=a;R(g,x+4,y+8+n*14,18,1,'#ff7a2e');R(g,x+14,y+4+n*10,1,10,'#ff9a3c');g.globalAlpha=1;}}
    if(theme==='frost'){if(n>.6){R(g,x+6,y+10,10,1,'#b8dce8');R(g,x+10,y+6,1,9,'#b8dce8');}if(n<.15)R(g,x,y,14,3,'#8fb8cc');}
    if(theme==='ante'||theme==='arena'){if(n>.8){const a=.45+Math.sin(time*2+wx*.7)*.35;g.globalAlpha=a;R(g,x+10,y+12,10,1,'#e8b04a');R(g,x+14,y+8,1,9,'#e8b04a');R(g,x+11,y+9,1,1,'#e8b04a');R(g,x+18,y+18,1,1,'#e8b04a');g.globalAlpha=1;}}
  }
  function citadelWallTile(g,theme,x,y,wx,wy,below){
    const top=citadelWall[theme]||citadelWall.wall;R(g,x,y,32,32,'#16141c');
    if(below){R(g,x,y,32,22,shade(top,-8));for(let i=0;i<3;i++)R(g,x+2+(i%2)*6+i*10,y+4+i*5,9,4,shade(top,8));R(g,x,y+20,32,12,shade(top,20));for(let i=0;i<4;i++)R(g,x+3+i*8,y+22,5,1,shade(top,34));R(g,x,y+19,32,2,shade(top,-22));
      if(hash(wx,wy,8)>.8){R(g,x+12,y+6,8,10,'#2a2230');R(g,x+13,y+8,2,2,'#e8b04a');R(g,x+17,y+8,2,2,'#e8b04a');}}
  }
  function totem(g,m,x,y,time,big,flash){
    const k=big?2.1:1,h=Math.round(58*k),rise=Math.sin(time*2+(m.homeX||0))*2*k,cols=['#c9a45c','#7a3b3b','#3f6f8f','#4f7a45'];
    E(g,x,y+2,16*k,5*k,'#00000066');
    // Rune rings orbit the pole.
    g.save();g.globalAlpha=.8;for(let r=0;r<(big?2:1);r++){const ry=y-h*.35-r*h*.3,rad=(big?34:18)+r*6;for(let i=0;i<8;i++){const a=time*(r?-1.2:1.6)+i*Math.PI/4,px=x+Math.cos(a)*rad,py=ry+Math.sin(a)*rad*.32;R(g,px-1,py-1,3,3,i%2?m.enraged?'#ff6a4a':'#e8b04a':'#fff2c0');}}g.restore();
    const faces=big?4:3,fh=(h-8*k)/faces,w=Math.round(20*k);
    for(let i=0;i<faces;i++){const fy=y-8*k-(i+1)*fh+rise,c=cols[(i+(m.area||'').length)%4];R(g,x-w/2-1,fy-1,w+2,fh+2,'#2a1c16');R(g,x-w/2,fy,w,fh,c);R(g,x+w/2-4*k,fy,4*k,fh,shade(c,-30));R(g,x-w/2,fy,w,2*k,shade(c,30));
      const eyeY=fy+fh*.35,look=Math.sin(time*.7+i)*1.5*k,glowC=m.enraged?'#ff5a3a':flash?'#ffffff':'#ffe27a';R(g,x-6*k+look,eyeY,4*k,3*k,glowC);R(g,x+2*k+look,eyeY,4*k,3*k,glowC);R(g,x-4*k,fy+fh*.7,8*k,2*k,'#2a1c16');for(let t=0;t<3;t++)R(g,x-3*k+t*3*k,fy+fh*.7+2*k,1*k,2*k,'#f1efe6');
      if(i===faces-1&&big){Poly(g,[[x-w/2-18,fy+6],[x-w/2,fy],[x-w/2,fy+14]],'#b5483e');Poly(g,[[x+w/2+18,fy+6],[x+w/2,fy],[x+w/2,fy+14]],'#b5483e');}}
    const topY=y-8*k-faces*fh+rise;Poly(g,[[x-w/2-3,topY],[x,topY-14*k],[x+w/2+3,topY]],'#e8b04a');E(g,x,topY-6*k,3*k,3*k,m.enraged?'#ff5a3a':'#fff2c0');
    R(g,x-w/2-4*k,y-8*k,w+8*k,8*k,'#5a4232');R(g,x-w/2-4*k,y-8*k,w+8*k,2*k,'#7a5a3a');
    if(flash){g.globalAlpha=.35;R(g,x-w/2,topY,w,y-topY,'#ffffff');g.globalAlpha=1;}
    return topY;
  }
  function pillar(g,x,y,time,lit,color){R(g,x-8,y-56,16,58,'#6a5a48');R(g,x+2,y-56,6,58,'#4e4234');R(g,x-10,y-60,20,6,'#8a7658');R(g,x-10,y,20,4,'#4e4234');R(g,x-12,y-68,24,8,'#3a3028');
    if(lit){const f=Math.sin(time*10+x-originX)*2;Poly(g,[[x-8,y-68],[x,y-88-f],[x+8,y-68]],color);Poly(g,[[x-4,y-68],[x,y-80-f],[x+4,y-68]],'#fff2c0');}else R(g,x-6,y-70,12,2,'#2a2028');}

  // ---------- Distrito Alto: windmill, wheat, royal pond, barracks, dummies, clock tower ----------
  // Pixel-true helpers: every mark is an axis-aligned rect, so rotated parts stay crisp at any zoom.
  const art=new Map();
  function cached(key,w,h,draw){if(art.has(key))return art.get(key);const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;draw(g);art.set(key,c);return c;}
  function pline(g,x0,y0,x1,y1,c,w=1){const n=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));g.fillStyle=c;for(let i=0;i<=n;i++)g.fillRect(Math.round(x0+(x1-x0)*i/n-w/2),Math.round(y0+(y1-y0)*i/n-w/2),w,w);}
  function pellipse(g,cx,cy,rx,ry,c,step=2){g.fillStyle=c;for(let dy=-ry;dy<ry;dy+=step){const k=(dy+step/2)/ry,hw=Math.round(rx*Math.sqrt(Math.max(0,1-k*k)));g.fillRect(Math.round(cx-hw),Math.round(cy+dy),hw*2,step);}}
  function flag(g,x,y,time,color,accent,len=22){R(g,x,y,2,40,'#4a3a30');R(g,x-1,y-2,4,3,'#e8c14a');for(let c=0;c<len;c+=2){const k=c/len,off=Math.round(Math.sin(time*5-c*.45)*2*k);R(g,x+2+c,y+2+off,2,13,c%6<2?shade(color,-18):color);if(c>4&&c<len-4)R(g,x+2+c,y+7+off,2,3,accent);}}
  function fireflies(g,x,y,w,h,time,night,count=8){if(night<.08)return;for(let i=0;i<count;i++){const fx=x+hash(i,3,91)*w+Math.sin(time*.7+i*2.1)*14,fy=y+hash(i,7,91)*h+Math.cos(time*.9+i)*9,on=Math.sin(time*2.3+i*1.7);if(on<.1)continue;R(g,fx,fy,2,2,'#f4ffb0');glow(g,fx+1,fy+1,10,'#d8ff6a',night*on*2.6);}}

  function windmillBody(lit){return cached('windmill'+(lit?1:0),150,210,g=>{
    const cx=75,base=204,H=136;
    for(let r=0;r<H;r+=2){const hw=Math.round(40-14*r/H),yy=base-r-2;R(g,cx-hw,yy,hw*2,2,'#d2c6aa');R(g,cx+Math.round(hw*.3),yy,Math.round(hw*.7),2,'#b9ab8e');R(g,cx-hw,yy,3,2,'#e9dfc7');R(g,cx-hw-1,yy,1,2,'#5e5446');R(g,cx+hw,yy,1,2,'#5e5446');
      if(r%10===0)R(g,cx-hw+1,yy,hw*2-2,1,'#a0937a');else if(r%10===6){for(let k=-hw+6+(r%20>10?7:0);k<hw-3;k+=14)R(g,cx+k,yy-3,1,5,'#a0937a');}}
    R(g,cx-44,base-4,88,4,'#8b8577');R(g,cx-44,base-5,88,1,'#c9c3b2');
    // Arched door with stone frame and iron bands.
    R(g,cx-12,base-32,24,28,'#8b8577');pellipse(g,cx,base-32,12,7,'#8b8577');R(g,cx-9,base-30,18,26,'#5a3a22');pellipse(g,cx,base-30,9,5,'#5a3a22');
    for(let i=-7;i<8;i+=5)R(g,cx+i,base-33,2,29,'#7a4e2e');R(g,cx-9,base-22,18,1,'#2e2a2a');R(g,cx-9,base-12,18,1,'#2e2a2a');R(g,cx+5,base-17,2,2,'#e8c14a');
    for(const [wy,wx] of [[base-74,cx-4],[base-104,cx+2]]){R(g,wx-6,wy-1,14,16,'#8b8577');R(g,wx-5,wy,12,13,lit?'#ffd98a':'#2f4660');if(!lit)R(g,wx-4,wy+1,3,4,'#6f98c0');R(g,wx,wy,1,13,'#5a4232');R(g,wx-5,wy+6,12,1,'#5a4232');R(g,wx-7,wy+14,16,2,'#e9dfc7');}
    // Wooden gallery around the cap.
    const gy=base-H+10;R(g,cx-36,gy,72,4,'#6b4a2e');R(g,cx-36,gy,72,1,'#9a7048');for(let i=-34;i<=34;i+=6)R(g,i+cx,gy-9,2,9,'#7a5a3a');R(g,cx-36,gy-10,72,2,'#8a6440');
    // Conical shingled cap and finial.
    const top=base-H;for(let r=0;r<40;r+=2){const hw=Math.round(30-28*r/40),yy=top-r;R(g,cx-hw,yy,hw*2,2,'#8e4b3a');R(g,cx+Math.round(hw*.25),yy,Math.round(hw*.75),2,'#6f3a2d');R(g,cx-hw,yy,2,2,'#b5654e');if(r%6===0)for(let k=-hw+2+(r%12?0:3);k<hw-1;k+=6)R(g,cx+k,yy,1,2,'#5a2e24');}
    R(g,cx-32,top,64,3,'#5a2e24');R(g,cx-1,top-48,2,10,'#4a3a30');R(g,cx-3,top-50,6,3,'#e8c14a');
  });}
  function windmill(g,d,x,y,time,night,q){
    if(townArt('windmill')){const cx=x+64,b=y+124;E(g,cx+10,b-2,58,10,'#1c2a2244');placeArt(g,'windmill',cx,b,152);if(night>.12)glow(g,cx,b-60,26,'#ffc46a',night*2);return;}
    const cx=x+64,base=y+122,lit=night>.12;E(g,cx+10,base+2,58,10,'#1c2a2244');
    g.drawImage(windmillBody(lit),Math.round(cx-75),Math.round(base-204));if(lit)for(const [wy,wx] of [[base-68,cx-4],[base-98,cx+2]])glow(g,wx+1,wy,24,'#ffc46a',night*2);
    // Sails turn with the wind; the lattice is drawn from rect "pixels" so the edges stay hard.
    const hx=cx,hy=base-148,spin=time*.9,L=q==='leve'?66:74;
    for(let i=0;i<4;i++){const a=spin+i*Math.PI/2,dx=Math.cos(a),dy=Math.sin(a),px=-dy,py=dx;
      if(q!=='leve'){for(let r=16;r<L;r+=3)for(let o=2;o<=12;o+=3){const sx=hx+dx*r+px*o,sy=hy+dy*r+py*o,frame=(r%12<3)||o>=11;R(g,sx-1,sy-1,4,4,frame?'#7a5a3a':((r+o)%6<3?'#efe6cf':'#ddd2b6'));}}
      else for(let r=16;r<L;r+=4)pline(g,hx+dx*r+px*2,hy+dy*r+py*2,hx+dx*r+px*11,hy+dy*r+py*11,'#e6dcc2',3);
      pline(g,hx,hy,hx+dx*L,hy+dy*L,'#4a3424',3);}
    R(g,hx-4,hy-4,8,8,'#4a3424');R(g,hx-2,hy-2,4,4,'#e8c14a');
  }
  function wheatRow(lean){return cached('wheat'+lean,34,20,g=>{for(let i=0;i<32;i+=3){const h=11+Math.floor(hash(i,lean+3,5)*4),tx=i+1+lean,ty=18-h;pline(g,i+1,18,tx+1,ty+3,'#9a8a3a');R(g,tx,ty,3,5,'#c89a38');R(g,tx,ty,2,4,'#e8c35a');R(g,tx,ty,1,1,'#f8e7a0');}R(g,0,18,32,2,'#7a5f3a');});}
  function wheat(g,d,x,y,time,night,q){
    const w=d.w*32,h=d.h*32;R(g,x+2,y+4,w-4,h-6,'#8a6a3e');for(let j=0;j<h-8;j+=6)R(g,x+2,y+8+j,w-4,1,'#6e5230');
    for(let j=0;j*7<h-14;j++)for(let s=0;s<w/32;s++){const lean=q==='leve'?0:Math.max(-1,Math.min(1,Math.round(Math.sin(time*1.6-(x-originX+s*32)*.02+j*.35)*1.3)));g.drawImage(wheatRow(lean),x+s*32,y+j*7-4);}
    // Scarecrow keeps watch in the middle of the field.
    const sx=x+w/2,sy=y+h-18,sw=Math.round(Math.sin(time*1.2)*1);R(g,sx-1,sy-30,3,34,'#6b4a2e');R(g,sx-14,sy-22,28,3,'#6b4a2e');R(g,sx-7+sw,sy-24,14,14,'#4f6a8a');R(g,sx-7+sw,sy-24,14,2,'#6f8aa8');R(g,sx-16,sy-22,3,5,'#d8b865');R(g,sx+13,sy-22,3,5,'#d8b865');
    R(g,sx-5+sw,sy-36,10,10,'#d9bf8a');R(g,sx-3+sw,sy-33,2,2,'#2a2230');R(g,sx+1+sw,sy-33,2,2,'#2a2230');R(g,sx-9+sw,sy-38,18,3,'#b58a4e');R(g,sx-5+sw,sy-43,10,5,'#c89a58');
    for(const yy of [y+2,y+h-4]){R(g,x,yy,w,2,'#9a7048');R(g,x,yy+1,w,1,'#6b4a2e');}for(let i=0;i<=w;i+=16){R(g,x+i-1,y-4,3,10,'#7a5a3a');R(g,x+i-1,y+h-10,3,10,'#7a5a3a');R(g,x+i-1,y-4,3,1,'#b08658');}
  }
  function pondBody(w,h){return cached('pond'+w+'x'+h,w,h,g=>{
    const cx=w/2,cy=h/2,rx=w/2-4,ry=h/2-6;pellipse(g,cx,cy+3,rx+2,ry+2,'#1c2a2244');pellipse(g,cx,cy,rx,ry,'#8b8577');
    for(let i=0;i<44;i++){const a=i/44*Math.PI*2,sx=cx+Math.cos(a)*(rx-3),sy=cy+Math.sin(a)*(ry-3),t=hash(i,1,44);R(g,sx-4,sy-3,8,6,t>.6?'#c9c3b2':t>.3?'#b3ad9d':'#a39d8d');R(g,sx-4,sy-3,8,1,'#e2dccb');R(g,sx-4,sy+2,8,1,'#7d776a');}
    pellipse(g,cx,cy,rx-8,ry-8,'#3d86a0');pellipse(g,cx,cy+2,rx-12,ry-12,'#2f7390');pellipse(g,cx,cy+5,rx-26,ry-24,'#276580');
    for(const [lx,ly,f] of [[.28,.34,1],[.7,.62,0],[.62,.26,1],[.33,.7,0]]){const px=w*lx,py=h*ly;pellipse(g,px,py,7,4,'#4f8a45',1);R(g,px-1,py-4,2,4,'#2f7390');R(g,px-5,py-2,4,1,'#6fae5f');if(f){R(g,px+1,py-3,3,3,'#f08aa8');R(g,px+2,py-3,1,1,'#fff0f4');}}
  });}
  function duck(g,x,y,face,mallard,bob){const X=(a,w)=>face<0?x-a-w:x+a;y+=bob;
    R(g,X(-6,10),y-4,10,5,'#f1efe6');R(g,X(-6,10),y,10,1,'#c9c3b2');R(g,X(-8,2),y-5,2,2,'#e2dccb');R(g,X(-3,5),y-3,5,1,'#d8d2c1');
    R(g,X(2,4),y-9,4,5,mallard?'#2f6a3a':'#f1efe6');R(g,X(6,2),y-7,2,1,'#e8a040');R(g,X(4,1),y-8,1,1,'#1a1a20');if(mallard)R(g,X(2,4),y-4,4,1,'#f1efe6');}
  function pond(g,d,x,y,time,night,q){
    const w=d.w*32,h=d.h*32,cx=x+w/2,cy=y+h/2,rx=w/2-20,ry=h/2-22;g.drawImage(pondBody(w,h),x,y);
    for(let i=0;i<(q==='leve'?5:12);i++){const k=(time*.08+hash(i,2,9))%1,px=cx+(hash(i,5,9)*2-1)*rx*.8+Math.sin(time*.5+i)*6,py=cy+(hash(i,6,9)*2-1)*ry*.7;if(((px-cx)/rx)**2+((py-cy)/ry)**2>.8)continue;R(g,px,py,6+(i%3)*2,1,k<.5?'#6fb4c8':'#5aa2ba');}
    if(q!=='leve')for(let i=0;i<2;i++){const k=(time*.5+i*.5)%1;g.strokeStyle=`rgba(200,236,244,${.5*(1-k)})`;g.lineWidth=1;g.beginPath();g.ellipse(cx+(i?30:-26),cy+(i?10:-8),3+k*14,1+k*5,0,0,Math.PI*2);g.stroke();}
    const fk=(time%9)/9;if(fk<.1&&q!=='leve'){const s=fk/.1,fx=cx+24-s*22,fy=cy-4-Math.sin(s*Math.PI)*16;R(g,fx,fy,5,2,'#e0b25c');R(g,fx+4,fy-1,2,1,'#c07a3a');}
    for(let i=0;i<3;i++){const dir=i%2?-1:1,a=time*.14*dir+i*2.1,ex=cx+Math.cos(a)*rx*.55,ey=cy+Math.sin(a)*ry*.45,face=-Math.sin(a)*dir>=0?1:-1,bob=Math.round(Math.sin(time*3+i));
      R(g,ex-face*9-2,ey+1,5,1,'#9fd0dc');R(g,ex-face*13-2,ey+2,4,1,'#8fc3d0');duck(g,Math.round(ex),Math.round(ey),face,i===0,bob);}
    for(const [rx2,ry2] of [[x+10,y+h-30],[x+w-22,y+18],[x+w-14,y+h-26]])for(let i=0;i<4;i++){const sway=q==='leve'?0:Math.round(Math.sin(time*1.7+i+rx2)*1.5);pline(g,rx2+i*3,ry2+22,rx2+i*3+sway,ry2+6-i%2*4,'#4f6a3a');R(g,rx2+i*3+sway-1,ry2+4-i%2*4,3,5,'#7a5236');}
    if(night>.1){const gl=Math.round(Math.sin(time*.8)*6);R(g,cx-10+gl,cy-6,20,1,'#dfe8f0');R(g,cx-6+gl,cy-4,12,1,'#b8c8d8');}
    if(q==='ultra'&&night<.1)for(let i=0;i<2;i++){const fx=cx+Math.sin(time*1.3+i*3)*rx*.7,fy=cy-ry*.3+Math.cos(time*1.9+i)*ry*.4,wg=Math.sin(time*30+i)>0;R(g,fx,fy,6,1,'#3aa6c8');R(g,fx+1,fy-(wg?2:-1),2,2,'#cfeaf4');R(g,fx+4,fy-(wg?2:-1),2,2,'#cfeaf4');}
  }
  function barracksBody(w,lit){return cached('barracks'+w+(lit?1:0),w+16,150,g=>{
    const x=8,base=146,top=base-70;
    R(g,x,top,w,70,'#b9b3a3');R(g,x+w-14,top,14,70,'#9d9787');R(g,x,top,4,70,'#d3cdbc');
    for(let r=0;r<9;r++)for(let c=0;c<w/16+1;c++){const bx=x+c*16-(r%2?8:0),by=top+4+r*7;if(bx<x||bx+14>x+w)continue;R(g,bx+1,by,14,6,hash(c,r,17)>.5?'#cfc9b8':'#c3bdac');R(g,bx+1,by+5,14,1,'#9d9787');}
    for(let i=0;i<w;i+=16){R(g,x+i,top-10,10,11,'#d3cdbc');R(g,x+i,top-10,10,2,'#efe9d8');R(g,x+i+8,top-8,2,9,'#a8a292');}R(g,x,top,w,3,'#e2dccb');
    const cx=x+w/2;R(g,cx-18,base-44,36,44,'#8b8577');pellipse(g,cx,base-44,18,10,'#8b8577');R(g,cx-14,base-40,28,40,'#5a3a22');pellipse(g,cx,base-40,14,7,'#5a3a22');
    for(let i=-12;i<13;i+=6)R(g,cx+i,base-46,2,46,'#7a4e2e');for(const yy of [base-32,base-14])R(g,cx-14,yy,28,2,'#2e2a2a');for(let i=-10;i<11;i+=5)for(const yy of [base-32,base-14])R(g,cx+i,yy,1,1,'#c9c3b2');
    // Shields with the sun of Aurória flank the gate.
    for(const sx of [cx-40,cx+26]){R(g,sx,top+14,14,16,'#2c4f7a');R(g,sx+2,top+28,10,4,'#2c4f7a');R(g,sx+4,top+32,6,2,'#2c4f7a');R(g,sx+1,top+15,12,1,'#5a8ab8');R(g,sx+5,top+19,4,4,'#f3d56a');R(g,sx+6,top+18,2,6,'#f3d56a');R(g,sx+4,top+20,6,2,'#f3d56a');}
    for(const sx of [x+14,x+w-24]){R(g,sx,top+20,6,22,'#3a3440');R(g,sx+1,top+21,4,20,lit?'#ffd98a':'#2a2430');}
    // Weapon rack.
    const rx=x+w-58;R(g,rx,base-26,26,3,'#6b4a2e');R(g,rx,base-12,26,3,'#6b4a2e');for(let i=0;i<4;i++){R(g,rx+3+i*6,base-40,2,38,'#8a6a44');R(g,rx+2+i*6,base-44,4,5,'#b8c7d9');R(g,rx+3+i*6,base-45,2,1,'#e8f0f8');}
  });}
  function barracks(g,d,x,y,time,night,q){
    if(townArt('barracks')){const cx=x+d.w*16,b=y+d.h*32+6;E(g,cx+6,b-4,d.w*16,9,'#1c2a2244');placeArt(g,'barracks',cx,b,204);if(night>.12)glow(g,cx,b-60,50,'#ffc46a',night*1.8);return;}
    const w=d.w*32,base=y+d.h*32,lit=night>.12;E(g,x+w/2+6,base+2,w*.56,9,'#1c2a2244');g.drawImage(barracksBody(w,lit),Math.round(x-8),Math.round(base-146));
    flag(g,x+w-22,base-122,time,'#2c4f7a','#f3d56a');flag(g,x+8,base-122,time+1.3,'#b73a3a','#f3d56a',18);
    for(const tx of [x+w/2-28,x+w/2+24]){const f=Math.sin(time*11+tx-originX)*1.5;R(g,tx,base-40,4,8,'#4a3a30');Poly(g,[[tx-2,base-40],[tx+2,base-52-f],[tx+6,base-40]],'#ff9b3d');Poly(g,[[tx,base-40],[tx+2,base-47-f],[tx+4,base-40]],'#ffe28a');if(night>.05)glow(g,tx+2,base-46,40,'#ffb45a',night*2.4);}
    if(lit)for(const sx of [x+6,x+w-32])glow(g,sx+11,base-40,20,'#ffc46a',night*1.8);
  }
  function dummy(g,d,x,y,time,night,q){
    const cx=x+16,base=y+30,phase=(time*.9+d.x*.37)%2,hit=phase<.35,ang=hit?Math.sin(phase*40)*.14*(1-phase/.35):Math.sin(time*1.1+d.x)*.02;
    E(g,cx,base+1,9,3,'#1c2a2244');R(g,cx-6,base-2,12,3,'#6b4a2e');
    g.save();g.translate(cx,base);g.rotate(ang);R(g,-1,-40,3,40,'#7a5a3a');R(g,-13,-30,26,3,'#6b4a2e');R(g,-7,-34,14,18,'#d8b865');R(g,-7,-34,14,2,'#ecd28a');R(g,-7,-27,14,1,'#8a6a3a');R(g,-7,-21,14,1,'#8a6a3a');R(g,3,-34,4,18,'#c09a4a');
    R(g,-5,-45,10,10,'#c8a878');R(g,-5,-45,10,2,'#dcc098');R(g,-3,-42,1,1,'#3a2a20');R(g,-2,-41,1,1,'#3a2a20');R(g,1,-42,1,1,'#3a2a20');R(g,2,-41,1,1,'#3a2a20');R(g,-3,-38,6,1,'#9a5a3a');
    if(hit){R(g,-12,-35+phase*20,2,1,'#ecd28a');R(g,10,-30-phase*18,2,1,'#ecd28a');R(g,-8+phase*30,-44,1,2,'#ecd28a');}g.restore();
    if(phase<.08){g.strokeStyle='#ffffffcc';g.lineWidth=1;g.beginPath();g.arc(cx,base-26,14,-2.4,-.8);g.stroke();}
  }
  function clockBody(lit){return cached('clock'+(lit?1:0),100,236,g=>{
    const cx=50,base=232,H=150,x0=cx-26;
    R(g,x0,base-H,52,H,'#d8d0bc');R(g,x0+38,base-H,14,H,'#b3aa94');R(g,x0,base-H,4,H,'#ece4d0');R(g,x0-1,base-H,1,H,'#5e5446');R(g,x0+52,base-H,1,H,'#5e5446');
    for(let r=0;r<H;r+=9){R(g,x0+1,base-r-1,50,1,'#b8ae98');for(let k=(r/9)%2?6:13;k<50;k+=14)R(g,x0+k,base-r-9,1,8,'#b8ae98');}
    for(const yy of [base-H+44,base-60]){R(g,x0-4,yy,60,5,'#e9e1cd');R(g,x0-4,yy+4,60,1,'#9d9380');}
    R(g,cx-10,base-30,20,30,'#8b8577');pellipse(g,cx,base-30,10,6,'#8b8577');R(g,cx-8,base-28,16,28,'#5a3a22');pellipse(g,cx,base-28,8,4,'#5a3a22');R(g,cx,base-30,1,30,'#3a2414');R(g,cx+4,base-15,2,2,'#e8c14a');
    for(const yy of [base-96,base-72]){R(g,cx-4,yy,8,14,'#3a3440');R(g,cx-3,yy+1,6,12,lit?'#ffd98a':'#35506e');pellipse(g,cx,yy,4,3,'#3a3440',1);}
    // Clock face.
    const fy=base-H+24;pellipse(g,cx,fy,17,17,'#8b6a2e',1);pellipse(g,cx,fy,15,15,'#e8c14a',1);pellipse(g,cx,fy,13,13,lit?'#fff2c8':'#f3ecd8',1);
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;R(g,Math.round(cx+Math.cos(a)*11)-(i%3?0:1),Math.round(fy+Math.sin(a)*11)-(i%3?0:1),i%3?1:2,i%3?1:2,'#3a2a20');}
    // Open belfry and spire.
    const by=base-H;R(g,x0-2,by-30,56,30,'#c9c1ab');R(g,x0+6,by-26,16,24,'#2a2430');R(g,x0+30,by-26,16,24,'#2a2430');pellipse(g,x0+14,by-26,8,5,'#2a2430',1);pellipse(g,x0+38,by-26,8,5,'#2a2430',1);R(g,x0-4,by-32,60,4,'#e9e1cd');
    for(let r=0;r<54;r+=2){const hw=Math.round(30-29*r/54),yy=by-34-r;R(g,cx-hw,yy,hw*2,2,'#436e78');R(g,cx+Math.round(hw*.2),yy,Math.round(hw*.8),2,'#34585f');R(g,cx-hw,yy,2,2,'#6a98a2');if(r%8===0)R(g,cx-hw,yy,hw*2,1,'#2c4a50');}
    R(g,cx-1,by-100,2,14,'#e8c14a');R(g,cx-4,by-96,8,2,'#e8c14a');pellipse(g,cx,by-101,3,3,'#e8c14a',1);
  });}
  function clocktower(g,d,x,y,time,night,q){
    if(townArt('clocktower')){const cx=x+48,b=y+94,H=238,a=townArt('clocktower'),W=a.width*H/a.height;E(g,cx+8,b-2,40,8,'#1c2a2244');placeArt(g,'clocktower',cx,b,W);
      const fx=cx-W/2+W*.34,fy=b-H+H*.47,r=W*.13,hour=(12+(time%480)/480*24)%24,ha=(hour%12)/12*Math.PI*2-Math.PI/2,ma=(hour%1)*Math.PI*2-Math.PI/2;
      E(g,fx,fy,r,r,'#efe3c4');pline(g,fx,fy,fx+Math.cos(ha)*r*.55,fy+Math.sin(ha)*r*.55,'#2a2230',2);pline(g,fx,fy,fx+Math.cos(ma)*r*.85,fy+Math.sin(ma)*r*.85,'#2a2230',1);R(g,fx-1,fy-1,2,2,'#b8862e');
      if(night>.12)glow(g,fx,fy,30,'#ffd98a',night*1.6);return;}
    const cx=x+48,base=y+92,lit=night>.12,H=150;E(g,cx+8,base+2,40,8,'#1c2a2244');g.drawImage(clockBody(lit),cx-50,base-232);
    const fy=base-H+24,hour=(12+(time%480)/480*24)%24,ha=(hour%12)/12*Math.PI*2-Math.PI/2,ma=(hour%1)*Math.PI*2-Math.PI/2;
    pline(g,cx,fy,cx+Math.cos(ha)*7,fy+Math.sin(ha)*7,'#2a2230',2);pline(g,cx,fy,cx+Math.cos(ma)*11,fy+Math.sin(ma)*11,'#2a2230',1);R(g,cx-1,fy-1,2,2,'#b8862e');
    if(lit)glow(g,cx,fy,36,'#ffd98a',night*1.6);
    const ring=(hour%1)<.05,sw=ring?Math.round(Math.sin(time*9)*3):0,by=base-H-26;for(const bx of [cx-12,cx+12]){R(g,bx-4+sw,by+6,9,8,'#d7a94a');R(g,bx-3+sw,by+4,7,3,'#d7a94a');R(g,bx-5+sw,by+13,11,2,'#b8862e');R(g,bx-3+sw,by+6,2,6,'#f3d56a');R(g,bx+sw,by+15,2,2,'#6b4a2e');}
    if(ring)for(let i=0;i<3;i++){const k=((time*1.5+i/3)%1);g.strokeStyle=`rgba(243,213,106,${.6*(1-k)})`;g.lineWidth=1;g.beginPath();g.arc(cx,by+10,10+k*26,Math.PI*1.1,Math.PI*1.9);g.stroke();}
  }
  return {setOrigin,cobble,lawn,wall,cornerTower,gateArch,house,chapel,tavern,stall,tower,hedge,lamp,grandFountain,flowerBed,glow,citadelGround,citadelWallTile,citadelWall,totem,pillar,shade,windmill,wheat,pond,barracks,dummy,clocktower,flag,fireflies,pline,pellipse,setQuality};
})();
