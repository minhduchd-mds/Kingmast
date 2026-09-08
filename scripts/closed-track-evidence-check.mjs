import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const path=resolve(process.cwd(),'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json');
const registry=JSON.parse(readFileSync(path,'utf8'));
const failures=[];

function fail(message){failures.push(message);}
function label(value){return typeof value==='string'&&value.trim().length>0&&value.length<=160&&!/[\r\n\t]/.test(value);}
function sha40(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}

if(registry.schema!=='kingmast-closed-track-evidence-registry/v1')fail('unexpected closed-track registry schema');
if(registry.version!=='0.0.6')fail('closed-track registry version must remain 0.0.6');
if(registry.controlAuthority!=='none')fail('closed-track registry controlAuthority must remain none');
if(registry.publicRoadApproved!==false)fail('publicRoadApproved must remain false');
if(registry.targetHardwareQualified!==false)fail('targetHardwareQualified must remain false');
if(registry.closedTrackApproved!==false)fail('closedTrackApproved may not be granted by repository bookkeeping');

const prerequisiteKeys=['targetSoakReviewed','requiredHilReviewed','oddScenarioBoundsApproved','prototypeElectricalHarnessReviewed','physicalReadOnlyCanVerified','testEmergencyProcedureApproved','independentObserverAssigned','synchronizedLoggingReady','buildConfigurationCalibrationFrozen','testFacilityApprovalRecorded'];
if(!registry.prerequisites||typeof registry.prerequisites!=='object'||Array.isArray(registry.prerequisites))fail('prerequisites object is required');
else for(const key of prerequisiteKeys)if(typeof registry.prerequisites[key]!=='boolean')fail(`prerequisites.${key} must be boolean`);

if(!Array.isArray(registry.scenarios)||registry.scenarios.length<8)fail('at least eight bounded closed-track scenarios are required');
else{
  const ids=new Set();
  for(const scenario of registry.scenarios){
    if(!scenario||typeof scenario!=='object'||Array.isArray(scenario)){fail('scenario entry must be an object');continue;}
    if(!/^CT-\d{3}$/.test(scenario.id)||ids.has(scenario.id))fail(`invalid or duplicate scenario id ${String(scenario.id)}`);
    ids.add(scenario.id);
    if(!label(scenario.title))fail(`${scenario.id}: title is required`);
    if(!Array.isArray(scenario.traceability)||scenario.traceability.length===0||scenario.traceability.some((item)=>!label(item)))fail(`${scenario.id}: traceability is required`);
    if(!['pending','captured-awaiting-independent-review','reviewed-pass','reviewed-fail'].includes(scenario.status))fail(`${scenario.id}: unsupported status`);
    if(scenario.status==='pending'){
      if(scenario.evidence!==null)fail(`${scenario.id}: pending scenario must keep evidence=null`);
      continue;
    }
    const e=scenario.evidence;
    if(!e||typeof e!=='object'||Array.isArray(e)){fail(`${scenario.id}: captured/reviewed status requires evidence object`);continue;}
    if(!sha40(e.softwareCommit))fail(`${scenario.id}: softwareCommit must be a full commit SHA`);
    for(const key of ['vehicleOrRigId','testFacilityId','configurationRevision','calibrationRevision','operator','reviewer'])if(!label(e[key]))fail(`${scenario.id}: ${key} is required`);
    if(e.operator===e.reviewer)fail(`${scenario.id}: reviewer must differ from operator`);
    if(!iso(e.startedAt)||!iso(e.finishedAt))fail(`${scenario.id}: ISO start/finish timestamps are required`);
    else if(Date.parse(e.finishedAt)<Date.parse(e.startedAt))fail(`${scenario.id}: finishedAt cannot precede startedAt`);
    if(!Array.isArray(e.evidenceDigests)||e.evidenceDigests.length===0)fail(`${scenario.id}: evidenceDigests are required`);
    else for(const item of e.evidenceDigests){if(!item||!label(item.ref)||!sha256(item.sha256))fail(`${scenario.id}: every evidence ref requires SHA-256`);}
    if(!label(e.resultSummary))fail(`${scenario.id}: resultSummary is required`);
    if((scenario.status==='reviewed-pass'||scenario.status==='reviewed-fail')&&!['pass','fail'].includes(e.independentReviewDisposition))fail(`${scenario.id}: reviewed status requires independentReviewDisposition`);
  }
}

const allPrerequisites=registry.prerequisites&&prerequisiteKeys.every((key)=>registry.prerequisites[key]===true);
if(!allPrerequisites&&registry.status!=='blocked-pending-physical-prerequisites')fail('registry must remain blocked while any physical prerequisite is incomplete');
if(allPrerequisites&&!['entry-ready-awaiting-run-approval','captured-awaiting-independent-review'].includes(registry.status))fail('completed prerequisites require an explicit entry-ready/captured status');

if(failures.length){
  console.error('KINGMAST closed-track evidence policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`KINGMAST closed-track evidence registry valid: ${registry.scenarios.length} scenario(s); status=${registry.status}; closedTrackApproved=false; publicRoadApproved=false.`);
