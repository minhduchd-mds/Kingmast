export type ReleaseEvidence={softwareIntegrity:boolean;unitAndContractTests:boolean;silEvidence:boolean;securityReview:boolean;physicalHil:boolean;controlledTrack:boolean;independentSafetyReview:boolean;publicRoadApproval:boolean};
export type ReleaseReadinessExplanation={stage:'software-blocked'|'software-evidence-ready'|'physical-validation-pending'|'external-review-pending'|'public-road-approval-pending'|'external-evidence-review-required';blockers:string[];automaticQualification:false;controlAuthority:'none'};

const ordered:[keyof ReleaseEvidence,string][]=[
  ['softwareIntegrity','software-integrity'],
  ['unitAndContractTests','unit-contract-tests'],
  ['silEvidence','sil-evidence'],
  ['securityReview','security-review'],
  ['physicalHil','physical-hil'],
  ['controlledTrack','controlled-track'],
  ['independentSafetyReview','independent-safety-review'],
  ['publicRoadApproval','public-road-approval'],
];

export function explainReleaseReadiness(evidence:ReleaseEvidence):ReleaseReadinessExplanation{
  const blockers=ordered.filter(([key])=>!evidence[key]).map(([,label])=>label);
  let stage:ReleaseReadinessExplanation['stage'];
  if(!evidence.softwareIntegrity||!evidence.unitAndContractTests||!evidence.silEvidence||!evidence.securityReview)stage='software-blocked';
  else if(!evidence.physicalHil||!evidence.controlledTrack)stage='physical-validation-pending';
  else if(!evidence.independentSafetyReview)stage='external-review-pending';
  else if(!evidence.publicRoadApproval)stage='public-road-approval-pending';
  else stage='external-evidence-review-required';
  return{stage,blockers,automaticQualification:false,controlAuthority:'none'};
}
