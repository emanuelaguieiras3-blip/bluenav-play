(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WorldFrontier=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  // Terras além do vale. The original 256x256 valley (the "heart") sits in the middle of a 2560x2560 world;
  // everything outside it is generated here: biomes by direction, rivers with bridges, lakes, goblin camps,
  // and a danger ring that grows with the distance from the valley.
  const HEART=256,WORLD={x0:-1152,y0:-1152,x1:1408,y1:1408},CELL=120;
  const hash=(x,y,s)=>{let h=Math.imul(x+s,374761393)^Math.imul(y-s,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const inHeart=(x,y)=>x>=0&&y>=0&&x<HEART&&y<HEART;
  const inWorld=(x,y)=>x>=WORLD.x0&&y>=WORLD.y0&&x<WORLD.x1&&y<WORLD.y1;
  // Chebyshev distance to the valley, and the danger ring (0 near the valley, 3 at the far edges).
  const distance=(x,y)=>Math.max(0,-x,x-HEART,-y,y-HEART);
  const ring=(x,y)=>Math.min(3,Math.floor(distance(x,y)/300));
  // The valley's own region centres, so its biomes flow past its border instead of stopping on a line.
  const HEART_REGIONS=[[128,128],[187,99],[191,177],[128,219],[48,203],[36,120],[65,42],[176,35]];
  // Biome pools by direction: cold north, dry south, green east, wet west.
  const POOLS={n:[7,4,1,5,7],s:[3,6,2,0,6],e:[1,5,2,6,0],w:[2,7,1,4,2]};
  function pool(cx,cy){const dx=cx-128,dy=cy-128;return Math.abs(dy)>Math.abs(dx)?(dy<0?POOLS.n:POOLS.s):(dx<0?POOLS.w:POOLS.e);}
  const centres=new Map();
  function centre(gx,gy){const key=gx+','+gy;let c=centres.get(key);if(c!==undefined)return c;
    const x=gx*CELL+15+hash(gx,gy,313)*90,y=gy*CELL+15+hash(gy,gx,331)*90;
    c=x>-60&&x<HEART+60&&y>-60&&y<HEART+60?null:{x,y,b:pool(x,y)[Math.floor(hash(gx,gy,977)*5)]};centres.set(key,c);return c;}
  function biome(x,y){const wx=x+Math.sin(y*.021)*16+Math.sin(y*.07)*5,wy=y+Math.sin(x*.023)*14+Math.sin(x*.066)*4,gx=Math.floor(wx/CELL),gy=Math.floor(wy/CELL);let best=Infinity,b=1;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const c=centre(gx+i,gy+j);if(!c)continue;const d=(wx-c.x)**2+(wy-c.y)**2;if(d<best){best=d;b=c.b;}}
    if(distance(x,y)<140)HEART_REGIONS.forEach(([cx,cy],i)=>{const d=(wx-cx)**2+(wy-cy)**2;if(d<best){best=d;b=i;}});
    return b;}
  // Smooth value noise for lakes.
  const smooth=t=>t*t*(3-2*t);
  function vnoise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy),a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
  // Four long rivers around the valley (the valley river runs north and south into them).
  const RIVERS=[
    {axis:'y',at:x=>-420+Math.sin(x*.013)*30+Math.sin(x*.041)*8},
    {axis:'y',at:x=>700+Math.sin(x*.011+2)*34+Math.sin(x*.037)*9},
    {axis:'x',at:y=>-520+Math.sin(y*.012+1)*34+Math.sin(y*.043)*8},
    {axis:'x',at:y=>880+Math.sin(y*.014+3)*30+Math.sin(y*.039)*9}];
  function valleyRiver(x,y){if(y<-430||y>712)return false;return Math.abs(x-(158+Math.sin(y*.045)*6))<2.2;}
  // River at (x,y): 'bridge' every 140 tiles along it, 'water' elsewhere, null when dry.
  function river(x,y){
    for(const r of RIVERS){const along=r.axis==='y'?x:y,across=r.axis==='y'?y:x;if(Math.abs(across-r.at(along))<2.4)return ((along%140)+140)%140<3?'bridge':'water';}
    if(!inHeart(x,y)&&valleyRiver(x,y))return ((y%140)+140)%140<3?'bridge':'water';
    return null;}
  function lake(x,y,b){if(b===3||b===6)return false;return vnoise(x/34,y/34,4411)>(b===2?.72:.8);}
  // Goblin camps: spaced out, on dry land, away from rivers and the valley.
  const camps=(()=>{const list=[];for(let i=0;i<240&&list.length<44;i++){const x=Math.floor(WORLD.x0+60+hash(i,7,2024)*(WORLD.x1-WORLD.x0-120)),y=Math.floor(WORLD.y0+60+hash(i,11,2025)*(WORLD.y1-WORLD.y0-120));
      if(distance(x,y)<40||list.some(c=>Math.hypot(c.x-x,c.y-y)<150))continue;let ok=true;for(let dy=-6;dy<=6&&ok;dy+=2)for(let dx=-6;dx<=6&&ok;dx+=2)if(river(x+dx,y+dy)||lake(x+dx,y+dy,biome(x+dx,y+dy))||Math.abs(y+dy-128)<3||Math.abs(x+dx-128)<3)ok=false;
      if(ok)list.push({id:'camp-'+list.length,x,y,ring:ring(x,y)});}return list;})();
  // Camp props (around the centre): tents, a fire, a totem and a loot chest.
  const CAMP=[['tent',-5,-3,3,2],['tent',3,-3,3,2],['tent',-5,2,3,2],['campfire',0,0,1,1],['totem',0,-4,1,1],['chest',3,2,1,1],['crates',5,2,1,1],['skulls',-2,4,1,1]];
  const campTiles=new Map();for(const c of camps)for(const [kind,dx,dy,w,h] of CAMP)for(let y=0;y<h;y++)for(let x=0;x<w;x++)campTiles.set((c.x+dx+x)+','+(c.y+dy+y),{camp:c.id,prop:kind,fx:x,fy:y,fw:w,fh:h});
  function campAt(x,y){return campTiles.get(Math.floor(x)+','+Math.floor(y));}
  const campNear=(x,y,r)=>camps.filter(c=>Math.abs(c.x-x)<r&&Math.abs(c.y-y)<r);
  return {HEART,WORLD,inHeart,inWorld,distance,ring,biome,river,lake,valleyRiver,camps,campAt,campNear};
});
