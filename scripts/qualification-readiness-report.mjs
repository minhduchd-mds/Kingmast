import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const paths={
  hardware:'docs/validation/hardware/V006_HARDWARE_QUALIFICATION_MATRIX.json',
  sensors:'docs/validation/sensors/V006_SENSOR_CALIBRATION_LIFECYCLE.json',
  hil:'docs/validation/hil/V006_HIL_EVIDENCE_REGISTRY.json',
  closedTrack:'docs/validation/closed-track/V006_CLOSED_TRACK_EVIDENCE_REGISTRY.json',
  targetSoak:'docs/validation/runtime/V006_TARGET_SOAK_CAPTURE.json',
  reviews:'docs/review/V006_INDEPENDENT_REVIEW_REGISTRY.json'
};

function readJson(relative){return JSON.parse(readFileSync(resolve(root,relative),'utf8'));}
function percent(done,total){return total===0?0:Math.round((done/total)*10000)/100;}
function round2(value){return Math.round(value*100)/100;}
function countStatuses(items,key='status'){
  const counts={};
  for(const item of items){const value=String(item?.[key]??'unknown');counts[value]=(counts[value]??0)+1;}
  return counts;
}
function requireInvariant(condition,message){if(!condition)throw new Error(message);}

for(const [name,path] of Object.entries(paths))requireInvariant(existsSync(resolve(root,path)),`missing readiness source ${name}: ${path}`);

const hardware=readJson(paths.hardware);
const sensors=readJson(paths.sensors);
const hil=readJson(paths.hil);
const closedTrack=readJson(paths.closedTrack);
const targetSoak=readJson(paths.targetSoak);
const reviews=readJson(paths.reviews);

requireInvariant(hardware.schema==='kingmast-hardware-qualification-matrix/v1','unexpected hardware matrix schema');
requireInvariant(sensors.schema==='kingmast-sensor-calibration-lifecycle/v1','unexpected sensor lifecycle schema');
requireInvariant(hil.schema==='kingmast-hil-evidence-registry/v1','unexpected HIL registry schema');
requireInvariant(closedTrack.schema==='kingmast-closed-track-evidence-registry/v1','unexpected closed-track registry schema');
requireInvariant(targetSoak.schema==='kingmast-target-soak-capture/v1','unexpected target soak schema');
requireInvariant(reviews.schema==='kingmast-independent-review-registry/v1','unexpected independent review schema');

const hardwareTargets=Array.isArray(hardware.targets)?hardware.targets:[];
const sensorGroups=Array.isArray(sensors.sensors)?sensors.sensors:[];
const hilScenarios=Array.isArray(hil.scenarios)?hil.scenarios:[];
const trackScenarios=Array.isArray(closedTrack.scenarios)?closedTrack.scenarios:[];
const reviewDomains=Array.isArray(reviews.reviews)?reviews.reviews:[];

requireInvariant(hardwareTargets.length>=7,'hardware matrix must contain at least seven targets');
requireInvariant(sensorGroups.length>=4,'sensor lifecycle must contain at least four sensor groups');
requireInvariant(hilScenarios.length===12,'HIL registry must contain exactly 12 scenarios');
requireInvariant(trackScenarios.length>=8,'closed-track registry must contain at least 8 scenarios');
requireInvariant(reviewDomains.length>=5,'independent review registry must contain at least 5 domains');

const hardwareReviewedPass=hardwareTargets.filter((item)=>item.status==='reviewed-pass').length;
const calibrationApproved=sensorGroups.filter((item)=>item.currentState==='approved').length;
const soakReviewedPass=targetSoak.physicalVehicleComputerTest===true&&targetSoak.reviewStatus==='reviewed-pass'&&targetSoak.runtimeEnvelopePassed===true;
const hilReviewedPass=hilScenarios.filter((item)=>item.status==='passed').length;
const trackReviewedPass=trackScenarios.filter((item)=>item.status==='reviewed-pass').length;
const acceptedReviews=reviewDomains.filter((item)=>item.status==='complete'&&['accept','accept-with-findings'].includes(item.disposition)&&Array.isArray(item.findings)&&item.findings.every((finding)=>finding.status!=='open')).length;

const softwarePreparationChecks=[
  {id:'hardware-matrix',passed:hardware.version==='0.0.6'&&hardware.controlAuthority==='none'&&hardware.automaticQualification===false&&hardware.targetHardwareQualified===false},
  {id:'sensor-calibration-lifecycle',passed:sensors.version==='0.0.6'&&sensors.controlAuthority==='none'&&sensors.automaticCalibrationPromotion===false&&sensors.productionThresholdMutation===false},
  {id:'hil-registry-coverage',passed:hilScenarios.length===12&&hilScenarios.every((item)=>/^HIL-\d{3}$/.test(item.id))},
  {id:'closed-track-registry-coverage',passed:trackScenarios.length>=8&&trackScenarios.every((item)=>/^CT-\d{3}$/.test(item.id))},
  {id:'target-soak-contract',passed:targetSoak.controlAuthority==='none'&&targetSoak.requiredDurationSeconds>=7200&&targetSoak.targetHardwareQualified===false},
  {id:'independent-review-contract',passed:reviews.controlAuthority==='none'&&reviews.targetHardwareQualified===false&&reviews.closedTrackApproved===false&&reviews.publicRoadApproved===false}
];
const softwarePreparationPassed=softwarePreparationChecks.filter((item)=>item.passed).length;
const softwarePreparationScorePercent=percent(softwarePreparationPassed,softwarePreparationChecks.length);

