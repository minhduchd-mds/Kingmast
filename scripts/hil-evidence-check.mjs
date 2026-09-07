import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const registryPath='docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json';
const requiredScenarioIds=[
  'HIL-001','HIL-002','HIL-003','HIL-004','HIL-005','HIL-006',
  'HIL-007','HIL-008','HIL-009','HIL-010','HIL-011','HIL-012',
];
const allowedStatuses=new Set(['pending','blocked','passed','failed']);
const failures=[];

function fail(message){failures.push(message);}
function nonEmptyString(value){return typeof value==='string'&&value.trim().length>0;}
function validIso(value){return nonEmptyString(value)&&Number.isFinite(Date.parse(value));}
function validSha(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function validDigest(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}

const full=resolve(root,registryPath);
if(!existsSync(full)){
  fail(`${registryPath}: missing`);
}else{
  let registry;
  try{registry=JSON.parse(readFileSync(full,'utf8'));}catch{fail(`${registryPath}: invalid JSON`);}
  if(registry){
    if(registry.schema!=='kingmast-hil-evidence-registry/v1')fail('HIL registry schema must remain kingmast-hil-evidence-registry/v1');
    if(registry.version!=='0.0.6')fail('HIL registry version must remain 0.0.6 for this evidence set');
    if(!validIso(registry.updatedAt))fail('HIL registry updatedAt must be an ISO timestamp');
    if(!Array.isArray(registry.scenarios))fail('HIL registry scenarios must be an array');
    else{
      const ids=new Set();
      let claimedResults=0;
      for(const scenario of registry.scenarios){
        if(!scenario||typeof scenario!=='object'){fail('HIL registry contains a non-object scenario');continue;}
        if(!nonEmptyString(scenario.id)){fail('HIL scenario id is required');continue;}
        if(ids.has(scenario.id))fail(`duplicate HIL scenario id: ${scenario.id}`);
        ids.add(scenario.id);
        if(!nonEmptyString(scenario.title))fail(`${scenario.id}: title is required`);
        if(!Array.isArray(scenario.traceability)||scenario.traceability.length===0||scenario.traceability.some((item)=>!nonEmptyString(item)))fail(`${scenario.id}: non-empty traceability is required`);
        if(!allowedStatuses.has(scenario.status))fail(`${scenario.id}: invalid status ${String(scenario.status)}`);
        if(!Array.isArray(scenario.requiredEvidence)||scenario.requiredEvidence.length===0||scenario.requiredEvidence.some((item)=>!nonEmptyString(item)))fail(`${scenario.id}: requiredEvidence must be a non-empty string array`);

        if(scenario.status==='pending'||scenario.status==='blocked'){
          if(!nonEmptyString(scenario.blockedReason))fail(`${scenario.id}: pending/blocked scenario must state why physical evidence is unavailable`);
          if(scenario.evidence!==null)fail(`${scenario.id}: pending/blocked scenario must keep evidence=null to avoid implying physical proof`);
          continue;
        }

        claimedResults+=1;
        const evidence=scenario.evidence;
        if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)){
          fail(`${scenario.id}: ${scenario.status} HIL result requires a physical evidence object`);
          continue;
        }
        if(!nonEmptyString(evidence.controllerId))fail(`${scenario.id}: controllerId is required for claimed HIL results`);
        if(!nonEmptyString(evidence.benchId))fail(`${scenario.id}: benchId is required for claimed HIL results`);
        if(!validSha(evidence.softwareCommit))fail(`${scenario.id}: softwareCommit must be a full 40-character commit SHA`);
        if(!validIso(evidence.startedAt)||!validIso(evidence.finishedAt))fail(`${scenario.id}: startedAt and finishedAt ISO timestamps are required`);
        else if(Date.parse(evidence.finishedAt)<Date.parse(evidence.startedAt))fail(`${scenario.id}: finishedAt cannot precede startedAt`);
        if(!nonEmptyString(evidence.operator))fail(`${scenario.id}: operator is required for claimed HIL results`);
        if(!nonEmptyString(evidence.reviewer))fail(`${scenario.id}: independent reviewer is required for claimed HIL results`);
        if(!Array.isArray(evidence.evidenceRefs)||evidence.evidenceRefs.length===0||evidence.evidenceRefs.some((item)=>!nonEmptyString(item)))fail(`${scenario.id}: at least one evidence reference is required`);
        if(evidence.configurationHash!==undefined&&!validDigest(evidence.configurationHash))fail(`${scenario.id}: configurationHash must be a SHA-256 hex digest when supplied`);
        if(evidence.calibrationHash!==undefined&&!validDigest(evidence.calibrationHash))fail(`${scenario.id}: calibrationHash must be a SHA-256 hex digest when supplied`);
        if(evidence.harnessRevision!==undefined&&!nonEmptyString(evidence.harnessRevision))fail(`${scenario.id}: harnessRevision must be non-empty when supplied`);
        if(!nonEmptyString(evidence.resultSummary))fail(`${scenario.id}: resultSummary is required for claimed HIL results`);
      }
      for(const id of requiredScenarioIds)if(!ids.has(id))fail(`required HIL scenario missing: ${id}`);
      if(registry.scenarios.length!==requiredScenarioIds.length)fail(`HIL registry must contain exactly ${requiredScenarioIds.length} baseline scenarios; found ${registry.scenarios.length}`);
      if(claimedResults===0&&registry.claim!=='no-hil-results-claimed')fail('registry with no physical results must state claim=no-hil-results-claimed');
      if(claimedResults>0&&registry.claim==='no-hil-results-claimed')fail('registry contains physical result claims but top-level claim still says no-hil-results-claimed');
    }
  }
}

if(failures.length){
  console.error('KINGMAST HIL evidence registry check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log('KINGMAST HIL evidence registry passed: no unsupported physical HIL claims detected.');
