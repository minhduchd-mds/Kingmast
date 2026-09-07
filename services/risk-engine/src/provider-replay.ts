import {createHash} from 'node:crypto';
import type {ProviderScope} from './provider-auth.js';

export type ProviderReplayDecision={accepted:true;reason:'ok'}|{accepted:false;reason:'replay'|'capacity'};

export class BoundedProviderReplayGuard {
  private readonly seen=new Map<string,number>();
  rejected=0;
  capacityRejected=0;

  constructor(private readonly maxEntries=8_192,private readonly ttlMs=2*60_000){
    if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>100_000)throw new Error('provider replay maxEntries must be between 1 and 100000');
    if(!Number.isFinite(ttlMs)||ttlMs<30_000||ttlMs>60*60_000)throw new Error('provider replay ttlMs must be between 30000 and 3600000');
  }

  get activeEntries(){return this.seen.size;}

  private fingerprint(providerId:string,keyId:string,scope:ProviderScope,signature:string){
    return createHash('sha256').update(providerId).update('\0').update(keyId).update('\0').update(scope).update('\0').update(signature).digest('hex');
  }

  private prune(nowMs:number){for(const[key,expiresAtMs]of this.seen)if(expiresAtMs<=nowMs)this.seen.delete(key);}

  accept(input:{providerId:string;keyId:string;scope:ProviderScope;signature:string;nowMs?:number}):ProviderReplayDecision{
    const nowMs=input.nowMs??Date.now();
    const key=this.fingerprint(input.providerId,input.keyId,input.scope,input.signature);
    const existing=this.seen.get(key);
    if(existing!==undefined&&existing>nowMs){this.rejected+=1;return{accepted:false,reason:'replay'};}
    if(existing!==undefined)this.seen.delete(key);
    if(this.seen.size>=this.maxEntries)this.prune(nowMs);
    if(this.seen.size>=this.maxEntries){this.rejected+=1;this.capacityRejected+=1;return{accepted:false,reason:'capacity'};}
    this.seen.set(key,nowMs+this.ttlMs);
    return{accepted:true,reason:'ok'};
  }

  snapshot(){return{activeEntries:this.activeEntries,rejected:this.rejected,capacityRejected:this.capacityRejected,maxEntries:this.maxEntries,ttlMs:this.ttlMs};}
}
