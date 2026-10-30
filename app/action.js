import { LIMITS, clamp, newFrame, line, rgba, makePalette, quantize } from './core.js';

// Boundaries cover the source exactly, including AI sheets whose size is not divisible by the grid.
export function sheetRects(width, height, columns, rows, count = columns * rows) {
  if (![width, height, columns, rows, count].every(Number.isInteger) || columns < 1 || rows < 1 || count < 1 || count > LIMITS.frames || count > columns * rows || columns > width || rows > height) throw new Error('シートの分割数と使用するコマ数を確認してください（最大64コマ）。');
  return Array.from({length: count}, (_, i) => {
    const column = i % columns, row = Math.floor(i / columns);
    const x = Math.floor(column * width / columns), y = Math.floor(row * height / rows);
    return {x, y, width: Math.floor((column + 1) * width / columns) - x, height: Math.floor((row + 1) * height / rows) - y};
  });
}

// AI sprite sheets often cross nominal cell boundaries. Find substantial alpha-connected figures instead.
export function spriteBounds(pixels,width,height,columns,rows,count) {
  sheetRects(width,height,columns,rows,count);
  const seen=new Uint8Array(width*height),queue=new Int32Array(width*height),parts=[];
  for(let start=0;start<seen.length;start++) {
    if(seen[start]||pixels[start*4+3]<128)continue;
    let head=0,tail=1,minX=width,minY=height,maxX=0,maxY=0;queue[0]=start;seen[start]=1;
    while(head<tail) {
      const at=queue[head++],x=at%width,y=Math.floor(at/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
        const next=ny*width+nx;if(!seen[next]&&pixels[next*4+3]>=128){seen[next]=1;queue[tail++]=next;}
      }
    }
    if(tail>=Math.max(8,width*height*.00002))parts.push({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,area:tail,seed:start});
  }
  const largest=Math.max(0,...parts.map(p=>p.area));
  const figures=parts.filter(p=>p.area>=largest*.08);
  if(figures.length<count)throw new Error(`${figures.length}体を検出しました。使用するコマ数を合わせるか、等分グリッドを使用してください。キャラクター同士が接触すると分離できません。`);
  figures.sort((a,b)=>{
    const rowA=clamp(Math.floor((a.y+a.height/2)/height*rows),0,rows-1),rowB=clamp(Math.floor((b.y+b.height/2)/height*rows),0,rows-1);
    return rowA-rowB||(a.x+a.width/2)-(b.x+b.width/2);
  });
  return figures.slice(0,count);
}

// Copy only the connected figure, excluding neighboring sprites and disconnected background debris.
export function extractSprite(pixels,width,height,bounds,side) {
  const output=new Uint8ClampedArray(side*side*4),seen=new Uint8Array(width*height),queue=[bounds.seed];seen[bounds.seed]=1;
  const offsetX=Math.floor((side-bounds.width)/2)-bounds.x,offsetY=Math.floor(side*.84)-bounds.height-bounds.y;
  for(let head=0;head<queue.length;head++) {
    const at=queue[head],x=at%width,y=Math.floor(at/width),tx=x+offsetX,ty=y+offsetY;
    if(tx>=0&&ty>=0&&tx<side&&ty<side)output.set(pixels.subarray(at*4,at*4+4),(ty*side+tx)*4);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const nx=x+dx,ny=y+dy;if(nx<bounds.x||ny<bounds.y||nx>=bounds.x+bounds.width||ny>=bounds.y+bounds.height)continue;
      const next=ny*width+nx;if(!seen[next]&&pixels[next*4+3]>=128){seen[next]=1;queue.push(next);}
    }
  }
  return output;
}

