import { GIFEncoder } from './vendor/gifenc.esm.js';
import { makePalette, indexedPixels, resizeNearest, rgba, clamp } from './core.js';
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
