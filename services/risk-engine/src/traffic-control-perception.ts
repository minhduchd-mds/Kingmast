import type { SpeedLimitContext,SpeedLimitSource } from '@kingmast/contracts';
import type { TrafficControlObservation,TrafficSignalState } from '@kingmast/contracts/nextgen';

const MAX_OBSERVATION_AGE_MS=2_000;
const MAX_FUTURE_SKEW_MS=250;
const MIN_CONFIDENCE=.72;

export interface TrafficControlDecision {
  usable:boolean;
  reason:'accepted'|'stale'|'future'|'low-confidence'|'invalid-distance'|'unsupported';
  observation:TrafficControlObservation;
}

export function assessTrafficControlObservation(observation:TrafficControlObservation,nowMs=Date.now()):TrafficControlDecision{
  const age=nowMs-observation.capturedAtMs;
  if(age < -MAX_FUTURE_SKEW_MS)return{usable:false,reason:'future',observation};
  if(age > MAX_OBSERVATION_AGE_MS)return{usable:false,reason:'stale',observation};
  if(observation.confidence<MIN_CONFIDENCE)return{usable:false,reason:'low-confidence',observation};
  if(observation.estimatedDistanceM!==null&&(observation.estimatedDistanceM<0||observation.estimatedDistanceM>250))return{usable:false,reason:'invalid-distance',observation};
  if(observation.kind==='speed-limit'&&(!observation.speedLimitKmh||observation.speedLimitKmh<5||observation.speedLimitKmh>180))return{usable:false,reason:'unsupported',observation};
  if(observation.kind==='traffic-light'&&!observation.signalState)return{usable:false,reason:'unsupported',observation};
  return{usable:true,reason:'accepted',observation};
}

export function speedLimitFromVision(observation:TrafficControlObservation,roadName:string|null,nowMs=Date.now()):SpeedLimitContext|null{
  const decision=assessTrafficControlObservation(observation,nowMs);
  if(!decision.usable||observation.kind!=='speed-limit'||observation.speedLimitKmh===null)return null;
  const source:SpeedLimitSource='sign-vision';
  return{currentKmh:Math.round(observation.speedLimitKmh),source,confidence:observation.confidence,roadName,conditional:null,observedAtMs:observation.capturedAtMs};
}

export function trafficLightState(observations:TrafficControlObservation[],nowMs=Date.now()):{state:TrafficSignalState;confidence:number;observedAtMs:number}|null{
  const candidates=observations
    .filter((item)=>item.kind==='traffic-light'&&item.signalState!==null&&assessTrafficControlObservation(item,nowMs).usable)
    .sort((a,b)=>b.confidence-a.confidence||b.capturedAtMs-a.capturedAtMs);
  const best=candidates[0];
  return best?.signalState?{state:best.signalState,confidence:best.confidence,observedAtMs:best.capturedAtMs}:null;
}
