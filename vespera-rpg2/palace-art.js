'use strict';
// Procedural 16-bit art for the royal castle interiors (world-palace.js): floors, walls, furniture.
// Low pieces are baked with the ground (each tile draws its slice of the whole object); tall pieces
// are depth-sorted layers so the player can walk in front of and behind them.
window.PalaceArt=(()=>{
  const V=()=>window.Vespera,P=()=>window.WorldPalace;
  const kingdom=id=>V().kingdoms.find(k=>k.id===id)||V().kingdoms[0];
  const R=(g,x,y,w,h,c)=>{if(w<=0||h<=0)return;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const E=(g,x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(Math.round(x),Math.round(y),rx,ry,0,0,Math.PI*2);g.fill();};
  const shade=(hex,a)=>{const n=parseInt(hex.slice(1),16);return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,v+a)).toString(16).padStart(2,'0')).join('');};
  const hash=(x,y,s=0)=>{const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return v-Math.floor(v);};
  // Sprite pieces from assets/town-v1.png (GameAssets.place: bottom-centred, width in pixels); false while loading.
  const has=n=>!!window.GameAssets?.get('town-'+n),put2=(g,n,cx,base,w,flip)=>!!window.GameAssets?.place(g,'town-'+n,cx,base,w,flip);
  const GOLD='#e8c14a',GOLDD='#a8862e',WOOD='#7a4e2e',WOODL='#a06a3e',WOODD='#4e301c';
  // Draw a whole multi-tile object, clipped to this tile.
  function slice(g,t,x,y,draw){g.save();g.beginPath();g.rect(x,y,32,32);g.clip();draw(x-t.fx*32,y-t.fy*32,t.fw*32,t.fh*32);g.restore();}
  function floor(g,t,x,y,k){const a=(t.lx+t.ly)%2;
    switch(t.floor){
      case 'marble':R(g,x,y,32,32,a?'#cfc8b6':'#e2dccb');R(g,x,y,32,1,'#f1ecde');R(g,x,y+31,32,1,'#aea795');R(g,x+31,y,1,32,'#bdb6a4');if((t.lx*3+t.ly*5)%7===0){R(g,x+13,y+13,6,6,shade(k.color,-40));R(g,x+14,y+14,4,4,k.color);}break;
      case 'carpet':R(g,x,y,32,32,shade(k.roof,-10));R(g,x+2,y,2,32,GOLD);R(g,x+28,y,2,32,GOLD);if(t.ly%3===0){R(g,x+14,y+12,4,8,GOLD);R(g,x+12,y+14,8,4,GOLD);}break;
      case 'wood':R(g,x,y,32,32,WOOD);for(let i=0;i<4;i++){R(g,x,y+i*8,32,1,WOODD);R(g,x+((t.lx*7+i*13)%4)*8,y+i*8,1,8,WOODD);R(g,x+2,y+i*8+2,28,1,shade(WOOD,14));}break;
      case 'stone':R(g,x,y,32,32,'#8a8a86');R(g,x,y,16,16,'#96968f');R(g,x+16,y+16,16,16,'#96968f');R(g,x,y+15,32,1,'#6e6e6a');R(g,x+15,y,1,32,'#6e6e6a');break;
      case 'rug':R(g,x,y,32,32,'#5a3552');if(a)R(g,x+6,y+6,20,20,'#643c5c');R(g,x+15,y+15,2,2,'#b88a5a');break;
      case 'grass':R(g,x,y,32,32,'#5a8a45');for(let i=0;i<5;i++){const gx=x+hash(t.lx,t.ly,i)*28,gy=y+hash(t.ly,t.lx,i)*26;R(g,gx,gy,2,4,'#78a85a');R(g,gx+1,gy-1,1,2,'#9cc676');}break;
      default:R(g,x,y,32,32,'#c9c2b0');
    }
  }
  // Walls: dark masonry; faces that look into a room get bricks and a per-room decoration.
  function wall(g,t,x,y,k){const cell=t.layout==='tavern'?P().tcell:P().cell,below=cell(t.lx,t.ly+1);
    R(g,x,y,32,32,'#232834');R(g,x,y,32,2,'#2e3442');
    if(!below)return;
    const room=below.room;R(g,x,y,32,32,'#4a5160');for(let r=0;r<4;r++)for(let c=-1;c<3;c++){const bx=x+c*14+(r%2)*7;R(g,Math.max(x,bx),y+r*8,Math.min(13,x+32-bx),7,r%2?'#5a6273':'#535b6b');}R(g,x,y+30,32,2,'#2a2f3a');
    const n=t.lx;
    if((room==='throne'||room==='chapel')&&n%5===2&&put2(g,'glass',x+16,y+31,21)){}
    else if((room==='throne'||room==='hall'||room==='gallery')&&n%4===0&&put2(g,'banner',x+16,y+30,22)){}
    else if(room==='taproom'&&n%5===4&&put2(g,'lantern',x+16,y+30,15)){}
    else if((room==='throne'||room==='chapel')&&n%5===2){R(g,x+8,y+2,16,26,'#1a1f2a');const cols=[k.color,k.roof,'#c0304a','#3a7fd0',GOLD];for(let i=0;i<3;i++)for(let j=0;j<2;j++)R(g,x+10+j*6,y+4+i*8,5,7,cols[(i+j+n)%cols.length]);E(g,x+16,y+4,7,3,cols[n%cols.length]);}
    else if((room==='throne'||room==='hall'||room==='gallery')&&n%4===0){R(g,x+11,y+2,10,2,GOLDD);R(g,x+12,y+4,8,20,k.color);R(g,x+12,y+4,8,2,GOLD);R(g,x+15,y+10,2,2,GOLD);R(g,x+12,y+24,4,3,k.color);R(g,x+16,y+24,4,3,shade(k.color,-30));}
    else if(n%6===3&&room!=='garden'){R(g,x+14,y+14,4,9,'#5a4030');R(g,x+12,y+12,8,3,'#8a6a40');R(g,x+14,y+6,4,6,'#ff9a3a');R(g,x+15,y+8,2,3,'#ffe7a0');}
    if(room==='taproom'){if(n%5===1){R(g,x+8,y+4,16,18,'#2a3a4a');R(g,x+9,y+5,6,7,'#6a8ab0');R(g,x+17,y+5,6,7,'#6a8ab0');R(g,x+9,y+13,6,7,'#5a7aa0');R(g,x+17,y+13,6,7,'#5a7aa0');R(g,x+6,y+22,20,3,WOOD);}else if(n%5===3){R(g,x+3,y+14,26,3,WOODD);for(let i=0;i<4;i++){R(g,x+5+i*6,y+8,5,6,'#c8a060');R(g,x+9+i*6,y+9,2,3,'#8a6a40');}}}
    if(room==='library'&&n%3===1){R(g,x+4,y+10,24,14,'#5a3a22');for(let i=0;i<6;i++)R(g,x+6+i*4,y+12,3,10,['#8a2a2a','#2f4f7a','#4f7a45','#8a6a2f','#5c4a86','#9a3b3b'][(i+n)%6]);}
  }
  // Low furniture, baked with the ground.
  function low(g,t,x,y,k){const f=t.furn;if(!f||P().TALL.has(f))return;slice(g,t,x,y,(ox,oy,w,h)=>lowArt(g,f,ox,oy,w,h,k));}
  function lowArt(g,f,ox,oy,w,h,k){
      switch(f){
        case 'carpet':case 'rug':case 'carpetR':{const main=f==='carpetR'?'#6a2e46':f==='rug'?shade(k.roof,-20):k.roof;R(g,ox,oy,w,h,GOLDD);R(g,ox+3,oy+3,w-6,h-6,main);R(g,ox+7,oy+7,w-14,h-14,shade(main,14));for(let i=16;i<w-16;i+=24)for(let j=16;j<h-16;j+=24){R(g,ox+i-2,oy+j-5,4,10,GOLD);R(g,ox+i-5,oy+j-2,10,4,GOLD);}break;}
        case 'dais':for(let s=0;s<3;s++){const inset=s*10;R(g,ox+inset,oy+inset*.8,w-inset*2,h-inset*.8,s%2?'#bdb5a0':'#d8d0bb');R(g,ox+inset,oy+inset*.8,w-inset*2,2,'#efe8d6');R(g,ox+inset,oy+h-2,w-inset*2,2,'#8e8674');}R(g,ox+w/2-40,oy,80,h,shade(k.roof,-10));R(g,ox+w/2-40,oy,2,h,GOLD);R(g,ox+w/2+38,oy,2,h,GOLD);break;
        case 'table':R(g,ox+2,oy+4,w-4,h-6,WOODD);R(g,ox+2,oy+2,w-4,h-8,WOODL);R(g,ox+4,oy+4,w-8,2,shade(WOODL,20));for(let i=12;i<w-12;i+=32){E(g,ox+i,oy+h/2-2,6,4,'#e8e2d0');E(g,ox+i,oy+h/2-2,3,2,'#c8b890');if(hash(i,oy)>.6){R(g,ox+i+10,oy+h/2-10,2,7,'#efe6d0');R(g,ox+i+10,oy+h/2-12,2,2,'#ffcf6a');}}break;
        case 'chair':R(g,ox+9,oy+8,14,14,WOODD);R(g,ox+10,oy+9,12,10,'#8a2a36');R(g,ox+10,oy+6,12,4,WOODL);break;
        case 'counter':R(g,ox,oy+10,w,h-10,WOOD);R(g,ox,oy+6,w,8,'#b8b4a8');R(g,ox,oy+6,w,2,'#d8d4c8');for(let i=16;i<w;i+=40){E(g,ox+i,oy+10,6,3,'#c07a3a');R(g,ox+i+14,oy+4,6,6,'#dcd0b0');}break;
        case 'pew':R(g,ox+2,oy+14,w-4,12,WOOD);R(g,ox+2,oy+8,w-4,6,WOODL);R(g,ox+2,oy+24,w-4,2,WOODD);break;
        case 'altar':R(g,ox+4,oy+6,w-8,h-8,'#efe9dc');R(g,ox+4,oy+6,w-8,4,GOLD);R(g,ox+w/2-3,oy+2,6,16,GOLD);R(g,ox+w/2-8,oy+6,16,4,GOLD);break;
        case 'flowers':R(g,ox,oy,w,h,'#4a3a26');for(let i=0;i<w;i+=8)for(let j=0;j<h;j+=8){const c=['#f08aa8','#f3d56a','#ffffff','#b47ae8'][((i+j)/8|0)%4];R(g,ox+i+2,oy+j+2,4,4,c);R(g,ox+i+3,oy+j+5,2,3,'#3f7a45');}break;
        case 'hedge':R(g,ox,oy+4,w,h-4,'#2f5a30');R(g,ox,oy+2,w,6,'#3f7a3c');for(let i=0;i<w;i+=6)R(g,ox+i,oy+2,3,2,'#5aa04a');break;
        case 'fountain':E(g,ox+w/2,oy+h/2+4,w/2-4,h/2-8,'#9c9686');E(g,ox+w/2,oy+h/2+2,w/2-10,h/2-14,'#3a7fb0');E(g,ox+w/2,oy+h/2,w/2-16,h/2-20,'#5aa8d8');R(g,ox+w/2-6,oy+h/2-26,12,26,'#bdb6a4');E(g,ox+w/2,oy+h/2-28,14,6,'#cfc8b6');E(g,ox+w/2,oy+h/2-30,8,3,'#8ac8f0');break;
        case 'sacks':E(g,ox+12,oy+20,10,9,'#c8a870');E(g,ox+20,oy+16,8,8,'#b89860');break;
        case 'barrel':E(g,ox+16,oy+18,11,12,'#6a4428');R(g,ox+6,oy+12,20,2,'#3a3440');R(g,ox+6,oy+22,20,2,'#3a3440');E(g,ox+16,oy+8,10,4,'#8a5a36');break;
        case 'desk':case 'vanity':R(g,ox+2,oy+6,w-4,h-8,WOODD);R(g,ox+2,oy+4,w-4,h-10,WOODL);if(f==='desk'){R(g,ox+10,oy+6,14,10,'#efe6d0');R(g,ox+30,oy+4,2,10,'#3a2a1a');}else{E(g,ox+w/2,oy+2,14,10,'#c8d8e8');E(g,ox+w/2,oy+2,11,7,'#e8f0f8');}break;
        case 'plant':R(g,ox+9,oy+18,14,12,'#8a5a3a');R(g,ox+8,oy+17,16,3,'#a8704a');E(g,ox+16,oy+12,10,8,'#3f7a45');E(g,ox+12,oy+8,6,5,'#5aa04a');E(g,ox+21,oy+10,5,4,'#5aa04a');break;
        case 'bar':R(g,ox,oy+6,w,h-6,WOODD);R(g,ox,oy+2,w,8,WOODL);R(g,ox,oy+2,w,2,shade(WOODL,24));for(let i=6;i<w;i+=22){R(g,ox+i,oy+12,2,h-14,WOOD);}for(let i=18;i<w-8;i+=46){R(g,ox+i,oy-6,6,8,'#c8a060');R(g,ox+i+1,oy-5,2,3,'#fff0c0');}break;
        case 'stool':E(g,ox+16,oy+14,8,5,WOODL);R(g,ox+13,oy+17,2,10,WOODD);R(g,ox+18,oy+17,2,10,WOODD);break;
        case 'stage':R(g,ox,oy+4,w,h-4,WOODD);R(g,ox,oy,w,h-6,WOODL);for(let i=0;i<w;i+=16)R(g,ox+i,oy,1,h-6,WOOD);R(g,ox,oy,w,2,GOLD);R(g,ox+4,oy+4,w-8,3,'#8a1f2e');break;
        case 'stairs':for(let s=0;s<h;s+=8){R(g,ox,oy+s,w,8,s%16?WOOD:WOODL);R(g,ox,oy+s+7,w,1,WOODD);}R(g,ox+w-4,oy,4,h,WOODD);break;
        case 'lamp':R(g,ox+14,oy+8,4,20,'#5a4a3a');E(g,ox+16,oy+8,7,5,'#ffe7a0');break;
        case 'rtable':lowArt(g,'table',ox,oy,w,h,k);break;
        case 'barrels':for(const [bx,by] of [[0,0],[32,0],[16,24]])lowArt(g,'barrel',ox+bx,oy+by,32,32,k);break;
        case 'crates':case 'chest':R(g,ox+5,oy+8,22,20,WOODD);R(g,ox+7,oy+10,18,16,f==='chest'?'#8a5a2e':WOOD);if(f==='chest')R(g,ox+5,oy+14,22,3,GOLD);break;
        case 'board':R(g,ox+4,oy+2,w-8,h-8,WOODD);for(let i=10;i<w-16;i+=18)R(g,ox+i,oy+6,12,12,'#efe6d0');break;
        case 'spears':R(g,ox+4,oy+20,24,4,WOODD);for(const sx of [8,15,22]){R(g,ox+sx,oy-6,2,30,WOODL);R(g,ox+sx-1,oy-10,4,5,'#c8ccd4');}break;
        case 'mirror':R(g,ox+8,oy-8,16,32,GOLD);R(g,ox+10,oy-6,12,28,'#8fb4d8');break;
        case 'rope':R(g,ox+4,oy+6,3,22,GOLD);R(g,ox+25,oy+6,3,22,GOLD);R(g,ox+6,oy+10,20,3,'#8a1f2e');break;
      }
  }
  function ground(g,t,x,y){const k=kingdom(t.kingdom);if(t.kind==='wall'){wall(g,t,x,y,k);return;}floor(g,t,x,y,k);if(t.exit){R(g,x+2,y,28,32,'#3a2a1a');R(g,x+4,y,24,30,'#1a120c');return;}low(g,t,x,y,k);}
  // Tall furniture as depth-sorted layers, drawn once from the anchor tile.
  function feature(g,layers,t,tx,ty,sx,sy,time,reduced,light){const k=kingdom(t.kingdom),w=t.fw*32,h=t.fh*32,f=t.furn,flick=reduced?0:Math.sin(time*11+tx*3);
    const put=(dy,draw)=>layers.push({y:ty+t.fh-.05+dy,draw}),cell=t.layout==='tavern'?P().tcell:P().cell,base=sy+h-2;
    const S=(n,cx,b,sw,flip)=>put2(g,n,cx,b,sw,flip);
    if(has('pillar'))switch(f){
      case 'pillar':put(0,()=>{E(g,sx+16,sy+28,13,4,'#0e121a55');S('pillar',sx+16,sy+31,30);});return;
      case 'statue':put(0,()=>{E(g,sx+16,sy+28,13,4,'#0e121a55');(t.lx+t.ly)%2?S('armor',sx+16,sy+31,32):S('bust',sx+16,sy+31,27);});return;
      case 'throne':put(0,()=>{t.lx>=P().W/2?S('queenThrone',sx+16,sy+31,36):S('throne',sx+16,sy+31,40);});return;
      case 'brazier':put(0,()=>{S('brazier',sx+16,sy+31,30);light(sx+16,sy-6,110,'#ffb45a',1,'66');});return;
      case 'shelf':put(0,()=>{for(let i=0;i<t.fw;i++)S('bookcase',sx+i*32+16,sy+30,34);});return;
      case 'bottles':put(0,()=>{const n=Math.max(1,Math.round(t.fw/3)),sw=w/n;for(let i=0;i<n;i++)S('bottles',sx+sw*i+sw/2,sy+24,sw+2);});return;
      case 'hearth':put(0,()=>{S('hearth',sx+w/2,sy+32,Math.min(w,118));light(sx+w/2,sy+6,130+(reduced?0:flick*8),'#ff9a4a',1,'66');});return;
      case 'plant':put(0,()=>S('vase',sx+16,sy+31,28));return;
      case 'stool':put(0,()=>S('stool',sx+16,sy+31,21));return;
      case 'chair':{const flip=t.layout==='tavern'?cell(t.lx+1,t.ly)?.furn==='rtable':t.lx%2===0;put(0,()=>S('chair',sx+16,sy+31,23,flip));return;}
      case 'rtable':put(0,()=>S('rtable',sx+w/2,base+4,w+6));return;
      case 'barrels':put(0,()=>S('barrels',sx+w/2,base+4,w+2));return;
      case 'sacks':case 'crates':case 'chest':put(0,()=>S(f,sx+16,sy+31,f==='chest'?31:34));return;
      case 'spears':put(0,()=>S('spears',sx+16,sy+31,32));return;
      case 'mirror':put(0,()=>S('mirror',sx+16,sy+26,24));return;
      case 'rope':put(0,()=>S('rope',sx+16,sy+30,34));return;
      case 'board':put(0,()=>S('board',sx+w/2,sy+22,w-10));return;
      case 'stairs':put(0,()=>S('stairs',sx+w/2,base+2,w+30));return;
      // The stage sorts at its back edge, so the bard and the audience on it are drawn in front.
      case 'stage':layers.push({y:ty+.05,draw(){S('stage',sx+w/2,base+2,w+10);}});return;
      case 'bar':put(0,()=>{lowArt(g,'bar',sx,sy,w,h,k);S('mug',sx+56,sy+12,12);S('stew',sx+w*.62,sy+14,22);S('mug',sx+w-40,sy+12,12);});return;
    }
    // Procedural fallback while the atlas loads (and for pieces without a sprite).
    if(!['bottles','pillar','statue','shelf','wardrobe','cabinet','bed','throne','tree','oven','hearth','brazier','globe','candles'].includes(f)){put(0,()=>lowArt(g,f,sx,sy,w,h,k));return;}
    switch(f){
      case 'bottles':put(0,()=>{R(g,sx,sy-26,w,54,WOODD);R(g,sx+2,sy-24,w-4,50,WOOD);for(let r=0;r<3;r++){R(g,sx+2,sy-22+r*16,w-4,2,WOODD);for(let i=4;i<w-6;i+=7){const c=['#3a7a4a','#8a2a2a','#c8a040','#5a4a8a','#2a5a7a'][Math.floor(hash(tx*5+i,r)*5)];R(g,sx+i,sy-18+r*16,5,12,c);R(g,sx+i+1,sy-21+r*16,3,4,c);R(g,sx+i+1,sy-16+r*16,1,6,'#ffffff55');}}});break;
      case 'pillar':put(0,()=>{E(g,sx+16,sy+28,13,4,'#0e121a55');R(g,sx+6,sy-40,20,66,'#bdb6a6');R(g,sx+6,sy-40,5,66,'#dcd6c6');R(g,sx+21,sy-40,5,66,'#96907f');R(g,sx+3,sy-46,26,8,'#d2cbb9');R(g,sx+3,sy-46,26,2,GOLD);R(g,sx+3,sy+22,26,8,'#aaa392');});break;
      case 'statue':put(0,()=>{R(g,sx+4,sy+14,24,16,'#9c9686');R(g,sx+4,sy+14,24,3,'#bdb6a4');R(g,sx+10,sy-22,12,36,'#c8c2b4');E(g,sx+16,sy-26,7,7,'#d8d2c4');R(g,sx+6,sy-12,6,14,'#b8b2a4');R(g,sx+22,sy-18,3,24,GOLDD);});break;
      case 'shelf':put(0,()=>{R(g,sx,sy-30,w,58,WOODD);R(g,sx+2,sy-28,w-4,54,WOOD);for(let r=0;r<3;r++){R(g,sx+2,sy-26+r*18,w-4,2,WOODD);for(let i=4;i<w-6;i+=5){const c=['#8a2a2a','#2f4f7a','#4f7a45','#8a6a2f','#5c4a86','#9a3b3b','#c8a040'][Math.floor(hash(tx*7+i,r)*7)];R(g,sx+i,sy-24+r*18+(hash(i,r)>.8?4:0),4,14-(hash(i,r)>.8?4:0),c);}}});break;
      case 'wardrobe':case 'cabinet':put(0,()=>{R(g,sx+2,sy-36,w-4,64,WOODD);R(g,sx+4,sy-34,w-8,60,WOODL);R(g,sx+w/2-1,sy-34,2,60,WOODD);R(g,sx+w/2-6,sy-8,3,6,GOLD);R(g,sx+w/2+3,sy-8,3,6,GOLD);R(g,sx+2,sy-38,w-4,4,shade(WOODD,-10));});break;
      case 'bed':put(0,()=>{R(g,sx+4,sy-24,w-8,28,WOODD);R(g,sx+6,sy-22,w-12,6,GOLDD);R(g,sx+6,sy,w-12,h-6,'#efe8dc');E(g,sx+w/2-18,sy+10,14,7,'#ffffff');E(g,sx+w/2+18,sy+10,14,7,'#ffffff');R(g,sx+6,sy+26,w-12,h-32,k.roof);R(g,sx+6,sy+26,w-12,4,GOLD);R(g,sx+4,sy-44,4,48,WOODD);R(g,sx+w-8,sy-44,4,48,WOODD);R(g,sx+4,sy-46,w-8,6,k.color);});break;
      case 'throne':put(0,()=>{R(g,sx+2,sy-34,28,60,GOLDD);R(g,sx+4,sy-32,24,56,GOLD);R(g,sx+8,sy-26,16,34,'#8a1f2e');R(g,sx+10,sy-24,12,30,'#b02a3c');R(g,sx+2,sy+8,28,14,GOLDD);R(g,sx+4,sy+10,24,10,'#8a1f2e');R(g,sx+14,sy-42,4,8,k.color);E(g,sx+16,sy-44,5,4,GOLD);});break;
      case 'tree':put(0,()=>{E(g,sx+16,sy+28,18,5,'#0e1a1255');R(g,sx+12,sy+2,8,26,'#6a4428');E(g,sx+16,sy-14,26,22,'#2f5a30');E(g,sx+10,sy-20,16,14,'#3f7a3c');E(g,sx+22,sy-8,14,11,'#4a8a45');E(g,sx+12,sy-26,8,6,'#5aa04a');});break;
      case 'oven':put(0,()=>{R(g,sx,sy-10,w,h+6,'#7a5a4a');for(let r=0;r<5;r++)for(let c=0;c<w;c+=12)R(g,sx+c+(r%2)*6,sy-10+r*14,10,12,r%2?'#8a6a58':'#946e5a');E(g,sx+w/2,sy+h/2,w/2-18,h/2-24,'#1a0e0a');E(g,sx+w/2,sy+h/2+6,w/2-26,8,flick>0?'#ff9a3a':'#ffb45a');light(sx+w/2,sy+h/2,90,'#ff9a4a',.8,'55');});break;
      case 'hearth':put(0,()=>{R(g,sx,sy-26,w,56,'#6a6a70');R(g,sx+4,sy-22,w-8,4,'#8a8a90');R(g,sx+w/2-26,sy-8,52,34,'#1a120c');for(let i=0;i<5;i++)R(g,sx+w/2-18+i*8,sy+14-(i%2?4:0)-(reduced?0:Math.abs(Math.sin(time*9+i))*6),6,10,i%2?'#ffb45a':'#ff7a2a');light(sx+w/2,sy+10,130,'#ff9a4a',1,'66');});break;
      case 'brazier':put(0,()=>{R(g,sx+12,sy+6,8,22,'#4a3a2a');E(g,sx+16,sy+6,12,5,'#8a6a40');for(let i=0;i<3;i++)R(g,sx+10+i*5,sy-6-(reduced?0:Math.abs(Math.sin(time*10+i))*5),5,10,i===1?'#ffe7a0':'#ff9a3a');light(sx+16,sy,110,'#ffb45a',1,'66');});break;
      case 'globe':put(0,()=>{R(g,sx+14,sy+8,4,20,WOODD);E(g,sx+16,sy+28,10,3,WOODD);E(g,sx+16,sy-2,11,11,'#3a7fb0');R(g,sx+10,sy-6,8,6,'#5a9a4a');R(g,sx+18,sy+2,6,4,'#5a9a4a');R(g,sx+4,sy-2,24,2,GOLD);});break;
      case 'candles':put(0,()=>{R(g,sx+14,sy-4,4,30,GOLDD);R(g,sx+6,sy-6,20,3,GOLD);for(const cx of [7,15,23]){R(g,sx+cx,sy-16,3,10,'#efe6d0');R(g,sx+cx,sy-20-(flick>0?1:0),3,4,'#ffcf6a');}light(sx+16,sy-16,80,'#ffd27a',.8,'55');});break;
    }
  }
  return {ground,feature};
})();
