// Keep the entire artwork visible at FIT, including wide sprites on small phones.
export function fitZoom(width,height,availableWidth,availableHeight,integer=true){
  const scale=Math.min(Math.max(1,availableWidth)/width,Math.max(1,availableHeight)/height,32);
  return integer&&scale>=1?Math.floor(scale):scale;
}

// A second finger must never replace an in-progress pen or drawing stroke.
export class PointerSession{
  id=null;
  start(event){
    if(this.id!==null||event.isPrimary===false||![0,2].includes(event.button))return false;
    this.id=event.pointerId;return true;
  }
  owns(event){return this.id!==null&&this.id===event.pointerId;}
  finish(event){if(!this.owns(event))return false;this.id=null;return true;}
}
