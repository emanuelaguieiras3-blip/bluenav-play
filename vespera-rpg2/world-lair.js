(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorldLair=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  // Covil dos Goblins: a cave warren east of the valley (84x60 tiles, placed outside the map like the palaces).
  // Seven halls joined by tunnels; the throne hall is shut by a war gate until Murk and Grol fall.
  const W=84,H=60;
  const hash=(x,y,s)=>{let h=Math.imul(x+s,374761393)^Math.imul(y-s,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const areas=[
    {id:'mouth',name:'Boca do Covil',sub:'Ossos na entrada e cheiro de fumaça. Eles sabem que você chegou.',x:42,y:53,rx:6,ry:4,theme:'tunnel'},
    {id:'camp',name:'Acampamento de Guerra',sub:'Tendas, fogueira e goblins afiando lanças.',x:42,y:37,rx:13,ry:7.5,theme:'hall'},
    {id:'pens',name:'Currais dos Wargs',sub:'Jaulas de ferro e lobos famintos.',x:14,y:40,rx:9,ry:6,theme:'roost'},
    {id:'mine',name:'Mina de Ferro',sub:'Veios de minério que os goblins escavam à força.',x:70,y:40,rx:9,ry:6,theme:'crystal'},
    {id:'kitchen',name:'Caldeirão de Murk',sub:'Um caldeirão borbulha. O xamã mexe algo verde.',x:14,y:17,rx:9,ry:6,theme:'mushroom',lair:'murk'},
    {id:'armory',name:'Arsenal de Grol',sub:'Pilhas de armas roubadas e uma bigorna quente.',x:70,y:17,rx:9,ry:6,theme:'geode',lair:'grol'},
    {id:'throne',name:'Salão do Rei Goblin',sub:'Um trono de ossos e ouro. Gorzak observa do alto.',x:42,y:11,rx:14,ry:7,theme:'magma',lair:'goblinKing'}
  ];
  const tunnels=[['mouth','camp',2],['camp','pens',1.7],['camp','mine',1.7],['pens','kitchen',1.6],['mine','armory',1.6],['camp','throne',2]];
  const area=id=>areas.find(a=>a.id===id);
  const oval=(a,x,y)=>((x+.5-a.x)/a.rx)**2+((y+.5-a.y)/a.ry)**2;
  const grid=new Array(W*H).fill(null);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const a=areas.find(a=>oval(a,x,y)<1+(hash(x,y,707)-.5)*.3);if(a)grid[y*W+x]={kind:'cavefloor',area:a.id,theme:a.theme};}
  const path=(from,to,fn)=>{const a=area(from),b=area(to),len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;for(let t=0;t<=1;t+=.4/len){const wig=Math.sin(t*Math.PI*2+a.x*.3)*1.8*Math.sin(t*Math.PI);fn(a.x+(b.x-a.x)*t+nx*wig,a.y+(b.y-a.y)*t+ny*wig);}};
  for(const [from,to,width] of tunnels)path(from,to,(cx,cy)=>{for(let y=Math.floor(cy-width-1);y<=cy+width+1;y++)for(let x=Math.floor(cx-width-1);x<=cx+width+1;x++){if(x<1||y<1||x>=W-1||y>=H-1)continue;if(Math.hypot(x+.5-cx,y+.5-cy)<=width&&!grid[y*W+x])grid[y*W+x]={kind:'cavefloor',area:'tunnel',theme:'tunnel',tunnel:from+'-'+to};}});
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=grid[y*W+x];if(!c){grid[y*W+x]={kind:'wall',theme:'wall'};continue;}
    const a=area(c.area),n=hash(x,y,909),o=a?oval(a,x,y):1;
    if(c.tunnel==='camp-throne'&&y>=21&&y<=22){c.kind='seal';continue;}
    if(c.area==='mine'&&o>.4&&n>.8){c.kind='rock';c.ore=1+Math.floor(hash(x,y,55)*4);continue;}
    if(a&&o>.55&&o<.95&&!a.lair&&c.area!=='camp'&&n>.95){c.kind='stal';continue;}
    if(c.area==='tunnel'&&n>.97)c.bones=true;
  }
  // Props: [kind, x, y, w, h, blocks]. Multi-tile props anchor at their top-left tile.
  const PROPS=[
    ['campfire',41,37,2,1,1],['tent',32,32,3,2,1],['tent',50,32,3,2,1],['tent',32,40,3,2,1],['tent',50,40,3,2,1],['totem',41,31,2,1,1],['crates',37,43,2,1,1],['crates',46,43,1,1,1],['banner',35,30,1,1,1],['banner',48,30,1,1,1],
    ['bones',40,52,1,1,0],['bones',45,55,1,1,0],['skulls',37,50,1,1,1],['skulls',47,50,1,1,1],
    ['cage',7,36,2,2,1],['cage',11,36,2,2,1],['cage',15,36,2,2,1],['hay',19,43,2,1,1],['bones',10,43,1,1,0],['bones',16,44,1,1,0],
    ['cart',72,44,2,1,1],['crates',64,37,1,1,1],['crates',76,39,1,1,1],
    ['cauldron',13,16,2,2,1],['meat',8,13,2,1,1],['bones',18,21,1,1,0],['skulls',20,13,1,1,1],
    ['rack',64,12,2,1,1],['rack',68,12,2,1,1],['rack',72,12,2,1,1],['anvil',70,19,1,1,1],['crates',76,18,1,1,1],
    ['throne',41,5,2,2,1],['gold',33,7,2,1,1],['gold',49,7,2,1,1],['brazier',36,10,1,1,1],['brazier',48,10,1,1,1],['banner',38,4,1,1,1],['banner',46,4,1,1,1],['skulls',31,12,1,1,1],['skulls',53,12,1,1,1]
  ];
  for(const [kind,x0,y0,w,h,block] of PROPS)for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const c=grid[y*W+x];if(c&&c.kind==='cavefloor')Object.assign(c,{prop:kind,block:!!block,fx:x-x0,fy:y-y0,fw:w,fh:h});}
  // Keep every tunnel walkable: no rock, stalagmite or prop ever blocks the way.
  for(const [from,to] of tunnels)path(from,to,(cx,cy)=>{for(let y=Math.floor(cy-2);y<=cy+2;y++)for(let x=Math.floor(cx-2);x<=cx+2;x++){const c=grid[y*W+x];if(c&&(['stal','rock'].includes(c.kind)||c.block)&&Math.hypot(x+.5-cx,y+.5-cy)<1.4&&c.area==='tunnel'){c.kind='cavefloor';delete c.ore;}}});
  function cell(lx,ly){lx=Math.floor(lx);ly=Math.floor(ly);if(lx<0||ly<0||lx>=W||ly>=H)return null;return grid[ly*W+lx];}
  const plan={mouth:['goblin','goblin'],camp:['goblin','goblinArcher','goblin','goblinArcher','goblinShaman','goblin'],pens:['wolf','wolf','goblin'],mine:['goblin','goblinBrute','goblin'],kitchen:['goblinShaman','goblin'],armory:['goblinBrute','goblinArcher'],throne:['goblinBrute','goblinBrute','goblinArcher','goblinArcher']};
  // Spawn spots in local tiles, checked against the floor so nobody starts inside a wall or a tent.
  const spawns=(()=>{const list=[],free=(x,y)=>{const c=cell(x,y);return c&&c.kind==='cavefloor'&&!c.block;};
    for(const a of areas){if(a.lair)list.push({key:'boss:'+a.id,kind:a.lair,x:a.x,y:a.y+(a.id==='throne'?-1:0),area:a.id,boss:true});
      (plan[a.id]||[]).forEach((kind,i)=>{const ang=i*2.4+a.x*.1;let px=a.x,py=a.y;for(const r of [.6,.8,.4,.9,.25]){px=a.x+Math.cos(ang)*a.rx*r;py=a.y+Math.sin(ang)*a.ry*r;if(free(px,py))break;}list.push({key:a.id+':'+i,kind,x:Math.floor(px)+.5,y:Math.floor(py)+.5,area:a.id});});}
    return list;})();
  const guardians=['murk','grol'];
  const entry={x:42.5,y:56.5},hoard={x:42,y:8};
  // Two smaller dens share one compact layout but have separate encounters and loot.
  const dens=[
    {id:'goblin-den-moon',name:'Covil da Lua Roubada',x:226,y:137,rx:3400,ry:0,w:32,h:26,tier:4,theme:'mushroom',reward:'ore7'},
    {id:'goblin-den-embers',name:'Covil das Brasas',x:82,y:188,rx:3440,ry:0,w:32,h:26,tier:6,theme:'magma',reward:'ore10'}
  ];
  const denProps=[['tent',6,7,3,2],['campfire',9,11,1,1],['crates',24,10,2,1],['banner',23,5,1,1],['skulls',15,18,1,1]];
  function denCell(d,lx,ly){lx=Math.floor(lx);ly=Math.floor(ly);if(lx<0||ly<0||lx>=d.w||ly>=d.h)return null;
    const left=((lx-9)/7)**2+((ly-9)/6)**2<1,right=((lx-23)/7)**2+((ly-9)/6)**2<1,entry=((lx-16)/7)**2+((ly-19)/5)**2<1;
    const corridor=ly>=8&&ly<=12&&lx>=9&&lx<=23||lx>=14&&lx<=18&&ly>=10&&ly<=22;
    if(!(left||right||entry||corridor))return {kind:'wall',theme:'wall'};
    const c={kind:'cavefloor',theme:d.theme,area:ly>14?'entry':lx<16?'camp':'cache'};
    for(const [prop,x,y,w,h] of denProps)if(lx>=x&&lx<x+w&&ly>=y&&ly<y+h){Object.assign(c,{prop,fx:lx-x,fy:ly-y,fw:w,fh:h,block:true});break;}
    if((lx===4&&ly===12||lx===28&&ly===12)&&hash(lx,ly,d.tier)>.2)c.bones=true;
    return c;
  }
  return {W,H,areas,tunnels,cell,spawns,guardians,entry,hoard,PROPS,dens,denCell};
});
