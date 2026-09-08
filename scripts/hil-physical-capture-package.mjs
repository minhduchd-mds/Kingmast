import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,isAbsolute} from 'node:path';

const root=process.cwd();
const manifestPath=resolve(root,'docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const scenarioId=(process.env.KINGMAST_HIL_SCENARIO_ID??'').trim();
const captureRoot=resolve(process.env.KINGMAST_HIL_CAPTURE_ROOT??manifest.captureRoot);
const outputPath=resolve(process.env.KINGMAST_HIL_OUTPUT_PATH??'/tmp/kingmast.hil-physical-package.json');
const failures=[];

function fail(message){failures.push(message);}
function label(value){return typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:+/@ -]{0,127}$/.test(value)&&!/[\r\n\t]/.test(value);}
function sha40(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}
function present(value){return (typeof value==='string'&&value.trim().length>0)||(typeof value==='number'&&Number.isFinite(value))||value===true||value===false;}

if(manifest.schema!=='kingmast-hil-execution-manifest/v1'||manifest.version!=='0.0.6'||manifest.controlAuthority!=='none')fail('unexpected HIL execution manifest');
const scenario=Array.isArray(manifest.scenarios)?manifest.scenarios.find((item)=>item.id===scenarioId):null;
if(!scenario)fail(`unsupported or missing KINGMAST_HIL_SCENARIO_ID: ${scenarioId||'<empty>'}`);

let capture;
let capturePath='';
if(scenario){
  capturePath=resolve(captureRoot,scenario.captureFile);
  const rel=relative(captureRoot,capturePath);
  if(rel.startsWith('..')||isAbsolute(rel))fail('capture path escaped the configured HIL capture root');
  try{capture=JSON.parse(readFileSync(capturePath,'utf8'));}catch(error){fail(`unable to read physical capture ${capturePath}: ${error instanceof Error?error.message:String(error)}`);}
}

if(capture){
  if(capture.schema!=='kingmast-hil-physical-capture/v1')fail('capture schema must be kingmast-hil-physical-capture/v1');
  if(capture.version!=='0.0.6')fail('capture version must remain 0.0.6');
  if(capture.controlAuthority!=='none')fail('capture controlAuthority must remain none');
  if(capture.physicalControllerTest!==true)fail('physicalControllerTest=true is required');
  if(capture.status!=='captured')fail('physical capture status must be captured');
  if(capture.scenarioId!==scenarioId)fail('capture scenarioId does not match requested scenario');
  if(!sha40(capture.softwareCommit))fail('softwareCommit must be a full 40-character commit SHA');
  if(!iso(capture.startedAt)||!iso(capture.finishedAt))fail('startedAt and finishedAt must be ISO timestamps');
  else if(Date.parse(capture.finishedAt)<Date.parse(capture.startedAt))fail('finishedAt cannot precede startedAt');
  if(!label(capture.operator)||!label(capture.reviewer))fail('bounded operator and reviewer labels are required');
  if(capture.operator===capture.reviewer)fail('independent reviewer must differ from operator');
  if(capture.resultDisposition!=='passed'&&capture.resultDisposition!=='failed')fail('resultDisposition must be passed or failed');
  if(typeof capture.resultSummary!=='string'||capture.resultSummary.trim().length<8||capture.resultSummary.length>2048)fail('resultSummary must contain 8..2048 characters');
  if(!capture.resultFields||typeof capture.resultFields!=='object'||Array.isArray(capture.resultFields))fail('resultFields object is required');
  else if(scenario){
    for(const key of scenario.requiredResultKeys??[]){
      const value=capture.resultFields[key];
      if(!present(value))fail(`${scenarioId}: missing required result field ${key}`);
      if(/Hash$/.test(key)&&!sha256(value))fail(`${scenarioId}: ${key} must be SHA-256`);
    }
  }
  if(!Array.isArray(capture.evidenceRefs)||capture.evidenceRefs.length===0||capture.evidenceRefs.some((item)=>!label(item)))fail('evidenceRefs must contain bounded non-empty references');
  if(!Array.isArray(capture.evidenceDigests)||capture.evidenceDigests.length===0)fail('evidenceDigests must contain SHA-256 bindings');
  else{
    const digestRefs=new Set();
    for(const item of capture.evidenceDigests){
      if(!item||typeof item!=='object'||Array.isArray(item)){fail('evidenceDigests contains a non-object item');continue;}
      if(!label(item.ref))fail('each evidence digest requires a bounded ref');
      else digestRefs.add(item.ref);
      if(!sha256(item.sha256))fail(`invalid SHA-256 for evidence ref ${String(item.ref)}`);
    }
    if(Array.isArray(capture.evidenceRefs))for(const ref of capture.evidenceRefs)if(!digestRefs.has(ref))fail(`missing SHA-256 binding for evidence ref ${ref}`);
  }
  const privacy=capture.privacy;
  if(!privacy||typeof privacy!=='object'||Array.isArray(privacy))fail('explicit privacy block is required');
  else for(const key of ['rawHardwareSerialIncluded','secretsIncluded','preciseCoordinatesIncluded','rawCabinVideoIncluded','rawCameraFramesIncluded'])if(privacy[key]!==false)fail(`privacy.${key} must be false`);
}

if(failures.length){
  console.error('KINGMAST physical HIL capture packaging failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}

const fields=capture.resultFields;
const result={
  controllerId:String(fields.controllerId),
  benchId:String(fields.benchId),
  softwareCommit:capture.softwareCommit,
  startedAt:capture.startedAt,
  finishedAt:capture.finishedAt,
  operator:capture.operator,
  reviewer:capture.reviewer,
  evidenceRefs:capture.evidenceRefs,
  evidenceDigests:capture.evidenceDigests,
  resultSummary:capture.resultSummary,
  scenarioResultFields:fields,
};
if(sha256(fields.configurationHash))result.configurationHash=fields.configurationHash;
if(sha256(fields.calibrationHash))result.calibrationHash=fields.calibrationHash;
if(present(fields.harnessRevision))result.harnessRevision=String(fields.harnessRevision);

const output={
  schema:'kingmast-hil-evidence-package/v1',
  version:'0.0.6',
  scenarioId,
  claim:'physical-hil-result',
  status:capture.resultDisposition,
  controlAuthority:'none',
  targetHardwareQualified:false,
  publicRoadApproved:false,
  reviewDisposition:'captured-awaiting-independent-review',
  sourceCapture:{path:`${manifest.captureRoot}/${scenario.captureFile}`,physicalControllerTest:true},
  result,
  notes:[
    'This package records a physical HIL execution result but does not qualify target hardware or authorize road use.',
    'Registry promotion requires independent review and must remain a separate human-controlled step.'
  ]
};
writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(`KINGMAST physical HIL package created for ${scenarioId}: ${outputPath}`);
