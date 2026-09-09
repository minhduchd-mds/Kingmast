import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SHA256_RE=/^[a-f0-9]{64}$/i;
const COMMIT_RE=/^[a-f0-9]{40}$/i;
const ROOT=resolve(fileURLToPath(new URL('../..',import.meta.url)));

export function loadRunnerContract(path=resolve(ROOT,'autonomy-lab/digital-twin/runner-contract.json')){
  return JSON.parse(readFileSync(path,'utf8'));
}

export function buildExternalSimulatorInvocation({engine,repositoryPath,campaignPath,scope,outputPath},contract=loadRunnerContract()){
  const wrapper=contract.wrappers?.find((item)=>item.engine===engine);
  if(!wrapper)throw new Error(`unsupported external simulator engine ${String(engine)}`);
  if(wrapper.networkDownloadAllowed!==false)throw new Error('external simulator wrapper must prohibit runtime network downloads');
  if(!contract.allowedScopes?.[scope])throw new Error(`unsupported campaign scope ${String(scope)}`);
  for(const [label,value] of Object.entries({repositoryPath,campaignPath,outputPath})){
    if(typeof value!=='string'||value.length<1||value.length>1024||/[\r\n\0]/.test(value))throw new Error(`${label} must be a bounded path`);
  }
  return Object.freeze({
    executable:wrapper.path,
    argv:['--repository',repositoryPath,'--campaign',campaignPath,'--scope',scope,'--output',outputPath],
    engine,
    networkDownloadAllowed:false,
    controlAuthority:'none',
    automaticActuation:false,
    physicalHilExecuted:false,
    closedTrackExecuted:false
  });
}

export function evaluateExternalSimulatorSession(session,contract=loadRunnerContract()){
  const failures=[];
  const scope=contract.allowedScopes?.[session?.campaignScope];
  const engineKnown=contract.wrappers?.some((item)=>item.engine===session?.engine);
  if(session?.schema!=='kingmast-p5-external-simulator-session/v1')failures.push('schema');
  if(!engineKnown)failures.push('engine');
  if(!scope)failures.push('campaignScope');
  if(!COMMIT_RE.test(session?.sourceCommit??''))failures.push('sourceCommit');
  if(!SHA256_RE.test(session?.scenarioArtifactSha256??''))failures.push('scenarioArtifactSha256');
  if(!SHA256_RE.test(session?.resultArtifactSha256??''))failures.push('resultArtifactSha256');
  if(!Number.isInteger(session?.scenarioResultCount))failures.push('scenarioResultCount');
  else if(scope&&(session.scenarioResultCount<scope.minimumScenarioResults||session.scenarioResultCount>scope.maximumScenarioResults))failures.push('scenarioResultCount-outside-scope');
  if(session?.controlAuthority!=='none')failures.push('controlAuthority');
  if(session?.automaticActuation!==false)failures.push('automaticActuation');
  if(session?.physicalHilExecuted!==false)failures.push('physicalHilExecuted');
  if(session?.closedTrackExecuted!==false)failures.push('closedTrackExecuted');
  if(session?.targetHardwareQualified!==false)failures.push('targetHardwareQualified');
  if(session?.publicRoadApproved!==false)failures.push('publicRoadApproved');
  if(typeof session?.fixtureOnly!=='boolean')failures.push('fixtureOnly');
  if(typeof session?.externalExecution!=='boolean')failures.push('externalExecution');
  if(session?.fixtureOnly===true&&session?.externalExecution===true)failures.push('fixture-cannot-claim-external-execution');

  const valid=failures.length===0;
  return{
    schema:'kingmast-p5-external-simulator-session-assessment/v1',
    version:'0.0.6',
    controlAuthority:'none',
    valid,
    failures,
    fixtureOnly:session?.fixtureOnly===true,
    externalExecution:session?.externalExecution===true,
    externalSimulatorEvidenceReady:valid&&session?.fixtureOnly===false&&session?.externalExecution===true,
    physicalEvidence:false,
    physicalHilExecuted:false,
    closedTrackExecuted:false,
    targetHardwareQualified:false,
    publicRoadApproved:false
  };
}

function selftest(){
  const base={
    schema:'kingmast-p5-external-simulator-session/v1',engine:'esmini',campaignScope:'smoke',sourceCommit:'a'.repeat(40),scenarioArtifactSha256:'b'.repeat(64),resultArtifactSha256:'c'.repeat(64),scenarioResultCount:8,fixtureOnly:true,externalExecution:false,controlAuthority:'none',automaticActuation:false,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false
  };
  const contract=loadRunnerContract();
  const invocation=buildExternalSimulatorInvocation({engine:'esmini',repositoryPath:'/workspace/Kingmast',campaignPath:'/workspace/campaign.json',scope:'smoke',outputPath:'/workspace/result.json'},contract);
  const valid=evaluateExternalSimulatorSession(base,contract);
  const badCount=evaluateExternalSimulatorSession({...base,scenarioResultCount:999},contract);
  const badAuthority=evaluateExternalSimulatorSession({...base,targetHardwareQualified:true},contract);
  const badFixture=evaluateExternalSimulatorSession({...base,externalExecution:true},contract);
  const report={schema:'kingmast-p5-external-simulator-session-selftest/v1',version:'0.0.6',controlAuthority:'none',fixtureOnly:true,externalSimulatorExecuted:false,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,total:5,passed:[invocation.controlAuthority==='none'&&invocation.networkDownloadAllowed===false,valid.valid,!badCount.valid,!badAuthority.valid,!badFixture.valid].filter(Boolean).length};
  return{...report,failed:report.total-report.passed,allPassed:report.passed===report.total};
}

if(process.argv.includes('--selftest')){
  const report=selftest();
  if(process.argv.includes('--json'))process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
  else console.log(`KINGMAST P5 external simulator session self-test ${report.passed}/${report.total}`);
  if(!report.allPassed)process.exit(1);
}
