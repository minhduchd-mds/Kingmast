export type TrackObservation={trackId:string;observedAtMs:number;confidence:number};
export type TrackIdentityPolicy={maxGapMs:number;minStableSamples:number;minConfidence:number};
export type TrackIdentityAssessment={status:'stable'|'degraded'|'unavailable';trackId:string|null;reason:string};

export function assessTrackIdentityLifecycle(observations:TrackObservation[],nowMs:number,policy:TrackIdentityPolicy):TrackIdentityAssessment{
  if(!Number.isFinite(nowMs)||policy.maxGapMs<0||policy.minStableSamples<2||policy.minConfidence<0||policy.minConfidence>1)return{status:'unavailable',trackId:null,reason:'invalid-policy'};
  const valid=observations.filter((item)=>item.trackId.length>0&&Number.isFinite(item.observedAtMs)&&Number.isFinite(item.confidence)&&item.observedAtMs<=nowMs).sort((a,b)=>a.observedAtMs-b.observedAtMs);
  if(valid.length===0)return{status:'unavailable',trackId:null,reason:'no-valid-observations'};
  for(let i=1;i<valid.length;i++)if(valid[i]!.observedAtMs<=valid[i-1]!.observedAtMs)return{status:'unavailable',trackId:null,reason:'non-monotonic-time'};
  const latest=valid.at(-1)!;
  if(nowMs-latest.observedAtMs>policy.maxGapMs)return{status:'unavailable',trackId:null,reason:'track-stale'};
  if(valid.some((item)=>item.trackId!==latest.trackId))return{status:'degraded',trackId:latest.trackId,reason:'track-id-churn'};
  if(valid.some((item)=>item.confidence<policy.minConfidence))return{status:'degraded',trackId:latest.trackId,reason:'confidence-below-policy'};
  for(let i=1;i<valid.length;i++)if(valid[i]!.observedAtMs-valid[i-1]!.observedAtMs>policy.maxGapMs)return{status:'degraded',trackId:latest.trackId,reason:'continuity-gap'};
  if(valid.length<policy.minStableSamples)return{status:'degraded',trackId:latest.trackId,reason:'insufficient-history'};
  return{status:'stable',trackId:latest.trackId,reason:'stable-identity-history'};
}
