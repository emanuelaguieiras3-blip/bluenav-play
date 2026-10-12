'use strict';
// Detects PC, tablet or phone before the page lays out, and keeps the answer on <html data-device>.
// Also tracks the input in use on <html data-input> (touch, mouse, keyboard or gamepad) and the pad
// family on <html data-pad>, so a phone with a PlayStation or Xbox controller hides the touch buttons.
// The player can override the device in Menu > Opções; the choice is stored only in this browser.
(()=>{
  const KEY='vespera-device',root=document.documentElement;
  function detect(){
    const ua=navigator.userAgent||'',touch=(navigator.maxTouchPoints||0)>0||'ontouchstart' in window;
    const coarse=matchMedia('(pointer:coarse)').matches,fine=matchMedia('(any-pointer:fine)').matches,hover=matchMedia('(hover:hover)').matches;
    const shortSide=Math.min(screen.width,screen.height);
    const iPad=/iPad/.test(ua)||/Macintosh/.test(ua)&&touch;
    const tabletUA=iPad||/Tablet|PlayBook|Silk|Kindle|SM-T|SM-X|Lenovo Tab|\bTab\b/i.test(ua)||/Android/i.test(ua)&&!/Mobile/i.test(ua);
    const phoneUA=navigator.userAgentData?.mobile===true||/iPhone|iPod|Android.*Mobile|Windows Phone|Mobi/i.test(ua);
    if(!touch)return 'pc';
    // Touch laptops keep a mouse and hover: treat them as PCs.
    if(!coarse&&fine&&hover&&!tabletUA&&!phoneUA)return 'pc';
    if(tabletUA)return 'tablet';
    if(phoneUA)return shortSide>=600?'tablet':'mobile';
    return shortSide>=600?'tablet':'mobile';
  }
  // Suggested graphics profile from the device class, memory and CPU cores (Leve, Médio or Ultra).
  function recommendedQuality(device=root.dataset.device||detect()){
    const mem=navigator.deviceMemory||0,cores=navigator.hardwareConcurrency||4;
    if(navigator.connection?.saveData)return 'leve';
    if(device==='mobile')return mem&&mem<=3||cores<=4?'leve':'medio';
    // Tablets and PCs get the sharp Ultra profile unless the hardware is clearly weak.
    if(device==='tablet')return mem&&mem<=2?'leve':(!mem||mem>=4)&&cores>=6?'ultra':'medio';
    return cores<=2||mem&&mem<=2?'medio':'ultra';
  }
  function override(){try{return localStorage.getItem(KEY)||'auto';}catch{return 'auto';}}
  function apply(){
    const chosen=override(),device=chosen==='auto'?detect():chosen,changed=root.dataset.device!==device;
    root.dataset.device=device;root.dataset.orientation=innerWidth>=innerHeight?'landscape':'portrait';
    if(!root.dataset.input)root.dataset.input=device==='pc'?'keyboard':'touch';
    if(changed)window.dispatchEvent(new CustomEvent('device-change',{detail:device}));return device;
  }
  function setInput(mode,pad){
    const changed=root.dataset.input!==mode||!!pad&&root.dataset.pad!==pad;if(pad)root.dataset.pad=pad;
    if(changed){root.dataset.input=mode;window.dispatchEvent(new CustomEvent('input-change',{detail:{mode,pad:root.dataset.pad}}));}
  }
  const labels={pc:'Computador',tablet:'Tablet',mobile:'Celular'},padNames={playstation:'PlayStation',xbox:'Xbox',nintendo:'Nintendo',generic:'genérico'};
  window.DeviceProfile={detect,apply,override,recommendedQuality,setInput,get:()=>root.dataset.device,input:()=>root.dataset.input,
    set(value){try{value==='auto'?localStorage.removeItem(KEY):localStorage.setItem(KEY,value);}catch{}return apply();},
    label:device=>labels[device]||device,
    fullLabel(){const d=labels[root.dataset.device]||root.dataset.device;return root.dataset.pad&&root.dataset.input==='gamepad'?d+' + controle '+padNames[root.dataset.pad]:d;}};
  apply();addEventListener('resize',apply);addEventListener('orientationchange',apply);
  // The last input used wins: touching the screen brings the touch buttons back, a pad hides them.
  addEventListener('pointerdown',e=>setInput(e.pointerType==='mouse'?'mouse':'touch'),{capture:true,passive:true});
  addEventListener('keydown',()=>setInput('keyboard'),{capture:true,passive:true});
})();
