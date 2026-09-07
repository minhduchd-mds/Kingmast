export interface RateLimitDecision {
  allowed:boolean;
  retryAfterS:number;
  reason:'ok'|'limit'|'capacity';
}

interface RateWindow {
  startedAtMs:number;
  count:number;
}

export class BoundedFixedWindowRateLimiter {
  private readonly windows=new Map<string,RateWindow>();
  rejected=0;
  capacityRejected=0;

  constructor(private readonly maxKeys=2_048) {
    if(!Number.isSafeInteger(maxKeys)||maxKeys<1)throw new Error('maxKeys must be a positive integer');
  }

  get activeKeys(){return this.windows.size;}

  private prune(nowMs:number,windowMs:number){
    for(const[key,value]of this.windows)if(nowMs-value.startedAtMs>=windowMs)this.windows.delete(key);
  }

  consume(key:string,limit:number,nowMs=Date.now(),windowMs=60_000):RateLimitDecision {
    if(!Number.isSafeInteger(limit)||limit<1)throw new Error('limit must be a positive integer');
    if(!Number.isFinite(windowMs)||windowMs<1_000)throw new Error('windowMs must be at least 1000');
    const current=this.windows.get(key);
    if(current&&nowMs-current.startedAtMs<windowMs){
      if(current.count>=limit){this.rejected+=1;return{allowed:false,retryAfterS:Math.max(1,Math.ceil((windowMs-(nowMs-current.startedAtMs))/1_000)),reason:'limit'};}
      current.count+=1;
      return{allowed:true,retryAfterS:0,reason:'ok'};
    }
    if(current)this.windows.delete(key);
    if(this.windows.size>=this.maxKeys)this.prune(nowMs,windowMs);
    if(this.windows.size>=this.maxKeys){this.rejected+=1;this.capacityRejected+=1;return{allowed:false,retryAfterS:1,reason:'capacity'};}
    this.windows.set(key,{startedAtMs:nowMs,count:1});
    return{allowed:true,retryAfterS:0,reason:'ok'};
  }

  accept(key:string,limit=30,nowMs=Date.now(),windowMs=60_000){
    return this.consume(key,limit,nowMs,windowMs).allowed;
  }
}

interface TimestampEntry { timestampMs:number; lastSeenAtMs:number; }

export class BoundedMonotonicTimestampStore {
  private readonly entries=new Map<string,TimestampEntry>();
  rejected=0;
  capacityRejected=0;

  constructor(private readonly maxKeys=4_096,private readonly ttlMs=5*60_000) {
    if(!Number.isSafeInteger(maxKeys)||maxKeys<1)throw new Error('maxKeys must be a positive integer');
    if(!Number.isFinite(ttlMs)||ttlMs<1_000)throw new Error('ttlMs must be at least 1000');
  }

  get activeKeys(){return this.entries.size;}

  private prune(nowMs:number){for(const[key,value]of this.entries)if(nowMs-value.lastSeenAtMs>=this.ttlMs)this.entries.delete(key);}

  accept(key:string,timestampMs:number,nowMs=Date.now(),maxPastMs=30_000,maxFutureMs=5_000){
    if(timestampMs>nowMs+maxFutureMs||nowMs-timestampMs>maxPastMs){this.rejected+=1;return false;}
    const previous=this.entries.get(key);
    if(previous&&timestampMs<=previous.timestampMs){this.rejected+=1;return false;}
    if(!previous&&this.entries.size>=this.maxKeys)this.prune(nowMs);
    if(!previous&&this.entries.size>=this.maxKeys){this.rejected+=1;this.capacityRejected+=1;return false;}
    this.entries.set(key,{timestampMs,lastSeenAtMs:nowMs});
    return true;
  }
}
