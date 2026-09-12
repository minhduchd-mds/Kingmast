export type DeploymentEvidence={softwareTests:boolean;securityReview:boolean;silReplay:boolean;physicalHil:boolean;controlledTrack:boolean;independentSafetyReview:boolean;publicRoadApproval:boolean};
export type DeploymentReadiness={status:'blocked'|'external-review-required';nextBlocker:string|null;automaticQualification:false;controlAuthority:'none'};

const stages:[keyof DeploymentEvidence,string][]=[
 ['softwareTests','software-tests-missing'],
 ['securityReview','security-review-missing'],
 ['silReplay','sil-replay-missing'],
 ['physicalHil','physical-hil-missing'],
 ['controlledTrack','controlled-track-evidence-missing'],
 ['independentSafetyReview','independent-safety-review-missing'],
 ['publicRoadApproval','public-road-approval-missing'],
];
export function evaluateDeploymentReadiness(evidence:DeploymentEvidence):DeploymentReadiness{
 for(const[key,reason]of stages)if(evidence[key]!==true)return{status:'blocked',nextBlocker:reason,automaticQualification:false,controlAuthority:'none'};
 return{status:'external-review-required',nextBlocker:null,automaticQualification:false,controlAuthority:'none'};
}