const weights={
  hardwareTargets:20,
  sensorCalibration:15,
  targetSoak:15,
  hil:25,
  closedTrack:15,
  independentReview:10
};
const weighted={
  hardwareTargets:(hardwareReviewedPass/hardwareTargets.length)*weights.hardwareTargets,
  sensorCalibration:(calibrationApproved/sensorGroups.length)*weights.sensorCalibration,
  targetSoak:(soakReviewedPass?1:0)*weights.targetSoak,
  hil:(hilReviewedPass/hilScenarios.length)*weights.hil,
  closedTrack:(trackReviewedPass/trackScenarios.length)*weights.closedTrack,
  independentReview:(acceptedReviews/reviewDomains.length)*weights.independentReview
};
const physicalEvidenceCompletionScorePercent=round2(Object.values(weighted).reduce((sum,value)=>sum+value,0));

const report={
  schema:'kingmast-qualification-readiness-report/v1',
  version:'0.0.6',
  controlAuthority:'none',
  qualificationClaim:'software-readiness-dashboard-not-physical-qualification',
  automaticQualification:false,
  targetHardwareQualified:false,
  physicalVehicleComputerQualified:false,
  closedTrackApproved:false,
  publicRoadApproved:false,
  overallStatus:physicalEvidenceCompletionScorePercent===100?'physical-evidence-complete-awaiting-independent-qualification-decision':'blocked-physical-evidence-incomplete',
  softwarePreparationScorePercent,
  physicalEvidenceCompletionScorePercent,
  softwarePreparation:{
    passed:softwarePreparationPassed,
    total:softwarePreparationChecks.length,
    checks:softwarePreparationChecks
  },
  physicalEvidenceWeightsPercent:weights,
  physicalEvidenceWeightedContributionPercent:Object.fromEntries(Object.entries(weighted).map(([key,value])=>[key,round2(value)])),
  coverage:{
    hardware:{
      total:hardwareTargets.length,
      reviewedPass:hardwareReviewedPass,
      completionPercent:percent(hardwareReviewedPass,hardwareTargets.length),
      byStatus:countStatuses(hardwareTargets),
      pendingIds:hardwareTargets.filter((item)=>item.status!=='reviewed-pass').map((item)=>item.id)
    },
    sensorCalibration:{
      total:sensorGroups.length,
      approved:calibrationApproved,
      completionPercent:percent(calibrationApproved,sensorGroups.length),
      byState:countStatuses(sensorGroups,'currentState'),
      pendingIds:sensorGroups.filter((item)=>item.currentState!=='approved').map((item)=>item.id)
    },
    targetSoak:{
      physicalVehicleComputerTest:targetSoak.physicalVehicleComputerTest===true,
      status:targetSoak.status,
      reviewStatus:targetSoak.reviewStatus,
      reviewedPass:soakReviewedPass,
      requiredDurationSeconds:targetSoak.requiredDurationSeconds,
      capturedDurationSeconds:targetSoak.capturedDurationSeconds
    },
    hil:{
      total:hilScenarios.length,
      reviewedPass:hilReviewedPass,
      completionPercent:percent(hilReviewedPass,hilScenarios.length),
      byStatus:countStatuses(hilScenarios),
      pendingIds:hilScenarios.filter((item)=>item.status!=='passed').map((item)=>item.id)
    },
    closedTrack:{
      total:trackScenarios.length,
      reviewedPass:trackReviewedPass,
      completionPercent:percent(trackReviewedPass,trackScenarios.length),
      byStatus:countStatuses(trackScenarios),
      pendingIds:trackScenarios.filter((item)=>item.status!=='reviewed-pass').map((item)=>item.id)
    },
    independentReview:{
      total:reviewDomains.length,
      accepted:acceptedReviews,
      completionPercent:percent(acceptedReviews,reviewDomains.length),
      byStatus:countStatuses(reviewDomains),
      pendingIds:reviewDomains.filter((item)=>!(item.status==='complete'&&['accept','accept-with-findings'].includes(item.disposition)&&Array.isArray(item.findings)&&item.findings.every((finding)=>finding.status!=='open'))).map((item)=>item.id)
    }
  },
  sourceFiles:paths,
  limitations:[
    'softwarePreparationScorePercent measures repository-side preparation and bookkeeping coverage only; it is not a safety, hardware or regulatory qualification score.',
    'physicalEvidenceCompletionScorePercent counts only reviewed physical evidence recorded in fail-closed registries. A score of 100 still requires an explicit independent qualification decision outside repository automation.',
    'Simulation, CI, CodeQL and packaging workflows cannot increase physical evidence completion unless the physical registries are manually updated from genuine independently reviewed evidence.',
    'KINGMAST remains warning-only SAE Level 0 with no steering, braking, throttle, gear, torque, drivetrain or CAN-write authority.'
  ]
};

requireInvariant(report.softwarePreparationScorePercent===100,'software preparation contract is incomplete');
requireInvariant(report.physicalEvidenceCompletionScorePercent>=0&&report.physicalEvidenceCompletionScorePercent<=100,'physical evidence score is out of range');
requireInvariant(report.targetHardwareQualified===false&&report.closedTrackApproved===false&&report.publicRoadApproved===false,'readiness report may not grant qualification or road approval');

console.log(JSON.stringify(report,null,2));
