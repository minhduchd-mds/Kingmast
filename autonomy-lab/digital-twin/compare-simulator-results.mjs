import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const args=process.argv.slice(2);
const has=(flag)=>args.includes(flag);
const valueAfter=(flag)=>{const index=args.indexOf(flag);return index>=0?args[index+1]:undefined;};
const root=process.cwd();
const contract=JSON.parse(readFileSync(resolve(root,'autonomy-lab/digital-twin/external-simulator-contract.json'),'utf8'));
const fixtureMode=has('--fixtures');

const fixture=(engine,offset)=>({
  schema:'kingmast-external-simulator-result/v1',engine,engineVersion:'fixture-only',fixtureOnly:true,externalExecution:false,controlAuthority:'none',qualificationClaim:'test-fixture-only-not-external-simulator-evidence',physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,
  results:[
    ['SIM-FCW-001','warn',false,1.44,0.08,118],['SIM-VRU-001','warn',false,2.31,0.16,141],['SIM-SENSOR-001','degrade',false,1.92,0.11,98],['SIM-LDW-001','warn',false,null,0.42,126],['SIM-DMS-001','warn',false,null,0,164],['SIM-RCTA-001','warn',false,2.01,0.14,132],['SIM-BSD-001','warn',false,null,0.18,109],['SIM-SURROUND-002','degrade',false,null,0.51,171],['SIM-V2X-001','reject',false,null,0,74],['SIM-VN-002','reject',false,null,0,62]
  ].map(([scenarioId,outcome,collision,minTtcS,maxLateralErrorM,warningLatencyMs],index)=>({scenarioId,outcome,collision,minTtcS:minTtcS===null?null:Number(minTtcS)+(index%3)*offset,maxLateralErrorM:Number(maxLateralErrorM)+offset,warningLatencyMs:Number(warningLatencyMs)+Math.round(offset*300)}))
});

function load(path,engine){
  if(fixtureMode)return fixture(engine,engine==='carla'?0.11:0);
  if(!path)throw new Error(`missing --${engine} <path>`);
  return JSON.parse(readFileSync(resolve(root,path),'utf8'));
}
const carla=load(valueAfter('--carla'),'carla');
const esmini=load(valueAfter('--esmini'),'esmini');

function validate(report,engine){
  if(report.schema!=='kingmast-external-simulator-result/v1'||report.engine!==engine)throw new Error(`${engine}: invalid result identity`);
  if(report.controlAuthority!=='none')throw new Error(`${engine}: controlAuthority must be none`);
  for(const field of ['physicalHilExecuted','closedTrackExecuted','targetHardwareQualified','publicRoadApproved'])if(report[field]!==false)throw new Error(`${engine}: ${field} must remain false`);
  if(fixtureMode){if(report.fixtureOnly!==true||report.externalExecution!==false)throw new Error(`${engine}: fixture mode must remain non-executed`);}
  else if(report.fixtureOnly!==false||report.externalExecution!==true||!report.engineVersion||report.engineVersion==='fixture-only')throw new Error(`${engine}: real evidence requires externalExecution=true, fixtureOnly=false and a captured version`);
  if(!Array.isArray(report.results))throw new Error(`${engine}: results array required`);
}
validate(carla,'carla');validate(esmini,'esmini');
const carlaById=new Map(carla.results.map((item)=>[item.scenarioId,item]));
const esminiById=new Map(esmini.results.map((item)=>[item.scenarioId,item]));
const common=[...carlaById.keys()].filter((id)=>esminiById.has(id)).sort();
const p=contract.parityPolicy;
const nullableDelta=(a,b)=>a===null&&b===null?0:(Number.isFinite(a)&&Number.isFinite(b)?Math.abs(a-b):Infinity);
const cases=common.map((scenarioId)=>{
  const a=carlaById.get(scenarioId),b=esminiById.get(scenarioId);
  const deltas={warningLatencyMs:Math.abs(a.warningLatencyMs-b.warningLatencyMs),minTtcS:nullableDelta(a.minTtcS,b.minTtcS),maxLateralErrorM:Math.abs(a.maxLateralErrorM-b.maxLateralErrorM)};
  const checks={outcome:a.outcome===b.outcome,collision:a.collision===b.collision,warningLatency:deltas.warningLatencyMs<=p.warningLatencyToleranceMs,minTtc:deltas.minTtcS<=p.minTtcToleranceS,lateralError:deltas.maxLateralErrorM<=p.maxLateralErrorToleranceM};
  return{scenarioId,passed:Object.values(checks).every(Boolean),checks,deltas};
});
const failed=cases.filter((item)=>!item.passed);
const report={schema:'kingmast-cross-simulator-parity-report/v1',generatedAt:new Date().toISOString(),controlAuthority:'none',qualificationClaim:fixtureMode?'fixture-parity-selftest-only-not-external-simulator-evidence':'external-simulator-parity-evidence-only-not-physical-validation',fixtureMode,externalSimulatorEvidence:!fixtureMode,physicalHilExecuted:false,closedTrackExecuted:false,targetHardwareQualified:false,publicRoadApproved:false,commonScenarioCount:common.length,passed:cases.length-failed.length,failed:failed.length,allPassed:failed.length===0&&common.length>=p.minimumCommonScenarios,tolerance:p,cases,limitation:'Cross-simulator parity can expose modeling divergence but cannot prove real-world vehicle safety or replace HIL, target-hardware, controlled-track or independent review evidence.'};
if(has('--json'))console.log(JSON.stringify(report,null,2));else console.log(`[cross-simulator] common=${report.commonScenarioCount}; passed=${report.passed}; failed=${report.failed}; fixture=${fixtureMode}; physical-qualification=false`);
if(has('--ci')&&!report.allPassed)process.exit(1);
