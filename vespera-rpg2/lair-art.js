'use strict';
// Goblin lair and frontier camp props (world-lair.js / world-frontier.js): tents, fires, totems, cages,
// cauldron, bone throne... Drawn as depth-sorted layers from each prop's anchor tile. Where the town atlas
// already has a matching sprite (crates, chest, spears, coins, brazier) it is used; the rest is pixel-drawn.
window.LairArt=(()=>{
  const R=(g,x,y,w,h,c)=>{if(w<=0||h<=0)return;g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const E=(g,x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(Math.round(x),Math.round(y),Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);g.fill();};
  const P=(g,pts,c)=>{g.fillStyle=c;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(Math.round(x),Math.round(y)):g.moveTo(Math.round(x),Math.round(y)));g.closePath();g.fill();};
  const art=(g,n,cx,base,w,flip)=>!!window.GameAssets?.place(g,n,cx,base,w,flip);
  const hash=(x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
  function skull(g,x,y,s=1){E(g,x,y,4*s,3.5*s,'#e8e0c8');R(g,x-3*s,y+1*s,6*s,3*s,'#e8e0c8');R(g,x-2.5*s,y-1*s,2*s,2*s,'#2a2020');R(g,x+.5*s,y-1*s,2*s,2*s,'#2a2020');R(g,x-1*s,y+3*s,1*s,1*s,'#2a2020');R(g,x+1*s,y+3*s,1*s,1*s,'#2a2020');}
  function tent(g,x,y,w,h,t,seed){const base=y+h,cx=x+w/2,cloth=['#8a5a3a','#6a7a4a','#7a4a3a'][seed%3],dark='#3e2a1c';E(g,cx+4,base-2,w*.52,7,'#10121a55');
    P(g,[[x-2,base],[cx,base-62],[x+w+2,base]],cloth);P(g,[[cx,base-62],[x+w+2,base],[cx+10,base]],'#00000033');
    for(let i=0;i<5;i++)R(g,x+6+i*(w-12)/4,base-12-(i%2)*20,6,4,'#5a3a24');R(g,cx-1,base-70,2,12,dark);P(g,[[cx+1,base-70],[cx+12,base-66+Math.sin(t*3+seed)*2],[cx+1,base-62]],'#b0302a');
    P(g,[[cx-10,base],[cx,base-30],[cx+10,base]],'#1a120c');R(g,x-4,base-2,w+8,3,dark);skull(g,cx,base-40,.8);}
  function totem(g,cx,base,t){E(g,cx+2,base-2,10,4,'#10121a55');R(g,cx-4,base-64,8,64,'#5a3a24');R(g,cx-4,base-64,3,64,'#7a5234');for(let i=0;i<3;i++){const yy=base-58+i*18;R(g,cx-8,yy,16,12,['#8a4a2a','#6a7a3a','#b08a3a'][i]);R(g,cx-5,yy+3,3,3,'#1a120c');R(g,cx+2,yy+3,3,3,'#1a120c');R(g,cx-4,yy+8,8,2,'#1a120c');}
    skull(g,cx,base-70,1.1);R(g,cx-14,base-50,28,3,'#4a2e1c');for(const s of [-1,1])P(g,[[cx+s*14,base-50],[cx+s*20,base-38+Math.sin(t*2+s)*2],[cx+s*12,base-47]],'#c8b890');}
  function cage(g,x,y,w,h,t){const base=y+h;E(g,x+w/2+3,base-2,w*.5,6,'#10121a55');R(g,x+2,base-54,w-4,4,'#3a3a44');R(g,x+2,base-4,w-4,4,'#3a3a44');for(let i=0;i<=6;i++)R(g,x+3+i*(w-8)/6,base-52,3,48,i%2?'#5a5a66':'#4a4a55');
    const k=Math.floor(t*1.3+x)%4;if(k<3){E(g,x+w/2,base-14,10,7,'#5a4a3a');E(g,x+w/2+8,base-20,6,5,'#6a5a48');R(g,x+w/2+10,base-22,2,2,'#ffd84a');}}
  function cauldron(g,x,y,w,h,t,still){const cx=x+w/2,base=y+h;E(g,cx+3,base-2,26,7,'#10121a55');for(const lx of [-14,14])R(g,cx+lx-2,base-18,4,18,'#2a2a30');
    for(let i=0;i<5;i++)R(g,cx-12+i*6,base-10-(still?0:Math.abs(Math.sin(t*9+i))*5),5,8,i%2?'#ffb45a':'#ff6a2a');
    E(g,cx,base-26,22,16,'#1e1e24');E(g,cx,base-36,22,6,'#2e2e36');E(g,cx,base-37,18,4,'#5fae3a');for(let i=0;i<3;i++){const k=(t*.8+i/3)%1;if(!still)E(g,cx-8+i*8,base-38-k*16,2+k*3,2+k*3,`rgba(140,220,90,${.6*(1-k)})`);}}
  function throne(g,x,y,w,h,t){const cx=x+w/2,base=y+h;E(g,cx+4,base-2,32,8,'#10121a66');R(g,cx-26,base-78,52,78,'#6a4a2a');R(g,cx-22,base-74,44,70,'#8a6034');
    for(let i=0;i<5;i++)skull(g,cx-20+i*10,base-80,.9);for(const s of [-1,1]){P(g,[[cx+s*22,base-78],[cx+s*34,base-104],[cx+s*26,base-76]],'#e8e0c8');}
    R(g,cx-18,base-60,36,34,'#8a1f2e');R(g,cx-16,base-58,32,30,'#a8283a');R(g,cx-26,base-28,52,10,'#d4b04a');R(g,cx-26,base-28,52,2,'#f3d56a');R(g,cx-30,base-18,60,18,'#5a3a24');R(g,cx-30,base-18,60,3,'#7a5234');
    for(const s of [-1,1])E(g,cx+s*24,base-34,5,5,'#d4b04a');}
  function banner(g,cx,base,t,seed){R(g,cx-1,base-58,3,58,'#4a2e1c');R(g,cx-12,base-58,24,3,'#4a2e1c');const sway=Math.sin(t*2+seed)*2;P(g,[[cx-10,base-55],[cx+10,base-55],[cx+10+sway,base-24],[cx+4+sway,base-30],[cx+sway,base-22],[cx-4+sway,base-30],[cx-10+sway,base-24]],'#8a1f24');skull(g,cx+sway*.5,base-42,.9);}
  function skulls(g,cx,base){E(g,cx+2,base-2,12,4,'#10121a44');R(g,cx-1,base-30,2,28,'#5a3a24');skull(g,cx,base-32,1);skull(g,cx-7,base-5,.8);skull(g,cx+6,base-4,.8);skull(g,cx,base-9,.8);}
  function hay(g,x,base,w){E(g,x+w/2+3,base-2,w*.5,5,'#10121a44');R(g,x+2,base-18,w-4,16,'#c8a048');R(g,x+2,base-18,w-4,3,'#e8c870');for(let i=4;i<w-4;i+=5)R(g,x+i,base-15,1,12,'#a07a30');R(g,x+2,base-12,w-4,2,'#7a5a28');}
  function cart(g,x,base,w){E(g,x+w/2+3,base-2,w*.5,5,'#10121a44');R(g,x+2,base-26,w-4,16,'#5a3a24');R(g,x+2,base-26,w-4,3,'#7a5234');for(let i=0;i<5;i++)E(g,x+10+i*9,base-28,5,4,['#8e9fa3','#6a6a70','#b08a50'][i%3]);for(const wx of [x+10,x+w-10]){E(g,wx,base-8,6,6,'#2a2a30');E(g,wx,base-8,2,2,'#8a8a90');}}
  function meat(g,x,base,w){R(g,x+2,base-40,3,40,'#4a2e1c');R(g,x+w-5,base-40,3,40,'#4a2e1c');R(g,x,base-40,w,3,'#5a3a24');for(let i=0;i<3;i++){const mx=x+10+i*(w-20)/2;R(g,mx,base-37,1,6,'#c8c0a8');E(g,mx,base-24,6,8,'#a8423a');E(g,mx-1,base-26,3,4,'#d8706a');}}
  function anvil(g,cx,base,t){E(g,cx+2,base-2,14,4,'#10121a44');R(g,cx-6,base-12,12,12,'#3a3a44');R(g,cx-14,base-20,28,8,'#4a4a55');R(g,cx-14,base-20,28,2,'#7a7a88');P(g,[[cx+14,base-20],[cx+22,base-17],[cx+14,base-14]],'#4a4a55');if(Math.sin(t*3)>.9)for(let i=0;i<3;i++)R(g,cx-4+i*4,base-26-i*3,2,2,'#ffd27a');}
  function campfire(g,cx,base,t,light){if(art(g,'prop-campfire',cx,base+4,40)){light(cx,base-12,120,'#ff9a4a',1,'66');return;}for(let i=0;i<5;i++)R(g,cx-10+i*5,base-12-Math.abs(Math.sin(t*9+i))*6,5,10,i%2?'#ffb45a':'#ff6a2a');R(g,cx-12,base-4,24,4,'#5a3a24');light(cx,base-10,120,'#ff9a4a',1,'66');}
  // Draws every prop from its anchor tile; t.fw/t.fh give the footprint.
  function feature(g,layers,t,tx,ty,sx,sy,time,reduced,light){const w=(t.fw||1)*32,h=(t.fh||1)*32,base=sy+h,cx=sx+w/2,tt=reduced?0:time,seed=Math.floor(hash(tx,ty)*9),put=draw=>layers.push({y:ty+(t.fh||1)-.05,draw});
    // Generated art (assets/lair-props.png) replaces the pixel-drawn prop when loaded.
    const LW={tent:104,totem:40,cage:66,cauldron:62,throne:86,banner:34,skulls:36,hay:60,cart:68,meat:64,anvil:42,gold:64};
    if(LW[t.prop]&&window.GameAssets?.get('lair-'+t.prop)){put(()=>{E(g,cx+3,base-2,LW[t.prop]*.45,6,'#10121a55');art(g,'lair-'+t.prop,cx,base+2,LW[t.prop]);
      if(t.prop==='cauldron')light(cx,base-26,90,'#8fdc5a',.7,'44');});return;}
    switch(t.prop){
      case 'tent':put(()=>tent(g,sx,sy,w,h,tt,seed));break;
      case 'campfire':put(()=>campfire(g,cx,base,tt,light));break;
      case 'totem':put(()=>totem(g,cx,base,tt));break;
      case 'cage':put(()=>cage(g,sx,sy,w,h,tt));break;
      case 'cauldron':put(()=>{cauldron(g,sx,sy,w,h,tt,reduced);light(cx,base-26,90,'#8fdc5a',.7,'44');});break;
      case 'throne':put(()=>throne(g,sx,sy,w,h,tt));break;
      case 'banner':put(()=>banner(g,cx,base,tt,seed));break;
      case 'skulls':put(()=>skulls(g,cx,base));break;
      case 'hay':put(()=>hay(g,sx,base,w));break;
      case 'cart':put(()=>cart(g,sx,base,w));break;
      case 'meat':put(()=>meat(g,sx,base,w));break;
      case 'anvil':put(()=>anvil(g,cx,base,tt));break;
      case 'crates':put(()=>{if(!art(g,'town-crates',cx,base+2,Math.min(w+4,40))){R(g,sx+4,base-26,24,24,'#6a4428');R(g,sx+6,base-24,20,20,'#8a5a36');}});break;
      case 'chest':put(()=>{if(!art(g,'town-chest',cx,base+2,32)&&!art(g,'prop-chest',cx,base+2,32)){R(g,sx+5,base-22,22,18,'#6a4428');R(g,sx+5,base-16,22,3,'#e8c14a');}});break;
      case 'rack':put(()=>{if(!art(g,'town-spears',cx,base+2,w))for(let i=0;i<3;i++)R(g,sx+10+i*16,base-44,3,42,'#8a8a90');});break;
      case 'gold':put(()=>{E(g,cx+2,base-3,w*.45,6,'#10121a44');for(let i=0;i<2;i++)art(g,'town-coins',sx+w*(.3+i*.4),base+1,34);if(!window.GameAssets?.get('town-coins'))E(g,cx,base-10,w*.4,9,'#e8c14a');});break;
      case 'brazier':put(()=>{if(!art(g,'town-brazier',cx,base+2,28)){R(g,cx-3,base-20,6,20,'#3a2a20');E(g,cx,base-22,10,4,'#ff9a3a');}light(cx,base-30,110,'#ffb45a',1,'66');});break;
    }
  }
  // Cave floor extras: scattered bones in the tunnels.
  function floorBits(g,t,x,y){if(!t.bones)return;R(g,x+8,y+20,12,2,'#d8d0b8');E(g,x+8,y+21,2,2,'#e8e0c8');E(g,x+20,y+21,2,2,'#e8e0c8');skull(g,x+22,y+12,.6);}
  return {feature,floorBits,skull};
})();
