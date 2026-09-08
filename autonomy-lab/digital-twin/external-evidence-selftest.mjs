import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildExternalEvidenceManifest,readJson,sha256File,validateExternalResult} from './external-evidence-lib.mjs';

const jsonMode=process.argv.includes('--json');
const root=process.cwd();
const runnerContract=readJson('autonomy-lab/digital-twin/runner-contract.json',root);
const sourceCommit='a'.repeat(40);
const scope='smoke';
const temp=mkdtempSync(join(tmpdir(),'kingmast-external-evidence-'));
const cases=[];
const checks=[];
const record=(id,passed,detail)=>checks.push({id,passed,detail});
const writeJson=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});

try{
  for(let index=1;index<=8;index++)cases.push({id:`SIM-TEST-${String(index).padStart(3,'0')}::nominal-day`,baseScenarioId:`SIM-TEST-${String(index).padStart(3,'0')}`,executionStatus:'planned',externalSimulatorExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,publicRoadApproved:false});
  const campaign={schema:'kingmast-safety-scenario-campaign/v1',productVersion:'0.0.6',controlAuthority:'none',campaignSha256:'d'.repeat(64),externalSimulatorExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,cases};
  const campaignPath=join(temp,'campaign.json');
  writeJson(campaignPath,campaign);
  const campaignFileSha256=sha256File(campaignPath);
  const result=(engine,offset=0)=>({
    schema:'kingmast-external-simulator-result/v1',generatedAt:'2026-09-08T00:00:00.000Z',engine,engineVersion:engine==='carla'?'0.9.16':'2.52.1',sourceCommit,campaignScope:scope,scenarioGranularity:'base',scenarioArtifactSha256:campaignFileSha256,resultArtifactSha256:(engine==='carla'?'b':'c').repeat(64),fixtureOnly:false,externalExecution:true,controlAuthority:'none',qualificationClaim:'external-simulator-run-only-not-physical-validation',physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,
    results:cases.map((item,index)=>({scenarioId:item.baseScenarioId,outcome:index%4===0?'warn':index%4===1?'monitor':index%4===2?'degrade':'reject',collision:false,minTtcS:index%3===0?null:1.2+index*0.1+offset,maxLateralErrorM:0.1+index*0.02+offset,warningLatencyMs:90+index*5+Math.round(offset*100)})),
  });
  const carla=result('carla',0.05);
  const esmini=result('esmini',0);
  const validate=(report,engine)=>validateExternalResult({report,engine,campaign,campaignFileSha256,sourceCommit,scope,runnerContract});
  record('SELFTEST-VALID-CARLA',validate(carla,'carla').ok,'valid CARLA envelope is accepted');
  record('SELFTEST-VALID-ESMINI',validate(esmini,'esmini').ok,'valid esmini envelope is accepted');
  record('SELFTEST-TAMPERED-CAMPAIGN',!validate({...carla,scenarioArtifactSha256:'0'.repeat(64)},'carla').ok,'tampered campaign binding is rejected');
  record('SELFTEST-FIXTURE-REJECTION',!validate({...carla,fixtureOnly:true,externalExecution:false,engineVersion:'fixture-only'},'carla').ok,'fixture output is rejected from external evidence path');
  const duplicate={...carla,results:[...carla.results.slice(0,7),carla.results[0]]};
  record('SELFTEST-DUPLICATE-SCENARIO',!validate(duplicate,'carla').ok,'duplicate scenario identities are rejected');

  const carlaPath=join(temp,'carla.json');
  const esminiPath=join(temp,'esmini.json');
  const parityPath=join(temp,'parity.json');
  writeJson(carlaPath,carla);writeJson(esminiPath,esmini);
  writeJson(parityPath,{schema:'kingmast-cross-simulator-parity-report/v1',generatedAt:'2026-09-08T00:01:00.000Z',controlAuthority:'none',qualificationClaim:'external-simulator-parity-evidence-only-not-physical-validation',fixtureMode:false,externalSimulatorEvidence:true,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,commonScenarioCount:8,passed:8,failed:0,allPassed:true,cases:[]});
  let manifestOk=false;
  try{
    const manifest=buildExternalEvidenceManifest({campaignPath,carlaPath,esminiPath,parityPath,sourceCommit,scope,runnerContractPath:'autonomy-lab/digital-twin/runner-contract.json',root});
    manifestOk=manifest.schema==='kingmast-external-simulator-evidence-manifest/v1'&&manifest.externalSimulatorExecuted===true&&manifest.independentReviewComplete===false&&manifest.reviewStatus==='captured-awaiting-independent-review'&&manifest.engines.length===2&&manifest.engines.every((item)=>/^[a-f0-9]{64}$/.test(item.envelopeSha256))&&manifest.physicalHilExecuted===false&&manifest.closedTrackExecuted===false&&manifest.targetHardwareQualified===false&&manifest.publicRoadApproved===false;
  }catch{manifestOk=false;}
  record('SELFTEST-MANIFEST-BINDING',manifestOk,'manifest binds both external envelopes, campaign and parity while remaining virtual evidence');
}finally{rmSync(temp,{recursive:true,force:true});}

const failed=checks.filter((item)=>!item.passed);
const report={schema:'kingmast-external-simulator-evidence-toolchain-selftest/v1',generatedAt:new Date().toISOString(),controlAuthority:'none',qualificationClaim:'software-toolchain-selftest-only-not-external-simulator-or-physical-evidence',externalSimulatorExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,total:checks.length,passed:checks.length-failed.length,failed:failed.length,allPassed:failed.length===0,checks};
if(jsonMode)console.log(JSON.stringify(report,null,2));else console.log(`[external-evidence-selftest] passed=${report.passed}/${report.total}; external-executed=false; physical-qualification=false`);
if(!report.allPassed)process.exit(1);
