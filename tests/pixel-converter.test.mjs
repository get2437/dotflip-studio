import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePixelArt,convertPixelArt,workSize} from '../app/pixel-converter.js';
import {flatten} from '../app/vendor/pixel-art-converter/flatten.js';
import {PaletteMap} from '../app/vendor/pixel-art-converter/color.js';
import {despeckle} from '../app/vendor/pixel-art-converter/cleanup.js';

function image(w,h,pixel){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(pixel(x,y),(y*w+x)*4);return {width:w,height:h,data};}
function opaqueColors(data){const colors=new Set();for(let i=0;i<data.length;i+=4)if(data[i+3])colors.add(data.slice(i,i+3).join(','));return colors;}

test('flatten suppresses fine texture without blurring a hard colour boundary',()=>{
  const source=image(32,24,(x,y)=>{const noise=(x+y)%2?3:-3;return x<16?[180+noise,100+noise,70+noise,255]:[40+noise,70+noise,160+noise,255];});
  const flat=flatten(source,.6);
  const variance=data=>{const values=[];for(let y=6;y<18;y++)for(let x=5;x<11;x++)values.push(data[(y*32+x)*4]);const mean=values.reduce((a,b)=>a+b)/values.length;return values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;};
  assert.ok(variance(flat.data)<variance(source.data)/4);
  const p=(x,y)=>Array.from(flat.data.slice((y*32+x)*4,(y*32+x)*4+3));
  assert.ok(p(14,12)[0]>150);assert.ok(p(17,12)[2]>130);
  assert.notDeepEqual(flat.data,source.data);
});
test('transparent gutters do not stain a uniform sprite during flattening and banding',()=>{
  const source=image(24,24,(x,y)=>x>=5&&x<19&&y>=5&&y<19?[220,180,140,255]:[0,255,255,0]);
  const prepared=preparePixelArt(source,24,24);
  const values=[];for(let p=0;p<24*24;p++)if(prepared.frame.data[p*4+3])values.push(prepared.frame.data.slice(p*4,p*4+3).join(','));
  assert.equal(new Set(values).size,1,'sprite edges must have the same flat colour as the centre');
  assert.ok(prepared.frame.data.filter((_,i)=>i%4===3).every(a=>a===0||a===255));
});
test('hidden RGB cannot change the converted sprite or shared palette',()=>{
  const a=image(32,32,(x,y)=>x>5&&x<27&&y>5&&y<27?[x*6,130,y*5,255]:[0,0,0,0]);
  const b={...a,data:new Uint8ClampedArray(a.data)};for(let i=0;i<b.data.length;i+=4)if(!b.data[i+3])b.data.set([255,0,255,0],i);
  const x=convertPixelArt([a],{width:16,height:16,colors:12}),y=convertPixelArt([b],{width:16,height:16,colors:12});
  assert.deepEqual(x,y);
});
test('cleanup removes weak specks while preserving a high-contrast one-pixel eye',()=>{
  const colors=[[0,0,0],[180,160,140],[185,163,144]],map=new PaletteMap(colors);
  const frame=image(7,5,()=>[...colors[1],255]),indices=new Uint16Array(35).fill(1);
  indices[9]=0;frame.data.set([...colors[0],255],9*4);
  indices[25]=2;frame.data.set([...colors[2],255],25*4);
  despeckle(frame,indices,map,.25);
  assert.equal(indices[9],0);assert.equal(indices[25],1);
});
test('a sequence uses one bounded palette, deterministic independent buffers and unchanged sources',()=>{
  const a=image(32,32,(x,y)=>x>3&&x<28&&y>3&&y<28?[x*7,y*7,70,255]:[0,0,0,0]);
  const original=new Uint8ClampedArray(a.data),progress=[];
  const result=convertPixelArt([a,a],{width:16,height:16,colors:12},(...p)=>progress.push(p));
  assert.ok(result.palette.length<=12);assert.deepEqual(a.data,original);assert.deepEqual(result.buffers[0],result.buffers[1]);assert.notEqual(result.buffers[0],result.buffers[1]);
  assert.deepEqual(result,convertPixelArt([a,a],{width:16,height:16,colors:12}));
  const allowed=new Set(result.palette.map(c=>{const n=parseInt(c.slice(1),16);return `${n>>16},${n>>8&255},${n&255}`;}));
  for(const buffer of result.buffers){for(const c of opaqueColors(buffer))assert.ok(allowed.has(c));assert.ok(buffer.filter((_,i)=>i%4===3).every(v=>v===0||v===255));}
  assert.equal(progress.length,4);
});
test('working raster budget remains bounded for long and high-resolution sequences',()=>{
  for(const [w,h,count] of [[64,64,16],[256,256,64],[256,128,16],[32,256,64]]){const s=workSize(w,h,count);assert.ok(s.width*s.height*count<=4194304);assert.ok(s.width>=w&&s.height>=h);}
});

test('small dark facial details survive flattening and output downsampling',()=>{
  const source=image(64,64,(x,y)=>(x>=26&&x<29&&y>=29&&y<32)||(x>=36&&x<39&&y>=29&&y<32)?[10,10,10,255]:[220,180,140,255]);
  const result=convertPixelArt([source],{width:16,height:16,palette:['#0a0a0a','#6e5a46','#dcb48c']});
  const data=result.buffers[0];
  for(const x of [6,9])assert.ok(data[(7*16+x)*4]<180,'eye pixels should stay visibly darker than surrounding skin');
});
