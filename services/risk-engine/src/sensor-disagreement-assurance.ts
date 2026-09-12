export interface SensorAssociationEvidence{
  radarId:string;
  cameraId:string;
  rangeResidualM:number;
  timestampSkewMs:number;
}

export interface SensorDisagreementInput{
  radarTrackCount:number;
  cameraDetectionCount:number;
  matches:SensorAssociationEvidence[];
  maxRangeResidualM:number;
  maxTimestampSkewMs:number;
}

export interface SensorDisagreementAssessment{
  state:'nominal'|'degraded'|'invalid';
  reasons:string[];
  fusionAllowed:boolean;
  confidenceCeiling:number;
  controlAuthority:'none';
  qualificationClaim:'cross-sensor-disagreement-gate-only';
}

const validCount=(value:number)=>Number.isInteger(value)&&value>=0;

export function assessSensorDisagreement(input:SensorDisagreementInput):SensorDisagreementAssessment{
  const reasons:string[]=[];
  if(!validCount(input.radarTrackCount)||!validCount(input.cameraDetectionCount)||!Number.isFinite(input.maxRangeResidualM)||!Number.isFinite(input.maxTimestampSkewMs)||input.maxRangeResidualM<0||input.maxTimestampSkewMs<0){
    return{state:'invalid',reasons:['invalid-input'],fusionAllowed:false,confidenceCeiling:0,controlAuthority:'none',qualificationClaim:'cross-sensor-disagreement-gate-only'};
  }

  const radarIds=new Set<string>();
  const cameraIds=new Set<string>();
  for(const match of input.matches){
    if(!match.radarId.trim()||!match.cameraId.trim()||!Number.isFinite(match.rangeResidualM)||!Number.isFinite(match.timestampSkewMs)||match.rangeResidualM<0||match.timestampSkewMs<0){
      reasons.push('invalid-association');
      continue;
    }
    if(radarIds.has(match.radarId))reasons.push('one-radar-to-many-camera-reuse');
    if(cameraIds.has(match.cameraId))reasons.push('one-camera-to-many-radar-reuse');
    radarIds.add(match.radarId);
    cameraIds.add(match.cameraId);
    if(match.rangeResidualM>input.maxRangeResidualM)reasons.push('range-residual-outside-gate');
    if(match.timestampSkewMs>input.maxTimestampSkewMs)reasons.push('timestamp-skew-outside-gate');
  }

  if(input.matches.length>Math.min(input.radarTrackCount,input.cameraDetectionCount))reasons.push('association-count-impossible');
  const unique=[...new Set(reasons)];
  const invalid=unique.includes('invalid-association')||unique.includes('association-count-impossible');
  const disagreement=unique.length>0;
  return{
    state:invalid?'invalid':disagreement?'degraded':'nominal',
    reasons:unique,
    fusionAllowed:!disagreement,
    confidenceCeiling:invalid?0:disagreement?0.55:1,
    controlAuthority:'none',
    qualificationClaim:'cross-sensor-disagreement-gate-only',
  };
}
