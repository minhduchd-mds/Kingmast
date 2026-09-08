import {existsSync,readFileSync} from 'node:fs';

const criteriaPath='docs/validation/V006_GATE3_ACCEPTANCE_CRITERIA.json';
const packPath='docs/validation/GATE3_ACCEPTANCE_PACK_V006.md';
const matrixPath='docs/validation/V006_RELEASE_QUALIFICATION_MATRIX.json';
const criteria=JSON.parse(readFileSync(criteriaPath,'utf8'));
const matrix=JSON.parse(readFileSync(matrixPath,'utf8'));
const pack=readFileSync(packPath,'utf8');
const failures=[];
function expect(name,condition){if(!condition)failures.push(name);}
function json(path){return JSON.parse(readFileSync(path,'utf8'));}

expect('criteria schema',criteria.schema==='kingmast-gate3-acceptance-criteria/v1');
expect('criteria version matches release matrix',criteria.productVersion===matrix.productVersion);
expect('warning-only authority is explicit',criteria.controlAuthority==='none'&&matrix.controlAuthority==='none');
expect('Gate-3 remains blocked pending physical evidence',criteria.currentDisposition==='blocked-pending-physical-evidence-and-review');
expect('closed-track is not approved in source',criteria.closedTrackApproved===false&&matrix.closedTrackApproved===false);
expect('public-road use is not approved',criteria.publicRoadApproved===false&&matrix.publicRoadApproved===false);
expect('homologation is not claimed',criteria.homologationClaim===false);
expect('human-readable pack exists',existsSync(packPath));
expect('release matrix exists',existsSync(matrixPath));
expect('pack states BLOCKED',pack.includes('**BLOCKED'));
expect('pack rejects CI-as-qualification',pack.includes('A green CI run is not proof'));
expect('pack preserves no-actuator boundary',pack.includes('steering, braking, throttle, torque, gear, drivetrain or CAN-write authority'));
expect('CI evidence list is regression-only',Array.isArray(criteria.ciEvidenceIsRegressionOnly)&&criteria.ciEvidenceIsRegressionOnly.length>=6);

const artifacts=criteria.preparationArtifacts??{};
const requiredArtifactKeys=['targetHardwareWorkflow','targetSoakRegistry','hilExecutionManifest','hilEvidenceRegistry','controlledTrackRegistry','independentReviewRegistry'];
for(const key of requiredArtifactKeys){
  expect(`Gate-3 preparation artifact ${key} is declared`,typeof artifacts[key]==='string'&&artifacts[key].length>0);
  if(typeof artifacts[key]==='string')expect(`Gate-3 preparation artifact ${key} exists`,existsSync(artifacts[key]));
}

if(existsSync(artifacts.targetSoakRegistry??'')){
  const target=json(artifacts.targetSoakRegistry);
  expect('target soak remains non-qualified',target.targetHardwareQualified===false);
  expect('target soak registry status is bounded',['pending-physical-execution','captured-awaiting-review'].includes(target.status));
}
if(existsSync(artifacts.hilExecutionManifest??'')){
  const hilManifest=json(artifacts.hilExecutionManifest);
  expect('HIL manifest requires physical execution',hilManifest.physicalExecutionRequired===true);
  expect('HIL manifest disables automatic qualification',hilManifest.automaticQualification===false);
  expect('HIL manifest requires independent review',hilManifest.promotionRule?.passRequiresIndependentReviewer===true);
}
if(existsSync(artifacts.hilEvidenceRegistry??'')){
  const hil=json(artifacts.hilEvidenceRegistry);
  expect('HIL registry starts with no invented results',hil.claim==='no-hil-results-claimed'||hil.scenarios?.some((item)=>item.status==='passed'||item.status==='failed'));
}
if(existsSync(artifacts.controlledTrackRegistry??'')){
  const track=json(artifacts.controlledTrackRegistry);
  expect('controlled-track source cannot approve execution',track.closedTrackApproved===false&&track.publicRoadApproved===false&&track.targetHardwareQualified===false);
  expect('controlled-track registry has physical prerequisites',track.prerequisites&&Object.keys(track.prerequisites).length>=8);
}
if(existsSync(artifacts.independentReviewRegistry??'')){
  const review=json(artifacts.independentReviewRegistry);
  expect('independent review cannot create road approval',review.publicRoadApproved===false&&review.closedTrackApproved===false&&review.targetHardwareQualified===false);
  expect('independent review covers at least five domains',Array.isArray(review.reviews)&&review.reviews.length>=5);
}

const requiredIds=new Set(['G3-HW-IDENTITY','G3-SW-IDENTITY','G3-FW-CONFIG-CAL','G3-BOOT','G3-HMI-PERF','G3-SOAK','G3-FAULT','G3-ROLLBACK','G3-CLOSED-TRACK','G3-REVIEW']);
const seen=new Set();
for(const item of criteria.criteria??[]){
  seen.add(item.id);
  expect(`${item.id} requires physical evidence`,item.physicalEvidenceRequired===true);
  expect(`${item.id} has a measurable pass condition`,typeof item.passCondition==='string'&&item.passCondition.length>=40);
}
for(const id of requiredIds)expect(`required Gate-3 criterion ${id}`,seen.has(id));
expect('no unexpected reduction in Gate-3 criteria',(criteria.criteria??[]).length>=requiredIds.size);

if(failures.length){
  console.error(`KINGMAST Gate-3 acceptance policy failed:\n${failures.map((item)=>`- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`KINGMAST Gate-3 acceptance policy passed with ${criteria.criteria.length} physical-evidence criteria and ${requiredArtifactKeys.length} preparation artifacts; disposition remains blocked and public-road approval remains false.`);
