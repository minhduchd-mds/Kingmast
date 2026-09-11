import type { NavigationHorizon } from '@kingmast/contracts/nextgen';

const MAX_VEHICLES=128;
const MAX_AGE_MS=15_000;
const MAX_FUTURE_SKEW_MS=1_000;

export interface HorizonSnapshot {horizon:NavigationHorizon|null;fresh:boolean;ageMs:number|null;reason:'fresh'|'missing'|'stale'|'future';}

export class NavigationHorizonStore{
  private readonly horizons=new Map<string,NavigationHorizon>();

  upsert(horizon:NavigationHorizon){
    const vehicleId=horizon.vehicleId.trim().slice(0,96);
    if(!vehicleId)throw new Error('invalid-horizon-vehicle');
    if(!this.horizons.has(vehicleId)&&this.horizons.size>=MAX_VEHICLES){const oldest=[...this.horizons.values()].sort((a,b)=>a.generatedAtMs-b.generatedAtMs)[0];if(oldest)this.horizons.delete(oldest.vehicleId);}
    const copy=structuredClone({...horizon,vehicleId,events:horizon.events.slice(0,128),notes:horizon.notes.slice(0,32)});
    this.horizons.set(vehicleId,copy);
    return structuredClone(copy);
  }

  snapshot(vehicleId:string,nowMs=Date.now()):HorizonSnapshot{
    const horizon=this.horizons.get(vehicleId);
    if(!horizon)return{horizon:null,fresh:false,ageMs:null,reason:'missing'};
    const delta=nowMs-horizon.generatedAtMs;
    if(delta< -MAX_FUTURE_SKEW_MS)return{horizon:null,fresh:false,ageMs:delta,reason:'future'};
    const ageMs=Math.max(0,delta);
    if(ageMs>MAX_AGE_MS)return{horizon:null,fresh:false,ageMs,reason:'stale'};
    return{horizon:structuredClone(horizon),fresh:true,ageMs,reason:'fresh'};
  }

  delete(vehicleId:string){return this.horizons.delete(vehicleId);}
  clear(){this.horizons.clear();}
  get size(){return this.horizons.size;}
}
