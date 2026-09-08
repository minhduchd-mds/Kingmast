import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const path=resolve(process.cwd(),'docs/review/V006_INDEPENDENT_REVIEW_REGISTRY.json');
const registry=JSON.parse(readFileSync(path,'utf8'));
const failures=[];

function fail(message){failures.push(message);}
function label(value){return typeof value==='string'&&value.trim().length>0&&value.length<=200&&!/[\r\n\t]/.test(value);}
function sha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value));}

if(registry.schema!=='kingmast-independent-review-registry/v1')fail('unexpected independent review registry schema');
if(registry.version!=='0.0.6')fail('review registry version must remain 0.0.6');
if(registry.controlAuthority!=='none')fail('controlAuthority must remain none');
for(const key of ['targetHardwareQualified','closedTrackApproved','publicRoadApproved'])if(registry[key]!==false)fail(`${key} must remain false`);
if(!['pending','in-review','reviewed-with-open-findings','reviewed'].includes(registry.overallStatus))fail('unsupported overallStatus');
if(!Array.isArray(registry.reviews)||registry.reviews.length<5)fail('at least five independent review domains are required');
else{
  const ids=new Set();
  for(const review of registry.reviews){
    if(!review||typeof review!=='object'||Array.isArray(review)){fail('review entry must be an object');continue;}
    if(!/^REV-[A-Z0-9-]+$/.test(review.id)||ids.has(review.id))fail(`invalid or duplicate review id ${String(review.id)}`);
    ids.add(review.id);
    if(!label(review.domain))fail(`${review.id}: domain is required`);
    if(!['pending','in-review','complete'].includes(review.status))fail(`${review.id}: unsupported status`);
    if(review.status==='pending'){
      if(review.reviewer!==null||review.reviewedAt!==null||review.disposition!==null)fail(`${review.id}: pending review must not claim reviewer/time/disposition`);
      if(!Array.isArray(review.evidenceRefs)||review.evidenceRefs.length!==0)fail(`${review.id}: pending review must keep evidenceRefs empty`);
      continue;
    }
    if(!label(review.reviewer))fail(`${review.id}: reviewer is required`);
    if(review.status==='complete'&&!iso(review.reviewedAt))fail(`${review.id}: completed review requires reviewedAt`);
    if(review.status==='in-review'&&review.reviewedAt!==null&&!iso(review.reviewedAt))fail(`${review.id}: reviewedAt must be null or ISO`);
    if(!Array.isArray(review.evidenceRefs)||review.evidenceRefs.length===0)fail(`${review.id}: evidenceRefs are required once review starts`);
    else for(const item of review.evidenceRefs){if(!item||!label(item.ref)||!sha256(item.sha256))fail(`${review.id}: evidence ref requires bounded ref and SHA-256`);}
    if(review.status==='complete'&&!['accept','accept-with-findings','reject'].includes(review.disposition))fail(`${review.id}: completed review requires disposition`);
    if(!Array.isArray(review.findings))fail(`${review.id}: findings must be an array`);
    else for(const finding of review.findings){
      if(!finding||typeof finding!=='object'||Array.isArray(finding)){fail(`${review.id}: finding must be an object`);continue;}
      if(!label(finding.id)||!label(finding.summary)||!['open','resolved','accepted-risk'].includes(finding.status))fail(`${review.id}: malformed finding`);
      if(finding.status==='resolved'&&!label(finding.resolutionRef))fail(`${review.id}: resolved finding requires resolutionRef`);
    }
  }
}

const complete=Array.isArray(registry.reviews)&&registry.reviews.every((item)=>item.status==='complete');
const hasOpen=Array.isArray(registry.reviews)&&registry.reviews.some((item)=>Array.isArray(item.findings)&&item.findings.some((finding)=>finding.status==='open'));
if(registry.overallStatus==='reviewed'&&(!complete||hasOpen))fail('overallStatus=reviewed requires all domains complete with no open findings');
if(registry.overallStatus==='pending'&&Array.isArray(registry.reviews)&&registry.reviews.some((item)=>item.status!=='pending'))fail('overallStatus=pending cannot contain started reviews');

if(failures.length){
  console.error('KINGMAST independent review registry policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`KINGMAST independent review registry valid: ${registry.reviews.length} domain(s); overall=${registry.overallStatus}; publicRoadApproved=false.`);
