import {describe,expect,it} from 'vitest';
import {assessSafetyCaseStatus} from './safety-case-status.js';

const software={sourceIntegrityPassed:true,deterministicTestsPassed:true,silPassed:true,physicalHilPassed:false,controlledTrackPassed:false,publicRoadApproval:false};

describe('assessSafetyCaseStatus',()=>{
  it('blocks on incomplete software evidence before physical claims',()=>{
    const result=assessSafetyCaseStatus({...software,sourceIntegrityPassed:false});
    expect(result.stage).toBe('blocked-software');
    expect(result.blockers).toContain('source-integrity');
  });

  it('requires physical HIL after software evidence passes',()=>{
    expect(assessSafetyCaseStatus(software).stage).toBe('blocked-physical-hil');
  });

  it('requires controlled-track evidence after HIL',()=>{
    expect(assessSafetyCaseStatus({...software,physicalHilPassed:true}).stage).toBe('blocked-controlled-track');
  });

  it('requires explicit public-road approval after controlled-track evidence',()=>{
    expect(assessSafetyCaseStatus({...software,physicalHilPassed:true,controlledTrackPassed:true}).stage).toBe('blocked-public-road-approval');
  });

  it('never auto-qualifies even when every evidence flag is true',()=>{
    const result=assessSafetyCaseStatus({sourceIntegrityPassed:true,deterministicTestsPassed:true,silPassed:true,physicalHilPassed:true,controlledTrackPassed:true,publicRoadApproval:true});
    expect(result.stage).toBe('external-evidence-review-required');
    expect(result.automaticQualification).toBe(false);
    expect(result.controlAuthority).toBe('none');
  });
});
