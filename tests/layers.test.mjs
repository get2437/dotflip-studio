import test from 'node:test';
import assert from 'node:assert/strict';
import {newFrame,copyFrame,cloneProject,setPixel,rgba,serializeProject,parseProject,motionFrames} from '../app/core.js';
import {framePixels,projectForExport,encodeGif,sheetMetadata} from '../dist/export.js';

function layeredProject(){
  const f=newFrame(4,2,90);f.scenePixels=new Uint8ClampedArray(4*2*4);
  for(let i=0;i<f.scenePixels.length;i+=4)f.scenePixels.set(rgba('#123456'),i);
  setPixel(f.pixels,4,2,1,0,rgba('#ffcc88'));
  return {name:'layered',width:4,height:2,palette:['#123456','#ffcc88'],frames:[f,copyFrame(f)]};
}
test('default export preserves only the character and explicit scene export composites both',()=>{
  const p=layeredProject(),character=projectForExport(p),scene=projectForExport(p,true);
  assert.equal(character.frames[0].pixels[3],0);
  assert.deepEqual(Array.from(character.frames[0].pixels.slice(4,8)),rgba('#ffcc88'));
  assert.deepEqual(Array.from(scene.frames[0].pixels.slice(0,4)),rgba('#123456'));
  assert.deepEqual(Array.from(scene.frames[0].pixels.slice(4,8)),rgba('#ffcc88'));
  assert.equal('scenePixels' in character.frames[0],false);
  assert.equal('scenePixels' in scene.frames[0],false);
  character.frames[0].pixels[4]=0;assert.equal(p.frames[0].pixels[4],255);
  assert.equal(sheetMetadata(character,2,2).frames[0].duration,90);
  assert.equal(Buffer.from(encodeGif(character)).subarray(0,6).toString(),'GIF89a');
});
test('editing or erasing a character is reflected in scene preview without changing the scene',()=>{
  const p=layeredProject(),f=p.frames[0],before=new Uint8ClampedArray(f.scenePixels);
  setPixel(f.pixels,4,2,1,0,[0,0,0,0]);
  assert.deepEqual(Array.from(framePixels(f,true).slice(4,8)),rgba('#123456'));
  setPixel(f.pixels,4,2,2,1,rgba('#ff0000'));
  assert.deepEqual(Array.from(framePixels(f,true).slice(24,28)),rgba('#ff0000'));
  assert.deepEqual(f.scenePixels,before);
});
test('saved layer data roundtrips, duplicates, undo snapshots and motion frames independently',()=>{
  const p=layeredProject(),restored=parseProject(serializeProject(p));assert.deepEqual(restored,p);
  const clone=cloneProject(p);clone.frames[0].scenePixels[0]=99;assert.notEqual(p.frames[0].scenePixels[0],99);
  const copy=copyFrame(p.frames[0]);copy.scenePixels[0]=77;assert.notEqual(p.frames[0].scenePixels[0],77);
  const motion=motionFrames(p.frames[0],4,2,'float',6,1);motion[0].scenePixels[0]=88;
  assert.notEqual(motion[1].scenePixels[0],88);assert.notEqual(p.frames[0].scenePixels[0],88);
});
test('old single-layer projects still load, and malformed scene payloads are rejected',()=>{
  const p=layeredProject();delete p.frames[0].scenePixels;delete p.frames[1].scenePixels;
  assert.deepEqual(parseProject(serializeProject(p)),p);
  assert.deepEqual(projectForExport(p,true),p);
  for(const payload of [null,'AAAA','!'.repeat(44),'A'.repeat(44)]){
    const data=serializeProject(layeredProject());data.frames[0].sceneRgba=payload;
    assert.throws(()=>parseProject(data),/背景/);
  }
});
test('compositing respects alpha and leaves ordinary frames unchanged',()=>{
  const f=newFrame(1,1);f.pixels.set([255,0,0,128]);f.scenePixels=new Uint8ClampedArray([0,0,255,255]);
  assert.deepEqual(Array.from(framePixels(f,true)),[128,0,127,255]);
  delete f.scenePixels;assert.equal(framePixels(f,true),f.pixels);
});
