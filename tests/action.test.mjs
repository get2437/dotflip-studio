import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionProject, sheetRects, spriteBounds, extractSprite } from '../app/action.js';
import { newFrame, setPixel, rgba, serializeProject, parseProject } from '../app/core.js';

test('action enlargement keeps low-resolution source pixels on an integer grid',()=>{
  const f=newFrame(64,64);for(let y=30;y<32;y++)for(let x=30;x<32;x++)setPixel(f.pixels,64,64,x,y,rgba('#ff0000'));
  const source={name:'pixel grid',width:64,height:64,palette:['#ff0000'],frames:[f,structuredClone(f)]};
  const project=createActionProject(source,{effects:false,camera:false});
  for(const frame of project.frames)assert.equal(frame.pixels.filter((v,i)=>i%4===3&&v===255).length,16,'2x2 source pixels must remain four 2x2 blocks');
});

test('uneven sprite sheet grid covers every pixel exactly once',()=>{
  const w=1254,h=1253,rects=sheetRects(w,h,4,4,16),coverage=new Uint8Array(w*h);
  for(const r of rects)for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)coverage[y*w+x]++;
  assert.ok(coverage.every(n=>n===1));assert.deepEqual(rects[15],{x:940,y:939,width:314,height:314});
});
test('sheet import rejects empty, overflowing and degenerate grids',()=>{
  for(const args of [[20,20,0,4,16],[20,20,4,4,17],[2,2,4,4,16],[20,20,4,4,0],[20,20,4.5,4,16],[20,20,20,20,65]])assert.throws(()=>sheetRects(...args));
});
test('alpha extraction keeps full figures across grid lines, ignores debris and aligns the ground without resizing',()=>{
  const w=60,h=30,p=newFrame(w,h).pixels;
  for(let y=4;y<25;y++)for(let x=3;x<32;x++)setPixel(p,w,h,x,y,rgba('#e0a050'));
  for(let y=12;y<25;y++)for(let x=37;x<56;x++)setPixel(p,w,h,x,y,rgba('#405080'));
  setPixel(p,w,h,59,29,rgba('#ff0000'));
  const bounds=spriteBounds(p,w,h,2,1,2);assert.equal(bounds.length,2);assert.equal(bounds[0].width,29);assert.equal(bounds[1].height,13);
  const output=bounds.map(b=>extractSprite(p,w,h,b,40));
  for(let i=0;i<2;i++){
    const points=[];for(let k=3;k<output[i].length;k+=4)if(output[i][k])points.push((k-3)/4);
    assert.equal(Math.max(...points.map(k=>Math.floor(k/40))),Math.floor(40*.84)-1);
    assert.equal(points.length,bounds[i].area);
  }
  assert.equal(spriteBounds(p,w,h,2,1,1)[0].x,3);assert.throws(()=>spriteBounds(p,w,h,3,1,3),/2体/);
});
function source(){return {name:'fighter-poses',width:32,height:32,palette:['#e0a050','#405080'],frames:Array.from({length:16},(_,i)=>{const f=newFrame(32,32);for(let y=8;y<27;y++)for(let x=10;x<16+(i%5);x++)setPixel(f.pixels,32,32,x,y,rgba(i%2?'#405080':'#e0a050'));return f;})};}
test('action project is bounded, editable, deterministic and loops at the same guard pose',()=>{
  const input=source(),before=serializeProject(input),a=createActionProject(input,{intensity:3}),b=createActionProject(input,{intensity:3});
  assert.equal(a.width,256);assert.equal(a.height,176);assert.equal(a.frames.length,64);assert.ok(a.palette.length<=96);
  assert.deepEqual(a.frames[0].pixels,a.frames.at(-1).pixels);assert.notDeepEqual(a.frames[8].pixels,a.frames[20].pixels);
  assert.deepEqual(a.frames[0].scenePixels,a.frames.at(-1).scenePixels);
  assert.deepEqual(a,b);assert.deepEqual(serializeProject(input),before);assert.deepEqual(parseProject(serializeProject(a)),a);
  for(const f of a.frames){assert.equal(f.pixels.length,256*176*4);assert.ok(f.pixels.some((v,i)=>i%4===3&&v===0));assert.ok(f.pixels.some((v,i)=>i%4===3&&v===255));assert.ok(f.scenePixels.every((v,i)=>i%4!==3||v===255));assert.equal(f.duration%10,0);assert.ok(f.duration>=20);}
});
test('effects, ghosts and camera switches change pixels while preserving source poses',()=>{
  const p=source(),full=createActionProject(p),plain=createActionProject(p,{effects:false,ghosts:false,camera:false});
  assert.notDeepEqual(full.frames[9].pixels,plain.frames[9].pixels);assert.deepEqual(full.frames[0].pixels,plain.frames[0].pixels);
});
test('afterimages are absent by default and appear only when explicitly enabled',()=>{
  const p=source(),defaults=createActionProject(p),disabled=createActionProject(p,{ghosts:false}),enabled=createActionProject(p,{ghosts:true});
  assert.deepEqual(defaults,disabled);
  assert.notDeepEqual(defaults.frames[28].pixels,enabled.frames[28].pixels);
  assert.deepEqual(defaults.frames.map(f=>f.duration),enabled.frames.map(f=>f.duration));
});

test('beam is off by default and explicit beam settings affect only the optional scene',()=>{
  const p=source(),defaults=createActionProject(p),disabled=createActionProject(p,{beam:false}),enabled=createActionProject(p,{beam:true});
  assert.deepEqual(defaults,disabled);
  assert.notDeepEqual(defaults.frames[52].scenePixels,enabled.frames[52].scenePixels);
  assert.deepEqual(defaults.frames.map(f=>f.pixels),enabled.frames.map(f=>f.pixels));
});

test('beam can be selected independently from ordinary slash effects',()=>{
  const p=source(),plain=createActionProject(p,{effects:false,camera:false}),beam=createActionProject(p,{effects:false,camera:false,beam:true});
  assert.notDeepEqual(plain.frames[52].scenePixels,beam.frames[52].scenePixels);
  assert.deepEqual(plain.frames[52].pixels,beam.frames[52].pixels);
});
test('action needs a transparent character sequence and accepts short sequences',()=>{
  const p=source();p.frames=p.frames.slice(0,2);assert.equal(createActionProject(p).frames.length,64);
  p.frames=p.frames.slice(0,1);assert.throws(()=>createActionProject(p),/2〜16/);
  p.frames=[newFrame(32,32),newFrame(32,32)];for(const f of p.frames)for(let i=3;i<f.pixels.length;i+=4)f.pixels[i]=255;
  assert.throws(()=>createActionProject(p),/透過背景/);
  p.frames=[newFrame(32,32),newFrame(32,32)];assert.throws(()=>createActionProject(p),/空のコマ/);
});
