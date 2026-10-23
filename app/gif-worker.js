import { encodeGif } from './export.js';
self.onmessage=({data})=>{
  try {const bytes=encodeGif(data.project,data.scale,data.background);self.postMessage({bytes},[bytes.buffer]);}
  catch(e){self.postMessage({error:e.message||'GIFを作成できませんでした。'});}
};
