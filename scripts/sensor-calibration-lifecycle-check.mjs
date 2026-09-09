import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const path=resolve(process.cwd(),'docs/validation/sensors/V006_SENSOR_CALIBRATION_LIFECYCLE.json');
const lifecycle=JSON.parse(readFileSync(path,'utf8'));
const failures=[];

function fail(message){failures.push(message);}
function label(value){return typeof value==='string'&&value.trim().length>0&&value.length<=220&&!/[\r\n\t]/.test(value);}
function sha40(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}

if(lifecycle.schema!=='kingmast-sensor-calibration-lifecycle/v1')fail('unexpected sensor calibration lifecycle schema');
if(lifecycle.version!=='0.0.6')fail('sensor calibration lifecycle version must remain 0.0.6');
if(lifecycle.controlAuthority!=='none')fail('sensor calibration lifecycle controlAuthority must remain none');
for(const key of ['automaticCalibrationPromotion','productionThresholdMutation','targetHardwareQualified','publicRoadApproved'])if(lifecycle[key]!==false)fail(`${key} must remain false`);

const expectedStates=['unprovisioned','provisioned','calibration-pending','captured-awaiting-independent-review','approved','rejected','invalidated'];
if(!Array.isArray(lifecycle.states)||lifecycle.states.length!==expectedStates.length||expectedStates.some((state)=>!lifecycle.states.includes(state)))fail('sensor lifecycle states must contain the complete bounded state set exactly once');

const transitionKey=(from,to)=>`${from}->${to}`;
const requiredTransitions=new Set([
  transitionKey('unprovisioned','provisioned'),
  transitionKey('provisioned','calibration-pending'),
  transitionKey('calibration-pending','captured-awaiting-independent-review'),
  transitionKey('captured-awaiting-independent-review','approved'),
  transitionKey('captured-awaiting-independent-review','rejected'),
  transitionKey('approved','invalidated'),
  transitionKey('rejected','calibration-pending'),
  transitionKey('invalidated','calibration-pending')
]);
if(!Array.isArray(lifecycle.transitions)||lifecycle.transitions.length<requiredTransitions.size){
  fail('sensor lifecycle transitions are incomplete');
}else{
  const seen=new Set();
  for(const transition of lifecycle.transitions){
    if(!transition||typeof transition!=='object'||Array.isArray(transition)){fail('transition must be an object');continue;}
    if(!expectedStates.includes(transition.from)||!expectedStates.includes(transition.to))fail(`unsupported transition ${String(transition.from)} -> ${String(transition.to)}`);
    const key=transitionKey(transition.from,transition.to);
    if(seen.has(key))fail(`duplicate transition ${key}`);
    seen.add(key);
    if(transition.automatic!==false)fail(`${key}: automatic transition is prohibited`);
    if(!Array.isArray(transition.requiredEvidence)||transition.requiredEvidence.length===0||transition.requiredEvidence.some((item)=>!label(item)))fail(`${key}: requiredEvidence must be a bounded non-empty array`);
  }
  for(const key of requiredTransitions)if(!seen.has(key))fail(`missing required transition ${key}`);
  if(seen.has(transitionKey('unprovisioned','approved')))fail('direct unprovisioned -> approved transition is prohibited');
  if(seen.has(transitionKey('invalidated','approved')))fail('direct invalidated -> approved transition is prohibited');
}

const requiredTriggers=['hardware-replacement','mounting-position-or-harness-change','sensor-firmware-change','configuration-geometry-change','calibration-input-change','clock-or-time-synchronization-loss','physical-impact-or-maintenance-event','independent-review-revocation'];
if(!Array.isArray(lifecycle.invalidationTriggers)||requiredTriggers.some((trigger)=>!lifecycle.invalidationTriggers.includes(trigger)))fail('required calibration invalidation triggers are incomplete');

