import test from 'node:test';
import assert from 'node:assert/strict';
import {fitZoom,PointerSession} from '../app/viewport.js';

test('FIT keeps a 256px action scene fully visible on a narrow phone',()=>{
  const zoom=fitZoom(256,176,238,260);
  assert.ok(zoom<1);
  assert.ok(256*zoom<=238&&176*zoom<=260);
  assert.equal(256*zoom,238);
});
test('FIT keeps pixel blocks integral when space allows, with a bounded maximum',()=>{
  assert.equal(fitZoom(64,64,350,290),4);
  assert.equal(fitZoom(16,16,3000,3000),32);
  assert.ok(fitZoom(128,256,300,190)*256<=190);
});
test('phone FIT uses the available space instead of leaving a small thumbnail',()=>{
  const zoom=fitZoom(128,128,238,276,false);
  assert.equal(128*zoom,238);
  assert.ok(128*zoom<=276);
});
test('a second finger cannot take over or finish the active drawing stroke',()=>{
  const session=new PointerSession();
  assert.equal(session.start({pointerId:7,button:0,isPrimary:true}),true);
  assert.equal(session.start({pointerId:8,button:0,isPrimary:false}),false);
  assert.equal(session.owns({pointerId:8}),false);
  assert.equal(session.finish({pointerId:8}),false);
  assert.equal(session.owns({pointerId:7}),true);
  assert.equal(session.finish({pointerId:7}),true);
  assert.equal(session.finish({pointerId:7}),false);
  assert.equal(session.start({pointerId:9,button:0,isPrimary:true}),true);
});
test('secondary touch and middle mouse cannot start a stroke; pen and right mouse can',()=>{
  const session=new PointerSession();
  assert.equal(session.start({pointerId:1,button:0,isPrimary:false}),false);
  assert.equal(session.start({pointerId:2,button:1,isPrimary:true}),false);
  assert.equal(session.start({pointerId:3,button:0,isPrimary:true,pointerType:'pen'}),true);
  assert.equal(session.finish({pointerId:3}),true);
  assert.equal(session.start({pointerId:4,button:2,isPrimary:true,pointerType:'mouse'}),true);
});
