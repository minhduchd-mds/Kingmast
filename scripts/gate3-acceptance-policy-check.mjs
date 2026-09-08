import {existsSync,readFileSync} from 'node:fs';

const criteriaPath='docs/validation/V006_GATE3_ACCEPTANCE_CRITERIA.json';
const packPath='docs/validation/GATE3_ACCEPTANCE_PACK_V006.md';
const matrixPath='docs/validation/V006_RELEASE_QUALIFICATION_MATRIX.json';
const criteria=JSON.parse(readFileSync(criteriaPath,'utf8'));
const matrix=JSON.parse(readFileSync(matrixPath,'utf8'));
const pack=readFileSync(packPath,'utf8');
const failures=[];
function expect(name,condition){if(!condition)failures.push(name);}

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
console.log(`KINGMAST Gate-3 acceptance policy passed with ${criteria.criteria.length} physical-evidence criteria; disposition remains blocked and public-road approval remains false.`);
