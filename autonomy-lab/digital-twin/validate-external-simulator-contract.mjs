import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const contract=JSON.parse(readFileSync(resolve(root,'autonomy-lab/digital-twin/external-simulator-contract.json'),'utf8'));
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};

expect(contract.schema==='kingmast-external-simulator-execution-contract/v1','unexpected simulator contract schema');
expect(contract.version==='0.0.6','simulator contract version must remain 0.0.6');
expect(contract.controlAuthority==='none','simulator contract controlAuthority must remain none');
expect(contract.qualificationClaim==='external-simulator-contract-only-not-physical-validation','simulator contract qualification claim must remain research-only');
expect(contract.runnerContract==='autonomy-lab/digital-twin/runner-contract.json','external execution must bind to the reviewed runner contract');
expect(contract.evidenceManifestSchema==='kingmast-external-simulator-evidence-manifest/v1','external execution must use the bounded evidence manifest schema');
expect(contract.standardTargets?.openDrive==='1.9.0','OpenDRIVE target must remain 1.9.0');
expect(contract.standardTargets?.openScenarioXml==='1.4.0','OpenSCENARIO XML target must remain 1.4.0');
const engines=new Map((contract.engines??[]).map((item)=>[item.id,item]));
for(const id of ['esmini','carla'])expect(engines.has(id),`missing simulator engine ${id}`);
for(const engine of engines.values()){
  expect(engine.executionMode==='external-runner',`${engine.id}: external-runner mode is required`);
  expect(engine.versionCapturedAtRun===true,`${engine.id}: engine version must be captured at run time`);
  expect(engine.bundledInCi===false,`${engine.id}: external simulator must not be silently bundled into deterministic CI`);
}
const envelopeFields=new Set(contract.requiredResultEnvelopeFields??[]);
for(const field of ['engine','engineVersion','sourceCommit','campaignScope','scenarioGranularity','scenarioArtifactSha256','resultArtifactSha256','fixtureOnly','externalExecution','controlAuthority','results'])expect(envelopeFields.has(field),`missing required result envelope field ${field}`);
expect(contract.parityPolicy?.outcomeMustMatch===true,'outcome parity must remain exact');
expect(contract.parityPolicy?.collisionMustMatch===true,'collision parity must remain exact');
expect(contract.parityPolicy?.minimumCommonScenarios>=8,'at least eight common scenarios are required');
expect(contract.evidencePolicy?.externalExecutionRequiredForRealEvidence===true,'real simulator evidence must require external execution');
expect(contract.evidencePolicy?.engineVersionRequired===true,'real simulator evidence must capture engine version');
expect(contract.evidencePolicy?.sourceCommitRequired===true,'real simulator evidence must bind to a full source commit');
expect(contract.evidencePolicy?.campaignScopeRequired===true,'real simulator evidence must bind to the dispatched campaign scope');
expect(contract.evidencePolicy?.scenarioArtifactSha256Required===true,'real simulator evidence must bind to the reviewed campaign artifact');
expect(contract.evidencePolicy?.resultArtifactSha256Required===true,'real simulator evidence must identify the runner-native result artifact');
expect(contract.evidencePolicy?.evidenceManifestRequired===true,'external simulator evidence must emit a bounded manifest');
expect(contract.evidencePolicy?.independentReviewRequired===true,'external simulator evidence must await independent review');
expect(contract.evidencePolicy?.fixtureResultsMayClaimExternalExecution===false,'fixtures must never claim external execution');
expect(contract.evidencePolicy?.automaticHilPass===false,'external simulation must not automatically pass HIL');
expect(contract.evidencePolicy?.automaticClosedTrackPass===false,'external simulation must not automatically pass controlled-track evidence');
expect(contract.evidencePolicy?.automaticProductionQualification===false,'external simulation must not automatically qualify production');
for(const field of ['physicalHilExecuted','closedTrackExecuted','targetHardwareQualified','publicRoadApproved'])expect(contract[field]===false,`${field} must remain false`);

if(failures.length){console.error('KINGMAST digital-twin contract validation failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log(`[digital-twin-contract] engines=${[...engines.keys()].sort().join(',')}; ASAM=${contract.standardTargets.openDrive}/${contract.standardTargets.openScenarioXml}; runner-contract-bound=true; evidence-manifest-required=true; independent-review-required=true; physical-qualification=false`);
