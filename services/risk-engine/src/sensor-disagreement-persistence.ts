export type DisagreementSample={observedAtMs:number;rangeResidualM:number;bearingResidualDeg:number};
export type DisagreementPolicy={maxAgeMs:number;rangeResidualLimitM:number;bearingResidualLimitDeg:number;persistentSamples:number};
export type DisagreementAssessment={status:'nominal'|'degraded'|'blocked';reason:string;fusionAllowed:boolean};

export function assessSensorDisagreementPersistence(samples:DisagreementSample[],nowMs:number,policy:DisagreementPolicy):DisagreementAssessment{
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.rangeResidualLimitM<0||policy.bearingResidualLimitDeg<0||!Number.isInteger(policy.persistentSamples)||policy.persistentSamples<2)return{status:'blocked',reason:'invalid-policy',fusionAllowed:false};
 const fresh=samples.filter((sample)=>Number.isFinite(sample.observedAtMs)&&Number.isFinite(sample.rangeResidualM)&&Number.isFinite(sample.bearingResidualDeg)&&sample.observedAtMs<=nowMs&&nowMs-sample.observedAtMs<=policy.maxAgeMs).sort((a,b)=>a.observedAtMs-b.observedAtMs);
 if(fresh.length===0)return{status:'blocked',reason:'no-fresh-cross-sensor-evidence',fusionAllowed:false};
 const disagree=(sample:DisagreementSample)=>Math.abs(sample.rangeResidualM)>policy.rangeResidualLimitM||Math.abs(sample.bearingResidualDeg)>policy.bearingResidualLimitDeg;
 let streak=0;
 for(const sample of fresh){streak=disagree(sample)?streak+1:0;}
 if(streak>=policy.persistentSamples)return{status:'blocked',reason:'persistent-cross-sensor-disagreement',fusionAllowed:false};
 if(streak>0)return{status:'degraded',reason:'transient-cross-sensor-disagreement',fusionAllowed:false};
 return{status:'nominal',reason:'cross-sensor-agreement-within-policy',fusionAllowed:true};
}
