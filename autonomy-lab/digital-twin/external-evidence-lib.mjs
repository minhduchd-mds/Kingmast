import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const SHA256=/^[a-f0-9]{64}$/;
const COMMIT=/^[a-f0-9]{40}$/;
const OUTCOMES=new Set(['monitor','warn','degrade','reject']);
const FALSE_CLAIM_FIELDS=['physicalHilExecuted','closedTrackExecuted','targetHardwareQualified','publicRoadApproved'];

export function resolvePath(path,root=process.cwd()){return resolve(root,path);}
export function readJson(path,root=process.cwd()){return JSON.parse(readFileSync(resolvePath(path,root),'utf8'));}
export function sha256File(path,root=process.cwd()){return createHash('sha256').update(readFileSync(resolvePath(path,root))).digest('hex');}
export function isSha256(value){return typeof value==='string'&&SHA256.test(value);}
export function isCommitSha(value){return typeof value==='string'&&COMMIT.test(value);}
export function isIsoTimestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&/T/.test(value);}

function boundedString(value,min,max){return typeof value==='string'&&value.length>=min&&value.length<=max;}
function boundedNumber(value,min,max){return Number.isFinite(value)&&value>=min&&value<=max;}
function add(errors,condition,message){if(!condition)errors.push(message);}

export function validateCampaign(campaign){
  const errors=[];
  add(errors,campaign?.schema==='kingmast-safety-scenario-campaign/v1','campaign schema mismatch');
  add(errors,campaign?.controlAuthority==='none','campaign controlAuthority must remain none');
  for(const field of ['externalSimulatorExecuted','physicalHilExecuted','closedTrackExecuted','targetHardwareQualified','publicRoadApproved'])add(errors,campaign?.[field]===false,`campaign ${field} must remain false`);
  const cases=Array.isArray(campaign?.cases)?campaign.cases:[];
  add(errors,cases.length>=8,'campaign must contain at least eight planned cases');
  add(errors,cases.length<=560,'campaign must remain bounded to 560 cases for this runner contract version');
  const caseIds=new Set();
  const baseIds=new Set();
  for(const item of cases){
    add(errors,boundedString(item?.id,3,160),`invalid campaign case id ${String(item?.id)}`);
    add(errors,boundedString(item?.baseScenarioId,3,96),`invalid base scenario id ${String(item?.baseScenarioId)}`);
    if(typeof item?.id==='string'){
      if(caseIds.has(item.id))errors.push(`duplicate campaign case id ${item.id}`);
      caseIds.add(item.id);
    }
    if(typeof item?.baseScenarioId==='string')baseIds.add(item.baseScenarioId);
    add(errors,item?.executionStatus==='planned',`${String(item?.id)}: campaign case must remain planned before external execution`);
    for(const field of ['externalSimulatorExecuted','physicalHilExecuted','closedTrackExecuted','publicRoadApproved'])add(errors,item?.[field]===false,`${String(item?.id)}: ${field} must remain false in campaign intent`);
  }
  return{ok:errors.length===0,errors,caseIds,baseIds};
}

export function validateExternalResult({report,engine,campaign,campaignFileSha256,sourceCommit,scope,runnerContract}){
  const errors=[];
  const campaignValidation=validateCampaign(campaign);
  errors.push(...campaignValidation.errors.map((item)=>`campaign: ${item}`));
  const resultContract=runnerContract?.resultContract??{};
  const scopePolicy=runnerContract?.allowedScopes?.[scope];
  add(errors,Boolean(scopePolicy),`unsupported campaign scope ${String(scope)}`);
  add(errors,report?.schema===resultContract.schema,`${engine}: result schema mismatch`);
  add(errors,report?.engine===engine,`${engine}: engine identity mismatch`);
  add(errors,boundedString(report?.engineVersion,1,resultContract.maxEngineVersionLength??96),`${engine}: engineVersion must be bounded and non-empty`);
  add(errors,typeof report?.engineVersion==='string'&&!/fixture/i.test(report.engineVersion),`${engine}: real external evidence cannot use a fixture engine version`);
  add(errors,isCommitSha(sourceCommit),'expected source commit must be a full 40-character lowercase SHA');
  add(errors,report?.sourceCommit===sourceCommit,`${engine}: sourceCommit must bind to the workflow commit`);
  add(errors,report?.campaignScope===scope,`${engine}: campaignScope must bind to the dispatched scope`);
  add(errors,(resultContract.scenarioGranularities??[]).includes(report?.scenarioGranularity),`${engine}: unsupported scenarioGranularity`);
  add(errors,isSha256(campaignFileSha256),'computed campaign file SHA-256 is invalid');
  add(errors,report?.scenarioArtifactSha256===campaignFileSha256,`${engine}: scenarioArtifactSha256 must equal the exact campaign file SHA-256`);
  add(errors,isSha256(report?.resultArtifactSha256),`${engine}: resultArtifactSha256 must identify the runner-native result artifact`);
  add(errors,report?.fixtureOnly===false,`${engine}: fixtureOnly must be false for external evidence`);
  add(errors,report?.externalExecution===true,`${engine}: externalExecution must be true for external evidence`);
  add(errors,report?.controlAuthority==='none',`${engine}: controlAuthority must remain none`);
  for(const field of FALSE_CLAIM_FIELDS)add(errors,report?.[field]===false,`${engine}: ${field} must remain false`);
  add(errors,isIsoTimestamp(report?.generatedAt),`${engine}: generatedAt must be an ISO timestamp`);

  const results=Array.isArray(report?.results)?report.results:[];
  const minimum=scopePolicy?.minimumScenarioResults??Number.POSITIVE_INFINITY;
  const maximum=Math.min(scopePolicy?.maximumScenarioResults??0,resultContract.maxResults??0);
  add(errors,results.length>=minimum,`${engine}: ${scope} scope requires at least ${minimum} scenario results`);
  add(errors,results.length<=maximum,`${engine}: ${scope} scope exceeds maximum ${maximum} scenario results`);
  const allowedIds=report?.scenarioGranularity==='campaign-case'?campaignValidation.caseIds:campaignValidation.baseIds;
  const seen=new Set();
  for(const item of results){
    const id=item?.scenarioId;
    add(errors,boundedString(id,3,resultContract.maxScenarioIdLength??160),`${engine}: invalid scenarioId ${String(id)}`);
    if(typeof id==='string'){
      if(seen.has(id))errors.push(`${engine}: duplicate scenarioId ${id}`);
      seen.add(id);
      add(errors,allowedIds.has(id),`${engine}/${id}: scenarioId is not present in the reviewed campaign intent`);
    }
    add(errors,(resultContract.allowedOutcomes??[...OUTCOMES]).includes(item?.outcome),`${engine}/${String(id)}: unsupported outcome`);
    add(errors,typeof item?.collision==='boolean',`${engine}/${String(id)}: collision must be boolean`);
    add(errors,item?.minTtcS===null||boundedNumber(item?.minTtcS,0,300),`${engine}/${String(id)}: minTtcS must be null or between 0 and 300 seconds`);
    add(errors,boundedNumber(item?.maxLateralErrorM,0,50),`${engine}/${String(id)}: maxLateralErrorM must be between 0 and 50 metres`);
    add(errors,boundedNumber(item?.warningLatencyMs,0,60_000),`${engine}/${String(id)}: warningLatencyMs must be between 0 and 60000 ms`);
  }
  return{
    ok:errors.length===0,
    errors,
    summary:{engine,engineVersion:report?.engineVersion??null,scope,scenarioGranularity:report?.scenarioGranularity??null,resultCount:results.length,scenarioArtifactSha256:report?.scenarioArtifactSha256??null,resultArtifactSha256:report?.resultArtifactSha256??null},
  };
}

