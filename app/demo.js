import { newFrame, setPixel, rgba, PALETTES, transform } from './core.js';
// Original hand-authored sample. All coordinates are integer pixels; no external artwork.
export function createDemo() {
  const w=64,h=64,f=newFrame(w,h,150),p=f.pixels;
  const c={o:'#29343a',dark:'#a45235',mid:'#d57c42',light:'#efa45c',cream:'#f5dfb4',white:'#fff0d2',scarf:'#66866b',scarfLight:'#94ae81',pink:'#db8d72',shadow:'#394b47'};
  const rect=(x,y,a,b,col)=>{for(let j=y;j<y+b;j++)for(let i=x;i<x+a;i++)setPixel(p,w,h,i,j,rgba(c[col]||col));};
  const span=(y,x1,x2,col)=>rect(x1,y,x2-x1+1,1,col);
  // Tail, feet, and scarf silhouette.
  [[41,37,8,4],[44,40,9,5],[46,45,9,7],[43,50,10,4],[38,52,10,4]].forEach(r=>rect(...r,'o'));
  [[42,39,6,4],[46,42,6,6],[45,48,7,4],[40,52,7,2]].forEach(r=>rect(...r,'mid'));
  rect(49,43,4,5,'cream');rect(47,49,4,2,'white');
  rect(22,48,8,9,'o');rect(33,48,8,9,'o');rect(23,49,6,5,'mid');rect(34,49,6,5,'mid');rect(22,55,8,2,'dark');rect(33,55,8,2,'dark');
  // Body.
  [[22,33,18,3],[20,36,22,9],[21,45,20,5],[24,50,14,3]].forEach(r=>rect(...r,'o'));
  rect(23,35,15,3,'mid');rect(22,38,18,9,'mid');rect(24,46,14,4,'light');
  rect(27,37,8,12,'cream');rect(29,38,4,9,'white');
  rect(19,38,4,10,'o');rect(20,39,3,7,'light');rect(39,38,4,9,'o');rect(39,39,3,6,'dark');
  // Pointed ears.
  [[17,10,3,13],[20,12,3,12],[23,16,3,9],[38,10,3,13],[35,13,3,11],[32,17,3,8]].forEach(r=>rect(...r,'o'));
  rect(19,13,2,8,'mid');rect(21,17,3,6,'pink');rect(37,13,2,9,'mid');rect(35,17,2,6,'pink');
  // Head with a deliberately stepped outline.
  [[21,20,16,2],[17,22,24,3],[15,25,28,9],[17,34,24,3],[21,37,16,2]].forEach(r=>rect(...r,'o'));
  [[21,22,15,2],[18,24,22,3],[17,27,24,7],[20,34,18,2]].forEach(r=>rect(...r,'mid'));
  rect(21,24,14,5,'light');rect(20,27,7,5,'light');rect(32,27,7,5,'light');
  rect(18,30,7,4,'cream');rect(34,30,7,4,'cream');rect(21,33,16,3,'cream');rect(25,31,9,5,'white');
  // Eyes and nose.
  rect(23,28,3,3,'o');rect(34,28,3,3,'o');rect(23,28,1,1,'white');rect(34,28,1,1,'white');
  rect(28,31,4,2,'o');rect(29,33,2,1,'dark');rect(19,31,3,1,'pink');rect(38,31,2,1,'pink');
  // Sage scarf.
  rect(21,37,19,4,'o');rect(22,37,17,3,'scarf');rect(24,37,11,1,'scarfLight');
  rect(35,40,5,9,'o');rect(35,40,4,7,'scarf');rect(35,41,1,5,'scarfLight');rect(36,47,3,2,'scarf');
  const frames=[];
  for(let i=0;i<8;i++){
    let q=transform(p,w,h,{dy:[0,0,-1,-1,-1,0,0,0][i]});
    if(i===5){
      const dy=0;for(const x of [23,34]){for(let y=28;y<31;y++)for(let xx=x;xx<x+3;xx++)setPixel(q,w,h,xx,y+dy,rgba(c.light));for(let xx=x;xx<x+3;xx++)setPixel(q,w,h,xx,30+dy,rgba(c.o));}
    }
    frames.push({pixels:q,duration:i===5?90:i===7?390:150});
  }
  return {name:'森の小さな相棒',width:w,height:h,palette:[...new Set(Object.values(c))],frames};
}
