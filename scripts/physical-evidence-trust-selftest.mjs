import {buildPhysicalEvidenceManifest,validatePhysicalEvidenceManifest} from './lib/physical-evidence-manifest.mjs';

const source='a'.repeat(40);
const makePackage=(kind)=>({
  schema:kind==='hil'?'kingmast-hil-evidence-package/v1':'kingmast-closed-track-evidence-package/v1',
  version:'0.0.6',
  scenarioId:kind==='hil'?'HIL-001':'CT-001',
  claim:kind==='hil'?'physical-hil-result':'physical-controlled-track-result',
  status:'passed',
  controlAuthority:'none',
  targetHardwareQualified:false,
  ...(kind==='closed-track'?{closedTrackApproved:false}:{}),
  publicRoadApproved:false,
  automaticQualification:false,
  registryMutation:false,
  reviewDisposition:'captured-awaiting-independent-review',
  sourceCommitBinding:{expected:source,matched:true},
  result:{softwareCommit:source},
});

const checks=[];
const run=(id,fn)=>{try{fn();checks.push({id,passed:true});}catch(error){checks.push({id,passed:false,error:error instanceof Error?error.message:String(error)});}};
for(const kind of ['hil','closed-track']){
  const payload=makePackage(kind);
  const bytes=Buffer.from(JSON.stringify(payload));
  run(`${kind}-valid-binding`,()=>{
    const manifest=buildPhysicalEvidenceManifest({kind,packagePayload:payload,packageBytes:bytes,expectedSourceCommit:source,workflowName:'Physical Evidence Selftest',runId:'123',runAttempt:'1'});
    validatePhysicalEvidenceManifest(manifest,{kind,packagePayload:payload,packageBytes:bytes,expectedSourceCommit:source});
  });
  run(`${kind}-tampered-package-rejected`,()=>{
    const manifest=buildPhysicalEvidenceManifest({kind,packagePayload:payload,packageBytes:bytes,expectedSourceCommit:source,workflowName:'Physical Evidence Selftest',runId:'123',runAttempt:'1'});
    let rejected=false;
    try{validatePhysicalEvidenceManifest(manifest,{kind,packagePayload:payload,packageBytes:Buffer.concat([bytes,Buffer.from('tamper')]),expectedSourceCommit:source});}catch{rejected=true;}
    if(!rejected)throw new Error('tampered package bytes were accepted');
  });
  run(`${kind}-source-mismatch-rejected`,()=>{
    let rejected=false;
    try{buildPhysicalEvidenceManifest({kind,packagePayload:payload,packageBytes:bytes,expectedSourceCommit:'b'.repeat(40),workflowName:'Physical Evidence Selftest',runId:'123',runAttempt:'1'});}catch{rejected=true;}
    if(!rejected)throw new Error('mismatched source commit was accepted');
  });
  run(`${kind}-automatic-qualification-rejected`,()=>{
    const bad={...payload,automaticQualification:true};
    let rejected=false;
    try{buildPhysicalEvidenceManifest({kind,packagePayload:bad,packageBytes:Buffer.from(JSON.stringify(bad)),expectedSourceCommit:source,workflowName:'Physical Evidence Selftest',runId:'123',runAttempt:'1'});}catch{rejected=true;}
    if(!rejected)throw new Error('automatic qualification was accepted');
  });
}
const failed=checks.filter((item)=>!item.passed);
const report={schema:'kingmast-physical-evidence-trust-selftest/v1',version:'0.0.6',controlAuthority:'none',fixtureOnly:true,physicalEvidenceCaptured:false,targetHardwareQualified:false,closedTrackApproved:false,publicRoadApproved:false,total:checks.length,passed:checks.length-failed.length,failed:failed.length,allPassed:failed.length===0,checks};
const args=new Set(process.argv.slice(2));
if(args.has('--json'))console.log(JSON.stringify(report,null,2));else console.log(`[physical-evidence-trust] passed=${report.passed}/${report.total}; fixtureOnly=true; physical-evidence=false`);
if(args.has('--ci')&&!report.allPassed)process.exit(1);
