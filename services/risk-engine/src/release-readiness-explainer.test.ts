import{describe,expect,it}from'vitest';
import{explainReleaseReadiness}from'./release-readiness-explainer.js';
const all={softwareIntegrity:true,unitAndContractTests:true,silEvidence:true,securityReview:true,physicalHil:true,controlledTrack:true,independentSafetyReview:true,publicRoadApproval:true};
describe('release readiness explainer',()=>{
  it('names software blockers before physical evidence',()=>expect(explainReleaseReadiness({...all,unitAndContractTests:false,physicalHil:false})).toMatchObject({stage:'software-blocked',blockers:['unit-contract-tests','physical-hil']}));
  it('keeps physical validation explicit after software evidence',()=>expect(explainReleaseReadiness({...all,physicalHil:false})).toMatchObject({stage:'physical-validation-pending'}));
  it('requires independent review before public-road approval',()=>expect(explainReleaseReadiness({...all,independentSafetyReview:false})).toMatchObject({stage:'external-review-pending'}));
  it('never auto-qualifies even when every evidence flag is true',()=>expect(explainReleaseReadiness(all)).toEqual({stage:'external-evidence-review-required',blockers:[],automaticQualification:false,controlAuthority:'none'}));
});
