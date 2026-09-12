export type CameraHealthSample={observedAtMs:number;obstructionRatio:number;confidence:number;selfTest:'pass'|'fail'|'unknown'};
export type CameraHealthPolicy={maxAgeMs:number;degradedObstructionRatio:number;unavailableObstructionRatio:number;minConfidence:number};
export type CameraHealthAssessment={status:'nominal'|'degraded'|'unavailable';reason:string;semanticClaimsAllowed:boolean};

export function assessCameraObstructionHealth(sample:CameraHealthSample|null,nowMs:number,policy:CameraHealthPolicy):CameraHealthAssessment{
 if(!sample)return{status:'unavailable',reason:'no-observation',semanticClaimsAllowed:false};
 if(!Number.isFinite(nowMs)||!Number.isFinite(sample.observedAtMs)||!Number.isFinite(sample.obstructionRatio)||!Number.isFinite(sample.confidence)||policy.maxAgeMs<0||policy.degradedObstructionRatio<0||policy.unavailableObstructionRatio>1||policy.degradedObstructionRatio>policy.unavailableObstructionRatio)return{status:'unavailable',reason:'invalid-evidence',semanticClaimsAllowed:false};
 if(sample.observedAtMs>nowMs||nowMs-sample.observedAtMs>policy.maxAgeMs)return{status:'unavailable',reason:'stale-or-future-observation',semanticClaimsAllowed:false};
 if(sample.selfTest==='fail'||sample.obstructionRatio>=policy.unavailableObstructionRatio)return{status:'unavailable',reason:sample.selfTest==='fail'?'self-test-failed':'camera-obstructed',semanticClaimsAllowed:false};
 if(sample.selfTest==='unknown'||sample.obstructionRatio>=policy.degradedObstructionRatio||sample.confidence<policy.minConfidence)return{status:'degraded',reason:sample.selfTest==='unknown'?'self-test-unknown':sample.obstructionRatio>=policy.degradedObstructionRatio?'partial-obstruction':'confidence-below-policy',semanticClaimsAllowed:false};
 return{status:'nominal',reason:'fresh-unobstructed-observation',semanticClaimsAllowed:true};
}
