export type SpeedLimitSource='camera-sign'|'map'|'provider';
export type SpeedLimitEvidence={source:SpeedLimitSource;observedAtMs:number;speedKph:number;confidence:number;provenanceId:string};
export type SpeedLimitPolicy={maxAgeMs:number;minConfidence:number;maxSpeedKph:number};
export type SpeedLimitAssessment={status:'trusted'|'degraded'|'unavailable';speedKph:number|null;source:SpeedLimitSource|null;reason:string;provenanceId:string|null};

export function assessSpeedLimitProvenance(evidence:SpeedLimitEvidence[],nowMs:number,policy:SpeedLimitPolicy):SpeedLimitAssessment{
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.minConfidence<0||policy.minConfidence>1||policy.maxSpeedKph<=0)return{status:'unavailable',speedKph:null,source:null,reason:'invalid-policy',provenanceId:null};
 const fresh=evidence.filter((item)=>item.provenanceId.length>0&&Number.isFinite(item.observedAtMs)&&Number.isFinite(item.speedKph)&&Number.isFinite(item.confidence)&&item.observedAtMs<=nowMs&&nowMs-item.observedAtMs<=policy.maxAgeMs&&item.speedKph>0&&item.speedKph<=policy.maxSpeedKph);
 if(fresh.length===0)return{status:'unavailable',speedKph:null,source:null,reason:'no-fresh-provenance',provenanceId:null};
 const trusted=fresh.filter((item)=>item.confidence>=policy.minConfidence).sort((a,b)=>b.observedAtMs-a.observedAtMs);
 if(trusted.length===0)return{status:'degraded',speedKph:null,source:null,reason:'confidence-below-policy',provenanceId:null};
 const distinct=new Set(trusted.map((item)=>item.speedKph));
 if(distinct.size>1)return{status:'degraded',speedKph:null,source:null,reason:'trusted-source-conflict',provenanceId:null};
 const selected=trusted[0]!;
 return{status:'trusted',speedKph:selected.speedKph,source:selected.source,reason:'fresh-provenanced-limit',provenanceId:selected.provenanceId};
}
