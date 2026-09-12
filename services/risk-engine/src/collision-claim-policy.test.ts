import{describe,expect,it}from'vitest';
import{decideCollisionClaim}from'./collision-claim-policy.js';
const trusted={radar:'trusted' as const,odometry:'trusted' as const,timeSync:'trusted' as const,cameraSemantic:'trusted' as const,rangeM:12,ttcS:2.4};
describe('collision claim policy',()=>{
  it('allows a bounded warning claim only with trusted required evidence',()=>expect(decideCollisionClaim(trusted)).toMatchObject({level:'collision-warning-eligible',reason:'bounded-trusted-evidence'}));
  it('falls back to advisory when assurance is degraded',()=>expect(decideCollisionClaim({...trusted,timeSync:'degraded'})).toMatchObject({level:'advisory-only',reason:'assurance-degraded'}));
  it('removes collision metrics when a required source is unavailable',()=>expect(decideCollisionClaim({...trusted,radar:'unavailable'})).toEqual({level:'unavailable',reason:'required-source-unavailable',rangeM:null,ttcS:null,semanticLabelAllowed:false}));
  it('does not require camera semantics for geometry but suppresses semantic labels',()=>expect(decideCollisionClaim({...trusted,cameraSemantic:'degraded'})).toMatchObject({level:'collision-warning-eligible',semanticLabelAllowed:false}));
  it('never invents missing TTC',()=>expect(decideCollisionClaim({...trusted,ttcS:null})).toMatchObject({level:'advisory-only',reason:'collision-metric-missing',ttcS:null}));
});
