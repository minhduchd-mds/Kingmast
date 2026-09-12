export type HilFaultExpectedState='degraded'|'unavailable'|'rejected';

export interface HilFaultVector{
  id:string;
  stimulus:string;
  expectedState:HilFaultExpectedState;
  expectedReasons:string[];
  forbiddenClaims:string[];
  physicalScenarioSatisfied:false;
  controlAuthority:'none';
}

export const HIL_FAULT_VECTORS:readonly HilFaultVector[]=[
  {id:'HFV-001',stimulus:'radar frame age exceeds freshness limit',expectedState:'unavailable',expectedReasons:['radar-stale'],forbiddenClaims:['fresh-radar-range','critical-collision-warning'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-002',stimulus:'radar timestamp exceeds allowed future skew',expectedState:'rejected',expectedReasons:['radar-future-dated'],forbiddenClaims:['future-frame-as-current-truth'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-003',stimulus:'front camera source becomes unavailable',expectedState:'degraded',expectedReasons:['camera-unavailable'],forbiddenClaims:['camera-classification','lane-geometry'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-004',stimulus:'vehicle speed evidence degrades while range remains available',expectedState:'degraded',expectedReasons:['can-degraded'],forbiddenClaims:['critical-ttc-from-untrusted-ego-speed'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-005',stimulus:'GNSS multipath produces accuracy outside reviewed envelope',expectedState:'degraded',expectedReasons:['gnss-accuracy-outside-envelope'],forbiddenClaims:['precise-position'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-006',stimulus:'cross-device clock regresses or loses monotonicity',expectedState:'rejected',expectedReasons:['clock-regression'],forbiddenClaims:['cross-sensor-fusion'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-007',stimulus:'telemetry sequence is replayed or regresses',expectedState:'rejected',expectedReasons:['sequence-replay'],forbiddenClaims:['replayed-frame-as-live'],physicalScenarioSatisfied:false,controlAuthority:'none'},
  {id:'HFV-008',stimulus:'camera and radar observations exceed association gates',expectedState:'degraded',expectedReasons:['cross-sensor-disagreement'],forbiddenClaims:['forced-association','confidence-increase-on-disagreement'],physicalScenarioSatisfied:false,controlAuthority:'none'},
] as const;

export interface HilFaultVectorRegistryAssessment{
  valid:boolean;
  reasons:string[];
  physicalHilExecuted:false;
  targetHardwareQualified:false;
  controlAuthority:'none';
  qualificationClaim:'software-fault-vector-registry-only-not-physical-hil';
}

export function validateHilFaultVectorRegistry(vectors:readonly HilFaultVector[]=HIL_FAULT_VECTORS):HilFaultVectorRegistryAssessment{
  const reasons:string[]=[];
  const ids=new Set<string>();
  for(const vector of vectors){
    if(!/^HFV-\d{3}$/.test(vector.id))reasons.push(`invalid-id:${vector.id}`);
    if(ids.has(vector.id))reasons.push(`duplicate-id:${vector.id}`);
    ids.add(vector.id);
    if(!vector.stimulus.trim()||vector.expectedReasons.length===0||vector.forbiddenClaims.length===0)reasons.push(`incomplete:${vector.id}`);
    if(vector.physicalScenarioSatisfied!==false)reasons.push(`physical-evidence-overclaim:${vector.id}`);
    if(vector.controlAuthority!=='none')reasons.push(`control-authority:${vector.id}`);
  }
  if(vectors.length<8)reasons.push('insufficient-fault-coverage');
  return{valid:reasons.length===0,reasons,physicalHilExecuted:false,targetHardwareQualified:false,controlAuthority:'none',qualificationClaim:'software-fault-vector-registry-only-not-physical-hil'};
}
