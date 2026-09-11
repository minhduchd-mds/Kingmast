export interface FrameBufferStats {
  accepted:number;
  dropped:number;
  consumed:number;
  queued:number;
}

export class LatestFrameBuffer<T>{
  private readonly capacity:number;
  private readonly queue:T[]=[];
  private accepted=0;
  private dropped=0;
  private consumed=0;

  constructor(capacity=2){
    if(!Number.isInteger(capacity)||capacity<1||capacity>8)throw new Error('invalid-frame-buffer-capacity');
    this.capacity=capacity;
  }

  push(frame:T){
    this.accepted+=1;
    while(this.queue.length>=this.capacity){this.queue.shift();this.dropped+=1;}
    this.queue.push(frame);
  }

  takeLatest():T|null{
    if(!this.queue.length)return null;
    const latest=this.queue[this.queue.length-1]??null;
    const staleCount=Math.max(0,this.queue.length-1);
    this.dropped+=staleCount;
    this.queue.length=0;
    if(latest!==null)this.consumed+=1;
    return latest;
  }

  peekLatest():T|null{return this.queue[this.queue.length-1]??null;}
  clear(){this.dropped+=this.queue.length;this.queue.length=0;}
  stats():FrameBufferStats{return{accepted:this.accepted,dropped:this.dropped,consumed:this.consumed,queued:this.queue.length};}
}