const W = 256, H = 176, FLOOR = 148;
const COLORS = Object.fromEntries(Object.entries({ink:'#182c43',sky:'#426b8b',skyLight:'#7dafbb',cloud:'#bbd4ca',sea:'#367f92',foam:'#a6dbcf',sand:'#dbbc82',sandLight:'#efd5a0',floor:'#555d63',floorLight:'#7c8989',gold:'#ffcc69',white:'#fff1c7',cyan:'#79e5d3',blue:'#45b9d0',red:'#ed8868'}).map(([k,v]) => [k, rgba(v)]));
function painter(p) {
  function rect(x,y,w,h,c) {x=Math.round(x);y=Math.round(y);for(let py=Math.max(0,y);py<Math.min(H,y+h);py++)for(let px=Math.max(0,x);px<Math.min(W,x+w);px++)p.set(c,(py*W+px)*4);}
  function stroke(x1,y1,x2,y2,c,size=1) {line(p,W,H,Math.round(x1),Math.round(y1),Math.round(x2),Math.round(y2),c,size);}
  function ellipse(cx,cy,rx,ry,c,outline=false) {cx=Math.round(cx);cy=Math.round(cy);rx=Math.max(1,rx);ry=Math.max(1,ry);for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(H-1,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(W-1,Math.ceil(cx+rx));x++){const n=(x-cx)**2/rx**2+(y-cy)**2/ry**2;if(n<=1&&(!outline||n>=Math.max(0,1-2/Math.min(rx,ry))))p.set(c,(y*W+x)*4);}}
  return {rect,stroke,ellipse};
}
function background(p, night) {
  const d=painter(p), C=COLORS;
  d.rect(0,0,W,H,night?C.ink:C.sky);d.rect(0,42,W,32,night?C.sky:C.skyLight);
  d.ellipse(218,29,13,13,night?C.cloud:C.sandLight);
  for(const [x,y,w] of [[11,28,31],[84,18,42],[148,40,24]]){d.rect(x,y,w,4,C.cloud);d.rect(x+6,y-3,w-12,3,C.cloud);}
  d.rect(0,73,W,49,C.sea);d.rect(0,73,W,2,C.foam);
  for(let row=0;row<5;row++)for(let x=-10+row*9;x<W;x+=39)d.rect(x,83+row*8,17-row%3*3,1,row%2?C.blue:C.foam);
  d.rect(0,121,W,55,C.sand);d.rect(0,121,W,3,C.sandLight);
  for(let x=4;x<W;x+=23)d.rect(x,130+x%7,5,1,C.sandLight);
  d.rect(0,FLOOR,W,H-FLOOR,C.ink);d.rect(0,FLOOR,W,3,C.floorLight);d.rect(0,FLOOR+3,W,H-FLOOR-3,C.floor);
  for(let x=0;x<W;x+=32){d.stroke(x,FLOOR+4,x-14,H,C.ink);d.rect(x+3,FLOOR+5,12,2,C.floorLight);}
  d.rect(0,168,W,3,C.gold);
}
function drone(p, x, y, recoil=0) {
  const d=painter(p),C=COLORS;x=Math.round(x);y=Math.round(y);
  d.ellipse(x,FLOOR-2,18,3,C.floor);
  d.rect(x-21,y-5,42,10,C.ink);d.rect(x-24,y-2,8,4,C.floorLight);d.rect(x+16,y-2,8,4,C.floorLight);
  d.ellipse(x,y,17,19,C.ink);d.ellipse(x,y-1,14,16,C.floorLight);d.rect(x-12,y+3,24,8,C.floor);
  d.rect(x-10,y-8,20,8,C.ink);d.rect(x-7,y-6,5,3,recoil?C.gold:C.cyan);d.rect(x+3,y-6,4,3,recoil?C.gold:C.cyan);
  d.ellipse(x,y+7,5,5,C.ink);d.ellipse(x,y+7,3,3,C.cyan);d.rect(x-5,y-20,10,3,C.gold);
  d.stroke(x-12,y+15,x-18,y+23,C.ink,2);d.stroke(x+12,y+15,x+18,y+23,C.ink,2);
}
function blit(p, f, sw, sh, cx, foot, scale, opacity=1) {
  const dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
  const ox=Math.round(cx-dw/2),oy=Math.round(foot-sh*.84*scale);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++) {
    const tx=ox+x,ty=oy+y;if(tx<0||tx>=W||ty<0||ty>=H)continue;
    const si=(Math.min(sh-1,Math.floor(y/scale))*sw+Math.min(sw-1,Math.floor(x/scale)))*4;
    if(f.pixels[si+3]<128)continue;const di=(ty*W+tx)*4;
    for(let c=0;c<3;c++)p[di+c]=Math.round(p[di+c]*(1-opacity)+f.pixels[si+c]*opacity);p[di+3]=255;
  }
}
function burst(p,x,y,phase,intensity) {
  const d=painter(p),C=COLORS,r=9+phase*8;
  for(let n=0;n<10;n++){const a=n*Math.PI/5+.2,inner=r*.36;d.stroke(x+Math.cos(a)*inner,y+Math.sin(a)*inner,x+Math.cos(a)*r,y+Math.sin(a)*r*.7,n%2?C.gold:C.white,n%3===0?2:1);}
  d.ellipse(x,y,Math.max(2,7-phase*2),Math.max(2,7-phase*2),C.white);
  for(let n=0;n<intensity*3;n++){const a=n*2.4;d.rect(x+Math.cos(a)*(r+5),y+Math.sin(a)*r*.65,2,2,n%2?C.cyan:C.gold);}
}
function shake(p, dx, dy, clampEdges=true) {
  if(!dx&&!dy)return p;
  // Clamp the edges so camera shake cannot expose transparent strips.
  const q=new Uint8ClampedArray(p.length);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=clampEdges?clamp(x-dx,0,W-1):x-dx,sy=clampEdges?clamp(y-dy,0,H-1):y-dy;if(sx>=0&&sy>=0&&sx<W&&sy<H)q.set(p.subarray((sy*W+sx)*4,(sy*W+sx)*4+4),(y*W+x)*4);}
  return q;
}

