(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorldPalace=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  // The royal palace interior: an 80x76 castle (about 50 times the old throne room) with ten rooms.
  // It lives outside the 256x256 map, one copy per kingdom, and is entered through the palace door.
  // Laid out on an 80x76 plan and scaled by 1.25 (about 50 times the old 14x9 hall).
  const K=1.25,S=v=>Math.round(v*K),W=S(80),H=S(76),EXIT={x:S(40),y:S(74)};
  // [id, name, x0, y0, x1, y1, floor] in local tiles; corridors and doorways are rooms too.
  const ROOMS=[
    ['throne','Sala do Trono',24,4,56,29,'marble'],['gallery','Galeria Real',36,29,44,60,'carpet'],['hall','Grande Vestíbulo',28,60,52,74,'marble'],
    ['library','Biblioteca Real',4,4,22,34,'wood'],['banquet','Salão de Banquete',4,44,30,60,'wood'],['kitchen','Cozinha Real',4,62,24,74,'stone'],
    ['chambers','Aposentos Reais',58,4,76,34,'rug'],['chapel','Capela da Coroa',50,44,76,58,'marble'],['garden','Jardim Interno',56,60,76,74,'grass'],
    ['westHall','Corredor Oeste',6,38,36,42,'wood'],['eastHall','Corredor Leste',44,38,74,42,'wood'],
    ['d1','',12,34,16,38,'wood'],['d2','',16,42,20,44,'wood'],['d3','',10,60,14,62,'stone'],['d4','',64,34,68,38,'rug'],['d5','',60,42,64,44,'marble'],
    ['d6','',66,58,70,60,'grass'],['d7','',52,66,56,69,'marble'],['d8','',24,66,28,69,'stone'],['d9','',22,14,24,17,'wood'],['d10','',56,14,58,17,'rug'],
    ['exit','',39,74,42,76,'marble']
  ];
  const rooms=ROOMS.map(([id,name,x0,y0,x1,y1,floor])=>({id,name,x0:S(x0),y0:S(y0),x1:S(x1),y1:S(y1),floor}));
  const grid=new Array(W*H).fill(null);
  for(const r of rooms)for(let y=r.y0;y<r.y1;y++)for(let x=r.x0;x<r.x1;x++)grid[y*W+x]={room:r.id,floor:r.floor};
  const furn=(kind,ax,ay,bx=ax+1,by=ay+1,block=true)=>{const x0=S(ax),y0=S(ay),x1=bx===ax+1?x0+1:S(bx),y1=by===ay+1?y0+1:S(by);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const c=grid[y*W+x];if(c)Object.assign(c,{furn:kind,block,fx:x-x0,fy:y-y0,fw:x1-x0,fh:y1-y0});}};
  // Throne room: carpet, dais, thrones, pillars and braziers.
  furn('carpet',38,9,42,29,false);furn('dais',33,5,47,10,false);furn('throne',37,6);furn('throne',42,6);furn('brazier',32,6);furn('brazier',47,6);
  for(const y of [11,16,21,26])for(const x of [27,52])furn('pillar',x,y);
  furn('statue',25,5);furn('statue',54,5);furn('rope',35,11);furn('rope',45,11);
  // Gallery and entrance hall.
  for(let y=32;y<58;y+=5){furn('pillar',36,y);furn('pillar',43,y);}
  for(const y of [62,66,70])for(const x of [30,49])furn('pillar',x,y);
  furn('rug',36,64,44,71,false);furn('spears',35,73);furn('spears',45,73);furn('plant',28,60);furn('plant',51,60);furn('plant',28,73);furn('plant',51,73);furn('statue',33,61);furn('statue',46,61);
  // Library: shelf rows with aisles and reading tables.
  furn('shelf',4,4,22,5);
  for(const y of [9,15,21])furn('shelf',5,y,11,y+1),furn('shelf',14,y,21,y+1);
  furn('table',7,27,17,29);furn('lamp',6,26,7,27,false);furn('globe',19,27);
  // Banquet hall: two long tables with chairs, fireplace, cabinets.
  furn('hearth',15,44,19,45);for(const y of [49,55]){furn('table',8,y,27,y+1);for(let x=8;x<27;x+=2){furn('chair',x,y-1);furn('chair',x,y+1);}}
  furn('cabinet',4,44);furn('cabinet',29,44);furn('plant',4,59);furn('plant',29,59);
  // Kitchen: counters, ovens, barrels and a work table.
  furn('counter',5,62,23,63);furn('oven',5,70,8,73);furn('oven',9,70,12,73);furn('barrels',20,70,22,72);furn('crates',22,70);furn('table',12,66,18,68);furn('sacks',4,72);furn('sacks',23,72);
  // Royal chambers: two beds, wardrobes, desk and vanity.
  furn('bed',60,6,63,10);furn('bed',70,6,73,10);furn('wardrobe',65,4,67,5);furn('wardrobe',67,4,69,5);furn('desk',60,22,64,23);furn('vanity',70,22,73,23);furn('carpetR',62,13,72,20,false);furn('mirror',74,4);furn('chest',61,11);furn('chest',71,11);furn('plant',58,33);furn('plant',75,33);
  // Chapel: pews, altar, candles, stained glass wall.
  furn('altar',61,45,65,46);furn('candles',59,45);furn('candles',66,45);for(const y of [49,52,55]){furn('pew',52,y,61,y+1);furn('pew',65,y,74,y+1);}
  // Inner garden: fountain, hedges, trees and flower beds.
  furn('fountain',64,65,68,69);for(let x=56;x<76;x++){if(x<66||x>69)furn('hedge',x,60);}furn('tree',57,62);furn('tree',74,62);furn('tree',57,72);furn('tree',74,72);
  furn('flowers',59,65,62,69,false);furn('flowers',70,65,73,69,false);
  // ---------- Tavern interior (the capital taverns): one taproom with a bar, tables, hearth and stage ----------
  const TW=30,TH=22,tgrid=new Array(TW*TH).fill(null),trooms=[{id:'taproom',name:'Salão da Taverna',x0:1,y0:1,x1:29,y1:19,floor:'wood'},{id:'exit',name:'',x0:14,y0:19,x1:17,y1:22,floor:'wood'}];
  for(const r of trooms)for(let y=r.y0;y<r.y1;y++)for(let x=r.x0;x<r.x1;x++)tgrid[y*TW+x]={room:r.id,floor:r.floor};
  const tfurn=(kind,x0,y0,x1=x0+1,y1=y0+1,block=true)=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const c=tgrid[y*TW+x];if(c)Object.assign(c,{furn:kind,block,fx:x-x0,fy:y-y0,fw:x1-x0,fh:y1-y0});}};
  tfurn('bottles',2,1,15,2);tfurn('bar',3,5,14,6);for(let x=4;x<14;x+=2)tfurn('stool',x,6);tfurn('barrels',1,8,3,10);tfurn('sacks',1,10);tfurn('crates',2,10);tfurn('board',24,1,27,2);tfurn('hearth',18,1,23,2);
  for(const [x,y] of [[17,6],[23,6],[17,12],[23,12],[6,12]]){tfurn('rtable',x,y,x+2,y+2);tfurn('chair',x-1,y);tfurn('chair',x-1,y+1);tfurn('chair',x+2,y);tfurn('chair',x+2,y+1);}
  tfurn('stage',24,15,29,19,false);tfurn('rug',10,9,15,11,false);tfurn('stairs',1,14,3,19);tfurn('plant',28,1);tfurn('plant',1,1);tfurn('plant',13,18);tfurn('plant',17,18);
  const tcell=(lx,ly)=>lx<0||ly<0||lx>=TW||ly>=TH?null:tgrid[Math.floor(ly)*TW+Math.floor(lx)];
  const TALL=new Set(['bottles','pillar','shelf','statue','wardrobe','bed','throne','tree','cabinet','oven','hearth','brazier','globe','candles',
    'plant','bar','stool','stage','stairs','chair','rtable','barrels','sacks','crates','board','spears','mirror','chest','rope']);
  function cell(lx,ly){if(lx<0||ly<0||lx>=W||ly>=H)return null;return grid[Math.floor(ly)*W+Math.floor(lx)];}
  // Map tile for world coordinates inside a palace region (the caller passes the region).
  const cellOf=kind=>kind==='tavern'?tcell:cell;
  function tile(region,x,y,biome){const cf=cellOf(region.kind),lx=x-region.rx,ly=y-region.ry,c=cf(lx,ly);
    if(!c)return {kind:'wall',biome,underground:true,palace:true,layout:region.kind,kingdom:region.kingdom,lx,ly,edge:!!(cf(lx,ly+1)||cf(lx,ly-1)||cf(lx+1,ly)||cf(lx-1,ly))};
    return {kind:'palacefloor',biome,underground:true,palace:true,layout:region.kind,kingdom:region.kingdom,lx,ly,room:c.room,floor:c.floor,furn:c.furn,fx:c.fx,fy:c.fy,fw:c.fw,fh:c.fh,decor:!!c.block,exit:c.room==='exit'};}
  function roomAt(region,x,y){const c=cellOf(region.kind)(x-region.rx,y-region.ry);return c?(region.kind==='tavern'?trooms:rooms).find(r=>r.id===c.room):null;}
  const start=r=>r.kind==='tavern'?{x:r.rx+15.5,y:r.ry+17.5}:{x:r.rx+EXIT.x+.5,y:r.ry+EXIT.y-2.5};
  const thronePos=r=>({x:r.rx+S(40),y:r.ry+S(11)});
  // Court on and beside the thrones; staff at work in their rooms (world coordinates).
  function people(r){if(r.kind==='tavern'){const t=(x,y)=>({x:r.rx+x+.5,y:r.ry+y+.9});return {court:[],staff:[{role:'taverneiro',...t(8,3),look:'innkeeper'},{role:'bardo',...t(26,16),look:'bard'},{role:'garçonete',...t(20,10),look:'barmaid'},...[[16,6],[25,7],[16,13],[25,12],[5,13]].map(([x,y],i)=>({role:'freguês',...t(x,y),look:'patron'+(i%3)}))]};}
    const at=(x,y)=>({x:r.rx+S(x)+.5,y:r.ry+S(y)+.9});
    return {court:[at(37,6),at(42,6),at(33,9),at(46,9)],staff:[
      {role:'guarda',...at(34,28),look:'guard'},{role:'guarda',...at(45,28),look:'guard'},{role:'guarda',...at(37,72),look:'guard'},{role:'guarda',...at(43,72),look:'guard'},
      {role:'cozinheira',...at(14,64),look:'cook'},{role:'bibliotecário',...at(12,26),look:'scholar'},{role:'sacerdote',...at(63,47),look:'priest'},{role:'camareira',...at(66,15),look:'maid'},{role:'jardineiro',...at(60,70),look:'gardener'},{role:'copeiro',...at(18,52),look:'maid'}]};}
  const bar=r=>({x:r.rx+8.5,y:r.ry+6.5}),stage=r=>({x:r.rx+26.5,y:r.ry+16.5});
  return {W,H,TW,TH,rooms,cell,tcell,tile,roomAt,start,thronePos,people,bar,stage,TALL,EXIT};
});
