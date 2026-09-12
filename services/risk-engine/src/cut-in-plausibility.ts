export type CutInObservation={observedAtMs:number;lateralOffsetM:number;lateralVelocityMps:number;longitudinalGapM:number;confidence:number};
export type CutInPolicy={maxAgeMs:number;minConfidence:number;minLateralSpeedMps:number;maxLaneEntryTimeSec:number;maxRelevantGapM:number};
export type CutInAssessment={status:'plausible'|'degraded'|'rejected';reason:string;timeToLaneEntrySec:number|null};

export function assessCutInPlausibility(observation:CutInObservation|null,nowMs:number,policy:CutInPolicy):CutInAssessment{
 if(!observation)return{status:'rejected',reason:'no-observation',timeToLaneEntrySec:null};
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.minConfidence<0||policy.minConfidence>1||policy.minLateralSpeedMps<0||policy.maxLaneEntryTimeSec<=0||policy.maxRelevantGapM<=0)return{status:'rejected',reason:'invalid-policy',timeToLaneEntrySec:null};
 const values=[observation.observedAtMs,observation.lateralOffsetM,observation.lateralVelocityMps,observation.longitudinalGapM,observation.confidence];
 if(values.some((value)=>!Number.isFinite(value))||observation.observedAtMs>nowMs||nowMs-observation.observedAtMs>policy.maxAgeMs)return{status:'rejected',reason:'invalid-or-stale-evidence',timeToLaneEntrySec:null};
 if(observation.longitudinalGapM<=0||observation.longitudinalGapM>policy.maxRelevantGapM)return{status:'rejected',reason:'outside-relevant-gap',timeToLaneEntrySec:null};
 if(observation.confidence<policy.minConfidence)return{status:'degraded',reason:'confidence-below-policy',timeToLaneEntrySec:null};
 const towardLane=observation.lateralOffsetM===0?false:Math.sign(observation.lateralOffsetM)!==Math.sign(observation.lateralVelocityMps);
 if(!towardLane||Math.abs(observation.lateralVelocityMps)<policy.minLateralSpeedMps)return{status:'rejected',reason:'no-supported-lateral-entry',timeToLaneEntrySec:null};
 const timeToLaneEntrySec=Math.abs(observation.lateralOffsetM/observation.lateralVelocityMps);
 if(timeToLaneEntrySec>policy.maxLaneEntryTimeSec)return{status:'degraded',reason:'lane-entry-not-imminent',timeToLaneEntrySec};
 return{status:'plausible',reason:'bounded-lateral-entry-supported',timeToLaneEntrySec};
}