export function buildExternalEvidenceManifest({campaignPath,carlaPath,esminiPath,parityPath,sourceCommit,scope,runnerContractPath='autonomy-lab/digital-twin/runner-contract.json',root=process.cwd()}){
  const runnerContract=readJson(runnerContractPath,root);
  const campaign=readJson(campaignPath,root);
  const carla=readJson(carlaPath,root);
  const esmini=readJson(esminiPath,root);
  const parity=readJson(parityPath,root);
  const campaignFileSha256=sha256File(campaignPath,root);
  const carlaValidation=validateExternalResult({report:carla,engine:'carla',campaign,campaignFileSha256,sourceCommit,scope,runnerContract});
  const esminiValidation=validateExternalResult({report:esmini,engine:'esmini',campaign,campaignFileSha256,sourceCommit,scope,runnerContract});
  const errors=[...carlaValidation.errors,...esminiValidation.errors];
  const parityMinimum=8;
  add(errors,parity?.schema==='kingmast-cross-simulator-parity-report/v1','parity report schema mismatch');
  add(errors,parity?.controlAuthority==='none','parity report controlAuthority must remain none');
  add(errors,parity?.fixtureMode===false,'parity report must not be fixture mode');
  add(errors,parity?.externalSimulatorEvidence===true,'parity report must identify genuine external simulator evidence');
  add(errors,Number.isInteger(parity?.commonScenarioCount)&&parity.commonScenarioCount>=parityMinimum,`parity report requires at least ${parityMinimum} common scenarios`);
  add(errors,Number.isInteger(parity?.failed)&&parity.failed===0,'parity report must have zero failed common scenarios');
  add(errors,parity?.allPassed===true,'parity report must pass before evidence packaging');
  for(const field of FALSE_CLAIM_FIELDS)add(errors,parity?.[field]===false,`parity report ${field} must remain false`);
  if(errors.length){const error=new Error('external simulator evidence manifest rejected:\n'+errors.map((item)=>`- ${item}`).join('\n'));error.errors=errors;throw error;}

  return{
    schema:'kingmast-external-simulator-evidence-manifest/v1',
    generatedAt:new Date().toISOString(),
    productVersion:runnerContract.version,
    sourceCommit,
    campaignScope:scope,
    controlAuthority:'none',
    qualificationClaim:'external-simulator-evidence-captured-awaiting-independent-review-not-physical-validation',
    externalSimulatorExecuted:true,
    independentReviewComplete:false,
    reviewStatus:'captured-awaiting-independent-review',
    campaign:{
      schema:campaign.schema,
      fileSha256:campaignFileSha256,
      logicalCampaignSha256:isSha256(campaign.campaignSha256)?campaign.campaignSha256:null,
      plannedCaseCount:Array.isArray(campaign.cases)?campaign.cases.length:0,
    },
    engines:[
      {...carlaValidation.summary,envelopeSha256:sha256File(carlaPath,root)},
      {...esminiValidation.summary,envelopeSha256:sha256File(esminiPath,root)},
    ],
    parity:{
      reportSha256:sha256File(parityPath,root),
      commonScenarioCount:parity.commonScenarioCount,
      passed:parity.passed,
      failed:parity.failed,
      allPassed:parity.allPassed,
    },
    physicalHilExecuted:false,
    closedTrackExecuted:false,
    targetHardwareQualified:false,
    publicRoadApproved:false,
    limitation:'This manifest binds genuine external simulator outputs to a reviewed campaign and commit. It remains virtual evidence and requires independent review; it cannot satisfy physical HIL, target-hardware, controlled-track, homologation or public-road approval requirements.',
  };
}