const rule=lifecycle.promotionRule;
if(!rule||typeof rule!=='object'||Array.isArray(rule))fail('promotionRule is required');
else{
  for(const key of ['independentReviewRequired','sourceSoftwareCommitBindingRequired','configurationRevisionMatchRequired','firmwareRevisionMatchRequired','sha256EvidenceBindingRequired'])if(rule[key]!==true)fail(`promotionRule.${key} must be true`);
  for(const key of ['automaticPromotion','productionThresholdMutation'])if(rule[key]!==false)fail(`promotionRule.${key} must remain false`);
}

const requiredSensors=['front-radar','surround-camera-set','dms-camera','gnss-imu'];
if(!Array.isArray(lifecycle.sensors)||lifecycle.sensors.length!==requiredSensors.length){
  fail('sensor lifecycle must contain exactly four baseline sensor groups');
}else{
  const ids=new Set();
  for(const sensor of lifecycle.sensors){
    if(!sensor||typeof sensor!=='object'||Array.isArray(sensor)){fail('sensor entry must be an object');continue;}
    if(!requiredSensors.includes(sensor.id)||ids.has(sensor.id))fail(`invalid or duplicate sensor ${String(sensor.id)}`);
    ids.add(sensor.id);
    if(!expectedStates.includes(sensor.currentState))fail(`${sensor.id}: unsupported currentState ${String(sensor.currentState)}`);

    if(sensor.currentState==='unprovisioned'){
      for(const key of ['hardwareInstanceSha256','firmwareRevision','configurationRevision','calibrationRevision','calibrationSha256','sourceSoftwareCommit','approvedAt','reviewer','invalidation'])if(sensor[key]!==null)fail(`${sensor.id}: unprovisioned ${key} must remain null`);
      if(!Array.isArray(sensor.evidenceRefs)||sensor.evidenceRefs.length!==0)fail(`${sensor.id}: unprovisioned evidenceRefs must remain empty`);
      continue;
    }

    if(!sha256(sensor.hardwareInstanceSha256))fail(`${sensor.id}: provisioned sensor requires SHA-256 hardware instance identity`);
    if(!label(sensor.firmwareRevision)||!label(sensor.configurationRevision))fail(`${sensor.id}: provisioned sensor requires firmware and configuration revisions`);

    if(['captured-awaiting-independent-review','approved','rejected'].includes(sensor.currentState)){
      if(!label(sensor.calibrationRevision)||!sha256(sensor.calibrationSha256)||!sha40(sensor.sourceSoftwareCommit))fail(`${sensor.id}: captured/reviewed calibration requires revision, SHA-256 and source commit`);
      if(!Array.isArray(sensor.evidenceRefs)||sensor.evidenceRefs.length===0)fail(`${sensor.id}: captured/reviewed calibration requires evidenceRefs`);
      else for(const item of sensor.evidenceRefs)if(!item||!label(item.ref)||!sha256(item.sha256))fail(`${sensor.id}: each calibration evidence ref requires bounded ref and SHA-256`);
    }

    if(sensor.currentState==='captured-awaiting-independent-review'){
      if(sensor.approvedAt!==null||sensor.reviewer!==null)fail(`${sensor.id}: captured calibration must await reviewer and approval timestamp`);
    }
    if(sensor.currentState==='approved'){
      if(!iso(sensor.approvedAt)||!label(sensor.reviewer))fail(`${sensor.id}: approved calibration requires reviewer and approvedAt`);
    }
    if(sensor.currentState==='invalidated'){
      const invalidation=sensor.invalidation;
      if(!invalidation||typeof invalidation!=='object'||Array.isArray(invalidation)||!requiredTriggers.includes(invalidation.trigger)||!iso(invalidation.invalidatedAt))fail(`${sensor.id}: invalidated state requires bounded invalidation trigger and timestamp`);
    }
  }
  for(const id of requiredSensors)if(!ids.has(id))fail(`missing baseline sensor ${id}`);
}

if(failures.length){
  console.error('KINGMAST sensor calibration lifecycle policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`KINGMAST sensor calibration lifecycle valid: ${lifecycle.sensors.length} sensor group(s); automatic promotion disabled.`);
