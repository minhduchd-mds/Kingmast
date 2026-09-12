export type ClaimTrust='trusted'|'degraded'|'unavailable';
export type CollisionClaimInput={radar:ClaimTrust;odometry:ClaimTrust;timeSync:ClaimTrust;cameraSemantic:ClaimTrust;rangeM:number|null;ttcS:number|null};
export type CollisionClaimDecision={level:'collision-warning-eligible'|'advisory-only'|'unavailable';reason:string;rangeM:number|null;ttcS:number|null;semanticLabelAllowed:boolean};

const validMetric=(value:number|null)=>value===null||(Number.isFinite(value)&&value>=0);
export function decideCollisionClaim(input:CollisionClaimInput):CollisionClaimDecision{
  if(!validMetric(input.rangeM)||!validMetric(input.ttcS))return{level:'unavailable',reason:'invalid-metric',rangeM:null,ttcS:null,semanticLabelAllowed:false};
  if(input.radar==='unavailable'||input.odometry==='unavailable'||input.timeSync==='unavailable')return{level:'unavailable',reason:'required-source-unavailable',rangeM:null,ttcS:null,semanticLabelAllowed:false};
  const semanticLabelAllowed=input.cameraSemantic==='trusted';
  if(input.rangeM===null||input.ttcS===null)return{level:'advisory-only',reason:'collision-metric-missing',rangeM:input.rangeM,ttcS:input.ttcS,semanticLabelAllowed};
  if(input.radar!=='trusted'||input.odometry!=='trusted'||input.timeSync!=='trusted')return{level:'advisory-only',reason:'assurance-degraded',rangeM:input.rangeM,ttcS:input.ttcS,semanticLabelAllowed};
  return{level:'collision-warning-eligible',reason:'bounded-trusted-evidence',rangeM:input.rangeM,ttcS:input.ttcS,semanticLabelAllowed};
}
