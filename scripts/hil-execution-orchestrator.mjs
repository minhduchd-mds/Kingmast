import {existsSync, readFileSync} from 'node:fs';

const argv=process.argv.slice(2);
const jsonMode=argv.includes('--json');
const requireReady=argv.includes('--require-ready');

function valueAfter(flag,fallback){
  const index=argv.indexOf(flag);
  if(index<0)return fallback;
  const value=argv[index+1];
  if(!value||value.startsWith('--'))throw new Error(`Missing value after ${flag}`);
  return value;
}
function load(path,label){
  if(!existsSync(path))throw new Error(`${label} not found: ${path}`);
  return JSON.parse(readFileSync(path,'utf8'));
}
function unique(items){return [...new Set(items)];}
function isSha256(value){return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}
function isCommit(value){return typeof value==='string'&&/^[a-f0-9]{40}$/i.test(value);}
function hasDigestBindings(refs,digests){
  if(!Array.isArray(refs)||!Array.isArray(digests)||refs.length<1||refs.length!==digests.length)return false;
  if(unique(refs).length!==refs.length)return false;
  const normalized=digests.map((item)=>typeof item==='string'?item:item?.sha256);
  return normalized.every(isSha256)&&unique(normalized).length===normalized.length;
}

const paths={
  bench:valueAfter('--bench','docs/validation/hil/V006_HIL_BENCH_MATRIX.json'),
  equipment:valueAfter('--equipment','docs/validation/hil/V006_HIL_EQUIPMENT_CAPABILITY_MATRIX.json'),
  harness:valueAfter('--harness','docs/validation/hardware/V006_HARNESS_MAPPING_TEMPLATE.json'),
  provisioning:valueAfter('--provisioning','docs/validation/hardware/V006_DEVICE_PROVISIONING_TEMPLATE.json'),
  calibration:valueAfter('--calibration','docs/validation/sensors/V006_CALIBRATION_CAPTURE_TEMPLATE.json'),
  timeSync:valueAfter('--time-sync','docs/validation/hil/V006_HIL_TIME_SYNC_CONTRACT.json'),
  evidence:valueAfter('--evidence-requirements','docs/validation/hil/V006_HIL_SCENARIO_EVIDENCE_REQUIREMENTS.json'),
  manifest:valueAfter('--manifest','docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json'),
  registry:valueAfter('--registry','docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json')
};
const requestedScenario=valueAfter('--scenario',null);
const sourceCommit=valueAfter('--source-commit',process.env.GITHUB_SHA??null);

const bench=load(paths.bench,'HIL bench matrix');
const equipment=load(paths.equipment,'HIL equipment capability matrix');
const harness=load(paths.harness,'harness mapping');
const provisioning=load(paths.provisioning,'device provisioning');
const calibration=load(paths.calibration,'calibration capture');
const timeSync=load(paths.timeSync,'time synchronization');
const evidence=load(paths.evidence,'scenario evidence requirements');
const manifest=load(paths.manifest,'HIL execution manifest');
const registry=load(paths.registry,'HIL evidence registry');

const failures=[];
const expect=(label,condition)=>{if(!condition)failures.push(label);};

expect('bench schema',bench.schema==='kingmast-hil-bench-matrix/v1');
expect('equipment schema',equipment.schema==='kingmast-hil-equipment-capability-matrix/v1');
expect('harness schema',harness.schema==='kingmast-harness-mapping-template/v1');
expect('provisioning schema',provisioning.schema==='kingmast-device-provisioning-template/v1');
expect('calibration schema',calibration.schema==='kingmast-calibration-capture-template/v1');
expect('time-sync schema',timeSync.schema==='kingmast-hil-time-sync-contract/v1');
expect('evidence requirements schema',evidence.schema==='kingmast-hil-scenario-evidence-requirements/v1');
expect('manifest schema',manifest.schema==='kingmast-hil-execution-manifest/v1');
expect('registry schema',registry.schema==='kingmast-hil-evidence-registry/v1');

