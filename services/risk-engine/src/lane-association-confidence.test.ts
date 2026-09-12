import{describe,expect,it}from'vitest';
import{assessLaneAssociationConfidence}from'./lane-association-confidence.js';
const p={maxAgeMs:500,minConfidence:.8,boundaryMarginM:.2};
const e=(lateralOffsetM:number,curvatureStatus:'nominal'|'degraded'|'unavailable'='nominal',confidence=.9)=>({observedAtMs:1000,lateralOffsetM,laneHalfWidthM:1.8,objectWidthM:1.8,confidence,curvatureStatus});
describe('lane association confidence',()=>{
 it('accepts object clearly inside ego lane',()=>expect(assessLaneAssociationConfidence(e(.4),1100,p)).toMatchObject({status:'ego-lane',usableForLaneSpecificWarning:true}));
 it('keeps boundary overlap ambiguous',()=>expect(assessLaneAssociationConfidence(e(1.2),1100,p).status).toBe('ambiguous'));
 it('does not use degraded curvature for lane-specific warning',()=>expect(assessLaneAssociationConfidence(e(.2,'degraded'),1100,p)).toMatchObject({status:'ambiguous',usableForLaneSpecificWarning:false}));
 it('classifies clearly outside object without escalating',()=>expect(assessLaneAssociationConfidence(e(3),1100,p).status).toBe('outside'));
});
