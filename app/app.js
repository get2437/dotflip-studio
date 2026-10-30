import { LIMITS, PALETTES, clamp, rgba, hex, newFrame, copyFrame, cloneProject, setPixel, line, floodFill, clearRegion, transform, removeBackground, adjustColors, makePalette, quantize, motionFrames, serializeProject, parseProject } from './core.js';
import { createDemo } from './demo.js';
import { sheetMetadata, framePixels, projectForExport } from './export.js';
import { zipFiles } from './zip.js';
import { sheetRects, spriteBounds, extractSprite, createActionProject } from './action.js';
import { fitZoom, PointerSession } from './viewport.js';
import { PROMPT_EXAMPLES } from './prompts.js';
import {workSize} from './pixel-converter.js';
const $=id=>document.getElementById(id);
const icons=name=>`<svg><use href="#i-${name}"/></svg>`;
const toolNames={pencil:'鉛筆',eraser:'消しゴム',fill:'塗りつぶし',picker:'スポイト',select:'範囲選択',line:'直線',rect:'四角形',pan:'画面移動'};
const state={project:createDemo(),active:0,tool:'pencil',color:'#efa45c',brush:1,grid:true,onion:false,reference:false,zoom:null,selection:null,cursor:null,playing:true,preview:0,previewTime:0,history:[],redo:[],source:[],drag:null,sample:true};
let saveTimer,toastTimer,dbPromise,persistGeneration=0,lastDimensions='';
const canvas=$('editor-canvas'),ctx=canvas.getContext('2d'),scratch=document.createElement('canvas'),sctx=scratch.getContext('2d');
const pointerSession=new PointerSession(),mobileLayout=matchMedia('(max-width:1023px)');
function selectMobileView(view){
  document.body.dataset.mobileView=view;
  document.querySelectorAll('.mobile-nav [data-mobile-view-target]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mobileViewTarget===view)));
  if(mobileLayout.matches){window.scrollTo(0,0);requestAnimationFrame(()=>{renderEditor();renderPreview(true);});}
}
document.querySelectorAll('[data-mobile-view-target]').forEach(button=>button.onclick=()=>selectMobileView(button.dataset.mobileViewTarget));
function arrangePalette(){
  if(mobileLayout.matches)$('editor-palette').append($('palette-section'));
  else $('source-panel').append($('palette-section'));
  requestAnimationFrame(renderEditor);
}
mobileLayout.addEventListener('change',arrangePalette);arrangePalette();
function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4200);}
function safe(fn){return async(...args)=>{try{await fn(...args);}catch(e){console.error(e);toast(e.message||'処理に失敗しました。',true);}};}
function frame(){return state.project.frames[state.active];}
function setSaveState(text,pending=false){$('save-state').lastElementChild.textContent=text;$('save-state').firstElementChild.style.background=pending?'#d1a16e':'#8da287';}
function database(){
  return dbPromise ||=new Promise((resolve,reject)=>{
    const req=indexedDB.open('dotflip-studio',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('workspace');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function readSaved(){const db=await database();return new Promise((resolve,reject)=>{const req=db.transaction('workspace').objectStore('workspace').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function scheduleSave(){
  clearTimeout(saveTimer);setSaveState('保存中…',true);const generation=++persistGeneration;
  saveTimer=setTimeout(async()=>{
    try{
      const record={project:serializeProject(state.project),sample:state.sample,active:state.active};
      const source=state.source[0];
      if(source){record.source={name:source.name,width:source.width,height:source.height,url:source.bitmap.toDataURL('image/png')};}
      const db=await database();
      await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(record,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
      if(generation===persistGeneration)setSaveState('保存済み');
    }catch(e){console.warn('Autosave unavailable',e);setSaveState('自動保存不可 · 保存ボタンへ',true);}
  },550);
}
function pushHistory(){
  state.history.push(snapshot());state.redo=[];
  let bytes=0;const sources=new Set();for(let i=state.history.length-1;i>=0;i--){const s=state.history[i];bytes+=s.project.frames.reduce((sum,f)=>sum+f.pixels.byteLength+(f.scenePixels?.byteLength||0),0);for(const source of s.source){if(!sources.has(source.bitmap)){sources.add(source.bitmap);bytes+=source.bitmap.width*source.bitmap.height*4;}}if(bytes>48*1024*1024&&i<state.history.length-1){state.history.splice(0,i+1);break;}}
  if(state.history.length>30)state.history.shift();
}
function snapshot(){return {project:cloneProject(state.project),active:state.active,sample:state.sample,source:[...state.source]};}
function changed(){state.sample=false;render();scheduleSave();}
function mutate(fn){pushHistory();fn();changed();}
function undo(){if(!state.history.length)return;state.redo.push(snapshot());restoreSnapshot(state.history.pop());}
function redo(){if(!state.redo.length)return;state.history.push(snapshot());restoreSnapshot(state.redo.pop());}
function restoreSnapshot(s){state.project=s.project;state.active=s.active;state.sample=s.sample;state.source=s.source;state.selection=null;state.cursor=null;state.preview=0;renderSource();render();scheduleSave();}
function putImage(context,p,w,h){context.canvas.width=w;context.canvas.height=h;context.putImageData(new ImageData(new Uint8ClampedArray(p),w,h),0,0);}
function checker(context,w,h,unit=8){context.fillStyle='#d4ddc7';context.fillRect(0,0,w,h);context.fillStyle='#c8d3b9';for(let y=0;y<h;y+=unit)for(let x=0;x<w;x+=unit)if((Math.floor(x/unit)+Math.floor(y/unit))%2)context.fillRect(x,y,unit,unit);}
function renderEditor(){
  const {width:w,height:h}=state.project;
  const scroller=$('canvas-scroll');if(!scroller.clientWidth||!scroller.clientHeight)return;
  const padding=getComputedStyle(scroller);
  const availableW=scroller.clientWidth-parseFloat(padding.paddingLeft)-parseFloat(padding.paddingRight),availableH=scroller.clientHeight-parseFloat(padding.paddingTop)-parseFloat(padding.paddingBottom);
  const fit=fitZoom(w,h,availableW,availableH,!mobileLayout.matches);
  const z=Math.min(state.zoom??fit,Math.max(1,Math.floor(2048/Math.max(w,h)))),W=w*z,H=h*z;
  canvas.width=W;canvas.height=H;canvas.style.width=W+'px';canvas.style.height=H+'px';
  $('canvas-mount').style.width=W+'px';$('canvas-mount').style.height=H+'px';
  checker(ctx,W,H,z*Math.max(1,Math.round(4/z)));
  ctx.imageSmoothingEnabled=false;
  if(state.reference&&state.source[0]){
    const image=state.source[0].bitmap,mode=$('image-fit').value;ctx.globalAlpha=Number($('reference-opacity').value)/100;
    ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();ctx.imageSmoothingEnabled=true;
    if(mode==='stretch')ctx.drawImage(image,0,0,W,H);else{const ratio=(mode==='cover'?Math.max:Math.min)(W/image.width,H/image.height);ctx.drawImage(image,(W-image.width*ratio)/2,(H-image.height*ratio)/2,image.width*ratio,image.height*ratio);}
    ctx.restore();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
  }
  if(state.onion&&state.active>0){putImage(sctx,state.project.frames[state.active-1].pixels,w,h);ctx.globalAlpha=.25;ctx.drawImage(scratch,0,0,W,H);ctx.globalAlpha=1;}
  putImage(sctx,frame().pixels,w,h);ctx.drawImage(scratch,0,0,W,H);
  if(state.grid&&z>=3){ctx.strokeStyle='#23342120';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=w;x++){ctx.moveTo(x*z+.5,0);ctx.lineTo(x*z+.5,H);}for(let y=0;y<=h;y++){ctx.moveTo(0,y*z+.5);ctx.lineTo(W,y*z+.5);}ctx.stroke();}
  if(state.selection){const r=state.selection;ctx.fillStyle='#f6bb7220';ctx.fillRect(r.x*z,r.y*z,r.w*z,r.h*z);ctx.strokeStyle='#fff0bd';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(r.x*z+.5,r.y*z+.5,r.w*z-1,r.h*z-1);ctx.setLineDash([]);}
  if(state.cursor&&z>=3){const {x,y}=state.cursor;ctx.strokeStyle='#fff8de';ctx.lineWidth=1;ctx.strokeRect(x*z+.5,y*z+.5,z-1,z-1);}
  $('zoom-fit').textContent=state.zoom===null?'FIT':`${z}×`;
  const rulerValues=(n)=>{const steps=Math.min(8,Math.max(2,Math.ceil(n/8)));return Array.from({length:steps+1},(_,i)=>Math.round(i*(n-1)/steps));};
  $('ruler-x').replaceChildren(...rulerValues(w).map(n=>{const span=document.createElement('span');span.textContent=n;return span;}));
  $('ruler-y').replaceChildren(...rulerValues(h).map(n=>{const span=document.createElement('span');span.textContent=n;return span;}));
}
function renderFrames(){
  const strip=$('frame-strip'),scroll=strip.scrollLeft,{width:w,height:h,frames}=state.project;
  strip.replaceChildren();
  frames.forEach((f,i)=>{
    const b=document.createElement('button');b.className='frame-card'+(i===state.active?' selected':'');b.dataset.frame=i;
    b.setAttribute('aria-label',`フレーム ${i+1}、${f.duration}ミリ秒`);b.setAttribute('aria-pressed',String(i===state.active));
    const c=document.createElement('canvas');c.width=w;c.height=h;putImage(c.getContext('2d'),f.pixels,w,h);
    const num=document.createElement('span');num.className='frame-number';num.textContent=String(i+1).padStart(2,'0');
    const ms=document.createElement('span');ms.className='frame-ms';ms.textContent=f.duration+' ms';b.append(c,num,ms);strip.append(b);
  });
  const add=document.createElement('button');add.className='add-frame';add.id='add-frame';add.setAttribute('aria-label','空のコマを追加');add.innerHTML=icons('plus')+'<span>追加</span>';add.disabled=frames.length>=LIMITS.frames;strip.append(add);strip.scrollLeft=scroll;
}
function renderPalette(){
  const el=$('palette-swatches');el.replaceChildren();
  state.project.palette.forEach(c=>{const b=document.createElement('button');b.className='swatch'+(c.toLowerCase()===state.color.toLowerCase()?' active':'');b.style.background=c;b.dataset.color=c;b.title=c;b.setAttribute('aria-label',`描画色 ${c}`);b.setAttribute('aria-pressed',String(c.toLowerCase()===state.color.toLowerCase()));el.append(b);});
  $('palette-count').textContent=state.project.palette.length+' COLORS';
  $('color-hex').value=state.color;$('color-picker').value=state.color;$('color-swatch').style.background=state.color;
  $('mobile-current-color').style.background=state.color;$('mobile-color-code').textContent=state.color;
}
function renderSelection(){
  const r=state.selection;$('selection-bar').hidden=!r;
  $('selection-status').textContent=r?`${r.w} × ${r.h} 選択`:'';
  if(r)$('selection-coords').textContent=`X ${r.x} Y ${r.y} · ${r.w}×${r.h}`;
}
function render(){
  const p=state.project,n=p.frames.length;
  const dimensions=p.width+'x'+p.height;
  if(dimensions!==lastDimensions){
    const preset=p.width===p.height&&[32,48,64,96,128,256].includes(p.width);
    $('resolution').value=preset?String(p.width):'custom';$('custom-size').hidden=preset;
    $('custom-width').value=p.width;$('custom-height').value=p.height;$('resolution-label').textContent=`${p.width} × ${p.height}`;lastDimensions=dimensions;
  }
  if(document.activeElement!==$('project-name'))$('project-name').value=p.name;
  $('sample-badge').hidden=!state.sample;$('canvas-size').textContent=`${p.width} × ${p.height} PX`;
  $('frame-total').textContent=`${n} FRAME${n>1?'S':''}`;
  const averageFps=1000/(p.frames.reduce((sum,f)=>sum+f.duration,0)/n);
  $('fps-label').textContent=(Number.isInteger(averageFps)?averageFps:averageFps.toFixed(1))+' FPS';
  $('fps').value=clamp(Math.round(averageFps),1,24);
  $('active-frame-label').textContent='フレーム '+String(state.active+1).padStart(2,'0');$('frame-duration').value=frame().duration;
  $('total-duration').textContent=(p.frames.reduce((s,f)=>s+f.duration,0)/1000).toFixed(2)+' s';
  $('footer-spec').textContent=`${p.width} × ${p.height} PX · ${n} FRAMES`;
  $('undo-btn').disabled=!state.history.length;$('redo-btn').disabled=!state.redo.length;$('delete-frame').disabled=n<=1;
  $('duplicate-frame').disabled=n>=LIMITS.frames;$('frame-left').disabled=state.active===0;$('frame-right').disabled=state.active===n-1;
  $('tool-name').textContent=toolNames[state.tool];
  canvas.classList.toggle('panning',state.tool==='pan');
  document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===state.tool);b.setAttribute('aria-pressed',String(b.dataset.tool===state.tool));});
  $('grid-btn').classList.toggle('active',state.grid);$('grid-btn').setAttribute('aria-pressed',state.grid);
  $('onion-btn').classList.toggle('active',state.onion);$('onion-btn').setAttribute('aria-pressed',state.onion);
  $('reference-toggle').classList.toggle('active',state.reference);$('reference-toggle').setAttribute('aria-pressed',state.reference);$('reference-opacity-label').hidden=!state.reference;
  renderEditor();renderFrames();renderPalette();renderSelection();renderPreview(true);
}
function selectTool(t){state.tool=t;state.cursor=null;render();}
function chooseColor(c){if(!/^#[\da-f]{6}$/i.test(c))return;state.color=c.toLowerCase();renderPalette();}
function selectFrame(i){state.active=clamp(i,0,state.project.frames.length-1);state.selection=null;state.cursor=null;render();const el=$('frame-strip').querySelector(`[data-frame="${state.active}"]`);el?.scrollIntoView({block:'nearest',inline:'nearest'});}
function point(e){const r=canvas.getBoundingClientRect(),p=state.project;return {x:clamp(Math.floor((e.clientX-r.left)/r.width*p.width),0,p.width-1),y:clamp(Math.floor((e.clientY-r.top)/r.height*p.height),0,p.height-1)};}
function showPosition(pt){$('pixel-position').textContent=pt?`X ${String(pt.x).padStart(3,'0')}  Y ${String(pt.y).padStart(3,'0')}`:'X —  Y —';}
function drawStroke(from,to,erase=false){const p=state.project;line(frame().pixels,p.width,p.height,from.x,from.y,to.x,to.y,erase?[0,0,0,0]:rgba(state.color),state.brush,state.selection);}
canvas.addEventListener('pointerdown',e=>{
  if(!pointerSession.start(e))return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
  if(state.tool==='pan'){const scroller=$('canvas-scroll');state.drag={pan:true,x:e.clientX,y:e.clientY,left:scroller.scrollLeft,top:scroller.scrollTop};return;}
  const pt=point(e);state.cursor=pt;showPosition(pt);
  if(state.tool==='picker'){const i=(pt.y*state.project.width+pt.x)*4;if(frame().pixels[i+3])chooseColor(hex(frame().pixels.slice(i,i+4)));return;}
  if(state.tool==='select'){state.selection={x:pt.x,y:pt.y,w:1,h:1};state.drag={start:pt,last:pt};renderEditor();renderSelection();return;}
  pushHistory();state.drag={start:pt,last:pt,before:new Uint8ClampedArray(frame().pixels),erase:e.button===2||state.tool==='eraser'};
  if(state.tool==='fill'){floodFill(frame().pixels,state.project.width,state.project.height,pt.x,pt.y,rgba(state.color),state.selection);state.drag=null;changed();return;}
  if(state.tool==='pencil'||state.tool==='eraser')drawStroke(pt,pt,state.drag.erase);
  renderEditor();
});
canvas.addEventListener('pointermove',e=>{
  if(pointerSession.id!==null&&!pointerSession.owns(e))return;
  if(state.drag?.pan){$('canvas-scroll').scrollLeft=state.drag.left+state.drag.x-e.clientX;$('canvas-scroll').scrollTop=state.drag.top+state.drag.y-e.clientY;return;}
  const pt=point(e);showPosition(pt);if(!state.drag)return;state.cursor=pt;const drag=state.drag;
  if(state.tool==='select'){
    state.selection={x:Math.min(drag.start.x,pt.x),y:Math.min(drag.start.y,pt.y),w:Math.abs(pt.x-drag.start.x)+1,h:Math.abs(pt.y-drag.start.y)+1};renderSelection();
  }else if(state.tool==='line'||state.tool==='rect'){
    frame().pixels.set(drag.before);
    const a=drag.start,p=state.project,c=drag.erase?[0,0,0,0]:rgba(state.color);
    if(state.tool==='line')line(frame().pixels,p.width,p.height,a.x,a.y,pt.x,pt.y,c,state.brush,state.selection);
    else{line(frame().pixels,p.width,p.height,a.x,a.y,pt.x,a.y,c,state.brush,state.selection);line(frame().pixels,p.width,p.height,pt.x,a.y,pt.x,pt.y,c,state.brush,state.selection);line(frame().pixels,p.width,p.height,pt.x,pt.y,a.x,pt.y,c,state.brush,state.selection);line(frame().pixels,p.width,p.height,a.x,pt.y,a.x,a.y,c,state.brush,state.selection);}
  }else drawStroke(drag.last,pt,drag.erase);
  drag.last=pt;renderEditor();
});
function finishStroke(event){if(!pointerSession.finish(event)||!state.drag)return;if(state.drag.pan){state.drag=null;return;}const isSelect=state.tool==='select';if(!isSelect&&(state.tool==='line'||state.tool==='rect')&&state.drag.start.x===state.drag.last.x&&state.drag.start.y===state.drag.last.y)drawStroke(state.drag.start,state.drag.last,state.drag.erase);state.drag=null;if(isSelect){renderSelection();return;}changed();}
canvas.addEventListener('pointerup',finishStroke);canvas.addEventListener('pointercancel',finishStroke);canvas.addEventListener('lostpointercapture',finishStroke);
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerleave',()=>{if(!state.drag)showPosition(state.cursor);});
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>selectTool(b.dataset.tool));
$('brush-size').onchange=e=>state.brush=Number(e.target.value);
$('palette-swatches').onclick=e=>{const b=e.target.closest('[data-color]');if(b)chooseColor(b.dataset.color);};
$('color-picker').oninput=e=>chooseColor(e.target.value);
$('color-hex').onchange=e=>{const c=e.target.value.startsWith('#')?e.target.value:'#'+e.target.value;if(!/^#[\da-f]{6}$/i.test(c)){toast('色は #RRGGBB 形式で指定してください。',true);e.target.value=state.color;return;}chooseColor(c);};
$('add-color').onclick=()=>{if(state.project.palette.includes(state.color))return;if(state.project.palette.length>=256){toast('パレットは最大256色です。',true);return;}mutate(()=>state.project.palette.push(state.color));};
$('undo-btn').onclick=undo;$('redo-btn').onclick=redo;
$('grid-btn').onclick=()=>{state.grid=!state.grid;render();};$('onion-btn').onclick=()=>{state.onion=!state.onion;render();};
$('reference-toggle').onclick=()=>{state.reference=!state.reference;render();};$('reference-opacity').oninput=renderEditor;
function zoomBy(d){const current=canvas.width/state.project.width;state.zoom=d<0&&current<=1?null:clamp(d>0?Math.floor(current)+1:Math.ceil(current)-1,1,32);renderEditor();}
$('zoom-in').onclick=()=>zoomBy(1);$('zoom-out').onclick=()=>zoomBy(-1);$('zoom-fit').onclick=()=>{state.zoom=null;renderEditor();$('canvas-scroll').scrollTo(0,0);};
new ResizeObserver(()=>renderEditor()).observe($('canvas-scroll'));
function moveSelection(dx,dy){const r=state.selection;if(!r)return;const {width:w,height:h}=state.project;const nx=clamp(r.x+dx,0,w-r.w),ny=clamp(r.y+dy,0,h-r.h);if(nx===r.x&&ny===r.y)return;mutate(()=>{frame().pixels=transform(frame().pixels,w,h,{dx:nx-r.x,dy:ny-r.y,selection:r});state.selection={...r,x:nx,y:ny};});}
document.querySelectorAll('[data-shift]').forEach(b=>b.onclick=()=>moveSelection(...b.dataset.shift.split(',').map(Number)));
$('clear-selection').onclick=()=>{state.selection=null;renderSelection();renderEditor();};
$('flip-x').onclick=()=>mutate(()=>{frame().pixels=transform(frame().pixels,state.project.width,state.project.height,{flipX:true,selection:state.selection});});
function addFrame(duplicate=false){if(state.project.frames.length>=LIMITS.frames){toast('コマは最大64枚です。',true);return;}mutate(()=>{const f=duplicate?copyFrame(frame()):newFrame(state.project.width,state.project.height,frame().duration);state.project.frames.splice(state.active+1,0,f);state.active++;state.selection=null;});}
$('frame-strip').onclick=e=>{const b=e.target.closest('[data-frame]');if(b)selectFrame(Number(b.dataset.frame));else if(e.target.closest('#add-frame'))addFrame();};
$('duplicate-frame').onclick=()=>addFrame(true);
$('delete-frame').onclick=()=>{if(state.project.frames.length<=1)return;mutate(()=>{state.project.frames.splice(state.active,1);state.active=Math.min(state.active,state.project.frames.length-1);state.selection=null;});};
function reorderFrame(d){const i=state.active,j=i+d;if(j<0||j>=state.project.frames.length)return;mutate(()=>{[state.project.frames[i],state.project.frames[j]]=[state.project.frames[j],state.project.frames[i]];state.active=j;});}
$('frame-left').onclick=()=>reorderFrame(-1);$('frame-right').onclick=()=>reorderFrame(1);
$('frame-duration').onchange=e=>{const value=Number(e.target.value);if(!Number.isFinite(value)||value<20||value>5000){toast('表示時間は20〜5000msにしてください。',true);e.target.value=frame().duration;return;}mutate(()=>frame().duration=Math.round(value));};
function renderPreview(force=false){
  const p=state.project;state.preview=clamp(state.preview,0,p.frames.length-1);
  const i=state.playing?state.preview:state.active;
  if(force||state.lastPreview!==i){putImage($('preview-canvas').getContext('2d'),framePixels(p.frames[i],true),p.width,p.height);state.lastPreview=i;$('preview-frame').textContent=String(i+1).padStart(2,'0')+' / '+String(p.frames.length).padStart(2,'0');document.querySelectorAll('[data-frame]').forEach(b=>b.classList.toggle('previewing',Number(b.dataset.frame)===i));}
}
function animate(time){
  if(state.playing){
    if(!state.previewTime)state.previewTime=time;
    const frames=state.project.frames,total=frames.reduce((sum,f)=>sum+f.duration,0);
    let elapsed=Math.min(time-state.previewTime,total),advanced=false;
    while(elapsed>=frames[state.preview].duration){elapsed-=frames[state.preview].duration;state.preview=(state.preview+1)%frames.length;advanced=true;}
    state.previewTime=time-elapsed;if(advanced)renderPreview(true);
  }
  requestAnimationFrame(animate);
}
function togglePlay(){state.playing=!state.playing;state.preview=state.active;state.previewTime=0;$('play-btn').innerHTML=icons(state.playing?'pause':'play');$('play-btn').setAttribute('aria-label',state.playing?'アニメーションを一時停止':'アニメーションを再生');renderPreview(true);}
$('play-btn').onclick=togglePlay;
let bgIndex=0;$('preview-bg').onclick=()=>{bgIndex=(bgIndex+1)%4;const el=$('preview-stage');el.classList.toggle('checker',bgIndex===0);el.style.background=bgIndex===0?'':['','#fffefa','#252b2d','#c5d2b5'][bgIndex];};
let fpsEditing=false;
$('fps').addEventListener('input',e=>{if(!fpsEditing){pushHistory();fpsEditing=true;}const fps=Number(e.target.value);state.project.frames.forEach(f=>f.duration=Math.round(1000/fps));$('fps-label').textContent=fps+' FPS';renderFrames();renderPreview(true);$('total-duration').textContent=(state.project.frames.reduce((s,f)=>s+f.duration,0)/1000).toFixed(2)+' s';});
$('fps').onchange=()=>{fpsEditing=false;changed();};
function motionOptions(){const t=$('motion-type').value;$('blink-options').hidden=t!=='blink';$('motion-amount').disabled=t==='blink';}
$('motion-type').onchange=motionOptions;
$('generate-motion').onclick=safe(()=>{
  const p=state.project,count=Number($('motion-count').value);
  if(p.frames.length+count>LIMITS.frames)throw new Error('コマは最大64枚です。不要なコマを減らしてください。');
  const frames=motionFrames(frame(),p.width,p.height,$('motion-type').value,count,Number($('motion-amount').value),state.selection,$('blink-color').value);
  mutate(()=>{p.frames.splice(state.active+1,0,...frames);state.active++;state.selection=null;});toast(`${count}コマを追加`);
});
function drawToSource(){const p=state.project,c=document.createElement('canvas');putImage(c.getContext('2d'),p.frames[0].pixels,p.width,p.height);state.source=[{bitmap:c,name:p.name,width:p.width,height:p.height}];renderSource();}
$('action-btn').onclick=()=>{
  $('action-source-info').textContent=`現在の素材：${state.project.frames.length}コマ · ${state.project.width}×${state.project.height}px`;
  $('action-status').textContent='';
  $('action-dialog').showModal();
};
$('create-action').onclick=safe(async()=>{
  const button=$('create-action');button.disabled=true;button.textContent='生成中…';
  try{
    await new Promise(r=>requestAnimationFrame(r));
    const project=createActionProject(state.project,{intensity:Number($('action-intensity').value),scene:$('action-scene').value,effects:$('action-effects').checked,ghosts:$('action-ghosts').checked,camera:$('action-camera').checked,beam:$('action-beam').checked});
    mutate(()=>{state.project=project;state.active=0;state.preview=0;state.previewTime=0;state.selection=null;state.cursor=null;state.zoom=null;state.reference=false;});
    $('action-dialog').close();selectMobileView('editor');toast(`${project.frames.length}コマを生成`);
  }catch(e){$('action-status').textContent=e.message;throw e;}
  finally{button.disabled=false;button.textContent='戦闘シーンを作成';}
});
$('action-example').onclick=safe(async()=>{
  const button=$('action-example');button.disabled=true;button.textContent='読込中…';
  try{
    const response=await fetch('./assets/surf-strike.poses.json');if(!response.ok)throw new Error('サンプルを読み込めませんでした。再度お試しください。');
    const source=parseProject(await response.json());
    if(source.width!==128||source.height!==128||source.frames.length!==16)throw new Error('サンプルの形式を確認できませんでした。');
    const project=createActionProject(source,{intensity:3,scene:'beach',effects:true,beam:false,ghosts:false,camera:true});project.name='SURF STRIKE';
    mutate(()=>{state.project=project;state.active=28;state.preview=0;state.previewTime=0;state.zoom=null;state.selection=null;state.cursor=null;state.reference=false;});
    drawToSource();scheduleSave();selectMobileView('editor');toast('サンプルを開きました');
  }finally{button.disabled=false;button.textContent='サンプル（64コマ）';}
});
function renderSource(){
  const s=state.source[0];if(!s)return;const c=$('source-thumb');c.width=80;c.height=80;const cx=c.getContext('2d');cx.clearRect(0,0,80,80);cx.imageSmoothingEnabled=false;const a=Math.min(80/s.bitmap.width,80/s.bitmap.height);cx.drawImage(s.bitmap,(80-s.bitmap.width*a)/2,(80-s.bitmap.height*a)/2,s.bitmap.width*a,s.bitmap.height*a);
  $('source-name').textContent=s.name;$('source-info').textContent=`${s.width} × ${s.height} px${state.source.length>1?' · '+state.source.length+' 枚':''}`;
  $('reference-image').src=s.bitmap.toDataURL('image/png');
  if(state.reference)renderEditor();
}
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('画像を読み込めませんでした。PNG / JPG / WebP を使用してください。'));image.src=url;});}
async function imageAsset(file,maxSide=2048){
  if(file.size>LIMITS.fileBytes)throw new Error('画像は1枚32MBまでです。');
  if(!/^image\/(png|jpeg|webp|bmp|x-ms-bmp)$/.test(file.type))throw new Error('PNG / JPG / WebP / BMP の画像を選んでください。');
  // data: images work on static hosts whose img-src policy excludes blob: URLs.
  const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('画像ファイルを読み取れませんでした。'));reader.readAsDataURL(file);});
  const image=await loadImage(url);if(image.naturalWidth*image.naturalHeight>25000000)throw new Error('画像が大きすぎます。2500万画素以下に縮小してください。');
    const c=document.createElement('canvas'),scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));c.width=Math.max(1,Math.round(image.naturalWidth*scale));c.height=Math.max(1,Math.round(image.naturalHeight*scale));c.getContext('2d').drawImage(image,0,0,c.width,c.height);
    return {bitmap:c,name:file.name,width:image.naturalWidth,height:image.naturalHeight};
}
async function importFiles(files){
  const list=[...files].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));if(!list.length)return;
  if(list.length>LIMITS.frames)throw new Error('一度に読み込める画像は64枚までです。');if(list.reduce((s,f)=>s+f.size,0)>128*1024*1024)throw new Error('画像の合計は128MBまでです。');
  setSaveState('読込中…',true);const assets=[],maxSide=Math.min(2048,Math.floor(Math.sqrt(8*1024*1024/list.length)));for(const file of list)assets.push(await imageAsset(file,maxSide));
  state.source=assets;renderSource();scheduleSave();toast(list.length>1?`${list.length}枚を読み込み`:'画像を読み込みました');
}
$('import-image').onclick=()=>$('image-input').click();$('image-input').onchange=safe(async e=>{try{await importFiles(e.target.files);}finally{e.target.value='';}});
const dropzone=$('import-image');['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag-over');}));['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag-over');}));dropzone.addEventListener('drop',safe(async e=>importFiles(e.dataTransfer.files)));
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
$('resolution').onchange=()=>{const v=$('resolution').value;$('custom-size').hidden=v!=='custom';$('resolution-label').textContent=v==='custom'?'CUSTOM':`${v} × ${v}`;};
$('color-count').oninput=e=>$('color-count-label').textContent=e.target.value+' 色';
for(const id of ['contrast','saturation'])$(id).oninput=e=>$(id+'-value').textContent=e.target.value;
function updateEngineControls(){const stylize=$('conversion-engine').value==='pixel-art';$('pixel-style').disabled=!stylize;$('sampling').disabled=stylize;}
$('conversion-engine').onchange=updateEngineControls;updateEngineControls();
$('convert-btn').onclick=safe(async()=>{
  if(!state.source.length)throw new Error('最初に元画像を読み込んでください。');
  const v=$('resolution').value,w=Number(v==='custom'?$('custom-width').value:v),h=Number(v==='custom'?$('custom-height').value:v);
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>256||h>256)throw new Error('幅・高さは1〜256pxの整数で指定してください。');
  $('convert-btn').disabled=true;$('convert-btn').textContent='変換中…';
  try{
    await new Promise(r=>requestAnimationFrame(r));
    let sources=state.source.map(s=>s.bitmap);
    if($('split-sheet').checked){
      if(sources.length!==1)throw new Error('シート分割には1枚の画像を読み込んでください。');
      const cols=Number($('sheet-import-cols').value),rows=Number($('sheet-import-rows').value),count=Number($('sheet-import-count').value),sheet=sources[0];
      if($('sheet-extract').value==='alpha'){
        const data=sheet.getContext('2d').getImageData(0,0,sheet.width,sheet.height).data,rects=spriteBounds(data,sheet.width,sheet.height,cols,rows,count);
        const side=Math.ceil(Math.max(...rects.map(r=>Math.max(r.width/.8,r.height/.74))));
        sources=rects.map(r=>{const c=document.createElement('canvas');putImage(c.getContext('2d'),extractSprite(data,sheet.width,sheet.height,r,side),side,side);return c;});
      }else sources=sheetRects(sheet.width,sheet.height,cols,rows,count).map(r=>{const c=document.createElement('canvas');c.width=r.width;c.height=r.height;c.getContext('2d').drawImage(sheet,r.x,r.y,r.width,r.height,0,0,r.width,r.height);return c;});
    }
    const stylize=$('conversion-engine').value==='pixel-art',work=stylize?workSize(w,h,sources.length):{width:w,height:h};
    const sourceName=state.source[0].name;
    const buffers=sources.map(image=>{
      const c=document.createElement('canvas');c.width=work.width;c.height=work.height;const cx=c.getContext('2d');cx.imageSmoothingEnabled=stylize||$('sampling').value!=='nearest';cx.imageSmoothingQuality='high';
      const mode=$('image-fit').value;
      if(mode==='stretch')cx.drawImage(image,0,0,work.width,work.height);else{const scale=(mode==='cover'?Math.max:Math.min)(work.width/image.width,work.height/image.height);cx.drawImage(image,(work.width-image.width*scale)/2,(work.height-image.height*scale)/2,image.width*scale,image.height*scale);}
      let data=cx.getImageData(0,0,work.width,work.height).data;
      if($('remove-bg').checked)data=removeBackground(data,work.width,work.height,Number($('bg-tolerance').value));
      return adjustColors(data,Number($('contrast').value),Number($('saturation').value));
    });
    const mode=$('palette-mode').value,fixed=mode==='auto'?null:[...PALETTES[mode]];
    let palette,pixels;
    if(stylize){
      let worker,timer;
      try{
        const result=await new Promise((resolve,reject)=>{
          worker=new Worker(new URL('./pixel-worker.js',import.meta.url),{type:'module'});
          timer=setTimeout(()=>reject(new Error('ドット絵への変換に時間がかかっています。サイズやコマ数を下げてください。')),90000);
          worker.onmessage=({data})=>{if(data.error)reject(new Error(data.error));else if(data.result)resolve(data.result);else if(data.progress){const {current,total,phase}=data.progress;$('convert-btn').textContent=`${phase==='prepare'?'輪郭・陰影を整理':'ドットを仕上げ'}… ${current}/${total}`;}};
          worker.onerror=()=>reject(new Error('変換エンジンを読み込めませんでした。ページを開き直してください。'));
          worker.postMessage({sources:buffers.map(data=>({...work,data})),settings:{width:w,height:h,colors:Number($('color-count').value),palette:fixed,style:$('pixel-style').value,dither:$('dither').value}},buffers.map(p=>p.buffer));
        });
        palette=result.palette;pixels=result.buffers;
      }finally{clearTimeout(timer);worker?.terminate();}
    }else{palette=fixed||makePalette(buffers,Number($('color-count').value));pixels=buffers.map(p=>quantize(p,w,h,palette,$('dither').value));}
    const frames=pixels.map(p=>({pixels:p,duration:125}));
    mutate(()=>{state.project={name:sourceName.replace(/\.[^.]+$/,'').slice(0,80),width:w,height:h,palette,frames};state.active=0;state.preview=0;state.selection=null;state.cursor=null;state.zoom=null;});
    selectMobileView('editor');toast(`${w}×${h}px · ${palette.length}色 · ${frames.length}コマ`);
  }finally{$('convert-btn').disabled=false;$('convert-btn').innerHTML=icons('spark')+'ドット絵に変換'+icons('arrow');}
});
$('project-name').onchange=e=>{const name=e.target.value.trim()||'無題のスプライト';mutate(()=>state.project.name=name);};
function filename(s){return s.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)||'sprite';}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function saveProject(){download(new Blob([JSON.stringify(serializeProject(state.project))],{type:'application/json'}),filename(state.project.name)+'.dotflip.json');toast('JSONを保存しました');}
$('save-project').onclick=saveProject;$('open-project').onclick=()=>$('project-input').click();
$('project-input').onchange=safe(async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>LIMITS.fileBytes)throw new Error('プロジェクトは32MBまでです。');let data;try{data=JSON.parse(await file.text());}catch{throw new Error('JSONファイルを読み込めません。');}
    const project=parseProject(data);mutate(()=>{state.project=project;state.active=0;state.preview=0;state.zoom=null;state.selection=null;state.cursor=null;});drawToSource();scheduleSave();selectMobileView('editor');toast('プロジェクトを開きました。');
  }finally{e.target.value='';}
});
$('new-project').onclick=()=>$('new-dialog').showModal();
$('create-project').onclick=safe(()=>{const w=Number($('new-width').value),h=Number($('new-height').value);if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>256||h>256)throw new Error('大きさは1〜256pxの整数にしてください。');mutate(()=>{state.project={name:$('new-name').value.trim()||'無題のスプライト',width:w,height:h,palette:[...PALETTES.forest],frames:[newFrame(w,h)]};state.active=0;state.preview=0;state.selection=null;state.cursor=null;state.zoom=null;});drawToSource();scheduleSave();$('new-dialog').close();selectMobileView('editor');toast('作成しました');});
$('demo-btn').onclick=()=>{pushHistory();state.project=createDemo();state.active=0;state.preview=0;state.zoom=null;state.selection=null;state.cursor=null;state.sample=true;drawToSource();render();scheduleSave();selectMobileView('editor');toast('サンプルを開きました');};
$('help-btn').onclick=()=>{$('ai-guide-dialog').close();$('help-dialog').showModal();};
$('reference-btn').onclick=()=>$('reference-dialog').showModal();
function openAiGuide(){$('help-dialog').close();$('prompt-dialog').close();if(!$('ai-guide-dialog').open)$('ai-guide-dialog').showModal();}
$('ai-guide-btn').onclick=openAiGuide;
$('prompt-help').onclick=openAiGuide;
function openPromptExamples(){$('ai-guide-dialog').close();$('help-dialog').close();$('prompt-dialog').showModal();}
$('ai-guide-prompts').onclick=openPromptExamples;
$('guide-prompts').onclick=openPromptExamples;
$('copy-ai-guide').onclick=async()=>{
  const body=[...$('ai-workflow').children].map(node=>node.matches('ol')?[...node.children].map((item,index)=>`${index+1}. ${item.innerText}`).join('\n\n'):node.innerText).join('\n\n');
  const text=`DOTFLIP Studio AI用手順\n${new URL('./#ai-guide',location.href).href}\n\n${body}`;
  const input=$('ai-guide-copy-text');input.value=text;input.hidden=false;input.focus();input.select();
  try{await navigator.clipboard.writeText(text);$('ai-guide-copy-status').textContent='コピーしました';}
  catch{$('ai-guide-copy-status').textContent='手順全文を選択しました。コピーしてください。';}
};
function openLinkedGuide(){if(location.hash==='#ai-guide')openAiGuide();}
window.addEventListener('hashchange',openLinkedGuide);openLinkedGuide();
PROMPT_EXAMPLES.forEach(({title,text},index)=>{
  const card=document.createElement('article');card.className='prompt-card';
  const heading=document.createElement('h3');heading.textContent=title;
  const input=document.createElement('textarea');input.value=text;input.readOnly=true;input.setAttribute('aria-label',title+'の指示文');
  const button=document.createElement('button');button.className='secondary';button.id='copy-prompt-'+index;button.textContent='コピー';
  button.onclick=async()=>{
    try{await navigator.clipboard.writeText(text);$('prompt-copy-status').textContent='コピーしました';}
    catch{input.focus();input.select();$('prompt-copy-status').textContent='選択しました。コピーしてください';}
  };
  card.append(heading,input,button);$('prompt-examples').append(card);
});
if(mobileLayout.matches)$('export-scale').value='2';
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function renderExportPreview(){const p=state.project,c=$('export-preview'),output=renderOutput(framePixels(frame(),!$('scene-option').hidden&&$('export-scene').checked),p.width,p.height,1,$('export-background').value);c.width=p.width;c.height=p.height;c.getContext('2d').drawImage(output,0,0);}
$('export-btn').onclick=()=>{const p=state.project,hasScene=p.frames.some(f=>f.scenePixels);$('export-name').textContent=p.name;$('export-info').textContent=`${p.width} × ${p.height} PX · ${p.frames.length} FRAMES`;$('sheet-columns').value=Math.min(8,p.frames.length);$('scene-option').hidden=!hasScene;$('export-scene').checked=false;if(hasScene)$('export-background').value='transparent';$('export-status').textContent='';renderExportPreview();$('export-dialog').showModal();};
$('export-scene').onchange=renderExportPreview;$('export-background').onchange=renderExportPreview;
function exportSettings(){return {scale:Number($('export-scale').value),background:$('export-background').value,columns:clamp(Math.round(Number($('sheet-columns').value)||1),1,state.project.frames.length),includeScene:!$('scene-option').hidden&&$('export-scene').checked};}
function renderOutput(p,w,h,scale,bg){const c=document.createElement('canvas');c.width=w*scale;c.height=h*scale;const cx=c.getContext('2d');if(bg!=='transparent'){cx.fillStyle=bg;cx.fillRect(0,0,c.width,c.height);}const temp=document.createElement('canvas');putImage(temp.getContext('2d'),p,w,h);cx.imageSmoothingEnabled=false;cx.drawImage(temp,0,0,c.width,c.height);return c;}
async function pngBlob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNGを作成できませんでした。')),'image/png'));}
$('export-png').onclick=safe(async()=>{const p=state.project,{scale,background,includeScene}=exportSettings();download(await pngBlob(renderOutput(framePixels(frame(),includeScene),p.width,p.height,scale,background)),filename(p.name)+`-${String(state.active+1).padStart(2,'0')}.png`);$('export-status').textContent='PNGを保存しました';});
$('export-sheet').onclick=safe(async()=>{
  const p=state.project,{scale,background,columns,includeScene}=exportSettings(),meta=sheetMetadata(p,scale,columns);
  const maxSide=16384;if(meta.size.width>maxSide||meta.size.height>maxSide||meta.size.width*meta.size.height>32000000)throw new Error('シートが大きすぎます。倍率を下げるか列数を調整してください。');
  const c=document.createElement('canvas');c.width=meta.size.width;c.height=meta.size.height;const cx=c.getContext('2d');
  p.frames.forEach((f,i)=>{const r=meta.frames[i].rect;cx.drawImage(renderOutput(framePixels(f,includeScene),p.width,p.height,scale,background),r.x,r.y);});
  const name=filename(p.name);meta.image=name+'.sheet.png';const png=await pngBlob(c);const zip=zipFiles([{name:name+'.sheet.png',data:await png.arrayBuffer()},{name:name+'.sheet.json',data:JSON.stringify(meta,null,2)}]);download(new Blob([zip],{type:'application/zip'}),name+'.spritesheet.zip');$('export-status').textContent='PNG＋JSONを保存しました';
});
let exporting=false;
$('export-gif').onclick=safe(async()=>{
  if(exporting)return;const {scale,background,includeScene}=exportSettings(),p=projectForExport(state.project,includeScene);
  if(p.width*p.height*scale*scale*p.frames.length>48000000)throw new Error('GIFが大きすぎます。出力倍率を下げてください。');
  exporting=true;$('export-gif').disabled=true;$('export-status').classList.add('busy');$('export-status').textContent='GIF出力中…';
  let worker,timer;try{
    const bytes=await new Promise((resolve,reject)=>{worker=new Worker(new URL('./gif-worker.js',import.meta.url),{type:'module'});timer=setTimeout(()=>reject(new Error('GIF生成が時間内に完了しませんでした。倍率やコマ数を下げてください。')),60000);worker.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data.bytes);worker.onerror=()=>reject(new Error('GIF出力を開始できません。ブラウザを更新して再度お試しください。'));worker.postMessage({project:p,scale,background});});
    download(new Blob([bytes],{type:'image/gif'}),filename(p.name)+'.gif');$('export-status').textContent='GIFを保存しました';
  }catch(e){$('export-status').textContent=e.message;throw e;}finally{clearTimeout(timer);worker?.terminate();exporting=false;$('export-gif').disabled=false;$('export-status').classList.remove('busy');}
});
document.addEventListener('keydown',e=>{
  const el=document.activeElement;
  if(document.querySelector('dialog[open]'))return;
  if(el?.matches('input,select,textarea')||el?.isContentEditable)return;
  const ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
  if(ctrl&&key==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(ctrl&&key==='y'){e.preventDefault();redo();return;}
  if(ctrl&&key==='d'){e.preventDefault();addFrame(true);return;}
  if(ctrl&&key==='s'){e.preventDefault();saveProject();return;}
  if(ctrl)return;
  const tools={b:'pencil',e:'eraser',f:'fill',i:'picker',m:'select',l:'line',r:'rect',h:'pan'};
  if(tools[key]){e.preventDefault();selectTool(tools[key]);return;}
  if(key==='g'){$('grid-btn').click();return;}if(key==='o'){$('onion-btn').click();return;}if(key==='t'){$('reference-toggle').click();return;}
  if(key===' '){e.preventDefault();togglePlay();return;}
  if(key==='escape'){state.selection=null;state.cursor=null;render();return;}
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
    e.preventDefault();const dx=key==='arrowleft'?-1:key==='arrowright'?1:0,dy=key==='arrowup'?-1:key==='arrowdown'?1:0;
    if(state.selection){moveSelection(dx,dy);return;}
    if(el===canvas){state.cursor={x:clamp((state.cursor?.x??0)+dx,0,state.project.width-1),y:clamp((state.cursor?.y??0)+dy,0,state.project.height-1)};showPosition(state.cursor);renderEditor();return;}
    if(dx)selectFrame(state.active+dx);return;
  }
  if(key==='enter'&&el===canvas&&state.cursor&&state.tool!=='pan'){e.preventDefault();const pt=state.cursor;pushHistory();if(state.tool==='fill')floodFill(frame().pixels,state.project.width,state.project.height,pt.x,pt.y,rgba(state.color),state.selection);else if(state.tool==='picker'){const i=(pt.y*state.project.width+pt.x)*4;if(frame().pixels[i+3])chooseColor(hex(frame().pixels.slice(i,i+4)));}else drawStroke(pt,pt,state.tool==='eraser');changed();return;}
  if((key==='delete'||key==='backspace')&&state.selection){e.preventDefault();mutate(()=>clearRegion(frame().pixels,state.project.width,state.project.height,state.selection));return;}
  if(key==='+'||key==='='){e.preventDefault();zoomBy(1);}if(key==='-'){e.preventDefault();zoomBy(-1);}
});
async function init(){
  drawToSource();render();requestAnimationFrame(animate);
  try{
    const record=await readSaved();if(!record)return;
    state.project=parseProject(record.project);state.active=clamp(record.active||0,0,state.project.frames.length-1);state.sample=!!record.sample;state.history=[];state.redo=[];
    drawToSource();
    if(record.source?.url?.startsWith('data:image/png;base64,')){
      try{const image=await loadImage(record.source.url);const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);state.source=[{bitmap:c,name:String(record.source.name),width:record.source.width,height:record.source.height}];renderSource();}catch(e){console.warn('Source restore failed',e);}
    }
    render();selectMobileView('editor');setSaveState('復元済み');
  }catch(e){console.warn('Workspace restore unavailable',e);setSaveState('自動保存不可 · 保存ボタンへ',true);}
}
init();
