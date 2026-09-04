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
  confidence:number;
  reason:string;
  advisoryOnly:true;
}

const MIN_SPEED_KMH=45;
const MIN_CONFIDENCE=.72;
const VEHICLE_HALF_WIDTH_M=.92;
const LANE_BUFFER_M=.18;

function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}

export function assessLaneDeparture(input:LaneObservation):LaneDepartureAssessment{
  const confidence=clamp(input.confidence,0,1);
  if(input.speedKmh<MIN_SPEED_KMH)return{severity:'safe',side:null,timeToLineCrossingS:null,projectedLateralSpeedMps:0,confidence,reason:'below-operating-speed',advisoryOnly:true};
  if(confidence<MIN_CONFIDENCE||input.laneWidthM<2.4||input.laneWidthM>5.5)return{severity:'safe',side:null,timeToLineCrossingS:null,projectedLateralSpeedMps:0,confidence,reason:'lane-model-not-reliable',advisoryOnly:true};

  const speedMps=input.speedKmh/3.6;
  const headingLateral=speedMps*Math.sin(input.headingErrorDeg*Math.PI/180);
  const projected=input.lateralVelocityMps+headingLateral;
  if(Math.abs(projected)<.06)return{severity:'safe',side:null,timeToLineCrossingS:null,projectedLateralSpeedMps:projected,confidence,reason:'stable-lane-position',advisoryOnly:true};

  const side=projected<0?'left':'right';
  if(input.turnSignal===side||input.turnSignal==='hazard')return{severity:'safe',side,timeToLineCrossingS:null,projectedLateralSpeedMps:projected,confidence,reason:'intentional-maneuver-suppressed',advisoryOnly:true};

  const usableHalf=Math.max(.15,input.laneWidthM/2-VEHICLE_HALF_WIDTH_M-LANE_BUFFER_M);
  const remaining=side==='right'?usableHalf-input.lateralOffsetM:usableHalf+input.lateralOffsetM;
  const ttlc=remaining<=0?0:remaining/Math.abs(projected);
  const severity:Severity=ttlc<=.7?'critical':ttlc<=1.6?'caution':'safe';
  return{severity,side,timeToLineCrossingS:Number(ttlc.toFixed(2)),projectedLateralSpeedMps:Number(projected.toFixed(3)),confidence,reason:severity==='safe'?'lane-crossing-not-imminent':`lane-departure-${side}`,advisoryOnly:true};
}
