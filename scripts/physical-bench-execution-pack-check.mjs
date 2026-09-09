import {existsSync,readFileSync} from 'node:fs';

const p='docs/validation/hardware/V006_PHYSICAL_BENCH_EXECUTION_PACK.json';
const pack=JSON.parse(readFileSync(p,'utf8'));
const lifecycle=JSON.parse(readFileSync('docs/validation/sensors/V006_SENSOR_CALIBRATION_LIFECYCLE.json','utf8'));
const manifest=JSON.parse(readFileSync('docs/validation/hil/V006_HIL_EXECUTION_MANIFEST.json','utf8'));
const registry=JSON.parse(readFileSync('docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json','utf8'));
const soak=JSON.parse(readFileSync('docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json','utf8'));
const failures=[];
const fail=(m)=>failures.push(m);

if(pack.schema!=='kingmast-physical-bench-execution-pack/v2')fail('unexpected schema');
if(pack.version!=='0.0.6'||pack.controlAuthority!=='none'||pack.status!=='preparation-only-no-physical-execution')fail('version/control/status mismatch');
for(const k of ['physicalBenchExecuted','automaticQualification','targetHardwareQualified','closedTrackApproved','publicRoadApproved'])if(pack[k]!==false)fail(`${k} must remain false`);

if(!Array.isArray(pack.roles)||pack.roles.length!==10)fail('exactly 10 bench roles required');
else{
  const ids=new Set(pack.roles.map((r)=>r?.[0]));
  for(const id of ['bench-controller','read-only-can','time-sync','bus-analyzer','bench-power'])if(!ids.has(id))fail(`missing role ${id}`);
}

const c=pack.controls??{};
for(const k of ['guessVehiclePinout','modifyVehicleConnectorWithoutReview','canTx','writableBusApi','actuationAuthority','rawSerialsInRepo','secretsInRepo','rawCabinVideoInRepo','rawCameraFramesInRepo'])if(c[k]!==false)fail(`controls.${k} must remain false`);
for(const k of ['emergencyPowerIsolationRequired','independentHarnessReviewRequired'])if(c[k]!==true)fail(`controls.${k} must remain true`);

const h=pack.harness??{};
if(h.vehicleSpecificPinoutValidated!==false||h.canTxPathPresent!==false)fail('harness must remain generic receive-only');
if(!Array.isArray(h.interfaces)||h.interfaces.length!==7)fail('exactly 7 logical interfaces required');
else{
  for(const i of h.interfaces){
    if(i.vehiclePin!==null)fail(`${i.id}: vehiclePin must remain null`);
    if(['tx','tx-only','bidirectional'].includes(i.direction))fail(`${i.id}: transmit-capable direction prohibited`);
    if(!Array.isArray(i.requirements)||i.requirements.length<2)fail(`${i.id}: requirements incomplete`);
  }
  const can=h.interfaces.find((i)=>i.id==='CAN-RX');
  if(!can||can.direction!=='rx-only'||!/tx/i.test(can.requirements.join(' ')))fail('CAN-RX must explicitly disable TX');
}

const prov=pack.provisioning??{};
const deviceIds=['vehicle-computer-aarch64','display-primary','front-radar','surround-camera-set','dms-camera','gnss-imu','read-only-can-interface'];
if(prov.state!=='unprovisioned'||prov.automaticApproval!==false||prov.rawSerialStorageProhibited!==true)fail('provisioning baseline must remain unprovisioned/manual');
if(JSON.stringify(prov.devices)!==JSON.stringify(deviceIds))fail('provisioning device set mismatch');
for(const k of ['sourceCommitBindingRequired','sha256EvidenceBindingRequired','independentReviewRequired'])if(prov[k]!==true)fail(`provisioning.${k} must be true`);

const cal=pack.calibration??{};
const sensorIds=['front-radar','surround-camera-set','dms-camera','gnss-imu'];
if(cal.status!=='template-only-no-physical-calibration'||cal.automaticPromotion!==false||cal.productionThresholdMutation!==false)fail('calibration must remain template-only/manual');
if(JSON.stringify(cal.sensors)!==JSON.stringify(sensorIds))fail('calibration sensor set mismatch');
for(const id of sensorIds)if(!(lifecycle.sensors??[]).some((s)=>s.id===id))fail(`lifecycle missing ${id}`);
if(cal.reviewerMustDifferFromOperator!==true||cal.sha256BindingRequired!==true||cal.initialDisposition!=='captured-awaiting-independent-review')fail('calibration review rule mismatch');

const hil=pack.hil??{};
const hilIds=Array.from({length:12},(_,i)=>`HIL-${String(i+1).padStart(3,'0')}`);
if(hil.status!=='preparation-only-no-hil-execution'||hil.physicalHilExecuted!==false)fail('HIL must remain preparation-only');
if(!Array.isArray(hil.entry)||hil.entry.length<6||!Array.isArray(hil.abort)||hil.abort.length<5||!Array.isArray(hil.commonEvidence)||hil.commonEvidence.length<5)fail('HIL global controls incomplete');
if(!Array.isArray(hil.scenarios)||hil.scenarios.length!==12)fail('exactly 12 HIL scenarios required');
else{
  const ids=hil.scenarios.map((s)=>s?.[0]);
  if(new Set(ids).size!==12)fail('duplicate HIL scenario');
  for(const id of hilIds){
    if(!ids.includes(id))fail(`pack missing ${id}`);
    if(!(manifest.scenarios??[]).some((s)=>s.id===id))fail(`manifest missing ${id}`);
    const r=(registry.scenarios??[]).find((s)=>s.id===id);
    if(!r||r.status!=='pending'||r.evidence!==null)fail(`${id}: registry must remain pending/evidence=null`);
  }
}
if(hil.initialResult!=='captured-awaiting-independent-review'||hil.automaticRegistryMutation!==false||hil.independentReviewRequired!==true||hil.ciOrSimulationCannotSatisfyPhysicalEvidence!==true)fail('HIL promotion rule mismatch');

for(const f of pack.externalContracts??[])if(typeof f!=='string'||!existsSync(f))fail(`missing external contract ${String(f)}`);

const report={
  schema:'kingmast-physical-bench-readiness-report/v2',version:'0.0.6',controlAuthority:'none',
  qualificationClaim:'software-preparation-only-not-physical-qualification',
  softwarePreparationScorePercent:failures.length?0:100,
  physicalExecutionCompletionScorePercent:0,
  roles:pack.roles?.length??0,logicalInterfaces:h.interfaces?.length??0,provisionTargets:prov.devices?.length??0,
  calibrationGroups:cal.sensors?.length??0,hilScenarios:hil.scenarios?.length??0,canTxPathPresent:h.canTxPathPresent,
  targetSoakPhysicalExecuted:soak.physicalVehicleComputerTest===true,
  physicalBenchExecuted:false,physicalHilExecuted:false,targetHardwareQualified:false,closedTrackApproved:false,publicRoadApproved:false,
  failures
};

if(process.argv.includes('--json')){
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(failures.length)process.exit(1);
}else if(failures.length){
  console.error('KINGMAST physical bench pack failed:\n'+failures.map((x)=>`- ${x}`).join('\n'));
  process.exit(1);
}else{
  console.log(`KINGMAST physical bench pack valid: ${report.roles} roles, ${report.logicalInterfaces} interfaces, ${report.provisionTargets} devices, ${report.calibrationGroups} calibration groups, ${report.hilScenarios} HIL scenarios; physical execution 0%.`);
}