export function createActionProject(source, options={}) {
  if(source.frames.length<2||source.frames.length>16)throw new Error('アクション演出には、透過背景の連続ポーズを2〜16コマ用意してください。');
  if(!source.frames.every(f=>f.pixels.some((v,i)=>i%4===3&&v<128)))throw new Error('キャラクターだけを重ねるため、全コマに透過背景のポーズを用意してください。');
  if(!source.frames.every(f=>f.pixels.some((v,i)=>i%4===3&&v>=128)))throw new Error('空のコマがあります。各コマにキャラクターを描いてください。');
  const intensity=clamp(Number(options.intensity)||2,1,3),effects=options.effects!==false,ghosts=options.ghosts===true,camera=options.camera!==false,beam=options.beam===true,shadow=options.shadow!==false;
  const poses=source.frames,n=poses.length,steps=4,C=COLORS;
  const roots=[[67,0],[58,4],[131,0],[145,0],[141,-5],[101,3],[111,-15],[151,-32],[149,-25],[142,-20],[137,4],[99,1],[72,3],[126,0],[94,3],[67,0]];
  const hits=new Set([2,3,4,7,8,9,10,13]),frames=[];
  const fitScale=Math.min(144/source.width,144/source.height),scale=fitScale>=1?Math.floor(fitScale):fitScale,strength=.7+intensity*.1;
  for(let slot=0;slot<16;slot++)for(let sub=0;sub<steps;sub++) {
    const i=Math.round(slot*(n-1)/15),nextSlot=Math.min(15,slot+1);
    const u=sub/steps,ease=u*u*(3-2*u),a=roots[slot],b=roots[nextSlot];
    const x=67+((a[0]+(b[0]-a[0])*ease)-67)*strength,y=(a[1]+(b[1]-a[1])*ease)*strength;
    const hit=hits.has(slot),impact=hit&&sub<3, f=newFrame(W,H,40),character=new Uint8ClampedArray(W*H*4),d=painter(f.pixels);
    background(f.pixels,options.scene==='night');
    const recoil=impact?(3-sub)*(2+intensity):0;
    drone(f.pixels,202+recoil,104+(slot===4?-14:slot===7||slot===8?-10:0),impact);
    // Keep the ground shadow with the transparent character export, beneath the
    // figure. Its centre stays on the floor as the airborne figure rises.
    if(shadow)painter(character).ellipse(x,FLOOR-2,24+Math.min(0,y)*.25,3,C.floor);
    if(effects&&slot>0&&slot<15){
      for(let k=0;k<6;k++){const sy=38+((k*23+slot*7+sub*4)%90);d.stroke(7+(k%2)*9,sy,43+k%3*14,sy,C.foam);}
      if([2,3,6,7,8,9,13].includes(slot))for(let k=0;k<6;k++)d.stroke(x-45-k*5,FLOOR-12-k*5+y,x-20,FLOOR-14-k*5+y,k%2?C.cyan:C.cloud);
    }
    if(ghosts&&slot>0&&slot<15){blit(character,poses[Math.max(0,i-1)],source.width,source.height,x-19-intensity*3,FLOOR+y+3,scale,.2);blit(character,poses[i],source.width,source.height,x-10-intensity,FLOOR+y+1,scale,.25);}
    const pose=slot===15?poses[0]:poses[i];
    blit(character,pose,source.width,source.height,x,FLOOR+y,scale);
    if(effects){
      if(impact&&slot!==10&&slot!==13)burst(f.pixels,190+sub*4,slot===4?79:slot===7||slot===8?91:104,sub,intensity);
      if(slot===10){d.ellipse(x,FLOOR,18+sub*12,3+sub*2,C.cyan,true);d.ellipse(x,FLOOR,12+sub*10,2+sub*2,C.white,true);for(let k=0;k<9;k++)d.stroke(x-39+k*10,FLOOR-2,x-44+k*11,FLOOR-10-(k%3)*4,C.foam,2);}

    }
    if(beam&&slot===12){d.ellipse(x+14,113,5+sub*2,6+sub*2,C.cyan,true);d.ellipse(x+14,113,3+sub,C.white);}
    if(beam&&slot===13){d.ellipse(x+31,104,10,11,C.cyan);d.rect(x+30,99,W-x-30,11,C.cyan);d.rect(x+31,103,W-x-31,3,C.white);burst(f.pixels,207,103,sub,intensity);}
    const shaking=camera&&impact&&sub<2,dx=shaking?(sub%2?intensity:-intensity):0,dy=shaking?(sub%2?-1:1):0;
    f.scenePixels=shake(f.pixels,dx,dy);
    f.pixels=shake(character,dx,dy,false);
    f.duration=slot===0?[100,60,40,40][sub]:slot===15?[60,80,110,150][sub]:impact&&sub===1?70:40;
    frames.push(f);
  }
  const palette=makePalette(frames.flatMap(f=>[f.pixels,f.scenePixels]),96);
  for(const f of frames){f.pixels=quantize(f.pixels,W,H,palette,'none');f.scenePixels=quantize(f.scenePixels,W,H,palette,'none');}
  return {name:(source.name.replace(/[-_ ]?(poses|ポーズ)$/i,'')+' · ACTION').slice(0,80),width:W,height:H,palette,frames};
}
