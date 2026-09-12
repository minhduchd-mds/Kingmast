export type LaneAssociationEvidence={observedAtMs:number;lateralOffsetM:number;laneHalfWidthM:number;objectWidthM:number;confidence:number;curvatureStatus:'nominal'|'degraded'|'unavailable'};
export type LaneAssociationPolicy={maxAgeMs:number;minConfidence:number;boundaryMarginM:number};
export type LaneAssociationAssessment={status:'ego-lane'|'ambiguous'|'outside'|'unavailable';reason:string;usableForLaneSpecificWarning:boolean};

export function assessLaneAssociationConfidence(evidence:LaneAssociationEvidence|null,nowMs:number,policy:LaneAssociationPolicy):LaneAssociationAssessment{
 if(!evidence)return{status:'unavailable',reason:'no-lane-evidence',usableForLaneSpecificWarning:false};
 if(!Number.isFinite(nowMs)||policy.maxAgeMs<0||policy.minConfidence<0||policy.minConfidence>1||policy.boundaryMarginM<0)return{status:'unavailable',reason:'invalid-policy',usableForLaneSpecificWarning:false};
 const values=[evidence.observedAtMs,evidence.lateralOffsetM,evidence.laneHalfWidthM,evidence.objectWidthM,evidence.confidence];
 if(values.some((value)=>!Number.isFinite(value))||evidence.laneHalfWidthM<=0||evidence.objectWidthM<0||evidence.observedAtMs>nowMs||nowMs-evidence.observedAtMs>policy.maxAgeMs)return{status:'unavailable',reason:'invalid-or-stale-evidence',usableForLaneSpecificWarning:false};
 if(evidence.curvatureStatus!=='nominal'||evidence.confidence<policy.minConfidence)return{status:'ambiguous',reason:evidence.curvatureStatus!=='nominal'?'curvature-not-nominal':'confidence-below-policy',usableForLaneSpecificWarning:false};
 const objectHalf=evidence.objectWidthM/2;
 const inner=Math.max(0,evidence.laneHalfWidthM-objectHalf-policy.boundaryMarginM);
 const outer=evidence.laneHalfWidthM+objectHalf+policy.boundaryMarginM;
 const offset=Math.abs(evidence.lateralOffsetM);
 if(offset<=inner)return{status:'ego-lane',reason:'object-footprint-inside-ego-lane',usableForLaneSpecificWarning:true};
 if(offset<outer)return{status:'ambiguous',reason:'object-overlaps-lane-boundary',usableForLaneSpecificWarning:false};
 return{status:'outside',reason:'object-outside-ego-lane',usableForLaneSpecificWarning:false};
}
