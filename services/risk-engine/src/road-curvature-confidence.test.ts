import{describe,expect,it}from'vitest';
import{assessRoadCurvatureConfidence}from'./road-curvature-confidence.js';
const p={maxAgeMs:500,minConfidence:.8,maxDisagreementPerM:.002};
describe('road curvature confidence',()=>{
 it('accepts consistent fresh cross-source evidence',()=>expect(assessRoadCurvatureConfidence([{source:'map',observedAtMs:1000,curvaturePerM:.01,confidence:.9},{source:'camera',observedAtMs:1050,curvaturePerM:.011,confidence:.9}],1100,p)).toMatchObject({status:'nominal',reason:'cross-source-consistent'}));
 it('degrades source disagreement',()=>expect(assessRoadCurvatureConfidence([{source:'map',observedAtMs:1000,curvaturePerM:.01,confidence:.9},{source:'camera',observedAtMs:1050,curvaturePerM:.02,confidence:.9}],1100,p)).toMatchObject({status:'degraded',curvaturePerM:null}));
 it('does not promote a single source to nominal',()=>expect(assessRoadCurvatureConfidence([{source:'map',observedAtMs:1000,curvaturePerM:.01,confidence:.9}],1100,p).reason).toBe('single-source-only'));
 it('rejects stale evidence',()=>expect(assessRoadCurvatureConfidence([{source:'map',observedAtMs:100,curvaturePerM:.01,confidence:.9}],1100,p).status).toBe('unavailable'));
});
