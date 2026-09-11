import type { TrafficControlObservation,TrafficSignalState } from '@kingmast/contracts/nextgen';
import type { VisionTrafficControlSnapshot } from '@kingmast/contracts/vision-nextgen';
import {assessTrafficControlObservation} from './traffic-control-perception.js';

const HISTORY_MS=2_500;
const MAX_HISTORY=128;
const HIGH_CONFIDENCE=.92;

function average(values:number[]){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;}
function stableBy<T extends string|number>(items:TrafficControlObservation[],value:(item:TrafficControlObservation)=>T|null){
  const groups=new Map<T,TrafficControlObservation[]>();
  for(const item of items){const key=value(item);if(key===null)continue;const list=groups.get(key)??[];list.push(item);groups.set(key,list);}
  const ranked=[...groups.entries()].map(([key,list])=>({key,list,confidence:average(list.map((item)=>item.confidence)),latest:Math.max(...list.map((item)=>item.capturedAtMs))})).sort((a,b)=>b.list.length-a.list.length||b.confidence-a.confidence||b.latest-a.latest);
  const best=ranked[0]??null;
  return best&&(best.list.length>=2||best.confidence>=HIGH_CONFIDENCE)?best:null;
}

export class VisionTrafficControlTracker{
  private history:TrafficControlObservation[]=[];

  ingest(observation:TrafficControlObservation,nowMs=Date.now()){
    const decision=assessTrafficControlObservation(observation,nowMs);
    this.prune(nowMs);
    if(!decision.usable)return decision;
    if(!this.history.some((item)=>item.cameraId===observation.cameraId&&item.id===observation.id&&item.capturedAtMs===observation.capturedAtMs))this.history.push(structuredClone(observation));
    if(this.history.length>MAX_HISTORY)this.history.splice(0,this.history.length-MAX_HISTORY);
    return decision;
  }

  snapshot(nowMs=Date.now()):VisionTrafficControlSnapshot{
    this.prune(nowMs);
    const usable=this.history.filter((item)=>assessTrafficControlObservation(item,nowMs).usable);
    const speed=stableBy(usable.filter((item)=>item.kind==='speed-limit'),(item)=>item.speedLimitKmh===null?null:Math.round(item.speedLimitKmh));
    const signal=stableBy(usable.filter((item)=>item.kind==='traffic-light'),(item)=>item.signalState as TrafficSignalState|null);
    const stop=usable.filter((item)=>item.kind==='stop-sign'&&item.estimatedDistanceM!==null).sort((a,b)=>a.estimatedDistanceM!-b.estimatedDistanceM!||b.confidence-a.confidence)[0]??null;
    const yieldSign=usable.filter((item)=>item.kind==='yield-sign'&&item.estimatedDistanceM!==null).sort((a,b)=>a.estimatedDistanceM!-b.estimatedDistanceM!||b.confidence-a.confidence)[0]??null;
    const selected=[...(speed?.list??[]),...(signal?.list??[]),...(stop?[stop]:[]),...(yieldSign?[yieldSign]:[])];
    const degradedReasons:string[]=[];
    if(usable.some((item)=>item.kind==='speed-limit')&&!speed)degradedReasons.push('speed-limit-unstable');
    if(usable.some((item)=>item.kind==='traffic-light')&&!signal)degradedReasons.push('traffic-signal-unstable');
    return{
      speedLimitKmh:speed?Number(speed.key):null,
      speedLimitConfidence:speed?.confidence??0,
      signalState:signal?signal.key as TrafficSignalState:null,
      signalConfidence:signal?.confidence??0,
      stopSignDistanceM:stop?.estimatedDistanceM??null,
      yieldSignDistanceM:yieldSign?.estimatedDistanceM??null,
      observedAtMs:selected.length?Math.max(...selected.map((item)=>item.capturedAtMs)):null,
      sourceCameraIds:[...new Set(selected.map((item)=>item.cameraId))].sort(),
      degradedReasons,
      advisoryOnly:true,
    };
  }

  clear(){this.history=[];}
  private prune(nowMs:number){this.history=this.history.filter((item)=>item.capturedAtMs<=nowMs+250&&nowMs-item.capturedAtMs<=HISTORY_MS);}
}
