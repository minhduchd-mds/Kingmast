import{describe,expect,it}from'vitest';
import{assessSensorDisagreementPersistence}from'./sensor-disagreement-persistence.js';
const p={maxAgeMs:1000,rangeResidualLimitM:2,bearingResidualLimitDeg:5,persistentSamples:3};
const s=(observedAtMs:number,rangeResidualM:number,bearingResidualDeg=1)=>({observedAtMs,rangeResidualM,bearingResidualDeg});
describe('sensor disagreement persistence',()=>{
 it('allows consistent fresh evidence',()=>expect(assessSensorDisagreementPersistence([s(800,1),s(900,1),s(1000,1)],1100,p)).toMatchObject({status:'nominal',fusionAllowed:true}));
 it('degrades one transient disagreement',()=>expect(assessSensorDisagreementPersistence([s(800,1),s(1000,3)],1100,p)).toMatchObject({status:'degraded',fusionAllowed:false}));
 it('blocks persistent disagreement',()=>expect(assessSensorDisagreementPersistence([s(800,3),s(900,3),s(1000,3)],1100,p)).toMatchObject({status:'blocked',reason:'persistent-cross-sensor-disagreement'}));
 it('does not trust absent fresh evidence',()=>expect(assessSensorDisagreementPersistence([],1100,p).status).toBe('blocked'));
});
