export type CalibrationReviewState='pending'|'accepted'|'rejected';
export type CalibrationAssuranceState='verified'|'unknown'|'invalid';

export interface CalibrationAssuranceInput{
  nowMs:number;
  capturedAtMs:number;
  maxAgeMs:number;
  sensorId:string;
  calibrationRevision:string;
  configurationRevision:string;
  artifactSha256:string;
  mountRevision:string;
  expectedMountRevision:string;
  review:CalibrationReviewState;
}

export interface CalibrationAssuranceAssessment{
  state:CalibrationAssuranceState;
  reasons:string[];
  usableForResearchClaims:boolean;
  controlAuthority:'none';
  qualificationClaim:'calibration-assurance-gate-only-not-physical-qualification';
}

const SHA256=/^[a-f0-9]{64}$/i;
const MAX_FUTURE_SKEW_MS=50;
const present=(value:string)=>value.trim().length>0;

export function assessCalibrationAssurance(input:CalibrationAssuranceInput):CalibrationAssuranceAssessment{
  const reasons:string[]=[];
  if(!Number.isFinite(input.nowMs)||!Number.isFinite(input.capturedAtMs)||!Number.isFinite(input.maxAgeMs)||input.maxAgeMs<0)reasons.push('invalid-time-input');
  if(!present(input.sensorId))reasons.push('sensor-id-missing');
  if(!present(input.calibrationRevision))reasons.push('calibration-revision-missing');
  if(!present(input.configurationRevision))reasons.push('configuration-revision-missing');
  if(!SHA256.test(input.artifactSha256))reasons.push('calibration-artifact-hash-invalid');
  if(!present(input.mountRevision)||!present(input.expectedMountRevision))reasons.push('mount-revision-missing');
  else if(input.mountRevision!==input.expectedMountRevision)reasons.push('mount-revision-mismatch');

  if(Number.isFinite(input.nowMs)&&Number.isFinite(input.capturedAtMs)&&Number.isFinite(input.maxAgeMs)){
    const ageMs=input.nowMs-input.capturedAtMs;
    if(ageMs< -MAX_FUTURE_SKEW_MS)reasons.push('calibration-future-dated');
    else if(ageMs>input.maxAgeMs)reasons.push('calibration-stale');
  }
  if(input.review==='rejected')reasons.push('independent-review-rejected');
  if(input.review==='pending')reasons.push('independent-review-pending');

  const invalid=reasons.some((reason)=>reason!=='independent-review-pending');
  const state:CalibrationAssuranceState=invalid?'invalid':input.review==='accepted'?'verified':'unknown';
  return{
    state,
    reasons,
    usableForResearchClaims:state==='verified',
    controlAuthority:'none',
    qualificationClaim:'calibration-assurance-gate-only-not-physical-qualification',
  };
}
