export type CurvatureSource='map'|'camera';
export type CurvatureObservation={source:CurvatureSource;observedAtMs:number;curvaturePerM:number;confidence:number};
export type CurvaturePolicy={maxAgeMs:number;minConfidence:number;maxDisagreementPerM:number};
export type CurvatureAssessment={status:'nominal'|'degraded'|'unavailable';curvaturePerM:number|null;reason:string};

export function assessRoadCurvatureConfidence(observations:CurvatureObservation[],nowMs:number,policy:CurvaturePolicy):CurvatureAssessment{
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.minConfidence<0||policy.minConfidence>1||policy.maxDisagreementPerM<0)return{status:'unavailable',curvaturePerM:null,reason:'invalid-policy'};
 const fresh=observations.filter((item)=>Number.isFinite(item.observedAtMs)&&Number.isFinite(item.curvaturePerM)&&Number.isFinite(item.confidence)&&item.observedAtMs<=nowMs&&nowMs-item.observedAtMs<=policy.maxAgeMs);
 if(fresh.length===0)return{status:'unavailable',curvaturePerM:null,reason:'no-fresh-curvature-evidence'};
 const trusted=fresh.filter((item)=>item.confidence>=policy.minConfidence);
 if(trusted.length===0)return{status:'degraded',curvaturePerM:null,reason:'confidence-below-policy'};
 if(trusted.length>1){
  const values=trusted.map((item)=>item.curvaturePerM);
  const spread=Math.max(...values)-Math.min(...values);
  if(spread>policy.maxDisagreementPerM)return{status:'degraded',curvaturePerM:null,reason:'cross-source-disagreement'};
  return{status:'nominal',curvaturePerM:values.reduce((sum,value)=>sum+value,0)/values.length,reason:'cross-source-consistent'};
 }
 return{status:'degraded',curvaturePerM:trusted[0]!.curvaturePerM,reason:'single-source-only'};
}
