import{describe,expect,it}from'vitest';
import{evaluateDeploymentReadiness}from'./deployment-readiness-checklist.js';
const all={softwareTests:true,securityReview:true,silReplay:true,physicalHil:true,controlledTrack:true,independentSafetyReview:true,publicRoadApproval:true};
describe('deployment readiness checklist',()=>{
 it('blocks at first missing software evidence',()=>expect(evaluateDeploymentReadiness({...all,softwareTests:false}).nextBlocker).toBe('software-tests-missing'));
 it('blocks before road use without physical HIL',()=>expect(evaluateDeploymentReadiness({...all,physicalHil:false}).nextBlocker).toBe('physical-hil-missing'));
 it('requires explicit public road approval',()=>expect(evaluateDeploymentReadiness({...all,publicRoadApproval:false}).nextBlocker).toBe('public-road-approval-missing'));
 it('never auto-qualifies even with every flag true',()=>expect(evaluateDeploymentReadiness(all)).toEqual({status:'external-review-required',nextBlocker:null,automaticQualification:false,controlAuthority:'none'}));
});
