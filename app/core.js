export const LIMITS = Object.freeze({ size: 256, frames: 64, fileBytes: 32 * 1024 * 1024, duration: 5000 });
export const PALETTES = {
  forest: ['#202735','#394754','#506b63','#719378','#a7bd8c','#d3dcb0','#f3e9d2','#ffcc86','#eaa15c','#c97643','#954832','#623a35','#e8b49b','#bc6a72','#735b82','#b69bb4'],
  endesga: ['#e4a672','#b86f50','#743f39','#3f2832','#9e2835','#e53b44','#fb922b','#ffe762','#63c64d','#327345','#193d3f','#4f6781','#afbfd2','#ffffff','#2ce8f4','#0484d1'],
  gameboy: ['#0f380f','#306230','#8bac0f','#9bbc0f']
};
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const rgba = hex => {
  const s = hex.replace('#','');
  if (!/^[\da-f]{6}$/i.test(s)) return [0,0,0,255];
  return [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16),255];
};
export const hex = c => '#' + Array.from(c).slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
export function newFrame(w,h,duration=125) { return { pixels: new Uint8ClampedArray(w*h*4), duration }; }
export function copyFrame(f) { return { pixels: new Uint8ClampedArray(f.pixels), duration: f.duration }; }
export function cloneProject(p) { return { ...p, palette: [...p.palette], frames: p.frames.map(copyFrame) }; }
export function setPixel(pixels,w,h,x,y,color,size=1,selection=null) {
  const off = Math.floor((size-1)/2);
  for (let dy=0;dy<size;dy++) for(let dx=0;dx<size;dx++) {
    const px=x+dx-off,py=y+dy-off;
    if(px<0||py<0||px>=w||py>=h) continue;
    if(selection && (px<selection.x||py<selection.y||px>=selection.x+selection.w||py>=selection.y+selection.h)) continue;
    pixels.set(color,(py*w+px)*4);
  }
}
export function line(p,w,h,x0,y0,x1,y1,c,size=1,selection=null) {
  let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx+dy;
  for(;;) {
    setPixel(p,w,h,x0,y0,c,size,selection);
    if(x0===x1&&y0===y1) break;
    const e=2*err;
    if(e>=dy){err+=dy;x0+=sx;} if(e<=dx){err+=dx;y0+=sy;}
  }
}
export function floodFill(p,w,h,x,y,c,selection=null) {
  if(x<0||y<0||x>=w||y>=h) return;
  const i=(y*w+x)*4, target=Array.from(p.slice(i,i+4));
  if(target.every((v,k)=>v===c[k])) return;
  const seen=new Uint8Array(w*h),queue=[y*w+x];
  for(let head=0;head<queue.length;head++) {
    const q=queue[head],px=q%w,py=Math.floor(q/w),o=q*4;
    if(seen[q]) continue; seen[q]=1;
    if(selection&&(px<selection.x||py<selection.y||px>=selection.x+selection.w||py>=selection.y+selection.h)) continue;
    if(!target.every((v,k)=>v===p[o+k])) continue;
    p.set(c,o);
    if(px>0)queue.push(q-1);if(px<w-1)queue.push(q+1);if(py>0)queue.push(q-w);if(py<h-1)queue.push(q+w);
  }
}
export function clearRegion(p,w,h,r) {
  for(let y=r.y;y<r.y+r.h;y++) for(let x=r.x;x<r.x+r.w;x++) if(x>=0&&y>=0&&x<w&&y<h) p.fill(0,(y*w+x)*4,(y*w+x)*4+4);
}
export function transform(p,w,h,{dx=0,dy=0,flipX=false,flipY=false,selection=null}={}) {
  const r=selection||{x:0,y:0,w,h},out=new Uint8ClampedArray(p);
  clearRegion(out,w,h,r);
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++) {
    const sx=r.x+x,sy=r.y+y;
    if(sx<0||sy<0||sx>=w||sy>=h)continue;
    const tx=r.x+(flipX?r.w-1-x:x)+dx,ty=r.y+(flipY?r.h-1-y:y)+dy;
    if(tx<0||ty<0||tx>=w||ty>=h)continue;
    const i=(sy*w+sx)*4;
    if(p[i+3]) out.set(p.subarray(i,i+4),(ty*w+tx)*4);
  }
  return out;
}
export function resizeNearest(p,sw,sh,w,h) {
  const out=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const sx=Math.min(sw-1,Math.floor(x*sw/w)),sy=Math.min(sh-1,Math.floor(y*sh/h));
    out.set(p.subarray((sy*sw+sx)*4,(sy*sw+sx)*4+4),(y*w+x)*4);
  }
  return out;
}
// Edge-connected color-key removal: unlike deleting every near-white pixel, highlights remain intact.
export function removeBackground(p,w,h,tolerance=32) {
  const out=new Uint8ClampedArray(p),corners=[0,(w-1)*4,(h-1)*w*4,(w*h-1)*4];
  let colors=corners.filter(i=>p[i+3]>=128).map(i=>Array.from(p.subarray(i,i+3)));
  if(!colors.length){
    // Contain-fit may add transparent letterboxing around an otherwise solid background.
    let x0=w,y0=h,x1=-1,y1=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(x1<x0||y1<y0)return out;
    if(x1===x0||y1===y0||!((x0===0&&x1===w-1)||(y0===0&&y1===h-1)))return out;
    const boundCorners=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(([x,y])=>(y*w+x)*4);
    if(boundCorners.every(i=>p[i+3]>=128)){
      const samples=boundCorners.map(i=>Array.from(p.subarray(i,i+3)));
      if(samples.every(c=>Math.hypot(...c.map((v,k)=>v-samples[0][k]))<=tolerance))colors=samples;
    }
    if(!colors.length)return out;
  }
  const visited=new Uint8Array(w*h),queue=[];
  for(let x=0;x<w;x++){queue.push(x);queue.push((h-1)*w+x);}
  for(let y=0;y<h;y++){queue.push(y*w);queue.push(y*w+w-1);}
  for(let head=0;head<queue.length;head++) {
    const q=queue[head];if(visited[q])continue;visited[q]=1;
    const i=q*4;
    if(p[i+3]!==0 && !colors.some(c=>Math.hypot(c[0]-p[i],c[1]-p[i+1],c[2]-p[i+2])<=tolerance))continue;
    out.fill(0,i,i+4);const x=q%w,y=Math.floor(q/w);
    if(x)queue.push(q-1);if(x<w-1)queue.push(q+1);if(y)queue.push(q-w);if(y<h-1)queue.push(q+w);
  }
  return out;
}
export function adjustColors(p,contrast=0,saturation=0,alphaThreshold=128) {
  const out=new Uint8ClampedArray(p),factor=(259*(contrast+255))/(255*(259-contrast)),sat=1+saturation/100;
  for(let i=0;i<out.length;i+=4) {
    if(out[i+3]<alphaThreshold){out.fill(0,i,i+4);continue;}
    let r=factor*(out[i]-128)+128,g=factor*(out[i+1]-128)+128,b=factor*(out[i+2]-128)+128;
    const l=.2126*r+.7152*g+.0722*b;
    out[i]=l+(r-l)*sat;out[i+1]=l+(g-l)*sat;out[i+2]=l+(b-l)*sat;out[i+3]=255;
  }
  return out;
}
// Weighted median cut, shared across every frame to avoid palette flicker.
export function makePalette(buffers,maxColors=24) {
  const exact=new Set();
  outer:for(const p of buffers)for(let i=0;i<p.length;i+=4){if(p[i+3]<128)continue;exact.add((p[i]<<16)|(p[i+1]<<8)|p[i+2]);if(exact.size>maxColors)break outer;}
  if(exact.size&&exact.size<=maxColors)return [...exact].sort((a,b)=>a-b).map(c=>'#'+c.toString(16).padStart(6,'0'));
  const histogram=new Map();
  for(const p of buffers)for(let i=0;i<p.length;i+=4) {
    if(p[i+3]<128)continue;
    const key=((p[i]>>3)<<10)|((p[i+1]>>3)<<5)|(p[i+2]>>3);
    let v=histogram.get(key);
    if(!v){v=[0,0,0,0];histogram.set(key,v);}
    v[0]+=p[i];v[1]+=p[i+1];v[2]+=p[i+2];v[3]++;
  }
  const points=[...histogram.values()].map(v=>[v[0]/v[3],v[1]/v[3],v[2]/v[3],v[3]]);
  if(!points.length)return ['#202735'];
  const boxes=[points];
  const measure=box=>{
    const min=[255,255,255],max=[0,0,0];let count=0;
    for(const p of box){count+=p[3];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}
    const ranges=max.map((v,k)=>v-min[k]);const axis=ranges.indexOf(Math.max(...ranges));
    return {axis,score:ranges[axis]*Math.sqrt(count)};
  };
  while(boxes.length<maxColors){
    let best=-1,score=-1,axis=0;
    boxes.forEach((b,i)=>{if(b.length<2)return;const m=measure(b);if(m.score>score){best=i;score=m.score;axis=m.axis;}});
    if(best<0)break;
    const box=boxes[best].sort((a,b)=>a[axis]-b[axis]);
    const count=box.reduce((s,p)=>s+p[3],0);let partial=0,split=box.length-1;
    for(let j=0;j<box.length-1;j++){partial+=box[j][3];if(partial>=count/2){split=j+1;break;}}
    boxes.splice(best,1,box.slice(0,split),box.slice(split));
  }
  return [...new Set(boxes.map(b=>{const n=b.reduce((s,p)=>s+p[3],0);return hex([0,1,2].map(k=>Math.round(b.reduce((s,p)=>s+p[k]*p[3],0)/n)));}))]
    .sort((a,b)=>{const l=c=>{const v=rgba(c);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};return l(a)-l(b);});
}
export function quantize(p,w,h,palette,dither='none') {
  const colors=palette.map(rgba),out=new Uint8ClampedArray(p),work=new Float32Array(p);
  const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const nearest=(r,g,b)=>{
    let best=colors[0],dist=Infinity;
    for(const c of colors){const d=(r-c[0])**2*.3+(g-c[1])**2*.59+(b-c[2])**2*.11;if(d<dist){dist=d;best=c;}}
    return best;
  };
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const i=(y*w+x)*4;if(p[i+3]<128){out.fill(0,i,i+4);continue;}
    const n=dither==='ordered'?(bayer[(y%4)*4+x%4]-7.5)*3:0;
    const c=nearest(work[i]+n,work[i+1]+n,work[i+2]+n);out.set(c,i);
    if(dither==='floyd') {
      for(const [dx,dy,f] of [[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]]) {
        const px=x+dx,py=y+dy;if(px<0||py>=h||px>=w)continue;
        const j=(py*w+px)*4;if(p[j+3]<128)continue;
        for(let k=0;k<3;k++)work[j+k]+=(work[i+k]-c[k])*f;
      }
    }
  }
  return out;
}
export function motionFrames(frame,w,h,type,count=8,amount=2,selection=null,fillColor='#f3c4a3') {
  if(!Number.isInteger(count)||count<2||count>LIMITS.frames)throw new Error('コマ数は2〜64にしてください。');
  if((type==='blink'||type==='sway')&&!selection)throw new Error('動かしたい範囲を「選択」ツールで囲んでください。');
  const result=[];
  for(let i=0;i<count;i++) {
    const t=i/count*Math.PI*2;
    let p;
    if(type==='blink') {
      p=new Uint8ClampedArray(frame.pixels);
      const phase=i/count,closed=phase>=.5&&phase<.5+Math.max(1/count,.12);
      if(closed){
        const r=selection;const color=rgba(fillColor);
        for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)setPixel(p,w,h,x,y,color);
        // Keep the original darkest eye pixels as a thin closed-eyelid line.
        const eyelidY=r.y+Math.floor(r.h*.6);
        for(let x=r.x;x<r.x+r.w;x++){
          let darkest=null,lum=Infinity;
          for(let y=r.y;y<r.y+r.h;y++){
            const o=(y*w+x)*4;if(frame.pixels[o+3]<128)continue;
            const c=frame.pixels.subarray(o,o+4),l=c[0]+c[1]+c[2];
            if(l<lum){lum=l;darkest=c;}
          }
          if(darkest&&lum<color[0]+color[1]+color[2]-80)setPixel(p,w,h,x,eyelidY,darkest);
        }
      }
    } else {
      const dx=type==='sway'?Math.round(Math.sin(t)*amount):0;
      const dy=type==='float'?Math.round(-Math.sin(t)*amount):type==='bounce'?-Math.round(Math.abs(Math.sin(t))*amount):0;
      p=transform(frame.pixels,w,h,{dx,dy,selection:type==='sway'?selection:null});
    }
    result.push({pixels:p,duration:frame.duration});
  }
  return result;
}
function encodeBytes(p) {
  let s='';for(let i=0;i<p.length;i+=8192)s+=String.fromCharCode(...p.subarray(i,i+8192));return btoa(s);
}
function decodeBytes(s) { const raw=atob(s);return Uint8ClampedArray.from(raw,c=>c.charCodeAt(0)); }
export function serializeProject(p) {
  return { format:'dotflip', version:1, name:p.name, width:p.width, height:p.height, palette:p.palette, frames:p.frames.map(f=>({duration:f.duration,rgba:encodeBytes(f.pixels)})) };
}
export function parseProject(data) {
  if(!data||data.format!=='dotflip'||data.version!==1)throw new Error('対応するDOTFLIPプロジェクトではありません。');
  const {width:w,height:h}=data;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>LIMITS.size||h>LIMITS.size)throw new Error('キャンバスの大きさが不正です（最大256px）。');
  if(!Array.isArray(data.frames)||!data.frames.length||data.frames.length>LIMITS.frames)throw new Error('コマ数が不正です（最大64コマ）。');
  if(!Array.isArray(data.palette)||data.palette.length>256||data.palette.some(c=>!/^#[\da-f]{6}$/i.test(c)))throw new Error('パレットが不正です。');
  const frames=data.frames.map(f=>{
    if(typeof f.rgba!=='string'||f.rgba.length!==Math.ceil(w*h*4/3)*4)throw new Error('ピクセルデータの長さが不正です。');
    let pixels;try{pixels=decodeBytes(f.rgba);}catch{throw new Error('ピクセルデータを読み込めません。');}
    if(pixels.length!==w*h*4)throw new Error('ピクセルデータが壊れています。');
    if(!Number.isFinite(f.duration)||f.duration<20||f.duration>LIMITS.duration)throw new Error('コマの表示時間が不正です。');
    return {pixels,duration:Math.round(f.duration)};
  });
  return {name:String(data.name||'無題のスプライト').slice(0,80),width:w,height:h,palette:[...data.palette],frames};
}
export function indexedPixels(p,palette) {
  const colors=palette.map(rgba),map=new Map(colors.map((c,i)=>[c.slice(0,3).join(','),i+1]));
  const out=new Uint8Array(p.length/4);
  for(let i=0;i<p.length;i+=4) {
    if(p[i+3]<128)continue;
    const key=p.subarray(i,i+3).join(',');let index=map.get(key);
    if(index===undefined){let d=Infinity;index=1;colors.forEach((c,j)=>{const dist=(p[i]-c[0])**2+(p[i+1]-c[1])**2+(p[i+2]-c[2])**2;if(dist<d){d=dist;index=j+1;}});map.set(key,index);}
    out[i/4]=index;
  }
  return out;
}
