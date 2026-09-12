export type EgoMotionSource='can-readonly'|'wheel-odometry'|'gnss'|'imu';
export type EgoMotionEvidence={source:EgoMotionSource;observedAtMs:number;speedMps:number;confidence:number;provenanceId:string};
export type EgoMotionPolicy={maxAgeMs:number;minConfidence:number;maxCrossSourceDeltaMps:number};
export type EgoMotionAssessment={status:'trusted'|'degraded'|'unavailable';speedMps:number|null;reason:string;primarySource:EgoMotionSource|null};

export function assessEgoMotionProvenance(evidence:EgoMotionEvidence[],nowMs:number,policy:EgoMotionPolicy):EgoMotionAssessment{
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.minConfidence<0||policy.minConfidence>1||policy.maxCrossSourceDeltaMps<0)return{status:'unavailable',speedMps:null,reason:'invalid-policy',primarySource:null};
 const fresh=evidence.filter((item)=>item.provenanceId.length>0&&Number.isFinite(item.observedAtMs)&&Number.isFinite(item.speedMps)&&item.speedMps>=0&&Number.isFinite(item.confidence)&&item.observedAtMs<=nowMs&&nowMs-item.observedAtMs<=policy.maxAgeMs);
 if(fresh.length===0)return{status:'unavailable',speedMps:null,reason:'no-fresh-provenanced-motion',primarySource:null};
 const trusted=fresh.filter((item)=>item.confidence>=policy.minConfidence);
 if(trusted.length===0)return{status:'degraded',speedMps:null,reason:'confidence-below-policy',primarySource:null};
 const preferred=['can-readonly','wheel-odometry','imu','gnss'] as const;
 trusted.sort((a,b)=>preferred.indexOf(a.source)-preferred.indexOf(b.source)||b.observedAtMs-a.observedAtMs);
 const primary=trusted[0]!;
 if(trusted.length===1)return{status:'degraded',speedMps:primary.speedMps,reason:'single-source-motion',primarySource:primary.source};
 if(trusted.some((item)=>Math.abs(item.speedMps-primary.speedMps)>policy.maxCrossSourceDeltaMps))return{status:'degraded',speedMps:null,reason:'cross-source-motion-disagreement',primarySource:null};
 return{status:'trusted',speedMps:primary.speedMps,reason:'fresh-cross-checked-motion',primarySource:primary.source};
}
