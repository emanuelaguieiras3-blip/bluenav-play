'use strict';
// Gamepads: identifies PlayStation, Xbox and Nintendo pads, reads buttons by name (not by index),
// fixes common non-"standard" layouts, applies a radial dead zone and rumbles when supported.
// Works the same on PC and on phones/tablets with a Bluetooth or USB controller.
window.PadInput=(()=>{
  const GLYPHS={
    xbox:{a:'A',b:'B',x:'X',y:'Y',lb:'LB',rb:'RB',lt:'LT',rt:'RT',view:'View',menu:'Menu',ls:'LS',rs:'RS',move:'L',name:'Xbox'},
    playstation:{a:'✕',b:'○',x:'□',y:'△',lb:'L1',rb:'R1',lt:'L2',rt:'R2',view:'Create',menu:'Options',ls:'L3',rs:'R3',move:'L',name:'PlayStation'},
    nintendo:{a:'B',b:'A',x:'Y',y:'X',lb:'L',rb:'R',lt:'ZL',rt:'ZR',view:'−',menu:'+',ls:'LS',rs:'RS',move:'L',name:'Nintendo'},
    generic:{a:'A',b:'B',x:'X',y:'Y',lb:'LB',rb:'RB',lt:'LT',rt:'RT',view:'Select',menu:'Start',ls:'L3',rs:'R3',move:'L',name:'genérico'}};
  // W3C "standard" mapping order.
  const STANDARD=['a','b','x','y','lb','rb','lt','rt','view','menu','ls','rs','up','down','left','right','home','pad'];
  // DualShock/DualSense without standard mapping (older Firefox, some Android builds).
  const PS_RAW={x:0,a:1,b:2,y:3,lb:4,rb:5,lt:6,rt:7,view:8,menu:9,ls:10,rs:11,home:12,pad:13};
  function kindOf(id=''){id=id.toLowerCase();
    // Xbox first: its id also says "Wireless Controller", which is the DualShock 4 name on Chrome.
    if(/045e|xbox|xinput|microsoft|8bitdo/.test(id))return 'xbox';
    if(/054c|playstation|dualshock|dualsense|wireless controller|ps[345]\b|sony/.test(id))return 'playstation';
    if(/057e|nintendo|pro controller|joy-?con|switch/.test(id))return 'nintendo';
    return 'generic';}
  function deadzone(x,y,d=.2){const m=Math.hypot(x,y);if(m<d)return {x:0,y:0};const k=Math.min(1,(m-d)/(1-d))/m;return {x:x*k,y:y*k};}
  function value(gp,i){const b=gp.buttons[i];if(b==null)return 0;if(typeof b==='number')return b;return b.pressed?Math.max(.99,b.value||0):b.value||0;}
  function read(gp){
    const kind=kindOf(gp.id),std=gp.mapping==='standard',b={};
    if(!std&&kind==='playstation')for(const n in PS_RAW)b[n]=value(gp,PS_RAW[n]);
    else STANDARD.forEach((n,i)=>{b[n]=value(gp,i);});
    let rx=gp.axes[2]||0,ry=(!std&&kind==='playstation'?gp.axes[5]:gp.axes[3])||0;
    if(!std){
      // Hat switch on axis 9 (8 directions, ~1.28 when released).
      const hat=gp.axes[9];if(hat!==undefined&&Math.abs(hat)<=1.05){const i=Math.round((hat+1)*3.5)%8;b.up=[7,0,1].includes(i)?1:0;b.right=[1,2,3].includes(i)?1:0;b.down=[3,4,5].includes(i)?1:0;b.left=[5,6,7].includes(i)?1:0;}
      // Some Android pads report the D-pad as axes 6/7.
      else if(gp.axes.length>=8&&!(b.up||b.down||b.left||b.right)){const hx=gp.axes[6]||0,hy=gp.axes[7]||0;b.left=hx<-.5?1:0;b.right=hx>.5?1:0;b.up=hy<-.5?1:0;b.down=hy>.5?1:0;}
    }
    return {gp,kind,std,b,move:deadzone(gp.axes[0]||0,gp.axes[1]||0),look:deadzone(rx,ry,.25)};
  }
  let active=-1,prev={},state={connected:false,kind:null,active:false},lastKind=null;
  function busy(r){return Object.values(r.b).some(v=>v>.5)||Math.hypot(r.move.x,r.move.y)>.3||Math.hypot(r.look.x,r.look.y)>.3;}
  function poll(){
    let pads=[];try{pads=[...(navigator.getGamepads?.()||[])].filter(Boolean);}catch{}
    if(!pads.length){active=-1;prev={};state={connected:false,kind:null,active:false,pressed:()=>false,held:()=>false,move:{x:0,y:0},look:{x:0,y:0}};return state;}
    const reads=pads.map(read);
    // The pad the player touched last becomes the active one (two pads plugged in, or a phone + pad).
    const touched=reads.find(r=>r.gp.index!==active&&busy(r));if(touched)active=touched.gp.index;
    let r=reads.find(x=>x.gp.index===active);if(!r){r=reads[0];active=r.gp.index;}
    const was=prev,now={};for(const n in r.b)now[n]=r.b[n]>.5;prev=now;
    const pressed=n=>!!now[n]&&!was[n],held=n=>!!now[n];
    state={connected:true,kind:r.kind,id:r.gp.id,index:r.gp.index,active:busy(r),pressed,held,move:r.move,look:r.look,b:r.b,glyphs:GLYPHS[r.kind]};
    if(r.kind!==lastKind){lastKind=r.kind;dispatchEvent(new CustomEvent('pad-change',{detail:{kind:r.kind,name:GLYPHS[r.kind].name,id:r.gp.id}}));}
    return state;
  }
  function rumble(strong=.5,weak=.3,ms=120){
    try{const gp=[...(navigator.getGamepads?.()||[])].find(p=>p&&p.index===active);if(!gp)return;
      const v=gp.vibrationActuator;if(v?.playEffect){v.playEffect(v.type||'dual-rumble',{startDelay:0,duration:ms,strongMagnitude:strong,weakMagnitude:weak}).catch(()=>{});return;}
      gp.hapticActuators?.[0]?.pulse?.(strong,ms);}catch{}
  }
  function glyph(name,kind=state.kind||'xbox'){const g=GLYPHS[kind]||GLYPHS.xbox;return g[name]||name;}
  function glyphHtml(name,kind=state.kind||'xbox'){return `<span class="pad-glyph" data-kind="${kind}" data-btn="${name}">${glyph(name,kind)}</span>`;}
  addEventListener('gamepadconnected',e=>{active=e.gamepad.index;lastKind=null;poll();dispatchEvent(new CustomEvent('pad-connect',{detail:{kind:kindOf(e.gamepad.id),name:GLYPHS[kindOf(e.gamepad.id)].name}}));});
  addEventListener('gamepaddisconnected',e=>{if(e.gamepad.index===active)active=-1;lastKind=null;prev={};dispatchEvent(new CustomEvent('pad-disconnect',{detail:{kind:kindOf(e.gamepad.id)}}));});
  return {poll,rumble,glyph,glyphHtml,kindOf,GLYPHS,get state(){return state;}};
})();