for(const [label,document] of Object.entries({bench,equipment,harness,provisioning,calibration,timeSync,evidence,manifest})){
  expect(`${label} control authority none`,document.controlAuthority==='none');
  expect(`${label} does not claim automatic qualification`,document.automaticQualification!==true);
  expect(`${label} does not claim target qualification`,document.targetHardwareQualified!==true);
  expect(`${label} does not claim public-road approval`,document.publicRoadApproved!==true);
}
expect('bench no physical HIL claim',bench.physicalHilExecuted===false);
expect('equipment no physical HIL claim',equipment.physicalHilExecuted===false);
expect('time-sync no physical HIL claim',timeSync.physicalHilExecuted===false);
expect('evidence no physical HIL claim',evidence.physicalHilExecuted===false);
expect('provisioning baseline remains physical false',provisioning.physicalProvisioningExecuted===false);
expect('calibration baseline remains physical false',calibration.physicalCalibrationExecuted===false);
expect('harness CAN TX path absent',harness.canTxPathPresent===false);
expect('harness writable bus absent',harness.writableBusApi===false);
expect('harness actuation absent',harness.actuationAuthority===false);

const benchScenarios=Array.isArray(bench.scenarios)?bench.scenarios:[];
const manifestScenarios=Array.isArray(manifest.scenarios)?manifest.scenarios:[];
const evidenceScenarios=Array.isArray(evidence.scenarioRequirements)?evidence.scenarioRequirements:[];
const registryScenarios=Array.isArray(registry.scenarios)?registry.scenarios:[];
const equipmentRoles=Array.isArray(equipment.roles)?equipment.roles:[];
const devices=Array.isArray(provisioning.devices)?provisioning.devices:[];
const sensors=Array.isArray(calibration.sensors)?calibration.sensors:[];

expect('12 HIL bench scenarios',benchScenarios.length===12);
expect('12 HIL manifest scenarios',manifestScenarios.length===12);
expect('12 HIL evidence requirement scenarios',evidenceScenarios.length===12);
expect('12 HIL registry scenarios',registryScenarios.length===12);
expect('10 equipment roles',equipmentRoles.length===10);
expect('7 provisioning targets',devices.length===7);
expect('4 calibration sensor groups',sensors.length===4);

for(const [label,items,key] of [
  ['bench scenarios',benchScenarios,'id'],
  ['manifest scenarios',manifestScenarios,'id'],
  ['evidence scenarios',evidenceScenarios,'id'],
  ['registry scenarios',registryScenarios,'id'],
  ['equipment roles',equipmentRoles,'role'],
  ['provisioning targets',devices,'id']
]){
  expect(`${label} unique`,unique(items.map((item)=>item?.[key])).length===items.length);
}

const canonicalIds=benchScenarios.map((item)=>item.id).sort();
for(const [label,items] of [['manifest',manifestScenarios],['evidence',evidenceScenarios],['registry',registryScenarios]]){
  expect(`${label} scenario ids align`,JSON.stringify(items.map((item)=>item.id).sort())===JSON.stringify(canonicalIds));
}
if(requestedScenario)expect('requested scenario exists',canonicalIds.includes(requestedScenario));

expect('time sync requires independent review',timeSync.requirements?.independentReviewRequired===true);
expect('time sync requires measured offset',timeSync.requirements?.offsetMeasurementRequired===true);
expect('time sync requires measured uncertainty',timeSync.requirements?.uncertaintyMeasurementRequired===true);
expect('time sync requires drift measurement',timeSync.requirements?.driftMeasurementRequired===true);
expect('time sync baseline does not guess max offset',timeSync.numericAcceptanceThresholds?.maxOffsetMs===null);
expect('time sync baseline does not guess max uncertainty',timeSync.numericAcceptanceThresholds?.maxUncertaintyMs===null);
expect('time sync baseline does not guess max drift',timeSync.numericAcceptanceThresholds?.maxDriftPpm===null);
expect('evidence automation cannot mutate registry',evidence.completionPolicy?.registryMutationByAutomation===false);
expect('evidence independent review required',evidence.completionPolicy?.independentReviewRequired===true);

const equipmentByRole=new Map(equipmentRoles.map((item)=>[item.role,item]));
const provisionedById=new Map((provisioning.records??[]).filter((record)=>
  record?.status==='reviewed-provisioned-for-bounded-hil'&&
  isSha256(record?.hardwareInstanceSha256)&&
  isCommit(record?.sourceSoftwareCommit)&&
  Array.isArray(record?.evidenceRefs)&&record.evidenceRefs.length>0&&
  record?.independentReview
).map((record)=>[record.deviceId,record]));

