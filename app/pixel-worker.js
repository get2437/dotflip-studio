import {convertPixelArt} from './pixel-converter.js';
self.onmessage=({data})=>{
  try{
    const result=convertPixelArt(data.sources,data.settings,(current,total,phase)=>self.postMessage({progress:{current,total,phase}}));
    self.postMessage({result},result.buffers.map(p=>p.buffer));
  }catch(error){self.postMessage({error:error.message||'ドット絵への変換に失敗しました。'});}
};
