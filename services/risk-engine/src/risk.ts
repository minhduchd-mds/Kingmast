import type { RiskAssessment, VehicleSample } from '@kingmast/contracts';

const MIN_SPEED_MPS = 0.5;
const MAX_AGE_MS = 250;
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));

export function assessRisk(sample: VehicleSample, nowMs=Date.now()): RiskAssessment {
  const confidence=clamp01(sample.confidence);
  const reasons:string[]=[];
  if(nowMs-sample.timestampMs>MAX_AGE_MS) return {severity:'safe',ttcS:null,thwS:null,closingSpeedMps:0,confidence:0,reasons:['stale-data-rejected']};
  if(!sample.radarHealthy) return {severity:'safe',ttcS:null,thwS:null,closingSpeedMps:0,confidence:0,reasons:['radar-unavailable']};
  const closingSpeedMps=Math.max(0,sample.egoSpeedMps-sample.targetSpeedMps);
  const thwS=sample.egoSpeedMps>MIN_SPEED_MPS?sample.rangeM/sample.egoSpeedMps:null;
  const ttcS=closingSpeedMps>0.1?sample.rangeM/closingSpeedMps:null;
  if(!sample.canHealthy){ reasons.push('can-degraded'); if(confidence<0.9) return {severity:'caution',ttcS,thwS,closingSpeedMps,confidence:confidence*0.6,reasons}; }
  let severity:RiskAssessment['severity']='safe';
  if(confidence>=0.75 && ((ttcS!==null&&ttcS<1.6)||(thwS!==null&&thwS<1.0))) severity='critical';
  else if(confidence>=0.55 && ((ttcS!==null&&ttcS<3.2)||(thwS!==null&&thwS<1.8))) severity='caution';
  if(severity!=='safe') reasons.push(ttcS!==null?'closing-gap':'short-headway');
  return {severity,ttcS,thwS,closingSpeedMps,confidence,reasons};
}
