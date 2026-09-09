import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const paths={
  harness:'docs/validation/hardware/V006_HARNESS_MAPPING_TEMPLATE.json',
  provisioning:'docs/validation/hardware/V006_DEVICE_PROVISIONING_TEMPLATE.json',
  calibration:'docs/validation/sensors/V006_CALIBRATION_CAPTURE_TEMPLATE.json',
  hilBench:'docs/validation/hil/V006_HIL_BENCH_MATRIX.json',
  benchPack:'docs/validation/hardware/V006_PHYSICAL_BENCH_EXECUTION_PACK.json',
  sensorLifecycle:'docs/validation/sensors/V006_SENSOR_CALIBRATION_LIFECYCLE.json',
  hilManifest:'docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json'
};
const failures=[];
function fail(message){failures.push(message);}
function readJson(path){return JSON.parse(readFileSync(resolve(root,path),'utf8'));}
function unique(values){return new Set(values).size===values.length;}

for(const [name,path] of Object.entries(paths))if(!existsSync(resolve(root,path)))fail(`missing ${name}: ${path}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1);}

const harness=readJson(paths.harness);
const provisioning=readJson(paths.provisioning);
const calibration=readJson(paths.calibration);
const hilBench=readJson(paths.hilBench);
const benchPack=readJson(paths.benchPack);
const lifecycle=readJson(paths.sensorLifecycle);
const hilManifest=readJson(paths.hilManifest);

if(harness.schema!=='kingmast-harness-mapping-template/v1'||harness.version!=='0.0.6'||harness.controlAuthority!=='none')fail('invalid harness mapping template identity');
if(harness.status!=='template-only-vehicle-pinout-unset'||harness.vehicleSpecificPinoutValidated!==false||harness.automaticApproval!==false||harness.canTxPathPresent!==false||harness.writableBusApi!==false||harness.actuationAuthority!==false)fail('harness template must remain fail-closed');
for(const key of ['authorizedElectricalDocumentationRequired','reviewedAdapterDocumentationAllowed','guessingProhibited','wireColorInferenceProhibited','unreviewedCommunityPinoutProhibited'])if(harness.sourcePolicy?.[key]!==true)fail(`harness sourcePolicy.${key} must be true`);
const harnessInterfaces=Array.isArray(harness.interfaces)?harness.interfaces:[];
if(harnessInterfaces.length!==7||!unique(harnessInterfaces.map((item)=>item.id)))fail('harness template must contain seven unique interfaces');
for(const item of harnessInterfaces){
  if(item.vehicleConnectorRef!==null||item.vehiclePin!==null||item.wireColor!==null||item.electricalSpecRef!==null||item.reviewed!==false)fail(`${item.id}: committed vehicle mapping must remain unset`);
  if(item.id==='CAN-RX'&&(item.direction!=='rx-only'||item.txPathPresent!==false))fail('CAN-RX must remain receive-only with no TX path');
}
if(harness.mappingEvidence?.disposition!=='pending'||Object.entries(harness.mappingEvidence??{}).some(([key,value])=>key!=='disposition'&&value!==null))fail('harness mapping evidence must remain pending and unset');

if(provisioning.schema!=='kingmast-device-provisioning-template/v1'||provisioning.version!=='0.0.6'||provisioning.controlAuthority!=='none')fail('invalid device provisioning template identity');
if(provisioning.status!=='template-only-unprovisioned'||provisioning.physicalProvisioningExecuted!==false||provisioning.automaticApproval!==false||provisioning.targetHardwareQualified!==false||provisioning.publicRoadApproved!==false)fail('device provisioning template must remain fail-closed');
if(!provisioning.privacy||Object.values(provisioning.privacy).some((value)=>value!==true))fail('all provisioning privacy prohibitions must remain enabled');
const provisionDevices=Array.isArray(provisioning.devices)?provisioning.devices:[];
if(provisionDevices.length!==7||!unique(provisionDevices.map((item)=>item.id)))fail('device provisioning template must contain seven unique targets');
if(!Array.isArray(provisioning.records)||provisioning.records.length!==0)fail('committed provisioning records must remain empty');
if(provisioning.captureTemplate?.status!=='unprovisioned'||provisioning.captureTemplate?.deviceId!==null||provisioning.captureTemplate?.hardwareInstanceSha256!==null||provisioning.captureTemplate?.sourceSoftwareCommit!==null||!Array.isArray(provisioning.captureTemplate?.evidenceRefs)||provisioning.captureTemplate.evidenceRefs.length!==0||provisioning.captureTemplate?.independentReview!==null)fail('provisioning capture template must remain empty/unprovisioned');
for(const key of ['sourceCommitBindingRequired','sha256HardwareIdentityRequired','sha256EvidenceBindingRequired','independentReviewRequired','reviewerMustDifferFromOperator'])if(provisioning.promotionRule?.[key]!==true)fail(`provisioning promotionRule.${key} must be true`);
for(const key of ['registryMutationByAutomation','automaticQualification'])if(provisioning.promotionRule?.[key]!==false)fail(`provisioning promotionRule.${key} must be false`);

if(calibration.schema!=='kingmast-calibration-capture-template/v1'||calibration.version!=='0.0.6'||calibration.controlAuthority!=='none')fail('invalid calibration capture template identity');
if(calibration.status!=='template-only-no-physical-calibration'||calibration.physicalCalibrationExecuted!==false||calibration.automaticPromotion!==false||calibration.productionThresholdMutation!==false||calibration.targetHardwareQualified!==false||calibration.publicRoadApproved!==false)fail('calibration capture template must remain fail-closed');
const calibrationSensors=Array.isArray(calibration.sensors)?calibration.sensors:[];
if(calibrationSensors.length!==4||!unique(calibrationSensors))fail('calibration template must contain four unique sensor groups');
if(!Array.isArray(calibration.captures)||calibration.captures.length!==0)fail('committed physical calibration captures must remain empty');
if(calibration.captureTemplate?.resultDisposition!=='pending-physical-capture'||calibration.captureTemplate?.sensorId!==null||calibration.captureTemplate?.hardwareInstanceSha256!==null||calibration.captureTemplate?.calibrationArtifactSha256!==null||!Array.isArray(calibration.captureTemplate?.measurementRefs)||calibration.captureTemplate.measurementRefs.length!==0)fail('calibration capture template must remain empty/pending');
for(const key of ['independentReviewRequired','reviewerMustDifferFromOperator','sourceCommitBindingRequired','firmwareRevisionMatchRequired','configurationRevisionMatchRequired','sha256EvidenceBindingRequired'])if(calibration.reviewPolicy?.[key]!==true)fail(`calibration reviewPolicy.${key} must be true`);
for(const key of ['automaticPromotion','productionThresholdMutation'])if(calibration.reviewPolicy?.[key]!==false)fail(`calibration reviewPolicy.${key} must be false`);
const lifecycleIds=new Set((lifecycle.sensors??[]).map((item)=>item.id));
for(const id of calibrationSensors)if(!lifecycleIds.has(id))fail(`calibration sensor ${id} missing from lifecycle`);

if(hilBench.schema!=='kingmast-hil-bench-matrix/v1'||hilBench.version!=='0.0.6'||hilBench.controlAuthority!=='none')fail('invalid HIL bench matrix identity');
if(hilBench.status!=='preparation-only-no-physical-hil'||hilBench.physicalHilExecuted!==false||hilBench.automaticQualification!==false||hilBench.targetHardwareQualified!==false||hilBench.publicRoadApproved!==false)fail('HIL bench matrix must remain preparation-only');
const benchScenarios=Array.isArray(hilBench.scenarios)?hilBench.scenarios:[];
if(benchScenarios.length!==12||!unique(benchScenarios.map((item)=>item.id)))fail('HIL bench matrix must contain exactly 12 unique scenarios');
const manifestIds=new Set((hilManifest.scenarios??[]).map((item)=>item.id));
const roleIds=new Set((benchPack.roles??[]).map((item)=>item[0]));
const provisionIds=new Set(provisionDevices.map((item)=>item.id));
const calIds=new Set(calibrationSensors);
for(const scenario of benchScenarios){
  if(!/^HIL-\d{3}$/.test(scenario.id)||!manifestIds.has(scenario.id))fail(`${scenario.id}: scenario missing from HIL execution manifest`);
  if(!Array.isArray(scenario.requiredRoles)||scenario.requiredRoles.length===0||scenario.requiredRoles.some((id)=>!roleIds.has(id)))fail(`${scenario.id}: invalid requiredRoles`);
  if(!Array.isArray(scenario.requiredProvisionTargets)||scenario.requiredProvisionTargets.length===0||scenario.requiredProvisionTargets.some((id)=>!provisionIds.has(id)))fail(`${scenario.id}: invalid requiredProvisionTargets`);
  if(!Array.isArray(scenario.requiredCalibration)||scenario.requiredCalibration.some((id)=>!calIds.has(id)))fail(`${scenario.id}: invalid requiredCalibration`);
  if(typeof scenario.stimulus!=='string'||!scenario.stimulus.trim()||typeof scenario.expectedBoundary!=='string'||!scenario.expectedBoundary.trim())fail(`${scenario.id}: stimulus/expectedBoundary required`);
}
if(hilBench.resultPolicy?.initialResult!=='captured-awaiting-independent-review'||hilBench.resultPolicy?.independentReviewRequired!==true||hilBench.resultPolicy?.automaticRegistryMutation!==false||hilBench.resultPolicy?.ciOrSimulationCannotSatisfyPhysicalEvidence!==true)fail('HIL result policy is not fail-closed');

const report={
  schema:'kingmast-physical-provisioning-readiness-report/v1',
  version:'0.0.6',
  controlAuthority:'none',
  status:failures.length?'invalid':'software-preparation-complete-physical-work-pending',
  softwarePreparationScorePercent:failures.length?0:100,
  vehicleHarnessMappingCompletionPercent:0,
  physicalProvisioningCompletionPercent:0,
  physicalCalibrationCompletionPercent:0,
  physicalHilExecutionCompletionPercent:0,
  harnessInterfaces:harnessInterfaces.length,
  provisionTargets:provisionDevices.length,
  calibrationGroups:calibrationSensors.length,
  hilScenarios:benchScenarios.length,
  canTxPathPresent:false,
  physicalProvisioningExecuted:false,
  physicalCalibrationExecuted:false,
  physicalHilExecuted:false,
  automaticQualification:false,
  targetHardwareQualified:false,
  publicRoadApproved:false,
  sourceFiles:paths,
  failures
};

if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
else if(failures.length)console.error('KINGMAST physical provisioning/calibration preparation failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));
else console.log(`KINGMAST physical provisioning/calibration preparation valid: ${report.harnessInterfaces} interfaces, ${report.provisionTargets} targets, ${report.calibrationGroups} calibration groups, ${report.hilScenarios} HIL scenarios; physical execution remains 0%.`);
if(failures.length)process.exit(1);
