export interface SafetyCaseEvidenceState{
  sourceIntegrityPassed:boolean;
  deterministicTestsPassed:boolean;
  silPassed:boolean;
  physicalHilPassed:boolean;
  controlledTrackPassed:boolean;
  publicRoadApproval:boolean;
}

export type SafetyCaseStage=
  |'blocked-software'
  |'blocked-physical-hil'
  |'blocked-controlled-track'
  |'blocked-public-road-approval'
  |'external-evidence-review-required';

export interface SafetyCaseStatus{
  stage:SafetyCaseStage;
  blockers:string[];
  automaticQualification:false;
  controlAuthority:'none';
  qualificationClaim:'safety-case-status-only-not-homologation';
}

export function assessSafetyCaseStatus(input:SafetyCaseEvidenceState):SafetyCaseStatus{
  const softwareReady=input.sourceIntegrityPassed&&input.deterministicTestsPassed&&input.silPassed;
  let stage:SafetyCaseStage;
  const blockers:string[]=[];

  if(!softwareReady){
    stage='blocked-software';
    if(!input.sourceIntegrityPassed)blockers.push('source-integrity');
    if(!input.deterministicTestsPassed)blockers.push('deterministic-tests');
    if(!input.silPassed)blockers.push('sil-evidence');
  }else if(!input.physicalHilPassed){
    stage='blocked-physical-hil';
    blockers.push('physical-hil-evidence');
  }else if(!input.controlledTrackPassed){
    stage='blocked-controlled-track';
    blockers.push('controlled-track-evidence');
  }else if(!input.publicRoadApproval){
    stage='blocked-public-road-approval';
    blockers.push('public-road-approval');
  }else{
    stage='external-evidence-review-required';
    blockers.push('independent-external-review');
  }

  return{stage,blockers,automaticQualification:false,controlAuthority:'none',qualificationClaim:'safety-case-status-only-not-homologation'};
}
