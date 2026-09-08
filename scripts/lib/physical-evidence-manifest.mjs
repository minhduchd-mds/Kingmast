import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const normalizedSha40=(value)=>typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value)?value.toLowerCase():null;
const sha256=(value)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const scenarioId=(kind,value)=>typeof value==='string'&&(kind==='hil'?/^HIL-\d{3}$/.test(value):/^CT-\d{3}$/.test(value));

export function hashBuffer(buffer){return createHash('sha256').update(buffer).digest('hex');}
export function readJsonBytes(path){const bytes=readFileSync(path);return{bytes,payload:JSON.parse(bytes.toString('utf8'))};}

export function validatePhysicalPackage(payload,{kind,expectedSourceCommit}){
  const failures=[];
  const fail=(message)=>failures.push(message);
  const expected=normalizedSha40(expectedSourceCommit);
  if(!['hil','closed-track'].includes(kind))fail(`unsupported physical evidence kind ${String(kind)}`);
  if(!expected)fail('expectedSourceCommit must be a full 40-character commit SHA');
  if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('physical package must be an object');
  if(failures.length)throw new Error(failures.join('; '));
  const expectedSchema=kind==='hil'?'kingmast-hil-evidence-package/v1':'kingmast-closed-track-evidence-package/v1';
  const expectedClaim=kind==='hil'?'physical-hil-result':'physical-controlled-track-result';
  if(payload.schema!==expectedSchema)fail(`${kind}: unexpected package schema`);
  if(payload.version!=='0.0.6')fail(`${kind}: version must remain 0.0.6`);
  if(payload.claim!==expectedClaim)fail(`${kind}: unexpected claim`);
  if(!scenarioId(kind,payload.scenarioId))fail(`${kind}: invalid scenarioId`);
  if(payload.status!=='passed'&&payload.status!=='failed')fail(`${kind}: status must be passed or failed`);
  if(payload.controlAuthority!=='none')fail(`${kind}: controlAuthority must remain none`);
  if(payload.reviewDisposition!=='captured-awaiting-independent-review')fail(`${kind}: independent review must remain pending`);
  if(payload.targetHardwareQualified!==false)fail(`${kind}: targetHardwareQualified must remain false`);
  if(payload.publicRoadApproved!==false)fail(`${kind}: publicRoadApproved must remain false`);
  if(kind==='closed-track'&&payload.closedTrackApproved!==false)fail('closed-track: closedTrackApproved must remain false');
  if(payload.automaticQualification!==false)fail(`${kind}: automaticQualification must remain false`);
  if(payload.registryMutation!==false)fail(`${kind}: registryMutation must remain false`);
  const sourceCommit=normalizedSha40(payload.result?.softwareCommit);
  if(!sourceCommit)fail(`${kind}: package result softwareCommit must be a full SHA`);
  else if(sourceCommit!==expected)fail(`${kind}: source commit does not match expected workflow commit`);
  const binding=payload.sourceCommitBinding;
  const bindingExpected=normalizedSha40(binding?.expected);
  if(!binding||bindingExpected!==expected||binding.matched!==true)fail(`${kind}: sourceCommitBinding must prove an exact workflow SHA match`);
  if(failures.length)throw new Error(failures.join('; '));
  return true;
}

export function buildPhysicalEvidenceManifest({kind,packagePayload,packageBytes,expectedSourceCommit,workflowName,runId,runAttempt}){
  validatePhysicalPackage(packagePayload,{kind,expectedSourceCommit});
  const expected=normalizedSha40(expectedSourceCommit);
  if(typeof workflowName!=='string'||workflowName.trim().length<3||workflowName.length>128)throw new Error('workflowName must be bounded');
  if(!/^\d{1,24}$/.test(String(runId)))throw new Error('runId must be a bounded decimal identifier');
  if(!/^\d{1,8}$/.test(String(runAttempt)))throw new Error('runAttempt must be a bounded decimal identifier');
  const packageSha256=hashBuffer(packageBytes);
  return{
    schema:'kingmast-physical-evidence-manifest/v1',
    version:'0.0.6',
    generatedAt:new Date().toISOString(),
    kind,
    scenarioId:packagePayload.scenarioId,
    sourceCommit:expected,
    packageSchema:packagePayload.schema,
    packageClaim:packagePayload.claim,
    packageStatus:packagePayload.status,
    packageSha256,
    workflow:{name:workflowName,runId:String(runId),runAttempt:String(runAttempt)},
    controlAuthority:'none',
    physicalEvidenceCaptured:true,
    independentReviewRequired:true,
    reviewDisposition:'captured-awaiting-independent-review',
    automaticQualification:false,
    registryMutation:false,
    targetHardwareQualified:false,
    closedTrackApproved:false,
    publicRoadApproved:false,
    limitation:'This manifest binds an already captured physical evidence package to one repository commit and workflow run. It does not itself grant hardware qualification, track approval, homologation or public-road authorization.'
  };
}

export function validatePhysicalEvidenceManifest(manifest,{kind,packagePayload,packageBytes,expectedSourceCommit}){
  validatePhysicalPackage(packagePayload,{kind,expectedSourceCommit});
  const expected=normalizedSha40(expectedSourceCommit);
  const failures=[];
  const fail=(message)=>failures.push(message);
  if(manifest?.schema!=='kingmast-physical-evidence-manifest/v1')fail('unexpected physical evidence manifest schema');
  if(manifest?.version!=='0.0.6')fail('physical evidence manifest version must remain 0.0.6');
  if(manifest?.kind!==kind)fail('physical evidence manifest kind mismatch');
  if(manifest?.scenarioId!==packagePayload.scenarioId)fail('scenarioId is not bound to the package');
  if(normalizedSha40(manifest?.sourceCommit)!==expected)fail('sourceCommit is not bound to the expected commit');
  if(manifest?.packageSchema!==packagePayload.schema||manifest?.packageClaim!==packagePayload.claim||manifest?.packageStatus!==packagePayload.status)fail('package identity/status is not bound to the manifest');
  if(!sha256(manifest?.packageSha256)||manifest.packageSha256!==hashBuffer(packageBytes))fail('packageSha256 does not match the exact package bytes');
  if(manifest?.controlAuthority!=='none'||manifest?.physicalEvidenceCaptured!==true||manifest?.independentReviewRequired!==true||manifest?.reviewDisposition!=='captured-awaiting-independent-review')fail('physical evidence review boundary is invalid');
  for(const key of ['automaticQualification','registryMutation','targetHardwareQualified','closedTrackApproved','publicRoadApproved'])if(manifest?.[key]!==false)fail(`${key} must remain false`);
  if(!manifest?.workflow||typeof manifest.workflow.name!=='string'||!/^\d{1,24}$/.test(String(manifest.workflow.runId))||!/^\d{1,8}$/.test(String(manifest.workflow.runAttempt)))fail('workflow provenance is incomplete');
  if(failures.length)throw new Error(failures.join('; '));
  return true;
}
