export type RadarPersistenceSample={targetId:string;observedAtMs:number;rangeM:number;bearingDeg:number;radialVelocityMps:number;confidence:number};
export type RadarPersistencePolicy={maxAgeMs:number;minSamples:number;minConfidence:number;maxRangeJumpM:number;maxBearingJumpDeg:number;maxVelocityJumpMps:number};
export type RadarPersistenceAssessment={status:'persistent'|'degraded'|'ghost-suspected';reason:string;usableForCollisionGeometry:boolean};

export function assessRadarGhostPersistence(samples:RadarPersistenceSample[],nowMs:number,policy:RadarPersistencePolicy):RadarPersistenceAssessment{
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||!Number.isInteger(policy.minSamples)||policy.minSamples<2||policy.minConfidence<0||policy.minConfidence>1||policy.maxRangeJumpM<0||policy.maxBearingJumpDeg<0||policy.maxVelocityJumpMps<0)return{status:'ghost-suspected',reason:'invalid-policy',usableForCollisionGeometry:false};
 const fresh=samples.filter((sample)=>sample.targetId.length>0&&[sample.observedAtMs,sample.rangeM,sample.bearingDeg,sample.radialVelocityMps,sample.confidence].every(Number.isFinite)&&sample.rangeM>=0&&sample.observedAtMs<=nowMs&&nowMs-sample.observedAtMs<=policy.maxAgeMs).sort((a,b)=>a.observedAtMs-b.observedAtMs);
 if(fresh.length===0)return{status:'ghost-suspected',reason:'no-fresh-radar-history',usableForCollisionGeometry:false};
 const id=fresh.at(-1)!.targetId;
 if(fresh.some((sample)=>sample.targetId!==id))return{status:'ghost-suspected',reason:'target-identity-discontinuity',usableForCollisionGeometry:false};
 if(fresh.some((sample)=>sample.confidence<policy.minConfidence))return{status:'degraded',reason:'confidence-below-policy',usableForCollisionGeometry:false};
 for(let i=1;i<fresh.length;i++){
  const a=fresh[i-1]!,b=fresh[i]!;
  if(b.observedAtMs<=a.observedAtMs)return{status:'ghost-suspected',reason:'non-monotonic-radar-time',usableForCollisionGeometry:false};
  if(Math.abs(b.rangeM-a.rangeM)>policy.maxRangeJumpM||Math.abs(b.bearingDeg-a.bearingDeg)>policy.maxBearingJumpDeg||Math.abs(b.radialVelocityMps-a.radialVelocityMps)>policy.maxVelocityJumpMps)return{status:'ghost-suspected',reason:'kinematic-discontinuity',usableForCollisionGeometry:false};
 }
 if(fresh.length<policy.minSamples)return{status:'degraded',reason:'insufficient-persistence-history',usableForCollisionGeometry:false};
 return{status:'persistent',reason:'persistent-radar-track',usableForCollisionGeometry:true};
}
