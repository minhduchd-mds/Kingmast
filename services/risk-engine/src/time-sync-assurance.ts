export type TimeSyncAssuranceState='verified'|'unknown'|'invalid';

export interface ReviewedTimeSyncBounds{
  maxOffsetMs:number;
  maxJitterMs:number;
  reviewRef:string;
}

export interface TimeSyncAssuranceInput{
  nowMs:number;
  observedAtMs:number;
  offsetMs:number;
  jitterMs:number;
  monotonic:boolean;
  reviewedBounds:ReviewedTimeSyncBounds|null;
}

export interface TimeSyncAssuranceAssessment{
  state:TimeSyncAssuranceState;
  reasons:string[];
  crossSensorFusionAllowed:boolean;
  controlAuthority:'none';
  qualificationClaim:'time-sync-assurance-only-not-hardware-qualification';
}

const MAX_FUTURE_SKEW_MS=50;

export function assessTimeSyncAssurance(input:TimeSyncAssuranceInput):TimeSyncAssuranceAssessment{
  const reasons:string[]=[];
  const numeric=[input.nowMs,input.observedAtMs,input.offsetMs,input.jitterMs];
  if(numeric.some((value)=>!Number.isFinite(value))||input.offsetMs<0||input.jitterMs<0)reasons.push('invalid-measurement');
  if(!input.monotonic)reasons.push('clock-regression');
  if(Number.isFinite(input.nowMs)&&Number.isFinite(input.observedAtMs)&&input.observedAtMs>input.nowMs+MAX_FUTURE_SKEW_MS)reasons.push('future-dated-observation');

  const bounds=input.reviewedBounds;
  if(bounds===null)reasons.push('reviewed-bounds-missing');
  else{
    if(!Number.isFinite(bounds.maxOffsetMs)||!Number.isFinite(bounds.maxJitterMs)||bounds.maxOffsetMs<0||bounds.maxJitterMs<0||!bounds.reviewRef.trim())reasons.push('reviewed-bounds-invalid');
    else{
      if(input.offsetMs>bounds.maxOffsetMs)reasons.push('offset-outside-reviewed-bound');
      if(input.jitterMs>bounds.maxJitterMs)reasons.push('jitter-outside-reviewed-bound');
    }
  }

  const invalid=reasons.some((reason)=>reason!=='reviewed-bounds-missing');
  const state:TimeSyncAssuranceState=invalid?'invalid':bounds===null?'unknown':'verified';
  return{
    state,
    reasons,
    crossSensorFusionAllowed:state==='verified',
    controlAuthority:'none',
    qualificationClaim:'time-sync-assurance-only-not-hardware-qualification',
  };
}
