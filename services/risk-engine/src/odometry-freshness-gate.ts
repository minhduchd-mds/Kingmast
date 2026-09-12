export type OdometrySample={observedAtMs:number;speedKmh:number;distanceM:number;source:'can-readonly'|'wheel-speed'|'gnss-derived'};
export type OdometryPolicy={maxAgeMs:number;maxSpeedKmh:number;maxDistanceDeltaM:number};
export type OdometryAssessment={status:'trusted'|'degraded'|'rejected';reason:string;speedKmh:number|null};

export function assessOdometry(samples:OdometrySample[],nowMs:number,policy:OdometryPolicy):OdometryAssessment{
  if(!Number.isFinite(nowMs)||!Number.isFinite(policy.maxAgeMs)||!Number.isFinite(policy.maxSpeedKmh)||!Number.isFinite(policy.maxDistanceDeltaM)||policy.maxAgeMs<0||policy.maxSpeedKmh<=0||policy.maxDistanceDeltaM<0)return{status:'rejected',reason:'invalid-policy',speedKmh:null};
  if(samples.length===0)return{status:'rejected',reason:'no-odometry',speedKmh:null};
  let previous:OdometrySample|undefined;
  for(const sample of samples){
    if(!Number.isFinite(sample.observedAtMs)||!Number.isFinite(sample.speedKmh)||!Number.isFinite(sample.distanceM)||sample.speedKmh<0||sample.distanceM<0)return{status:'rejected',reason:'invalid-sample',speedKmh:null};
    if(sample.observedAtMs>nowMs)return{status:'rejected',reason:'future-sample',speedKmh:null};
    if(previous){
      if(sample.observedAtMs<=previous.observedAtMs)return{status:'rejected',reason:'non-monotonic-time',speedKmh:null};
      if(sample.distanceM<previous.distanceM)return{status:'rejected',reason:'distance-regression',speedKmh:null};
      if(sample.distanceM-previous.distanceM>policy.maxDistanceDeltaM)return{status:'degraded',reason:'distance-jump',speedKmh:null};
    }
    previous=sample;
  }
  const latest=samples[samples.length-1]!;
  if(nowMs-latest.observedAtMs>policy.maxAgeMs)return{status:'rejected',reason:'stale-odometry',speedKmh:null};
  if(latest.speedKmh>policy.maxSpeedKmh)return{status:'degraded',reason:'implausible-speed',speedKmh:null};
  if(latest.source==='gnss-derived')return{status:'degraded',reason:'derived-speed-only',speedKmh:latest.speedKmh};
  return{status:'trusted',reason:'fresh-readonly-odometry',speedKmh:latest.speedKmh};
}
