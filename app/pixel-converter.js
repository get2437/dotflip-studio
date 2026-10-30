import {adjustColors,makePalette,quantize,rgba} from './core.js';
import {flatten,posterize} from './vendor/pixel-art-converter/flatten.js';
import {downsample,thresholdAlpha} from './vendor/pixel-art-converter/pixelate.js';
import {extractLines,downsampleMask,compositeLines} from './vendor/pixel-art-converter/lines.js';
import {despeckle} from './vendor/pixel-art-converter/cleanup.js';
import {applyOutline} from './vendor/pixel-art-converter/edges.js';
import {PaletteMap} from './vendor/pixel-art-converter/color.js';
import {adjust,sharpen} from './vendor/pixel-art-converter/adjust.js';

export const PIXEL_STYLES=Object.freeze({
  soft:{flatten:.3,bands:10,lines:.2,cleanup:.2,outline:.15,contrast:.06,saturation:.08,sharpness:.25},
  balanced:{flatten:.6,bands:7,lines:.4,cleanup:.25,outline:.3,contrast:.12,saturation:.15,sharpness:.35},
  strong:{flatten:.85,bands:5,lines:.65,cleanup:.5,outline:.5,contrast:.18,saturation:.2,sharpness:.4}
});
export function workSize(width,height,count){
  const scale=Math.max(1,Math.min(4,Math.floor(Math.sqrt(4194304/(width*height*count)))));
  return {width:width*scale,height:height*scale};
}
export function preparePixelArt(source,width,height,style='balanced'){
  const s=PIXEL_STYLES[style];if(!s)throw new Error('ドット絵化の強さが不正です。');
  if(!source||!Number.isInteger(source.width)||!Number.isInteger(source.height)||source.width<width||source.height<height||source.data.length!==source.width*source.height*4)throw new Error('変換元の画像が不正です。');
  // Threshold/clear hidden RGB before stylisation; alpha itself is never smoothed by a colour filter.
  const clean={...source,data:adjustColors(source.data)};
  const crisp=sharpen(adjust(clean,{brightness:0,contrast:s.contrast,saturation:s.saturation}),s.sharpness);
  const flat=posterize(flatten(crisp,s.flatten),s.bands);
  // Read fine contours before flattening can erase an eye or a thin blade.
  const mask=extractLines(crisp,Math.max(.7,source.width/width/1.8),.16);
  const lines=downsampleMask(mask,source.width,source.height,width,height);
  const small=downsample(flat,width,height);thresholdAlpha(small,128);
  small.data=adjustColors(small.data);
  return {frame:small,lines};
}
export function finishPixelArt(prepared,palette,style='balanced',dither='none'){
  const s=PIXEL_STYLES[style];if(!s||!palette.length)throw new Error('変換設定が不正です。');
  const {width,height}=prepared.frame;
  const frame={width,height,data:quantize(prepared.frame.data,width,height,palette,dither)};
  const colors=palette.map(c=>rgba(c).slice(0,3)),map=new PaletteMap(colors),indices=new Uint16Array(width*height);
  for(let p=0;p<indices.length;p++)if(frame.data[p*4+3])indices[p]=map.nearestIndex(...frame.data.subarray(p*4,p*4+3));
  despeckle(frame,indices,map,s.cleanup);
  compositeLines(frame,indices,map,prepared.lines,s.lines);
  applyOutline(frame,indices,map,s.outline);
  return frame.data;
}
export function convertPixelArt(sources,{width,height,colors=24,palette=null,style='balanced',dither='none'}={},onProgress=()=>{}){
  if(!sources?.length||sources.length>64||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256)throw new Error('変換する画像とサイズを確認してください。');
  const prepared=sources.map((source,index)=>{const result=preparePixelArt(source,width,height,style);onProgress(index+1,sources.length,'prepare');return result;});
  // All frames share one palette; deriving it per pose makes colours flicker in animation.
  const shared=palette||makePalette(prepared.map(p=>p.frame.data),colors);
  const buffers=prepared.map((p,index)=>{const result=finishPixelArt(p,shared,style,dither);onProgress(index+1,sources.length,'finish');return result;});
  return {buffers,palette:shared};
}
