export type PerceptionEvidenceSource='radar'|'camera'|'radar-camera';
export type AssuranceState='verified'|'unknown'|'invalid';
export type PerceptionClaimState='nominal'|'degraded'|'unavailable';

export interface PerceptionClaimInput{
  nowMs:number;
  observedAtMs:number;
  source:PerceptionEvidenceSource;
  confidence:number;
  maxAgeMs:number;
  minimumConfidence:number;
  calibration:AssuranceState;
  timeSync:AssuranceState;
  geometryAuthoritative:boolean;
}

export interface PerceptionClaimAssessment{
  state:PerceptionClaimState;
  confidenceCeiling:number;
  reasons:string[];
  allowedClaims:{range:boolean;relativeSpeed:boolean;classification:boolean};
  controlAuthority:'none';
  qualificationClaim:'research-perception-claim-gate-only';
}

const MAX_FUTURE_SKEW_MS=50;
const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

export function assessPerceptionClaims(input:PerceptionClaimInput):PerceptionClaimAssessment{
  const reasons:string[]=[];
  const invalidNumeric=[input.nowMs,input.observedAtMs,input.confidence,input.maxAgeMs,input.minimumConfidence].some((value)=>!Number.isFinite(value));
  if(invalidNumeric||input.maxAgeMs<0||input.minimumConfidence<0||input.minimumConfidence>1){
    return{state:'unavailable',confidenceCeiling:0,reasons:['invalid-input'],allowedClaims:{range:false,relativeSpeed:false,classification:false},controlAuthority:'none',qualificationClaim:'research-perception-claim-gate-only'};
  }

  const ageMs=input.nowMs-input.observedAtMs;
  if(ageMs< -MAX_FUTURE_SKEW_MS)reasons.push('future-dated-evidence');
  if(ageMs>input.maxAgeMs)reasons.push('stale-evidence');
  if(input.calibration==='invalid')reasons.push('calibration-invalid');
  if(input.timeSync==='invalid')reasons.push('time-sync-invalid');
  if(input.calibration==='unknown')reasons.push('calibration-unverified');
  if(input.timeSync==='unknown')reasons.push('time-sync-unverified');
  if(input.confidence<input.minimumConfidence)reasons.push('confidence-below-threshold');
  if((input.source==='radar'||input.source==='radar-camera')&&!input.geometryAuthoritative)reasons.push('geometry-not-authoritative');

  const hardFailure=reasons.some((reason)=>['future-dated-evidence','stale-evidence','calibration-invalid','time-sync-invalid','confidence-below-threshold'].includes(reason));
  const geometryUsable=!hardFailure&&input.geometryAuthoritative&&(input.source==='radar'||input.source==='radar-camera');
  const classificationUsable=!hardFailure&&(input.source==='camera'||input.source==='radar-camera')&&input.calibration==='verified'&&input.timeSync==='verified';

  let confidenceCeiling=clamp01(input.confidence);
  if(input.calibration==='unknown'||input.timeSync==='unknown')confidenceCeiling=Math.min(confidenceCeiling,0.6);
  if(reasons.includes('geometry-not-authoritative'))confidenceCeiling=Math.min(confidenceCeiling,0.5);
  if(hardFailure)confidenceCeiling=0;

  const state:PerceptionClaimState=hardFailure?'unavailable':reasons.length?'degraded':'nominal';
  return{
    state,
    confidenceCeiling,
    reasons,
    allowedClaims:{range:geometryUsable,relativeSpeed:geometryUsable,classification:classificationUsable},
    controlAuthority:'none',
    qualificationClaim:'research-perception-claim-gate-only',
  };
}
