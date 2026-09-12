export type SensorHealthSample={observedAtMs:number;online:boolean;selfTestOk:boolean;calibrationValid:boolean};
export type SensorHealthPolicy={maxAgeMs:number;healthySamplesRequired:number};
export type SensorHealthState={status:'healthy'|'degraded'|'unavailable';reason:string;healthyStreak:number};

export function deriveSensorHealth(samples:SensorHealthSample[],nowMs:number,policy:SensorHealthPolicy):SensorHealthState{
  if(!Number.isFinite(nowMs)||!Number.isFinite(policy.maxAgeMs)||policy.maxAgeMs<0||!Number.isInteger(policy.healthySamplesRequired)||policy.healthySamplesRequired<1)return{status:'unavailable',reason:'invalid-policy',healthyStreak:0};
  if(samples.length===0)return{status:'unavailable',reason:'no-health-evidence',healthyStreak:0};
  let previous=-Infinity;
  let healthyStreak=0;
  for(const sample of samples){
    if(!Number.isFinite(sample.observedAtMs)||sample.observedAtMs<=previous||sample.observedAtMs>nowMs)return{status:'unavailable',reason:'invalid-health-timeline',healthyStreak:0};
    previous=sample.observedAtMs;
    if(sample.online&&sample.selfTestOk&&sample.calibrationValid)healthyStreak+=1;else healthyStreak=0;
  }
  const latest=samples[samples.length-1]!;
  if(nowMs-latest.observedAtMs>policy.maxAgeMs)return{status:'unavailable',reason:'stale-health-evidence',healthyStreak:0};
  if(!latest.online)return{status:'unavailable',reason:'sensor-offline',healthyStreak:0};
  if(!latest.selfTestOk)return{status:'degraded',reason:'self-test-failed',healthyStreak:0};
  if(!latest.calibrationValid)return{status:'degraded',reason:'calibration-invalid',healthyStreak:0};
  if(healthyStreak<policy.healthySamplesRequired)return{status:'degraded',reason:'healthy-streak-pending',healthyStreak};
  return{status:'healthy',reason:'stable-healthy-evidence',healthyStreak};
}
