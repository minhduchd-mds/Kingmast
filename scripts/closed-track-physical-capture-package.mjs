import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';

const repoRoot=process.cwd();
const registry=JSON.parse(readFileSync(resolve(repoRoot,'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json'),'utf8'));
const scenarioId=(process.env.KINGMAST_CLOSED_TRACK_SCENARIO_ID??'').trim();
const captureRoot=resolve(process.env.KINGMAST_CLOSED_TRACK_CAPTURE_ROOT??'/var/lib/kingmast/closed-track-captures');
const outputPath=resolve(process.env.KINGMAST_CLOSED_TRACK_OUTPUT_PATH??'/tmp/kingmast.closed-track-physical-package.json');
const failures=[];

function fail(message){failures.push(message);}
function label(value,max=160){return typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\r\n\t]/.test(value);}
function sha40(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}

if(registry.schema!=='kingmast-closed-track-evidence-registry/v1'||registry.version!=='0.0.6'||registry.controlAuthority!=='none')fail('unexpected closed-track evidence registry');
const scenario=Array.isArray(registry.scenarios)?registry.scenarios.find((item)=>item.id===scenarioId):null;
if(!scenario)fail(`unsupported or missing KINGMAST_CLOSED_TRACK_SCENARIO_ID: ${scenarioId||'<empty>'}`);

let capture;
let capturePath='';
if(scenario){
  capturePath=resolve(captureRoot,`${scenarioId}.json`);
  const rel=relative(captureRoot,capturePath);
  if(rel.startsWith('..')||isAbsolute(rel))fail('capture path escaped the configured controlled-track capture root');
  try{capture=JSON.parse(readFileSync(capturePath,'utf8'));}catch(error){fail(`unable to read controlled-track capture ${capturePath}: ${error instanceof Error?error.message:String(error)}`);}
}

if(capture){
  if(capture.schema!=='kingmast-closed-track-physical-capture/v1')fail('capture schema must be kingmast-closed-track-physical-capture/v1');
  if(capture.version!=='0.0.6')fail('capture version must remain 0.0.6');
  if(capture.controlAuthority!=='none')fail('capture controlAuthority must remain none');
  if(capture.physicalClosedTrackTest!==true)fail('physicalClosedTrackTest=true is required');
  if(capture.status!=='captured')fail('physical controlled-track capture status must be captured');
  if(capture.scenarioId!==scenarioId)fail('capture scenarioId does not match requested scenario');
  if(!sha40(capture.softwareCommit))fail('softwareCommit must be a full 40-character commit SHA');
  if(!iso(capture.startedAt)||!iso(capture.finishedAt))fail('startedAt and finishedAt must be ISO timestamps');
  else if(Date.parse(capture.finishedAt)<Date.parse(capture.startedAt))fail('finishedAt cannot precede startedAt');
  for(const key of ['operator','reviewer','independentObserver','entryApprovalRef','testFacilityId','vehicleOrRigId','configurationRevision','calibrationRevision','approvedBoundsRef','timeSyncRef'])if(!label(capture[key]))fail(`${key} is required`);
  if(capture.operator===capture.reviewer)fail('reviewer must differ from operator');
  if(capture.operator===capture.independentObserver)fail('independent observer must differ from operator');
  if(capture.resultDisposition!=='passed'&&capture.resultDisposition!=='failed')fail('resultDisposition must be passed or failed');
  if(!label(capture.resultSummary,2048)||capture.resultSummary.trim().length<8)fail('resultSummary must contain 8..2048 characters');
  if(!Array.isArray(capture.evidenceRefs)||capture.evidenceRefs.length===0||capture.evidenceRefs.some((item)=>!label(item)))fail('evidenceRefs must contain bounded references');
  if(!Array.isArray(capture.evidenceDigests)||capture.evidenceDigests.length===0)fail('evidenceDigests must contain SHA-256 bindings');
  else{
    const digestRefs=new Set();
    for(const item of capture.evidenceDigests){
      if(!item||typeof item!=='object'||Array.isArray(item)){fail('evidenceDigests contains a non-object item');continue;}
      if(!label(item.ref))fail('each evidence digest requires a bounded ref');else digestRefs.add(item.ref);
      if(!sha256(item.sha256))fail(`invalid SHA-256 for evidence ref ${String(item.ref)}`);
    }
    if(Array.isArray(capture.evidenceRefs))for(const ref of capture.evidenceRefs)if(!digestRefs.has(ref))fail(`missing SHA-256 binding for evidence ref ${ref}`);
  }
  const privacy=capture.privacy;
  if(!privacy||typeof privacy!=='object'||Array.isArray(privacy))fail('explicit privacy block is required');
  else for(const key of ['rawHardwareSerialIncluded','secretsIncluded','preciseCoordinatesIncluded','rawCabinVideoIncluded','rawCameraFramesIncluded'])if(privacy[key]!==false)fail(`privacy.${key} must be false`);
}

if(failures.length){
  console.error('KINGMAST controlled-track evidence packaging failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}

const output={
  schema:'kingmast-closed-track-evidence-package/v1',
  version:'0.0.6',
  scenarioId,
  claim:'physical-controlled-track-result',
  status:capture.resultDisposition,
  controlAuthority:'none',
  closedTrackApproved:false,
  targetHardwareQualified:false,
  publicRoadApproved:false,
  reviewDisposition:'captured-awaiting-independent-review',
  sourceCapture:{path:`/var/lib/kingmast/closed-track-captures/${scenarioId}.json`,physicalClosedTrackTest:true},
  result:{
    softwareCommit:capture.softwareCommit,
    startedAt:capture.startedAt,
    finishedAt:capture.finishedAt,
    operator:capture.operator,
    reviewer:capture.reviewer,
    independentObserver:capture.independentObserver,
    entryApprovalRef:capture.entryApprovalRef,
    testFacilityId:capture.testFacilityId,
    vehicleOrRigId:capture.vehicleOrRigId,
    configurationRevision:capture.configurationRevision,
    calibrationRevision:capture.calibrationRevision,
    approvedBoundsRef:capture.approvedBoundsRef,
    timeSyncRef:capture.timeSyncRef,
    evidenceRefs:capture.evidenceRefs,
    evidenceDigests:capture.evidenceDigests,
    resultSummary:capture.resultSummary,
  },
  notes:[
    'This package records evidence from an already approved controlled-track activity; it does not authorize a test run.',
    'Independent review remains required before registry promotion.',
    'This package does not create target-hardware qualification, homologation or public-road approval.'
  ]
};
writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(`KINGMAST controlled-track package created for ${scenarioId}: ${outputPath}`);
