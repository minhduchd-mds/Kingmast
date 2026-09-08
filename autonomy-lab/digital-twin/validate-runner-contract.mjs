import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const runner=JSON.parse(readFileSync(resolve(root,'autonomy-lab/digital-twin/runner-contract.json'),'utf8'));
const execution=JSON.parse(readFileSync(resolve(root,'autonomy-lab/digital-twin/external-simulator-contract.json'),'utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};

expect(runner.schema==='kingmast-external-simulator-runner-contract/v1','unexpected runner contract schema');
expect(runner.version==='0.0.6','runner contract version must remain 0.0.6');
expect(runner.controlAuthority==='none','runner contract must preserve controlAuthority=none');
expect(runner.qualificationClaim==='runner-interface-contract-only-not-external-or-physical-evidence','runner qualification claim must remain interface-only');

const scopes=runner.allowedScopes??{};
expect(Object.keys(scopes).sort().join(',')==='smoke,validation','runner contract must expose exactly smoke and validation scopes');
expect(Number.isInteger(scopes.smoke?.minimumScenarioResults)&&scopes.smoke.minimumScenarioResults>=8,'smoke scope must require at least eight scenario results');
expect(Number.isInteger(scopes.smoke?.maximumScenarioResults)&&scopes.smoke.maximumScenarioResults<=64,'smoke scope must remain bounded to at most 64 scenario results');
expect(Number.isInteger(scopes.validation?.minimumScenarioResults)&&scopes.validation.minimumScenarioResults>=35,'validation scope must require at least 35 scenario results');
expect(Number.isInteger(scopes.validation?.maximumScenarioResults)&&scopes.validation.maximumScenarioResults>=500&&scopes.validation.maximumScenarioResults<=560,'validation scope must remain bounded to the current 500+ campaign envelope');

const expectedWrappers=new Map([
  ['esmini',{project:'esmini/esmini',path:'/opt/kingmast/bin/run-esmini-campaign'}],
  ['carla',{project:'carla-simulator/carla',path:'/opt/kingmast/bin/run-carla-campaign'}],
]);
const wrappers=Array.isArray(runner.wrappers)?runner.wrappers:[];
expect(wrappers.length===2,'runner contract must define exactly two reviewed wrappers');
for(const wrapper of wrappers){
  const expected=expectedWrappers.get(wrapper.engine);
  expect(Boolean(expected),`unsupported wrapper engine ${String(wrapper.engine)}`);
  if(!expected)continue;
  expect(wrapper.project===expected.project,`${wrapper.engine}: project identity mismatch`);
  expect(wrapper.path===expected.path,`${wrapper.engine}: wrapper path must remain fixed and reviewed`);
  expect(Array.isArray(wrapper.argv)&&wrapper.argv.join(',')==='--repository,--campaign,--scope,--output',`${wrapper.engine}: wrapper argv contract mismatch`);
  expect(wrapper.networkDownloadAllowed===false,`${wrapper.engine}: runtime network downloads must remain disabled by contract`);
}
for(const engine of execution.engines??[]){
  const wrapper=wrappers.find((item)=>item.engine===engine.id);
  expect(Boolean(wrapper),`${engine.id}: execution contract engine has no runner wrapper`);
  if(wrapper)expect(wrapper.project===engine.project,`${engine.id}: runner and execution contract project mismatch`);
}

const result=runner.resultContract??{};
expect(result.schema==='kingmast-external-simulator-result/v1','runner result schema must match external simulator result schema');
expect(Array.isArray(result.scenarioGranularities)&&result.scenarioGranularities.sort().join(',')==='base,campaign-case','runner result granularity must support base and campaign-case identities');
const top=new Set(result.requiredTopLevelFields??[]);
for(const field of ['schema','engine','engineVersion','sourceCommit','campaignScope','scenarioGranularity','scenarioArtifactSha256','resultArtifactSha256','fixtureOnly','externalExecution','controlAuthority','physicalHilExecuted','closedTrackExecuted','targetHardwareQualified','publicRoadApproved','results'])expect(top.has(field),`runner result contract missing top-level field ${field}`);
const scenarioFields=new Set(result.requiredScenarioFields??[]);
for(const field of execution.requiredResultFields??[])expect(scenarioFields.has(field),`runner scenario contract missing execution field ${field}`);
expect((result.allowedOutcomes??[]).sort().join(',')==='degrade,monitor,reject,warn','runner allowed outcomes mismatch independent safety oracle decisions');
expect(result.maxEngineVersionLength===96,'engine version bound must remain 96 characters');
expect(result.maxScenarioIdLength===160,'scenario id bound must remain 160 characters');
expect(result.maxResults===560,'external result count must remain bounded to 560');

expect(runner.evidenceBoundary?.externalExecutionMaySatisfyPhysicalHil===false,'external execution must not satisfy physical HIL');
expect(runner.evidenceBoundary?.externalExecutionMaySatisfyClosedTrack===false,'external execution must not satisfy closed-track evidence');
expect(runner.evidenceBoundary?.externalExecutionMayQualifyTargetHardware===false,'external execution must not qualify target hardware');
expect(runner.evidenceBoundary?.externalExecutionMayApprovePublicRoad===false,'external execution must not approve public-road use');
expect(runner.evidenceBoundary?.independentReviewRequiredForPromotion===true,'independent review must remain required for promotion');
for(const field of ['physicalHilExecuted','closedTrackExecuted','targetHardwareQualified','publicRoadApproved'])expect(runner[field]===false,`${field} must remain false in runner contract`);

if(failures.length){console.error('KINGMAST external simulator runner contract validation failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[external-runner-contract] wrappers=${wrappers.length}; scopes=${Object.keys(scopes).join(',')}; max-results=${result.maxResults}; external-only=true; physical-qualification=false`);
