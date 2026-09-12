import{describe,expect,it}from'vitest';
import{assessRadarGhostPersistence}from'./radar-ghost-persistence.js';
const p={maxAgeMs:1000,minSamples:3,minConfidence:.75,maxRangeJumpM:6,maxBearingJumpDeg:8,maxVelocityJumpMps:5};
const s=(observedAtMs:number,rangeM:number,bearingDeg=0,radialVelocityMps=-2,confidence=.9,targetId='r1')=>({targetId,observedAtMs,rangeM,bearingDeg,radialVelocityMps,confidence});
describe('radar ghost persistence',()=>{
 it('accepts persistent kinematically continuous radar history',()=>expect(assessRadarGhostPersistence([s(800,30),s(900,29),s(1000,28)],1100,p)).toMatchObject({status:'persistent',usableForCollisionGeometry:true}));
 it('suspects abrupt range jumps',()=>expect(assessRadarGhostPersistence([s(800,30),s(900,10),s(1000,9)],1100,p).reason).toBe('kinematic-discontinuity'));
 it('does not promote one radar hit',()=>expect(assessRadarGhostPersistence([s(1000,30)],1100,p).status).toBe('degraded'));
 it('rejects target id churn',()=>expect(assessRadarGhostPersistence([s(900,30,0,-2,.9,'a'),s(1000,29,0,-2,.9,'b')],1100,p).status).toBe('ghost-suspected'));
});
