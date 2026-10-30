import { GIFEncoder } from './vendor/gifenc.esm.js';
import { makePalette, indexedPixels, resizeNearest, rgba, clamp } from './core.js';
// Editable pixels contain the character. The optional scene is used for preview
// and is included in exports only when explicitly requested.
export function framePixels(frame,includeScene=false) {
  if(!includeScene||!frame.scenePixels)return frame.pixels;
  const result=new Uint8ClampedArray(frame.scenePixels);
  for(let i=0;i<result.length;i+=4){
    const a=frame.pixels[i+3]/255,b=result[i+3]/255,alpha=a+b*(1-a);
    if(!alpha){result.fill(0,i,i+4);continue;}
    for(let c=0;c<3;c++)result[i+c]=Math.round((frame.pixels[i+c]*a+result[i+c]*b*(1-a))/alpha);
    result[i+3]=Math.round(alpha*255);
  }
  return result;
}
export function projectForExport(project,includeScene=false) {
  return {...project,palette:[...project.palette],frames:project.frames.map(frame=>({duration:frame.duration,pixels:new Uint8ClampedArray(framePixels(frame,includeScene))}))};
}
export function encodeGif(project,scale=1,background='transparent') {
  const {width:w,height:h,frames}=project;
  scale=clamp(Math.round(scale),1,8);
  const buffers=frames.map(f=>{
    const pixels=new Uint8ClampedArray(f.pixels);
    if(background!=='transparent'){
      const color=rgba(background);
      for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]<128)pixels.set(color,i);
    }
    return pixels;
  });
  const palette=makePalette(buffers,255),gifPalette=[[0,0,0],...palette.map(c=>rgba(c).slice(0,3))];
  const gif=GIFEncoder();
  buffers.forEach((p,i)=>{
    const scaled=scale===1?p:resizeNearest(p,w,h,w*scale,h*scale);
    gif.writeFrame(indexedPixels(scaled,palette),w*scale,h*scale,{
      palette:gifPalette,delay:Math.max(20,Math.round(frames[i].duration/10)*10),
      transparent:background==='transparent',transparentIndex:0,dispose:2,repeat:0
    });
  });
  gif.finish();
  return gif.bytes();
}
export function sheetMetadata(project,scale=1,columns=8) {
  columns=clamp(Math.round(columns),1,project.frames.length);
  const w=project.width*scale,h=project.height*scale,rows=Math.ceil(project.frames.length/columns);
  return { app:'DOTFLIP Studio', version:1, name:project.name, image:project.name+'.sheet.png', size:{width:w*columns,height:h*rows}, scale, loop:true,
    frames:project.frames.map((f,i)=>({index:i,rect:{x:i%columns*w,y:Math.floor(i/columns)*h,width:w,height:h},duration:f.duration})),
    meta:{originalWidth:project.width,originalHeight:project.height,columns,rows} };
}
