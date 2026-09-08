import type { Severity } from '@kingmast/contracts';

export type TurnSignal='off'|'left'|'right'|'hazard';
export interface LaneObservation{
  timestampMs:number;
  speedKmh:number;
  laneWidthM:number;
  lateralOffsetM:number;
  lateralVelocityMps:number;
  headingErrorDeg:number;
  confidence:number;
  turnSignal:TurnSignal;
}
export interface LaneDepartureAssessment{
  severity:Severity;
  side:'left'|'right'|null;
  timeToLineCrossingS:number|null;
  projectedLateralSpeedMps:number;
  laneMarginM:number|null;
  riskScore:number;
  confidence:number;
  reason:string;
  advisoryOnly:true;
}

const MIN_SPEED_KMH=45;
const MIN_CONFIDENCE=.72;
const VEHICLE_HALF_WIDTH_M=.92;
const LANE_BUFFER_M=.18;

function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}
function round(value:number,digits=2){return Number(value.toFixed(digits));}
function safeAssessment(confidence:number,reason:string,laneMarginM:number|null=null,projectedLateralSpeedMps=0,riskScore=0):LaneDepartureAssessment{
  return{severity:'safe',side:null,timeToLineCrossingS:null,projectedLateralSpeedMps:round(projectedLateralSpeedMps,3),laneMarginM:laneMarginM===null?null:round(laneMarginM),riskScore:round(clamp(riskScore,0,1)),confidence,reason,advisoryOnly:true};
}

export function assessLaneDeparture(input:LaneObservation):LaneDepartureAssessment{
  const confidence=clamp(input.confidence,0,1);
  if(input.speedKmh<MIN_SPEED_KMH)return safeAssessment(confidence,'below-operating-speed');
  if(confidence<MIN_CONFIDENCE||input.laneWidthM<2.4||input.laneWidthM>5.5)return safeAssessment(confidence,'lane-model-not-reliable');

  const usableHalf=Math.max(.15,input.laneWidthM/2-VEHICLE_HALF_WIDTH_M-LANE_BUFFER_M);
  const laneMarginM=usableHalf-Math.abs(input.lateralOffsetM);
  const speedMps=input.speedKmh/3.6;
  const headingLateral=speedMps*Math.sin(input.headingErrorDeg*Math.PI/180);
  const projected=input.lateralVelocityMps+headingLateral;
  const offsetPressure=clamp(1-Math.max(0,laneMarginM)/usableHalf,0,1);
  const motionPressure=clamp(Math.abs(projected)/.8,0,1);
  const baselineRisk=clamp(.55*offsetPressure+.45*motionPressure,0,1);

  if(Math.abs(projected)<.06)return safeAssessment(confidence,'stable-lane-position',laneMarginM,projected,baselineRisk*.35);

  const side=projected<0?'left':'right';
  if(input.turnSignal===side||input.turnSignal==='hazard')return{severity:'safe',side,timeToLineCrossingS:null,projectedLateralSpeedMps:round(projected,3),laneMarginM:round(laneMarginM),riskScore:round(baselineRisk*.25),confidence,reason:'intentional-maneuver-suppressed',advisoryOnly:true};

  const remaining=side==='right'?usableHalf-input.lateralOffsetM:usableHalf+input.lateralOffsetM;
  const ttlc=remaining<=0?0:remaining/Math.abs(projected);
  const severity:Severity=ttlc<=.7?'critical':ttlc<=1.6?'caution':'safe';
  const ttlcRisk=clamp((2.5-ttlc)/2.5,0,1);
  const riskScore=clamp(Math.max(ttlcRisk,baselineRisk),0,1);
  return{severity,side,timeToLineCrossingS:round(ttlc),projectedLateralSpeedMps:round(projected,3),laneMarginM:round(laneMarginM),riskScore:round(riskScore),confidence,reason:severity==='safe'?'lane-crossing-not-imminent':`lane-departure-${side}`,advisoryOnly:true};
}
