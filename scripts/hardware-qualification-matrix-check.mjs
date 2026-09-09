import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const path=resolve(process.cwd(),'docs/validation/hardware/V006_HARDWARE_QUALIFICATION_MATRIX.json');
const matrix=JSON.parse(readFileSync(path,'utf8'));
const failures=[];

function fail(message){failures.push(message);}
function label(value){return typeof value==='string'&&value.trim().length>0&&value.length<=220&&!/[\r\n\t]/.test(value);}
function sha40(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}

if(matrix.schema!=='kingmast-hardware-qualification-matrix/v1')fail('unexpected hardware qualification matrix schema');
if(matrix.version!=='0.0.6')fail('hardware qualification matrix version must remain 0.0.6');
if(matrix.controlAuthority!=='none')fail('hardware qualification matrix controlAuthority must remain none');
if(matrix.qualificationClaim!=='preparation-only-no-target-hardware-qualification')fail('hardware qualification claim must remain preparation-only');
for(const key of ['automaticQualification','targetHardwareQualified','physicalVehicleComputerQualified','closedTrackApproved','publicRoadApproved'])if(matrix[key]!==false)fail(`${key} must remain false`);

if(!matrix.privacy||Object.values(matrix.privacy).some((value)=>value!==true))fail('all hardware evidence privacy prohibitions must remain enabled');

if(!Array.isArray(matrix.qualificationDimensions)||matrix.qualificationDimensions.length<6){
  fail('at least six qualification dimensions are required');
}else{
  const ids=new Set();
  let totalWeight=0;
  for(const dimension of matrix.qualificationDimensions){
    if(!dimension||typeof dimension!=='object'||Array.isArray(dimension)){fail('qualification dimension must be an object');continue;}
    if(!label(dimension.id)||ids.has(dimension.id))fail(`invalid or duplicate qualification dimension ${String(dimension.id)}`);
    ids.add(dimension.id);
    if(!Number.isFinite(dimension.weightPercent)||dimension.weightPercent<=0||dimension.weightPercent>100)fail(`${dimension.id}: weightPercent must be within 1..100`);
    else totalWeight+=dimension.weightPercent;
    if(dimension.physicalEvidenceRequired!==true)fail(`${dimension.id}: physicalEvidenceRequired must be true`);
  }
  if(Math.abs(totalWeight-100)>1e-9)fail(`qualification dimension weights must total 100, got ${totalWeight}`);
}

const allowedCategories=new Set(['vehicle-computer','display','sensor','interface']);
const allowedStatuses=new Set(['pending-physical-evidence','captured-awaiting-independent-review','reviewed-pass','reviewed-fail']);
if(!Array.isArray(matrix.targets)||matrix.targets.length<7){
  fail('at least seven bounded hardware targets are required');
}else{
  const ids=new Set();
  const categories=new Set();
  for(const target of matrix.targets){
    if(!target||typeof target!=='object'||Array.isArray(target)){fail('hardware target must be an object');continue;}
    if(!label(target.id)||ids.has(target.id))fail(`invalid or duplicate hardware target ${String(target.id)}`);
    ids.add(target.id);
    if(!allowedCategories.has(target.category))fail(`${target.id}: unsupported category ${String(target.category)}`);
    categories.add(target.category);
    if(!allowedStatuses.has(target.status))fail(`${target.id}: unsupported status ${String(target.status)}`);
    if(!Array.isArray(target.requiredEvidence)||target.requiredEvidence.length<4||target.requiredEvidence.some((item)=>!label(item)))fail(`${target.id}: requiredEvidence must contain at least four bounded entries`);

    if(target.status==='pending-physical-evidence'){
      if(target.evidence!==null)fail(`${target.id}: pending target must keep evidence=null`);
      continue;
    }

    const evidence=target.evidence;
    if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)){fail(`${target.id}: captured/reviewed target requires evidence object`);continue;}
    if(!sha40(evidence.sourceSoftwareCommit))fail(`${target.id}: sourceSoftwareCommit must be a full 40-character SHA`);
    if(!label(evidence.configurationRevision)||!label(evidence.firmwareRevision))fail(`${target.id}: firmware and configuration revisions are required`);
    if(!Array.isArray(evidence.evidenceRefs)||evidence.evidenceRefs.length===0)fail(`${target.id}: evidenceRefs are required`);
    else{
      const refs=new Set();
      for(const item of evidence.evidenceRefs){
        if(!item||typeof item!=='object'||Array.isArray(item)){fail(`${target.id}: malformed evidence ref`);continue;}
        if(!label(item.ref)||refs.has(item.ref))fail(`${target.id}: evidence refs must be bounded and unique`);
        else refs.add(item.ref);
        if(!sha256(item.sha256))fail(`${target.id}: every evidence ref requires SHA-256`);
      }
    }
    if(target.status==='captured-awaiting-independent-review'){
      if(evidence.independentReview!==null)fail(`${target.id}: captured target must await independent review`);
    }else{
      const review=evidence.independentReview;
      if(!review||typeof review!=='object'||Array.isArray(review))fail(`${target.id}: reviewed target requires independentReview object`);
      else{
        if(!label(review.reviewer)||!iso(review.reviewedAt))fail(`${target.id}: reviewed target requires reviewer and reviewedAt`);
        if(!['pass','fail'].includes(review.disposition))fail(`${target.id}: review disposition must be pass or fail`);
        if(target.status==='reviewed-pass'&&review.disposition!=='pass')fail(`${target.id}: reviewed-pass requires pass disposition`);
        if(target.status==='reviewed-fail'&&review.disposition!=='fail')fail(`${target.id}: reviewed-fail requires fail disposition`);
      }
    }
  }
  for(const category of allowedCategories)if(!categories.has(category))fail(`hardware matrix must contain category ${category}`);
  for(const requiredId of ['vehicle-computer-aarch64','display-primary','front-radar','surround-camera-set','dms-camera','gnss-imu','read-only-can-interface'])if(!ids.has(requiredId))fail(`missing required hardware target ${requiredId}`);
}

const rule=matrix.promotionRule;
if(!rule||typeof rule!=='object'||Array.isArray(rule))fail('promotionRule is required');
else{
  if(rule.captureStatus!=='captured-awaiting-independent-review'||rule.reviewedPassStatus!=='reviewed-pass'||rule.reviewedFailStatus!=='reviewed-fail')fail('promotionRule status names are invalid');
  for(const key of ['sourceCommitBindingRequired','sha256EvidenceBindingRequired','independentReviewerRequired','qualificationDecisionOutsideRepositoryAutomation'])if(rule[key]!==true)fail(`promotionRule.${key} must be true`);
  if(rule.registryMutationByAutomation!==false)fail('promotionRule.registryMutationByAutomation must remain false');
}

if(failures.length){
  console.error('KINGMAST hardware qualification matrix policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`KINGMAST hardware qualification matrix valid: ${matrix.targets.length} target(s), ${matrix.qualificationDimensions.length} dimensions; targetHardwareQualified=false.`);
