import{describe,expect,it}from'vitest';
import{assessCutInPlausibility}from'./cut-in-plausibility.js';
const p={maxAgeMs:300,minConfidence:.8,minLateralSpeedMps:.3,maxLaneEntryTimeSec:3,maxRelevantGapM:60};
const o=(lateralOffsetM:number,lateralVelocityMps:number,longitudinalGapM=20,confidence=.9)=>({observedAtMs:1000,lateralOffsetM,lateralVelocityMps,longitudinalGapM,confidence});
describe('cut in plausibility',()=>{
 it('accepts bounded motion toward ego lane',()=>expect(assessCutInPlausibility(o(1.5,-1),1100,p)).toMatchObject({status:'plausible',timeToLaneEntrySec:1.5}));
 it('rejects lateral motion away from ego lane',()=>expect(assessCutInPlausibility(o(1.5,1),1100,p).reason).toBe('no-supported-lateral-entry'));
 it('degrades slow future lane entry',()=>expect(assessCutInPlausibility(o(2,-.5),1100,p).reason).toBe('lane-entry-not-imminent'));
 it('rejects distant object outside relevant gap',()=>expect(assessCutInPlausibility(o(1,-1,100),1100,p).status).toBe('rejected'));
});