const calibrationById=new Map((calibration.captures??[]).filter((capture)=>
  capture?.resultDisposition==='approved-for-bounded-hil'&&
  isSha256(capture?.hardwareInstanceSha256)&&
  isSha256(capture?.calibrationArtifactSha256)&&
  isCommit(capture?.sourceSoftwareCommit)&&
  capture?.operator&&capture?.reviewer&&capture.operator!==capture.reviewer&&
  Array.isArray(capture?.measurementRefs)&&capture.measurementRefs.length>0
).map((capture)=>[capture.sensorId,capture]));

function reviewedEquipment(role){
  const item=equipmentByRole.get(role);
  const assignment=item?.assignment;
  return Boolean(
    item?.reviewed===true&&
    assignment?.status==='reviewed-ready-for-bounded-hil'&&
    isSha256(assignment?.equipmentIdentitySha256)&&
    hasDigestBindings(assignment?.capabilityEvidenceRefs,assignment?.capabilityEvidenceDigests)&&
    assignment?.reviewer
  );
}
const harnessReady=Boolean(
  harness.vehicleSpecificPinoutValidated===true&&
  Array.isArray(harness.interfaces)&&harness.interfaces.length===7&&
  harness.interfaces.every((item)=>item?.reviewed===true)&&
  harness.mappingEvidence?.disposition==='reviewed-approved-for-bounded-hil'&&
  isSha256(harness.mappingEvidence?.mappingArtifactSha256)&&
  harness.mappingEvidence?.reviewer
);
const thresholds=timeSync.numericAcceptanceThresholds??{};
const thresholdsReviewed=
  Number.isFinite(thresholds.maxOffsetMs)&&thresholds.maxOffsetMs>=0&&
  Number.isFinite(thresholds.maxUncertaintyMs)&&thresholds.maxUncertaintyMs>=0&&
  Number.isFinite(thresholds.maxDriftPpm)&&thresholds.maxDriftPpm>=0;
const reviewedTimeSessions=(timeSync.sessions??[]).filter((session)=>
  session?.status==='reviewed-ready-for-bounded-hil'&&
  isCommit(session?.sourceSoftwareCommit)&&
  isSha256(session?.timeSourceIdentitySha256)&&
  Number.isFinite(session?.measuredOffsetMs)&&
  Number.isFinite(session?.measuredUncertaintyMs)&&
  Number.isFinite(session?.measuredDriftPpm)&&
  session?.discontinuityObserved===false&&
  session?.operator&&session?.reviewer&&session.operator!==session.reviewer&&
  hasDigestBindings(session?.measurementRefs,session?.measurementDigests)
);
const selectedTimeSession=reviewedTimeSessions.find((session)=>!sourceCommit||session.sourceSoftwareCommit===sourceCommit)??null;
const timeSyncReady=thresholdsReviewed&&Boolean(selectedTimeSession);
const registryById=new Map(registryScenarios.map((item)=>[item.id,item]));
const evidenceReqById=new Map(evidenceScenarios.map((item)=>[item.id,item]));
const manifestById=new Map(manifestScenarios.map((item)=>[item.id,item]));

