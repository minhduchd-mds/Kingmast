import{describe,expect,it}from'vitest';
import{assessTrackIdentityLifecycle}from'./track-identity-lifecycle.js';
const p={maxGapMs:300,minStableSamples:3,minConfidence:.8};
const o=(trackId:string,observedAtMs:number,confidence=.9)=>({trackId,observedAtMs,confidence});
describe('track identity lifecycle',()=>{
 it('promotes only stable identity history',()=>expect(assessTrackIdentityLifecycle([o('a',700),o('a',850),o('a',1000)],1100,p)).toMatchObject({status:'stable',trackId:'a'}));
 it('degrades id churn',()=>expect(assessTrackIdentityLifecycle([o('a',800),o('b',950),o('b',1000)],1100,p).reason).toBe('track-id-churn'));
 it('degrades insufficient history',()=>expect(assessTrackIdentityLifecycle([o('a',900),o('a',1000)],1100,p).reason).toBe('insufficient-history'));
 it('rejects stale latest observation',()=>expect(assessTrackIdentityLifecycle([o('a',500)],1100,p).status).toBe('unavailable'));
});
