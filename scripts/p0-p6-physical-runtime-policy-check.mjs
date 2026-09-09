import {existsSync,readFileSync} from 'node:fs';

const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
const read=(path)=>{expect(existsSync(path),`missing ${path}`);return existsSync(path)?readFileSync(path,'utf8'):'';};
const json=(path)=>JSON.parse(read(path));

const runtimePath='services/risk-engine/src/physical-validation-runtime.ts';
const testPath='services/risk-engine/src/physical-validation-runtime.test.ts';
const p5Path='autonomy-lab/digital-twin/p5-external-simulator-session.mjs';
const runtime=read(runtimePath);
const tests=read(testPath);
const p5=read(p5Path);

expect(runtime.includes("PHYSICAL_RUNTIME_CONTROL_AUTHORITY='none'"),'runtime must preserve controlAuthority=none');
expect(runtime.includes('repositoryStoresRawEvidence=false'),'runtime must never store raw physical evidence in repository state');
expect(runtime.includes('automaticQualification=false'),'runtime must prohibit automatic qualification');
expect(runtime.includes("port.authority!=='read-only'"),'vehicle runtime must enforce the shared read-only port');
expect(runtime.includes("status:'unreviewed-limits'"),'time-sync must fail closed when reviewed numeric limits are absent');
expect(runtime.includes('independent reviewer must differ from calibration operator'),'calibration must enforce independent review separation');
expect(runtime.includes("private state:CaptureLifecycleState='BLOCKED'"),'physical capture lifecycles must start BLOCKED');
expect(runtime.includes("reviewStatus!=='pending-independent-review'"),'new physical captures must await independent review');
expect(runtime.includes('physicalQualificationComplete:false'),'software portfolio must not claim physical qualification');
expect(!runtime.includes('autonomy-lab'),'production physical runtime must not import simulation-only autonomy-lab');
expect(tests.includes("expect(portfolio.physicalQualificationComplete).toBe(false)"),'unit tests must assert qualification remains false');

expect(p5.includes("schema:'kingmast-p5-external-simulator-session-assessment/v1'"),'P5 external simulator assessment missing');
expect(p5.includes('networkDownloadAllowed:false'),'P5 runner must preserve no-runtime-download policy');
expect(p5.includes('physicalEvidence:false'),'P5 simulator session must not become physical evidence');
expect(p5.includes('physicalHilExecuted:false'),'P5 simulator session must not claim physical HIL');
expect(p5.includes('closedTrackExecuted:false'),'P5 simulator session must not claim controlled-track execution');
expect(p5.includes('targetHardwareQualified:false'),'P5 simulator session must not qualify target hardware');
expect(p5.includes('publicRoadApproved:false'),'P5 simulator session must not approve public-road use');

const store=json('docs/validation/evidence/V006_PHYSICAL_EVIDENCE_STORE_INDEX.json');
expect(store.backendConfigured===false,'source-controlled physical evidence backend baseline must remain unconfigured');
expect(Array.isArray(store.records)&&store.records.length===0,'source-controlled physical evidence index must remain empty until real backend provisioning');

const hil=json('docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json');
expect(Array.isArray(hil.scenarios)&&hil.scenarios.length===12,'HIL baseline must retain 12 scenarios');
expect(hil.scenarios.every((item)=>item.status==='pending'&&item.evidence===null),'HIL registry must not be promoted by software implementation');

const track=json('docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json');
expect(track.closedTrackApproved===false&&track.publicRoadApproved===false,'controlled-track baseline must remain unapproved');
expect(Array.isArray(track.scenarios)&&track.scenarios.length===8,'controlled-track baseline must retain 8 scenarios');
expect(track.scenarios.every((item)=>item.status==='pending'&&item.evidence===null),'controlled-track registry must not be promoted by software implementation');

const calibration=json('docs/validation/sensors/V006_SENSOR_CALIBRATION_LIFECYCLE.json');
expect(calibration.automaticCalibrationPromotion===false,'calibration automation must remain disabled');
expect(calibration.sensors.every((item)=>item.currentState==='unprovisioned'),'committed calibration sensors must remain unprovisioned without physical evidence');

if(failures.length){console.error('KINGMAST P0-P6 physical runtime policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('[p0-p6-runtime] production=read-only; evidence=metadata-only; time-sync=reviewed-limits-only; HIL/track=blocked-until-physical-prerequisites; simulator=non-physical; qualification=false');