const scenarioReports=benchScenarios
  .filter((scenario)=>!requestedScenario||scenario.id===requestedScenario)
  .map((scenario)=>{
    const preExecutionBlockers=[];
    if(!isCommit(sourceCommit))preExecutionBlockers.push('source-commit:not-frozen');
    if(!harnessReady)preExecutionBlockers.push('harness:not-independently-reviewed');
    for(const role of scenario.requiredRoles??[]){
      if(!reviewedEquipment(role))preExecutionBlockers.push(`equipment:${role}`);
    }
    for(const target of scenario.requiredProvisionTargets??[]){
      const record=provisionedById.get(target);
      if(!record)preExecutionBlockers.push(`provisioning:${target}`);
      else if(sourceCommit&&record.sourceSoftwareCommit!==sourceCommit)preExecutionBlockers.push(`provisioning-source-mismatch:${target}`);
    }
    for(const sensor of scenario.requiredCalibration??[]){
      const capture=calibrationById.get(sensor);
      if(!capture)preExecutionBlockers.push(`calibration:${sensor}`);
      else if(sourceCommit&&capture.sourceSoftwareCommit!==sourceCommit)preExecutionBlockers.push(`calibration-source-mismatch:${sensor}`);
    }
    if(!timeSyncReady)preExecutionBlockers.push('time-sync:no-reviewed-session-or-limits');
    const registryEntry=registryById.get(scenario.id);
    const evidenceRequirement=evidenceReqById.get(scenario.id);
    const manifestEntry=manifestById.get(scenario.id);
    const evidenceComplete=Boolean(
      registryEntry?.evidence&&
      ['reviewed-pass','reviewed-fail'].includes(registryEntry?.status)&&
      Array.isArray(evidenceRequirement?.requiredEvidenceKinds)&&evidenceRequirement.requiredEvidenceKinds.length>0&&
      Array.isArray(manifestEntry?.requiredResultKeys)&&manifestEntry.requiredResultKeys.length>0
    );
    return {
      id:scenario.id,
      preExecutionStatus:preExecutionBlockers.length===0?'ready-for-reviewed-physical-execution':'blocked-physical-prerequisites',
      preExecutionBlockers:unique(preExecutionBlockers),
      evidenceStatus:evidenceComplete?'reviewed-evidence-complete':'pending-reviewed-physical-evidence',
      requiredRoles:scenario.requiredRoles??[],
      requiredProvisionTargets:scenario.requiredProvisionTargets??[],
      requiredCalibration:scenario.requiredCalibration??[],
      requiredEvidenceKinds:[...(evidence.universalEvidenceKinds??[]),...(evidenceRequirement?.requiredEvidenceKinds??[])],
      expectedBoundary:scenario.expectedBoundary
    };
  });

const readyScenarioCount=scenarioReports.filter((item)=>item.preExecutionBlockers.length===0).length;
const evidenceCompleteScenarioCount=scenarioReports.filter((item)=>item.evidenceStatus==='reviewed-evidence-complete').length;
const assignedEquipmentRoleCount=equipmentRoles.filter((item)=>reviewedEquipment(item.role)).length;
const report={
  schema:'kingmast-hil-execution-orchestration-readiness/v1',
  version:bench.version,
  controlAuthority:'none',
  sourceCommit:isCommit(sourceCommit)?sourceCommit:null,
  softwareContractValid:failures.length===0,
  softwarePreparationScorePercent:failures.length===0?100:0,
  physicalExecutionReady:scenarioReports.length>0&&readyScenarioCount===scenarioReports.length,
  readyScenarioCount,
  blockedScenarioCount:scenarioReports.length-readyScenarioCount,
  evidenceCompleteScenarioCount,
  physicalHilExecuted:false,
  automaticQualification:false,
  registryMutationByAutomation:false,
  targetHardwareQualified:false,
  publicRoadApproved:false,
  prerequisiteCoverage:{
    harnessReviewed:harnessReady,
    equipmentRolesAssigned:assignedEquipmentRoleCount,
    equipmentRolesTotal:equipmentRoles.length,
    provisionedTargets:provisionedById.size,
    provisionTargetsTotal:devices.length,
    approvedCalibrationGroups:calibrationById.size,
    calibrationGroupsTotal:sensors.length,
    timeSyncReady
  },
  scenarios:scenarioReports,
  failures
};

if(jsonMode)process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
else{
  console.log(`KINGMAST HIL orchestration: software contracts ${report.softwareContractValid?'valid':'invalid'}; ${readyScenarioCount}/${scenarioReports.length} scenarios ready for reviewed physical execution; ${evidenceCompleteScenarioCount}/${scenarioReports.length} reviewed evidence complete.`);
  if(failures.length)for(const failure of failures)console.error(`- ${failure}`);
  for(const item of scenarioReports)console.log(`${item.id}: ${item.preExecutionStatus}; ${item.preExecutionBlockers.length} blocker(s); ${item.evidenceStatus}`);
}
if(failures.length)process.exit(1);
if(requireReady&&(!report.physicalExecutionReady||scenarioReports.length===0))process.exit(2);
