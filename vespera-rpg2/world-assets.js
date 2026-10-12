'use strict';
// Atlas loading and sprite extraction happen once, never in the frame loop.
window.GameAssets=(()=>{
  const sprites=new Map();
  // Phones download WebP atlases (about 4x smaller); browsers without WebP fall back to the PNG.
  const webp=(()=>{try{const c=document.createElement('canvas');c.width=c.height=1;return c.toDataURL('image/webp').startsWith('data:image/webp');}catch{return false;}})();
  const webpAtlases=new Set(['class-portraits','bosses-v2','mystics-v2']);
  function assetUrl(url){const name=url.slice(7,-4);return webp&&url.startsWith('assets/')&&url.endsWith('.png')&&webpAtlases.has(name)?url.slice(0,-4)+'.webp':url;}
  function extract(img,col,row,hero){
    const regions=[[12,60,389,454],[417,65,325,455],[757,108,375,392],[1154,85,382,447],[9,560,377,420],[383,580,386,410],[778,681,365,157],[1151,703,378,112]];
    const [sx,sy,w,h]=hero?[col*img.width/4,row*img.height/2,img.width/4,img.height/2]:regions[row*4+col];
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,sx,sy,w,h,0,0,w,h);
    // Some exported sheets contain a neutral checker matte rather than alpha.
    // Flood only edge-connected neutral matte; retain enclosed pale sprite details.
    const pixels=g.getImageData(0,0,w,h),d=pixels.data,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
    let head=0,tail=0;
    function seed(x,y){const i=y*w+x;if(x<0||y<0||x>=w||y>=h||seen[i])return;seen[i]=1;const k=i*4,lo=Math.min(d[k],d[k+1],d[k+2]),hi=Math.max(d[k],d[k+1],d[k+2]);if(d[k+3]===0||(lo>145&&hi-lo<26)){queue[tail++]=i;d[k+3]=0;}}
    for(let x=0;x<w;x++){seed(x,0);seed(x,h-1);}for(let y=0;y<h;y++){seed(0,y);seed(w-1,y);}
    if(!hero&&col===3&&row===1)seed(Math.floor(w*.55),Math.floor(h*.5));
    while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);seed(x-1,y);seed(x+1,y);seed(x,y-1);seed(x,y+1);}
    g.putImageData(pixels,0,0);
    let left=w,top=h,right=0,bottom=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    const out=document.createElement('canvas');out.width=Math.max(1,right-left+1);out.height=Math.max(1,bottom-top+1);out.getContext('2d').drawImage(c,left,top,out.width,out.height,0,0,out.width,out.height);return out;
  }
  function load(url,hero){return new Promise(resolve=>{const img=new Image();img.onload=()=>{for(let row=0;row<2;row++)for(let col=0;col<4;col++)sprites.set(`${hero?'hero':'world'}-${row}-${col}`,extract(img,col,row,hero));resolve(true);};img.onerror=()=>resolve(false);img.src=assetUrl(url);});}
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function cropAlpha(img,box){
    const [x,y,w,h]=box,c=canvas(w,h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,x,y,w,h,0,0,w,h);
    const pixels=g.getImageData(0,0,w,h),data=pixels.data;
    // Isolate the main sprite and substantial detached parts; reject neighboring atlas fragments.
    const labels=new Int32Array(w*h),queue=new Int32Array(w*h),sizes=[0];let label=0;
    for(let i=0;i<labels.length;i++){if(labels[i]||data[i*4+3]<=48)continue;label++;let head=0,tail=1;queue[0]=i;labels[i]=label;
      while(head<tail){const n=queue[head++],xx=n%w,yy=Math.floor(n/w);for(const next of [xx>0?n-1:-1,xx<w-1?n+1:-1,yy>0?n-w:-1,yy<h-1?n+w:-1])if(next>=0&&!labels[next]&&data[next*4+3]>48){labels[next]=label;queue[tail++]=next;}}
      sizes[label]=tail;
    }
    const minSize=Math.max(8,Math.max(...sizes)*.025);let left=w,top=h,right=-1,bottom=-1;
    for(let i=0;i<labels.length;i++)if(!labels[i]||sizes[labels[i]]<minSize)data[i*4+3]=0;
    g.putImageData(pixels,0,0);
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(data[(yy*w+xx)*4+3]>48){left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy);}
    if(right<left)return canvas(1,1);const out=canvas(right-left+1,bottom-top+1);out.getContext('2d').drawImage(c,left,top,out.width,out.height,0,0,out.width,out.height);return out;
  }
  function loadSheet(url,compile){return new Promise(resolve=>{const img=new Image();img.onload=()=>{try{compile(img);resolve(true);}catch(error){console.warn('Atlas indisponível:',url,error);resolve(false);}};img.onerror=()=>resolve(false);img.src=assetUrl(url);});}
  function walkingAtlas(img){
    // Measured transparent gutters, not assumed equal cells: no adjacent head/boot leaks.
    const columns=[40,239,441,644,848,1053,1254],rows=[0,207,399,612,830,1031,1254];
    for(let row=0;row<6;row++){
      const appearance=row<3?'female':'male',dir=[0,1,3][row%3],frames=[];
      for(let col=0;col<6;col++)frames.push(cropAlpha(img,[columns[col],rows[row],columns[col+1]-columns[col],rows[row+1]-rows[row]]));
      const scale=Math.min(60/Math.max(...frames.map(f=>f.height)),44/Math.max(...frames.map(f=>f.width)));
      frames.forEach((art,frame)=>{
        const registered=canvas(48,64),g=registered.getContext('2d');g.imageSmoothingEnabled=false;const w=Math.round(art.width*scale),h=Math.round(art.height*scale);
        g.drawImage(art,Math.round((48-w)/2),63-h,w,h);
        const colored=g.getImageData(0,0,48,64),pixels=colored.data;
        for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<80){pixels[i+3]=0;continue;}pixels[i]=Math.min(255,Math.round(pixels[i]/8)*8);pixels[i+1]=Math.min(255,Math.round(pixels[i+1]/4)*4);pixels[i+2]=Math.min(255,Math.round(pixels[i+2]/8)*8);pixels[i+3]=255;}
        g.putImageData(colored,0,0);
        // Pixel-rig secondary motion makes opposing feet, coat and arms readable at game scale.
        const out=canvas(48,68),c=out.getContext('2d');c.imageSmoothingEnabled=false;
        const phase=frame/6*Math.PI*2,step=Math.round(Math.sin(phase)*2),bob=frame%3===1?1:0;
        c.drawImage(registered,0,0,48,43,0,bob,48,43);
        if(dir===1){for(let y=43;y<64;y++){const width=48-Math.round(Math.abs(Math.cos(phase))*8*(y-43)/21);c.drawImage(registered,0,y,48,1,Math.round((48-width)/2),y+bob,width,1);}}
        else {c.drawImage(registered,0,43,24,21,0,43+bob,24,21+step);c.drawImage(registered,24,43,24,21,24,43+bob,24,21-step);}
        sprites.set(`walk-${appearance}-${dir}-${frame}`,out);
        if(dir===1){const mirror=canvas(48,68),m=mirror.getContext('2d');m.translate(48,0);m.scale(-1,1);m.drawImage(out,0,0);sprites.set(`walk-${appearance}-2-${frame}`,mirror);}
      });
      // Pick the least spread stance for idle/work instead of freezing a running pose.
      for(const facing of dir===1?[1,2]:[dir]){let best=null,bestWidth=Infinity;
        for(let frame=0;frame<6;frame++){const art=sprites.get(`walk-${appearance}-${facing}-${frame}`),d=art.getContext('2d').getImageData(0,50,48,18).data;let lo=48,hi=0;for(let y=0;y<18;y++)for(let x=0;x<48;x++)if(d[(y*48+x)*4+3]>100){lo=Math.min(lo,x);hi=Math.max(hi,x);}if(hi-lo<bestWidth){best=art;bestWidth=hi-lo;}}
        sprites.set(`idle-${appearance}-${facing}`,best);
        // Four quiet breathing poses keep heroes alive between steps.
        for(let pose=0;pose<4;pose++){
          const idle=canvas(48,68),g=idle.getContext('2d');g.imageSmoothingEnabled=false;
          const lift=pose===1||pose===2?1:0;
          g.drawImage(best,0,0,48,44,0,lift,48,44);
          g.drawImage(best,0,44,48,24,0,44,48,24);
          sprites.set(`idle-${appearance}-${facing}-${pose}`,idle);
        }
      }
    }
  }
  function classPortraitAtlas(img){
    const classes=['guerreiro','mago','arqueiro','ladino','paladino','berserker','guardiao','druida','clerigo','necromante','bardo','artifice'];
    const w=img.width/4,h=img.height/3;
    classes.forEach((id,i)=>sprites.set('portrait-'+id,retroFrame(img,(i%4)*w,Math.floor(i/4)*h,w,h,3)));
  }
  function detailedAtlas(img){
    const names=['slime','wolf','wisp','scarab','ice','ember','necromancer','boss','cave','crystal','guild','undergrowth'];
    const regions=[[0,12,370,310],[380,0,380,321],[835,0,260,318],[1124,20,410,285],[0,324,380,365],[400,320,332,380],[771,311,326,378],[1114,296,420,409],[0,694,430,326],[432,687,312,322],[758,672,384,334],[1145,710,389,310]];
    names.forEach((name,i)=>sprites.set('detail-'+name,cropAlpha(img,regions[i])));
  }
  function expansionAtlas(img){const regions={oreMetal:[8,55,372,390],oreCrystal:[402,45,366,402],goblin:[807,109,330,339],goblinShaman:[1183,0,353,461],yeti:[0,494,486,504],cartographer:[492,502,284,488],grimoire:[784,566,392,400],necromancerV3:[1181,459,355,550]};for(const [name,box] of Object.entries(regions))sprites.set('v3-'+name,cropAlpha(img,box));}
  function royalAtlas(img){
    // Pre-cut transparent sheet (see assets/README.md): no matte removal needed at runtime.
    const boxes={auroria:[0,0,320,340],lunaria:[324,0,320,333],brasalar:[648,0,320,347],wagon:[0,351,224,158],stall:[324,351,224,176],fountain:[648,351,224,202]};
    for(const [name,[x,y,w,h]] of Object.entries(boxes)){const c=canvas(w,h);c.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);sprites.set('royal-'+name,c);}
  }
  // Town buildings, palace and tavern furniture and item icons (assets/town-v1.png, pre-cut on magenta).
  const TOWN={"clocktower":[0,0,130,330],"windmill":[132,0,235,320],"tavern":[369,0,287,300],"inn":[658,0,324,300],"forge":[984,0,328,300],"guild":[1314,0,303,300],"chapel":[1619,0,265,300],"barracks":[0,332,285,300],"house0":[287,332,263,230],"house1":[552,332,245,230],"house2":[799,332,193,230],"house3":[994,332,230,230],"house4":[1226,332,237,230],"house5":[1465,332,245,230],"house6":[1712,332,143,230],"house7":[0,634,249,230],"pillar":[251,634,65,170],"armor":[318,634,71,170],"throne":[391,634,84,150],"queenThrone":[477,634,85,150],"dais":[564,634,180,150],"carpet":[746,634,124,150],"brazier":[872,634,84,150],"banner":[958,634,107,150],"glass":[1067,634,100,150],"chandelier":[1169,634,137,150],"vase":[1308,634,101,150],"bust":[1411,634,63,150],"spears":[1476,634,123,150],"mirror":[1601,634,91,150],"rope":[1694,634,142,150],"chest":[1838,634,147,150],"bar":[0,866,186,150],"stool":[188,866,89,150],"bottles":[279,866,184,150],"barrels":[465,866,150,150],"rtable":[617,866,171,150],"chair":[790,866,91,150],"bench":[883,866,164,150],"stage":[1049,866,150,150],"hearth":[1201,866,150,150],"stairs":[1353,866,149,150],"lantern":[1504,866,72,150],"board":[1578,866,208,150],"sacks":[1788,866,166,150],"crates":[0,1018,151,150],"mug":[153,1018,121,150],"stew":[276,1018,217,150],"ichest":[495,1018,96,110],"crate":[593,1018,101,110],"trident":[696,1018,51,110],"rope2":[749,1018,120,110],"pot":[871,1018,86,110],"bow":[959,1018,108,110],"potionBlue":[1069,1018,79,110],"pickaxe":[1150,1018,106,110],"sword":[1258,1018,110,110],"bow2":[1370,1018,111,110],"staff":[1483,1018,105,110],"pickaxe2":[1590,1018,107,110],"potionRed":[1699,1018,70,110],"potionGreen":[1771,1018,73,110],"potionBlue2":[1846,1018,81,110],"shield":[1929,1018,85,110],"campfire":[0,1170,97,110],"sign":[99,1170,88,110],"table":[189,1170,107,110],"stool2":[298,1170,81,110],"nightstand":[381,1170,89,110],"bookcase":[472,1170,79,110],"stones":[553,1170,128,103],"coins":[683,1170,128,88]};
  // town-v1.png draws these buildings at a 45° angle; they are skipped so the town keeps its front-facing
  // pixel-drawn buildings until assets/buildings-front.png (front view, same names) is present.
  const ANGLED=new Set(['tavern','inn','forge','guild','chapel','barracks','house0','house1','house2','house3','house4','house5','house6','house7']);
  function townAtlas(img){for(const [name,[x,y,w,h]] of Object.entries(TOWN)){if(ANGLED.has(name))continue;const c=canvas(w,h);c.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);sprites.set('town-'+name,c);}}
  // Sheets generated on a flat magenta background (Gemini has no alpha): key the magenta out, then cut an even grid.
  function magentaGrid(img,columns,rows,names,prefix){
    const c=canvas(img.width,img.height),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
    const pixels=g.getImageData(0,0,c.width,c.height),d=pixels.data;
    for(let i=0;i<d.length;i+=4){const r=d[i],gr=d[i+1],b=d[i+2];if(r>150&&b>150&&gr<110&&Math.abs(r-b)<70)d[i+3]=0;else if(r>120&&b>120&&gr<r*.6&&gr<b*.6){d[i+3]=Math.min(d[i+3],90);d[i]=d[i+2]=gr;}}
    g.putImageData(pixels,0,0);
    names.forEach((name,i)=>{if(!name)return;const col=i%columns,row=Math.floor(i/columns),x=Math.round(col*c.width/columns),y=Math.round(row*c.height/rows);sprites.set(prefix+name,cropAlpha(c,[x,y,Math.round((col+1)*c.width/columns)-x,Math.round((row+1)*c.height/rows)-y]));});
  }
  let frontBuildings=false;
  function frontAtlas(img){magentaGrid(img,4,4,['house0','house1','house2','house3','house4','house5','house6','house7','tavern','inn','forge','chapel','barracks','guild','clocktower','windmill'],'town-');frontBuildings=true;}
  // Walk cycles (assets/walk-*.png, generated on magenta): one monster per row, 4 side-view frames facing right.
  // Frames are bottom-centred on one shared canvas so the feet never jitter between steps.
  const WALKS={'walk-1':['slime','wolf','wisp','scarab'],'walk-2':['ice','ember','necromancer','goblin'],'walk-3':['goblinShaman','bat','spider','golem'],'walk-4':['brambleBoar','mossTurtle','moonMoth','glassScorpion'],'walk-5':['frostLynx','crystalStag','stormHawk'],
    'walk-boss-1':['boss','rootBoss','ashBoss','frostBoss'],'walk-boss-2':['tideBoss','murk','grol','goblinKing'],'walk-boss-3':['spiderQueen','colossus','batQueen','wyrm']};
  function walkSheet(img,names,boss){
    magentaGrid(img,4,names.length,names.flatMap(n=>[0,1,2,3].map(f=>n+'#'+f)),'');
    names.forEach(name=>{const raw=[0,1,2,3].map(f=>{const k=name+'#'+f,c=sprites.get(k);sprites.delete(k);return c;}).filter(c=>c&&c.width>1);if(raw.length<2)return;
      const W=Math.max(...raw.map(c=>c.width)),H=Math.max(...raw.map(c=>c.height)),k=Math.min(1,(boss?200:150)/Math.max(W,H)),fw=Math.round(W*k),fh=Math.round(H*k);
      anim.set('mwalk-'+name,raw.map(c=>{const out=canvas(fw,fh),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';const w=Math.round(c.width*k),h=Math.round(c.height*k);g.drawImage(c,Math.round((fw-w)/2),fh-h,w,h);return out;}));});
  }
  // One monster per file: assets/mon-<kind>.png, N walking frames side by side facing right (magenta or transparent).
  const MON_STRIPS={soulWarden:8,slimeKing:8,minotaurKing:8,bloodKnight:8,demonLord:8,mushroom:8,harpy:8,wraith:8,dragonkin:8,demon:4,gargoyle:8,sylph:8,slime:8,skeleton:8,orc:8,iceElf:8,lizardman:8,hellhound:8,antSoldier:8,naga:8,minotaur:8,antKing:8};
  function monStrip(img,kind,n,prefix='mwalk-'){
    // Attack strips keep whole equal cells so projectiles and swings never shift the body between frames.
    if(prefix==='matk-'){const cw=img.width/n,k=Math.min(1,200/Math.max(cw,img.height)),fw=Math.round(cw*k),fh=Math.round(img.height*k),key=canvas(img.width,img.height),kg=key.getContext('2d',{willReadFrequently:true});kg.drawImage(img,0,0);
      const px=kg.getImageData(0,0,key.width,key.height),d=px.data;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+2]>180&&d[i+1]<110)d[i+3]=0;kg.putImageData(px,0,0);
      anim.set(prefix+kind,[...Array(n).keys()].map(f=>{const out=canvas(fw,fh),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(key,f*cw,0,cw,img.height,0,0,fw,fh);return out;}));return;}const names=[...Array(n).keys()].map(f=>kind+'#'+f);magentaGrid(img,n,1,names,'');
    const raw=names.map(k=>{const c=sprites.get(k);sprites.delete(k);return c;}).filter(c=>c&&c.width>1);if(raw.length<2)return;
    const W=Math.max(...raw.map(c=>c.width)),H=Math.max(...raw.map(c=>c.height)),k=Math.min(1,170/Math.max(W,H)),fw=Math.round(W*k),fh=Math.round(H*k);
    anim.set(prefix+kind,raw.map(c=>{const out=canvas(fw,fh),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';const w=Math.round(c.width*k),h=Math.round(c.height*k);g.drawImage(c,Math.round((fw-w)/2),fh-h,w,h);return out;}));}
  // Monarca das Sombras hero: assets/hero-monarca.png = 8 frames x 3 rows (walking down, walking RIGHT, walking up);
  // assets/hero-monarca-atk.png = 6 frames x 3 rows (dagger attack down, right, up). The right row is mirrored for left.
  // Everything is registered at 48x68 with the feet on one line, like walk-v2.
  function heroSheet(img,cols,prefix){const names=[];for(let r=0;r<3;r++)for(let f=0;f<cols;f++)names.push(r+'#'+f);magentaGrid(img,cols,3,names,'hm-');
    const all=names.map(n=>sprites.get('hm-'+n));if(all.some(c=>!c||c.width<2))return;const k=prefix==='walk'?Math.min(60/Math.max(...all.map(c=>c.height)),44/Math.max(...all.map(c=>c.width))):heroScale||Math.min(60/Math.max(...all.map(c=>c.height)),60/Math.max(...all.map(c=>c.width)));if(prefix==='walk')heroScale=k;
    const size=prefix==='walk'?48:72;
    [0,2,3].forEach((dir,r)=>{for(let f=0;f<cols;f++){const src=sprites.get('hm-'+r+'#'+f);sprites.delete('hm-'+r+'#'+f);const out=canvas(size,68),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';const w=Math.round(src.width*k),h=Math.round(src.height*k);g.drawImage(src,Math.round((size-w)/2),64-h,w,h);
      sprites.set(`${prefix}-monarca-${dir}-${f}`,out);if(dir===2){const m=canvas(size,68),mg=m.getContext('2d');mg.translate(size,0);mg.scale(-1,1);mg.drawImage(out,0,0);sprites.set(`${prefix}-monarca-1-${f}`,m);}}});
    if(prefix==='walk')for(const dir of [0,1,2,3])sprites.set('idle-monarca-'+dir,sprites.get(`walk-monarca-${dir}-0`));}
  let heroScale=0;
  const heroMonarca=img=>heroSheet(img,8,'walk');
  // The attack sheet has uniform cells with the feet on one line, so frames are scaled whole (never cropped):
  // slash trails stick out without shifting the body. Scale comes from the idle stance in the first cell.
  // "Ergam-se!" cast pose: one row of 6 frames, same uniform-cell layout as the attack sheet.
  function heroMonarcaCast(img){const cw=img.width/6,ch=img.height,k=60/cropAlpha(img,[0,0,Math.floor(cw),Math.floor(ch)]).height,w=Math.round(cw*k),h=Math.round(ch*k);
    for(let f=0;f<6;f++){const out=canvas(w,h),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(img,f*cw,0,cw,ch,0,0,w,h);sprites.set('cast-monarca-'+f,out);}}
  function heroMonarcaAtk(img){const cw=img.width/6,ch=img.height/3,k=60/cropAlpha(img,[0,0,Math.floor(cw),Math.floor(ch)]).height,w=Math.round(cw*k),h=Math.round(ch*k);
    [0,2,3].forEach((dir,r)=>{for(let f=0;f<6;f++){const out=canvas(w,h),g=out.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(img,f*cw,r*ch,cw,ch,0,0,w,h);
      sprites.set(`atk-monarca-${dir}-${f}`,out);if(dir===2){const m=canvas(w,h),mg=m.getContext('2d');mg.translate(w,0);mg.scale(-1,1);mg.drawImage(out,0,0);sprites.set(`atk-monarca-1-${f}`,m);}}});}
  function walk(name,seed=0){const frames=anim.get('mwalk-'+name);if(!frames)return null;return frames[window.Experience?.settings?.reducedMotion?0:Math.floor(performance.now()/1000*8+seed)%frames.length];}
  function lairAtlas(img){magentaGrid(img,4,3,['tent','totem','cage','cauldron','throne','banner','skulls','hay','cart','meat','anvil','gold'],'lair-');}
  // Guild art (assets/guild-v1.png): animated facade, interior furniture, rank badges and the reception scene.
  const GUILD={"scene":[0,0,400,322],"facade0":[402,0,302,150],"facade1":[706,0,302,150],"facade2":[1010,0,302,150],"facade3":[1314,0,302,150],"board":[1618,0,156,150],"counter":[1776,0,161,150],"ranks":[0,324,144,150],"trophy":[146,324,118,150],"weapons":[266,324,152,150],"maptable":[420,324,176,150],"bench":[598,324,169,150],"chandelier":[769,324,170,150],"mapdesk":[941,324,184,150],"goldchest":[1127,324,133,150],"records":[1262,324,136,150],"orb":[1400,324,95,150],"banner":[1497,324,121,150],"letters":[1620,324,212,150],"tub":[1834,324,95,150],"bell":[0,476,120,123],"rankF":[122,476,99,120],"rankE":[223,476,99,120],"rankD":[324,476,99,120],"rankC":[425,476,99,120],"rankB":[526,476,128,120],"rankA":[656,476,99,120],"rankS":[757,476,122,120],"emblem":[881,476,103,120]};
  function guildAtlas(img){for(const [name,[x,y,w,h]] of Object.entries(GUILD)){const c=canvas(w,h);c.getContext('2d').drawImage(img,x,y,w,h,0,0,w,h);sprites.set('guild-'+name,c);}}
  // ---------- Animated sheets (assets/anim-v1.png, pre-cut; see tools in ATUALIZACAO) ----------
  // Each key maps to [x,y,frameWidth,frameHeight,frames]; frames sit side by side.
  const ANIM={"detail-scarab":[0,0,122,110,4],"detail-ice":[0,112,119,140,4],"detail-ember":[0,254,128,140,4],"detail-slime":[0,396,120,100,4],"detail-wolf":[0,498,143,120,4],"detail-wisp":[0,620,147,120,4],"v3-necromancerV3":[0,742,166,150,4],"v3-goblin":[0,894,138,120,4],"v3-yeti":[0,1016,179,160,4],"detail-boss":[0,1178,222,220,8],"royal-wagon":[0,1400,113,110,4],"detail-cave":[0,1512,207,140,4],"prop-campfire":[0,1654,112,96,4],"prop-lantern":[0,1752,87,128,4],"prop-forge":[0,1882,115,110,4],"royal-fountain":[0,1994,121,128,4],"prop-chest":[0,2124,112,96,4],"prop-well":[0,2222,117,128,4],"detail-crystal":[0,2352,90,96,4],"detail-guild":[0,2450,142,128,4],"royal-stall":[0,2580,142,120,4],"detail-undergrowth":[0,2702,112,96,4],"creature-fenrir":[0,2800,177,150,8],"mount-fenrir":[0,2952,220,150,4],"creature-patrasche":[0,3104,152,140,8],"mount-patrasche":[0,3246,163,140,4],"creature-qilin":[0,3388,140,140,8],"mount-qilin":[0,3530,141,140,4],"creature-salamander":[0,3672,92,90,8],"creature-kitsune":[0,3764,125,120,8],"creature-phoenix":[0,3886,146,130,8],"creature-cerberus":[0,4018,170,130,8],"creature-nekomata":[0,4150,116,110,8],"creature-horse":[0,4262,124,120,8],"mount-horse":[0,4384,133,120,4]};
  // Class skill effects: light on black, drawn additively (assets/fx-v1.png).
  const FX={"fx-guardiao":[0,0,128,128,8],"fx-guerreiro":[0,130,128,128,8],"fx-arqueiro":[0,260,128,128,8],"fx-mago":[0,390,128,128,8],"fx-clerigo":[0,520,128,128,8],"fx-druida":[0,650,128,128,8],"fx-berserker":[0,780,128,128,8],"fx-paladino":[0,910,128,128,8],"fx-fireball":[0,1040,128,128,8],"fx-meteoro":[0,1170,128,128,8],"fx-gift-analise":[0,1300,128,128,4],"fx-gift-crescimento":[0,1430,128,128,4],"fx-gift-domador":[0,1560,128,128,4],"fx-gift-sorte":[0,1690,128,128,4],"fx-gift-mana":[0,1820,128,128,4]};
  const WPN={"wpn-arqueiro":[0,0,64,64,16],"wpn-guerreiro":[0,66,64,64,16],"wpn-guardiao":[0,132,64,64,16],"wpn-mago":[0,198,64,64,16],"wpn-ladino":[0,264,64,64,16],"wpn-clerigo":[0,330,64,64,16],"wpn-druida":[0,396,64,64,16],"wpn-berserker":[0,462,64,64,16],"wpn-paladino":[0,528,64,64,16],"wpn-necromante":[0,594,64,64,16],"wpn-bardo":[0,660,64,64,16],"wpn-artifice":[0,726,64,64,16]};
  const anim=new Map();
  // Quantize to RGB565 and enlarge nearest-neighbour pixels once during loading.
  function retroFrame(img,x,y,w,h,pixelSize=2){
    const sw=Math.max(1,Math.round(w/pixelSize)),sh=Math.max(1,Math.round(h/pixelSize)),small=canvas(sw,sh),sg=small.getContext('2d',{willReadFrequently:true});
    sg.imageSmoothingEnabled=true;sg.imageSmoothingQuality='high';sg.drawImage(img,x,y,w,h,0,0,sw,sh);
    const pixels=sg.getImageData(0,0,sw,sh),d=pixels.data;
    for(let i=0;i<d.length;i+=4){if(d[i+3]<24){d[i+3]=0;continue;}d[i]=Math.min(255,Math.round(d[i]/8)*8);d[i+1]=Math.min(255,Math.round(d[i+1]/4)*4);d[i+2]=Math.min(255,Math.round(d[i+2]/8)*8);d[i+3]=Math.min(255,Math.round(d[i+3]/32)*32);}
    sg.putImageData(pixels,0,0);const out=canvas(w,h),g=out.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(small,0,0,w,h);return out;
  }
  // boxes (optional): measured [x,y,w,h] per name for sheets whose art overflows an even grid.
  function poseFrames(img,columns,rows,names,boss=false,boxes=null){
    names.forEach((name,i)=>{
      let col=i%columns,row=Math.floor(i/columns),x=Math.round(col*img.width/columns),y=Math.round(row*img.height/rows),w=Math.round((col+1)*img.width/columns)-x,h=Math.round((row+1)*img.height/rows)-y;
      let src=img;
      if(boxes){const pad=8,[bx,by,bw,bh]=boxes[i],x0=Math.max(0,bx-pad),y0=Math.max(0,by-pad);src=cropAlpha(img,[x0,y0,Math.min(img.width,bx+bw+pad)-x0,Math.min(img.height,by+bh+pad)-y0]);x=0;y=0;w=src.width;h=src.height;}
      const limit=boss?192:128,scale=Math.min(1,limit/Math.max(w,h)),fw=Math.max(1,Math.round(w*scale)),fh=Math.max(1,Math.round(h*scale));
      const art=retroFrame(src,x,y,w,h,Math.max(3,Math.round(2/scale))),base=canvas(fw,fh),bg=base.getContext('2d');bg.imageSmoothingEnabled=false;bg.drawImage(art,0,0,fw,fh);
      const frames=[];
      for(let n=0;n<(boss?4:8);n++){
        const out=canvas(fw,fh),g=out.getContext('2d');g.imageSmoothingEnabled=false;
        const moving=!boss&&n<4,breath=boss?n===1:n===5,windup=boss?n===2:n===6,attack=boss?n===3:n===7;
        const shift=moving?(n%2?2:-2):attack?4:0,lift=moving||breath?-2:windup?2:attack?-4:0;
        g.translate(Math.round(fw/2+shift),fh+lift);
        g.scale(windup?1.06:attack?1.04:breath?1.015:1,windup?.94:attack?1.06:breath?.985:1);
        g.drawImage(base,-Math.round(fw/2),-fh,fw,fh);frames.push(out);
      }
      anim.set((boss?'boss-':'creature-')+name,frames);
    });
  }
  // bosses-v2.png: art spills over the 4x4 grid (crowns, legs, the wyrm), so each boss has a measured box.
  const BOSS_BOXES=[[19,7,279,308],[325,12,253,303],[614,12,251,313],[923,13,290,303],[12,319,301,322],[344,319,219,319],[606,337,260,299],[889,354,326,285],[28,654,274,282],[312,643,292,295],[611,645,280,303],[910,669,309,279],[11,924,319,339]];
  function bossAtlas(img){poseFrames(img,4,4,['boss','rootBoss','ashBoss','frostBoss','tideBoss','greatTotem','murk','grol','goblinKing','spiderQueen','colossus','batQueen','wyrm'],true,BOSS_BOXES);}
  function mysticAtlas(img){poseFrames(img,4,2,['brambleBoar','mossTurtle','moonMoth','glassScorpion','frostLynx','crystalStag','stormHawk']);}
  function animAtlas(img,manifest=ANIM){for(const [key,[x,y,w,h,n]] of Object.entries(manifest)){const frames=[];for(let i=0;i<n;i++)frames.push(retroFrame(img,x+i*w,y,w,h));anim.set(key,frames);}}
  function generatedSkill(id){
    const frames=[],palettes={monarca:['#1a1030','#7a5cff','#d9ccff'],ladino:['#412554','#a45ad5','#eed1ff'],necromante:['#2d5b5b','#67cfa8','#ddffca'],bardo:['#8b4271','#e5a174','#fff1b2'],artifice:['#3b687a','#75d8e0','#ffdd75']},colors=palettes[id];
    const dot=(g,x,y,size,color)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),size,size);};
    const line=(g,x1,y1,x2,y2,color,size=2)=>{const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/2));for(let j=0;j<=steps;j++){const t=j/steps;dot(g,x1+(x2-x1)*t,y1+(y2-y1)*t,size,color);}};
    const ring=(g,r,color)=>{for(let j=0;j<40;j++){const a=j*Math.PI/20;dot(g,31+Math.cos(a)*r,31+Math.sin(a)*r,2,color);}};
    for(let f=0;f<8;f++){
      const c=canvas(64,64),g=c.getContext('2d'),r=5+f*3;g.globalAlpha=f>5?(8-f)/3:1;
      if(id==='ladino'){
        line(g,32-r,32-r,32+r,32+r,colors[1],3);line(g,32+r,32-r,32-r,32+r,colors[1],3);
        line(g,32-r+3,32-r,32+r+3,32+r,colors[2]);line(g,32+r-3,32-r,32-r-3,32+r,colors[2]);ring(g,r+2,colors[0]);
      }else if(id==='necromante'){
        ring(g,r,colors[1]);for(let j=0;j<5;j++){const a=j*Math.PI*2/5+f*.32;dot(g,30+Math.cos(a)*(r+4),30+Math.sin(a)*(r+4),4,colors[2]);}
        dot(g,25,24,14,colors[0]);dot(g,27,27,3,colors[2]);dot(g,34,27,3,colors[2]);dot(g,30,33,4,colors[2]);
      }else if(id==='bardo'){
        ring(g,r,colors[1]);ring(g,Math.max(3,r-7),colors[0]);for(let j=0;j<3;j++){const a=j*Math.PI*2/3+f*.27,x=30+Math.cos(a)*(r+5),y=30+Math.sin(a)*(r+5);dot(g,x,y,5,colors[2]);line(g,x+4,y,x+4,y-9,colors[2]);dot(g,x+4,y-9,4,colors[1]);}
      }else{
        ring(g,r,colors[1]);for(let j=0;j<8;j++){const a=j*Math.PI/4+f*.2;line(g,31+Math.cos(a)*(r-4),31+Math.sin(a)*(r-4),31+Math.cos(a)*(r+4),31+Math.sin(a)*(r+4),j%2?colors[1]:colors[2]);}
        dot(g,27,27,10,colors[0]);dot(g,30,30,4,colors[2]);
      }
      for(let j=0;j<8;j++){const a=j*2.4+f*.7,dist=r+7+j%3*3;dot(g,31+Math.cos(a)*dist,31+Math.sin(a)*dist,2,colors[j%2?1:2]);}
      const out=canvas(128,128),o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(c,0,0,128,128);frames.push(out);
    }
    return frames;
  }
  for(const id of ['ladino','necromante','bardo','artifice','monarca'])anim.set('fx-'+id,generatedSkill(id));
  const hitFrames=[];
  for(let f=0;f<6;f++){
    const small=canvas(32,32),g=small.getContext('2d'),radius=2+f*2;
    g.globalAlpha=f>3?(6-f)/3:1;
    for(let i=0;i<8;i++){const a=i*Math.PI/4,x=15+Math.cos(a)*radius,y=15+Math.sin(a)*radius;g.fillStyle=i%2?'#ffd166':'#ff8457';g.fillRect(Math.round(x),Math.round(y),i%2?3:2,i%2?2:3);}
    g.fillStyle='#fff5cf';g.fillRect(14,14,4,4);
    const out=canvas(64,64),o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(small,0,0,64,64);hitFrames.push(out);
  }
  anim.set('fx-hit',hitFrames);
  // Playback per key: loops for props, states for monsters (idle / windup / attack).
  const LOOP={'prop-campfire':[8,[0,1,2,3]],'prop-lantern':[4,[0,1,2,3]],'royal-fountain':[6,[0,1,2,1]],'detail-crystal':[3,[0,1,2,1]],'detail-guild':[4,[0,1,2,3]],'royal-stall':[4,[0,1,2,3]],'detail-undergrowth':[3,[0,1,2,3]],'detail-cave':[4,[0,1,2,3]],'royal-wagon':[6,[0,1,2,3]]};
  function pick(key,frames,opt){
    if(window.Experience?.settings?.reducedMotion)return 0;
    const t=performance.now()/1000+(opt?.seed||0)*.37,state=opt?.state;
    if(key==='creature-horse')return state==='moving'?Math.floor(t*8)%4:[4,5,4,6,7,6][Math.floor(t*1.5)%6];
    if(key.startsWith('creature-'))return state==='attack'?7:state==='windup'?6:state==='moving'?Math.floor(t*8)%4:4+Math.floor(t*2)%2;
    if(key.startsWith('boss-'))return state==='attack'?3:state==='windup'?2:Math.floor(t*2)%2;
    if(key.startsWith('mount-'))return state==='moving'?Math.floor(t*8)%4:0;
    if(key==='detail-boss')return state==='attack'?6:state==='windup'?4+Math.floor(t*6)%2:Math.floor(t*4)%4;
    if(frames.length===4&&(key.startsWith('detail-')||key.startsWith('v3-'))&&!LOOP[key])return state==='attack'?3:state==='windup'?2:Math.floor(t*3)%2;
    if(key==='prop-forge')return t%7<.45?2:[0,1,3,1][Math.floor(t*5)%4];
    if(key==='royal-wagon'&&opt?.state!=='moving')return 0;
    if(key==='prop-chest')return t%5<.35?1:0;
    if(key==='prop-well')return t%10<2?Math.floor(t*2)%4:0;
    const [fps,seq]=LOOP[key]||[4,[0,1,2,3]];return seq[Math.floor(t*fps)%seq.length];
  }
  // Big pixel-art sprites drawn small: shrink once with smoothing (halving steps) and cache per device size,
  // so a 300px building drawn 100px wide stays clean instead of nearest-neighbour noise.
  const fitted=new Map();
  function fit(name,w,h){w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));const key=name+'|'+w+'|'+h;let c=fitted.get(key);if(c)return c;const src=sprites.get(name);if(!src)return null;
    let cur=src;while(cur.width>w*2&&cur.height>h*2){const n=canvas(Math.ceil(cur.width/2),Math.ceil(cur.height/2)),g=n.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(cur,0,0,n.width,n.height);cur=n;}
    c=canvas(w,h);const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(cur,0,0,w,h);
    fitted.set(key,c);if(fitted.size>600)fitted.delete(fitted.keys().next().value);return c;}
  // Draws sprite `name` bottom-centred at (cx,base), w pixels wide (height from its aspect); false until loaded.
  function place(ctx,name,cx,base,w,flip){const src=sprites.get(name);if(!src)return false;const h=w*src.height/src.width,k=Math.abs(ctx.getTransform?.().a||1),c=fit(name,w*k,h*k);
    if(flip){ctx.save();ctx.translate(Math.round(cx),0);ctx.scale(-1,1);ctx.drawImage(c,-Math.round(w/2),Math.round(base-h),Math.round(w),Math.round(h));ctx.restore();}
    else ctx.drawImage(c,Math.round(cx-w/2),Math.round(base-h),Math.round(w),Math.round(h));return true;}
  function get(name,opt){const frames=anim.get(name);return frames?frames[pick(name,frames,opt)]:sprites.get(name);}
  // Essentials first (hero, world, props, creatures); animations, effects, weapons and royals follow,
  // so on a phone connection the world is drawn with real art as early as possible.
  function artReady(results){const button=sprites.get('world-1-2'),health=sprites.get('world-1-3');
    if(button)document.documentElement.style.setProperty('--gold-button',`url("${button.toDataURL()}")`);
    if(health)document.documentElement.style.setProperty('--health-frame',`url("${health.toDataURL()}")`);
    document.dispatchEvent(new Event('game-art-ready'));return results;}
  const essentials=Promise.all([loadSheet('assets/expansion-v3.png',expansionAtlas),load('assets/heroes.png',true),load('assets/world-atlas.png',false),loadSheet('assets/walk-v2.png',walkingAtlas),loadSheet('assets/class-portraits.png',classPortraitAtlas),loadSheet('assets/detail-atlas-v2.png',detailedAtlas),loadSheet('assets/props-v2.png',img=>{['well','chest','lantern','grave','forge','bed','bookcase','campfire'].forEach((name,i)=>sprites.set('prop-'+name,cropAlpha(img,[(i%4)*384,Math.floor(i/4)*512,384,512])));})]).then(artReady);
  const ready=essentials.then(()=>Promise.all([loadSheet('assets/anim-v1.png',img=>animAtlas(img)),loadSheet('assets/bosses-v2.png',bossAtlas),loadSheet('assets/mystics-v2.png',mysticAtlas),loadSheet('assets/fx-v1.png',img=>animAtlas(img,FX)),loadSheet('assets/wpn-v1.png',img=>animAtlas(img,WPN)),loadSheet('assets/royal-v1.png',royalAtlas),loadSheet('assets/town-v1.png',townAtlas).then(()=>loadSheet('assets/buildings-front.png',frontAtlas)),loadSheet('assets/lair-props.png',lairAtlas),...Object.entries(MON_STRIPS).map(([kind,n])=>loadSheet('assets/mon-'+kind+'.png',img=>monStrip(img,kind,n))),loadSheet('assets/hero-monarca.png',heroMonarca).then(()=>loadSheet('assets/hero-monarca-atk.png',heroMonarcaAtk)),...Object.keys(MON_STRIPS).map(kind=>loadSheet('assets/atk-'+kind+'.png',img=>monStrip(img,kind,4,'matk-'))),loadSheet('assets/fx-arise.png',img=>monStrip(img,'arise',8,'fx-')),loadSheet('assets/hero-monarca-cast.png',heroMonarcaCast),
      ...['adaga','troca','autoridade','dominio','furtividade'].map(id=>loadSheet('assets/fx-'+id+'.png',img=>monStrip(img,id,8,'fx-'))),
      loadSheet('assets/royal-plants.png',img=>magentaGrid(img,5,1,['hedge','roses','tulips','lavender','topiary'],'plant-')),loadSheet('assets/portal-gates.png',img=>magentaGrid(img,6,1,['E','D','C','B','A','S'],'gate-')),loadSheet('assets/portrait-monarca.png',img=>sprites.set('portrait-monarca',retroFrame(img,0,0,img.width,img.height,3))),...Object.entries(WALKS).map(([file,names])=>loadSheet('assets/'+file+'.png',img=>walkSheet(img,names,file.includes('boss')))),loadSheet('assets/guild-v1.png',guildAtlas)])).then(artReady);
  return {ready,essentials,get,place,fit,frame:(name,i)=>anim.get(name)?.[i],walk,get frontBuildings(){return frontBuildings;}};
})();
