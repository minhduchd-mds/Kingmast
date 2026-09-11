import type { CameraPerformanceSnapshot } from '@kingmast/contracts/nextgen';

const MAX_LATENCY_SAMPLES=256;

interface CameraStats {
  capturedFrames:number;
  processedFrames:number;
  droppedFrames:number;
  latencies:number[];
}

export type CameraRuntimeHealth='ok'|'degraded'|'overloaded'|'unavailable';
export interface CameraRuntimeHealthSnapshot{
  cameraId:string;
  status:CameraRuntimeHealth;
  dropRate:number;
  p50LatencyMs:number|null;
  p95LatencyMs:number|null;
}

function percentile(values:number[],ratio:number){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);const index=Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*ratio)-1));return sorted[index]??null;}

export class CameraPerformanceTracker{
  private readonly stats=new Map<string,CameraStats>();

  captured(cameraId:string){this.get(cameraId).capturedFrames+=1;}
  dropped(cameraId:string,count=1){this.get(cameraId).droppedFrames+=Math.max(0,Math.floor(count));}
  processed(cameraId:string,capturedAtMs:number,completedAtMs=Date.now()){
    const stats=this.get(cameraId);
    stats.processedFrames+=1;
    const latency=Math.max(0,completedAtMs-capturedAtMs);
    stats.latencies.push(latency);
    if(stats.latencies.length>MAX_LATENCY_SAMPLES)stats.latencies.splice(0,stats.latencies.length-MAX_LATENCY_SAMPLES);
  }

  snapshot(cameraId:string):CameraPerformanceSnapshot{
    const stats=this.get(cameraId);
    const average=stats.latencies.length?stats.latencies.reduce((sum,value)=>sum+value,0)/stats.latencies.length:null;
    return{cameraId,capturedFrames:stats.capturedFrames,processedFrames:stats.processedFrames,droppedFrames:stats.droppedFrames,latestLatencyMs:stats.latencies.at(-1)??null,averageLatencyMs:average,p95LatencyMs:percentile(stats.latencies,.95)};
  }

  health(cameraId:string):CameraRuntimeHealthSnapshot{
    const stats=this.get(cameraId);
    const dropRate=stats.capturedFrames?Math.min(1,stats.droppedFrames/stats.capturedFrames):0;
    const p50LatencyMs=percentile(stats.latencies,.5);
    const p95LatencyMs=percentile(stats.latencies,.95);
    const enoughVolume=stats.capturedFrames>=10||stats.processedFrames>=10;
    let status:CameraRuntimeHealth='ok';
    if(stats.processedFrames===0)status='unavailable';
    else if((p95LatencyMs!==null&&p95LatencyMs>750)||(enoughVolume&&dropRate>=.5))status='overloaded';
    else if((p95LatencyMs!==null&&p95LatencyMs>350)||(enoughVolume&&dropRate>=.2))status='degraded';
    return{cameraId,status,dropRate,p50LatencyMs,p95LatencyMs};
  }

  all(){return[...this.stats.keys()].sort().map((cameraId)=>this.snapshot(cameraId));}
  healthAll(){return[...this.stats.keys()].sort().map((cameraId)=>this.health(cameraId));}
  reset(cameraId?:string){if(cameraId)this.stats.delete(cameraId);else this.stats.clear();}

  private get(cameraId:string){let stats=this.stats.get(cameraId);if(!stats){stats={capturedFrames:0,processedFrames:0,droppedFrames:0,latencies:[]};this.stats.set(cameraId,stats);}return stats;}
}
