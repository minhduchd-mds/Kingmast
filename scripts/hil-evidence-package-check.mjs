import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const defaultPath='docs/validation/hil/V006_HIL_EVIDENCE_PACKAGE_TEMPLATE.json';
const packagePath=process.env.KINGMAST_HIL_PACKAGE_PATH||defaultPath;
const allowedScenarioIds=new Set(Array.from({length:12},(_,index)=>`HIL-${String(index+1).padStart(3,'0')}`));
const failures=[];

function fail(message){failures.push(message);}
function nonEmptyString(value){return typeof value==='string'&&value.trim().length>0;}
function validIso(value){return nonEmptyString(value)&&Number.isFinite(Date.parse(value));}
function validSha(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function validDigest(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}

const full=resolve(root,packagePath);
if(!existsSync(full)){
  fail(`${packagePath}: missing`);
}else{
  let payload;
  try{payload=JSON.parse(readFileSync(full,'utf8'));}catch{fail(`${packagePath}: invalid JSON`);}
  if(payload){
    if(payload.schema!=='kingmast-hil-evidence-package/v1')fail('HIL package schema must be kingmast-hil-evidence-package/v1');
    if(payload.version!=='0.0.6')fail('HIL package version must remain 0.0.6');
    if(!allowedScenarioIds.has(payload.scenarioId))fail(`unsupported scenarioId: ${String(payload.scenarioId)}`);

    if(payload.claim==='template-only-no-physical-result'){
      if(payload.status!=='template')fail('template package must use status=template');
      if(payload.result!==null)fail('template package must keep result=null');
      if(!Array.isArray(payload.requiredResultFields)||payload.requiredResultFields.length<8||payload.requiredResultFields.some((item)=>!nonEmptyString(item)))fail('template requiredResultFields must be a non-empty string array');
      const noteText=Array.isArray(payload.notes)?payload.notes.join(' '):'';
      if(!/must not be presented as target-controller or physical HIL qualification/i.test(noteText))fail('template must explicitly reject CI host-soak as physical HIL qualification');
    }else if(payload.claim==='physical-hil-result'){
      if(payload.status!=='passed'&&payload.status!=='failed')fail('physical result package status must be passed or failed');
      if(payload.controlAuthority!=='none')fail('physical HIL package controlAuthority must remain none');
      if(payload.targetHardwareQualified!==false)fail('physical HIL package targetHardwareQualified must remain false');
      if(payload.publicRoadApproved!==false)fail('physical HIL package publicRoadApproved must remain false');
      if(payload.automaticQualification!==false)fail('physical HIL package automaticQualification must remain false');
      if(payload.registryMutation!==false)fail('physical HIL package registryMutation must remain false');
      if(payload.reviewDisposition!=='captured-awaiting-independent-review')fail('physical HIL package must remain captured-awaiting-independent-review');
      const result=payload.result;
      if(!result||typeof result!=='object'||Array.isArray(result)){
        fail('physical result package requires a result object');
      }else{
        if(!nonEmptyString(result.controllerId))fail('controllerId is required');
        if(!nonEmptyString(result.benchId))fail('benchId is required');
        if(!validSha(result.softwareCommit))fail('softwareCommit must be a full 40-character commit SHA');
        const binding=payload.sourceCommitBinding;
        if(!binding||!validSha(binding.expected)||binding.matched!==true)fail('physical HIL package requires an exact sourceCommitBinding');
        else if(validSha(result.softwareCommit)&&binding.expected.toLowerCase()!==result.softwareCommit.toLowerCase())fail('sourceCommitBinding.expected must match result.softwareCommit');
        if(!validIso(result.startedAt)||!validIso(result.finishedAt))fail('startedAt and finishedAt ISO timestamps are required');
        else if(Date.parse(result.finishedAt)<Date.parse(result.startedAt))fail('finishedAt cannot precede startedAt');
        if(!nonEmptyString(result.operator))fail('operator is required');
        if(!nonEmptyString(result.reviewer))fail('independent reviewer is required');
        if(result.operator===result.reviewer)fail('reviewer must differ from operator for physical HIL evidence');
        if(!Array.isArray(result.evidenceRefs)||result.evidenceRefs.length===0||result.evidenceRefs.some((item)=>!nonEmptyString(item)))fail('evidenceRefs must contain at least one reference');
        else if(new Set(result.evidenceRefs).size!==result.evidenceRefs.length)fail('evidenceRefs must not contain duplicates');
        if(!Array.isArray(result.evidenceDigests)||result.evidenceDigests.length===0)fail('evidenceDigests must contain at least one SHA-256 binding');
        else{
          const digestRefs=new Set();
          for(const item of result.evidenceDigests){
            if(!item||typeof item!=='object'||Array.isArray(item)){fail('evidenceDigests contains a non-object item');continue;}
            if(!nonEmptyString(item.ref))fail('each evidence digest requires ref');
            else if(digestRefs.has(item.ref))fail(`duplicate evidence digest ref ${item.ref}`);
            else digestRefs.add(item.ref);
            if(!validDigest(item.sha256))fail(`invalid SHA-256 digest for ${String(item.ref)}`);
          }
          if(Array.isArray(result.evidenceRefs))for(const ref of result.evidenceRefs)if(!digestRefs.has(ref))fail(`missing SHA-256 binding for evidence ref ${ref}`);
          if(Array.isArray(result.evidenceRefs)&&digestRefs.size!==new Set(result.evidenceRefs).size)fail('evidenceDigests must bind exactly the declared evidenceRefs');
        }
        if(result.configurationHash!==undefined&&!validDigest(result.configurationHash))fail('configurationHash must be SHA-256 when supplied');
        if(result.calibrationHash!==undefined&&!validDigest(result.calibrationHash))fail('calibrationHash must be SHA-256 when supplied');
        if(result.harnessRevision!==undefined&&!nonEmptyString(result.harnessRevision))fail('harnessRevision must be non-empty when supplied');
        if(!nonEmptyString(result.resultSummary))fail('resultSummary is required');
      }
    }else{
      fail(`unsupported claim: ${String(payload.claim)}`);
    }
  }
}

if(failures.length){
  console.error('KINGMAST HIL evidence package check failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`KINGMAST HIL evidence package valid: ${packagePath}`);
