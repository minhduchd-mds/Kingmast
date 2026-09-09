import {createHash} from 'node:crypto';
import type {ReadOnlyVehiclePort,VehicleReadOnlySnapshot} from '@kingmast/contracts/vehicle-readonly';

export const PHYSICAL_RUNTIME_VERSION='0.0.6' as const;
export const PHYSICAL_RUNTIME_CONTROL_AUTHORITY='none' as const;

export type EvidenceClass='hil'|'closed-track'|'target-soak'|'sensor-calibration'|'boot-security'|'external-simulator';
export type EvidenceReviewStatus='pending-independent-review'|'reviewed';
export type ImmutabilityMode='object-lock'|'write-once'|'append-only-reviewed';

export interface EvidenceDigest {ref:string;sha256:string;}
export interface PhysicalEvidenceRecord {
  recordId:string;
  evidenceClass:EvidenceClass;
  scenarioId?:string;
  sourceSoftwareCommit:string;
  packageSha256:string;
  capturedAt:string;
  objectRef:string;
  retentionClass:'qualification'|'diagnostic'|'research';
  immutabilityMode:ImmutabilityMode;
  encryptedAtRest:true;
  accessControlReviewed:true;
  contentDigestVerified:true;
  evidenceDigests:EvidenceDigest[];
  reviewStatus:EvidenceReviewStatus;
}

export interface ProtectedEvidenceStoreConfig {
  backendConfigured:boolean;
  maxRecords:number;
  reviewedAccessControl:boolean;
  encryptedAtRest:boolean;
  immutableRetention:boolean;
}

export interface EvidenceRegistrationResult {
  accepted:boolean;
  code:'registered'|'backend-unavailable'|'invalid-record'|'duplicate-package'|'capacity-reached';
  recordId:string|null;
  detail:string;
  automaticQualification:false;
}

const COMMIT_RE=/^[a-f0-9]{40}$/i;
const SHA256_RE=/^[a-f0-9]{64}$/i;
const RECORD_ID_RE=/^EV-[A-Z0-9-]{4,80}$/;
const SAFE_REF_RE=/^[^\s?#@]{1,512}$/;

function boundedText(value:unknown,max=512):value is string{
  return typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\r\n\t]/.test(value);
}

function isIso(value:string){return Number.isFinite(Date.parse(value));}
function hasProhibitedMetadataKey(value:unknown):boolean{
  if(!value||typeof value!=='object')return false;
  const prohibited=new Set(['rawHardwareSerial','secret','secrets','privateKey','accessToken','password','preciseCoordinates','rawCabinVideo','rawCameraFrames']);
  return Object.keys(value).some((key)=>prohibited.has(key));
}

export function sha256Utf8(value:string){return createHash('sha256').update(value,'utf8').digest('hex');}

export function validatePhysicalEvidenceRecord(record:PhysicalEvidenceRecord):string[]{
  const failures:string[]=[];
  if(!RECORD_ID_RE.test(record.recordId))failures.push('recordId');
  if(!['hil','closed-track','target-soak','sensor-calibration','boot-security','external-simulator'].includes(record.evidenceClass))failures.push('evidenceClass');
  if(!COMMIT_RE.test(record.sourceSoftwareCommit))failures.push('sourceSoftwareCommit');
  if(!SHA256_RE.test(record.packageSha256))failures.push('packageSha256');
  if(!isIso(record.capturedAt))failures.push('capturedAt');
  if(!SAFE_REF_RE.test(record.objectRef))failures.push('objectRef');
  if(!['qualification','diagnostic','research'].includes(record.retentionClass))failures.push('retentionClass');
  if(!['object-lock','write-once','append-only-reviewed'].includes(record.immutabilityMode))failures.push('immutabilityMode');
  if(record.encryptedAtRest!==true)failures.push('encryptedAtRest');
  if(record.accessControlReviewed!==true)failures.push('accessControlReviewed');
  if(record.contentDigestVerified!==true)failures.push('contentDigestVerified');
  if(!['pending-independent-review','reviewed'].includes(record.reviewStatus))failures.push('reviewStatus');
  if(record.evidenceClass==='hil'&&!/^HIL-\d{3}$/.test(record.scenarioId??''))failures.push('HIL scenarioId');
  if(record.evidenceClass==='closed-track'&&!/^CT-\d{3}$/.test(record.scenarioId??''))failures.push('closed-track scenarioId');
  if(record.evidenceDigests.length<1||record.evidenceDigests.length>64)failures.push('evidenceDigests');
  const refs=new Set<string>();
  for(const digest of record.evidenceDigests){
    if(!boundedText(digest.ref)||refs.has(digest.ref))failures.push('evidence digest ref');
    refs.add(digest.ref);
    if(!SHA256_RE.test(digest.sha256))failures.push('evidence digest sha256');
  }
  if(hasProhibitedMetadataKey(record))failures.push('prohibited metadata');
  return failures;
}

export class ProtectedEvidenceStoreRuntime {
  readonly controlAuthority=PHYSICAL_RUNTIME_CONTROL_AUTHORITY;
  readonly repositoryStoresRawEvidence=false as const;
  readonly automaticQualification=false as const;
  readonly automaticRegistryMutation=false as const;
  private readonly records=new Map<string,PhysicalEvidenceRecord>();
  private readonly packageDigests=new Set<string>();

  constructor(private readonly config:ProtectedEvidenceStoreConfig){
    if(!Number.isInteger(config.maxRecords)||config.maxRecords<1||config.maxRecords>100_000)throw new Error('maxRecords must be an integer from 1 to 100000');
  }

  register(record:PhysicalEvidenceRecord):EvidenceRegistrationResult{
    if(!this.config.backendConfigured||!this.config.reviewedAccessControl||!this.config.encryptedAtRest||!this.config.immutableRetention){
      return{accepted:false,code:'backend-unavailable',recordId:null,detail:'protected evidence backend is not fully provisioned and reviewed',automaticQualification:false};
    }
    const failures=validatePhysicalEvidenceRecord(record);
    if(failures.length)return{accepted:false,code:'invalid-record',recordId:null,detail:`invalid fields: ${failures.join(', ')}`,automaticQualification:false};
    if(this.records.has(record.recordId))return{accepted:false,code:'invalid-record',recordId:null,detail:'recordId already registered',automaticQualification:false};
    if(this.packageDigests.has(record.packageSha256))return{accepted:false,code:'duplicate-package',recordId:null,detail:'package SHA-256 already registered',automaticQualification:false};
    if(this.records.size>=this.config.maxRecords)return{accepted:false,code:'capacity-reached',recordId:null,detail:'bounded metadata index capacity reached',automaticQualification:false};
    const stored=structuredClone(record);
    this.records.set(stored.recordId,stored);
    this.packageDigests.add(stored.packageSha256);
    return{accepted:true,code:'registered',recordId:stored.recordId,detail:'metadata registered; independent review is still required',automaticQualification:false};
  }

  listMetadata(){return [...this.records.values()].map((record)=>structuredClone(record));}
  snapshot(){
    return{schema:'kingmast-protected-evidence-runtime/v1' as const,version:PHYSICAL_RUNTIME_VERSION,controlAuthority:'none' as const,backendConfigured:this.config.backendConfigured,recordCount:this.records.size,repositoryStoresRawEvidence:false as const,automaticQualification:false as const,targetHardwareQualified:false as const,closedTrackApproved:false as const,publicRoadApproved:false as const};
  }
}

export interface VehicleRuntimeConfig {maxSnapshotAgeMs:number;maxFutureSkewMs:number;maxBufferedEvents:number;}
export interface VehicleRuntimeEvent {atMs:number;code:string;detail:string;}
export interface VehicleRuntimeObservation {
  schema:'kingmast-vehicle-computer-runtime/v1';
  controlAuthority:'none';
  readOnly:true;
  status:'live'|'degraded'|'unavailable';
  snapshot:VehicleReadOnlySnapshot|null;
  ageMs:number|null;
  reasons:string[];
}

export class VehicleComputerRuntime {
  readonly controlAuthority=PHYSICAL_RUNTIME_CONTROL_AUTHORITY;
  readonly readOnly=true as const;
  private readonly events:VehicleRuntimeEvent[]=[];

  constructor(private readonly port:ReadOnlyVehiclePort,private readonly config:VehicleRuntimeConfig){
    if(port.authority!=='read-only')throw new Error('vehicle port must be read-only');
    if(!Number.isFinite(config.maxSnapshotAgeMs)||config.maxSnapshotAgeMs<=0)throw new Error('maxSnapshotAgeMs must be positive');
    if(!Number.isFinite(config.maxFutureSkewMs)||config.maxFutureSkewMs<0)throw new Error('maxFutureSkewMs must be non-negative');
    if(!Number.isInteger(config.maxBufferedEvents)||config.maxBufferedEvents<1||config.maxBufferedEvents>10_000)throw new Error('maxBufferedEvents must be an integer from 1 to 10000');
  }

  private note(event:VehicleRuntimeEvent){this.events.push(event);while(this.events.length>this.config.maxBufferedEvents)this.events.shift();}

  async observe(nowMs=Date.now()):Promise<VehicleRuntimeObservation>{
    try{
      const snapshot=await this.port.readSnapshot(nowMs);
      const reasons:string[]=[];
      const futureSkew=snapshot.observedAtMs-nowMs;
      const ageMs=Math.max(0,nowMs-snapshot.observedAtMs);
      if(futureSkew>this.config.maxFutureSkewMs)reasons.push('future-clock-skew');
      if(ageMs>this.config.maxSnapshotAgeMs)reasons.push('stale-vehicle-snapshot');
      if(snapshot.sensors.can!=='ok')reasons.push(`can-${snapshot.sensors.can}`);
      if(snapshot.sensors.gnssImu!=='ok')reasons.push(`gnss-imu-${snapshot.sensors.gnssImu}`);
      if(snapshot.sensors.ecu!=='ok')reasons.push(`ecu-${snapshot.sensors.ecu}`);
      if(reasons.length)this.note({atMs:nowMs,code:'vehicle-input-degraded',detail:reasons.join(',')});
      return{schema:'kingmast-vehicle-computer-runtime/v1',controlAuthority:'none',readOnly:true,status:reasons.length?'degraded':'live',snapshot,ageMs,reasons};
    }catch(error){
      const detail=error instanceof Error?error.message:'vehicle port read failed';
      this.note({atMs:nowMs,code:'vehicle-input-unavailable',detail});
      return{schema:'kingmast-vehicle-computer-runtime/v1',controlAuthority:'none',readOnly:true,status:'unavailable',snapshot:null,ageMs:null,reasons:['vehicle-port-read-failed']};
    }
  }

  recentEvents(){return this.events.map((event)=>({...event}));}
}

export interface ReviewedTimeSyncLimits {maxOffsetMs:number|null;maxUncertaintyMs:number|null;maxDriftPpm:number|null;reviewed:boolean;reviewRef:string|null;}
export interface TimeSyncObservation {clockDomain:string;offsetMs:number;uncertaintyMs:number;driftPpm:number;discontinuityObserved:boolean;observedAtMs:number;}
export interface TimeSyncAssessment {
  schema:'kingmast-time-sync-assessment/v1';controlAuthority:'none';status:'unreviewed-limits'|'within-reviewed-limits'|'outside-reviewed-limits'|'clock-discontinuity';qualifiedForPhysicalEvidence:boolean;reasons:string[];
}

function finiteAbs(value:number){return Number.isFinite(value)?Math.abs(value):Number.POSITIVE_INFINITY;}
function reviewedLimit(value:number|null):value is number{return value!==null&&Number.isFinite(value)&&value>=0;}

export class TimeSyncMonitor {
  readonly controlAuthority=PHYSICAL_RUNTIME_CONTROL_AUTHORITY;
  constructor(private readonly limits:ReviewedTimeSyncLimits){}
  assess(observation:TimeSyncObservation):TimeSyncAssessment{
    if(observation.discontinuityObserved)return{schema:'kingmast-time-sync-assessment/v1',controlAuthority:'none',status:'clock-discontinuity',qualifiedForPhysicalEvidence:false,reasons:['clock-discontinuity']};
    const maxOffsetMs=this.limits.maxOffsetMs;
    const maxUncertaintyMs=this.limits.maxUncertaintyMs;
    const maxDriftPpm=this.limits.maxDriftPpm;
    if(!this.limits.reviewed||!boundedText(this.limits.reviewRef,256)||!reviewedLimit(maxOffsetMs)||!reviewedLimit(maxUncertaintyMs)||!reviewedLimit(maxDriftPpm))return{schema:'kingmast-time-sync-assessment/v1',controlAuthority:'none',status:'unreviewed-limits',qualifiedForPhysicalEvidence:false,reasons:['reviewed numeric time-sync limits are required']};
    const reasons:string[]=[];
    if(finiteAbs(observation.offsetMs)>maxOffsetMs)reasons.push('offset-outside-reviewed-limit');
    if(finiteAbs(observation.uncertaintyMs)>maxUncertaintyMs)reasons.push('uncertainty-outside-reviewed-limit');
    if(finiteAbs(observation.driftPpm)>maxDriftPpm)reasons.push('drift-outside-reviewed-limit');
    return{schema:'kingmast-time-sync-assessment/v1',controlAuthority:'none',status:reasons.length?'outside-reviewed-limits':'within-reviewed-limits',qualifiedForPhysicalEvidence:reasons.length===0,reasons};
  }
}

export type CalibrationState='unprovisioned'|'provisioned'|'calibration-pending'|'captured-awaiting-independent-review'|'approved'|'rejected'|'invalidated';
export interface CalibrationRecord {sensorId:string;state:CalibrationState;operator:string|null;reviewer:string|null;sourceSoftwareCommit:string|null;calibrationSha256:string|null;updatedAtMs:number;}
export type CalibrationAction='provision'|'begin-calibration'|'capture'|'approve'|'reject'|'invalidate'|'retry';
export interface CalibrationTransitionInput {action:CalibrationAction;actor:string;sourceSoftwareCommit?:string;calibrationSha256?:string;timeSyncQualified?:boolean;}

export function transitionCalibration(current:CalibrationRecord,input:CalibrationTransitionInput):CalibrationRecord{
  if(!boundedText(input.actor,128))throw new Error('calibration actor is required');
  const next={...current,updatedAtMs:Date.now()};
  if(input.action==='provision'&&current.state==='unprovisioned')return{...next,state:'provisioned',operator:input.actor};
  if(input.action==='begin-calibration'&&current.state==='provisioned'){
    if(input.timeSyncQualified!==true)throw new Error('reviewed time synchronization is required before calibration capture');
    return{...next,state:'calibration-pending',operator:input.actor};
  }
  if(input.action==='capture'&&current.state==='calibration-pending'){
    if(!input.sourceSoftwareCommit||!COMMIT_RE.test(input.sourceSoftwareCommit))throw new Error('source software commit is required');
    if(!input.calibrationSha256||!SHA256_RE.test(input.calibrationSha256))throw new Error('calibration SHA-256 is required');
    return{...next,state:'captured-awaiting-independent-review',operator:current.operator??input.actor,sourceSoftwareCommit:input.sourceSoftwareCommit,calibrationSha256:input.calibrationSha256};
  }
  if((input.action==='approve'||input.action==='reject')&&current.state==='captured-awaiting-independent-review'){
    if(!current.operator||current.operator===input.actor)throw new Error('independent reviewer must differ from calibration operator');
    return{...next,state:input.action==='approve'?'approved':'rejected',reviewer:input.actor};
  }
  if(input.action==='invalidate'&&current.state==='approved')return{...next,state:'invalidated',reviewer:null};
  if(input.action==='retry'&&(current.state==='rejected'||current.state==='invalidated'))return{...next,state:'calibration-pending',operator:input.actor,reviewer:null};
  throw new Error(`invalid calibration transition ${current.state} -> ${input.action}`);
}

export type CaptureLifecycleState='BLOCKED'|'READY'|'CAPTURED';
export interface CaptureLifecycleSnapshot {id:string;state:CaptureLifecycleState;reasons:string[];captureRecordId:string|null;automaticReview:false;physicalPassClaim:false;}

export interface HilReadinessInput {hardwareReviewed:boolean;calibrationReviewed:boolean;timeSyncQualified:boolean;readOnlyAuthorityVerified:boolean;sourceCommitBound:boolean;}
export class HilBenchAgent {
  readonly controlAuthority=PHYSICAL_RUNTIME_CONTROL_AUTHORITY;
  private state:CaptureLifecycleState='BLOCKED';
  private captureRecordId:string|null=null;
  constructor(readonly scenarioId:string){if(!/^HIL-\d{3}$/.test(scenarioId))throw new Error('invalid HIL scenario id');}
  evaluate(input:HilReadinessInput):CaptureLifecycleSnapshot{
    const reasons:string[]=[];
    if(!input.hardwareReviewed)reasons.push('hardware-review-pending');
    if(!input.calibrationReviewed)reasons.push('calibration-review-pending');
    if(!input.timeSyncQualified)reasons.push('time-sync-not-qualified');
    if(!input.readOnlyAuthorityVerified)reasons.push('read-only-authority-not-verified');
    if(!input.sourceCommitBound)reasons.push('source-commit-not-bound');
    this.state=reasons.length?'BLOCKED':'READY';
    return this.snapshot(reasons);
  }
  capture(record:PhysicalEvidenceRecord):CaptureLifecycleSnapshot{
    if(this.state!=='READY')throw new Error('HIL scenario must be READY before capture');
    if(record.evidenceClass!=='hil'||record.scenarioId!==this.scenarioId)throw new Error('HIL evidence record does not match scenario');
    if(record.reviewStatus!=='pending-independent-review')throw new Error('new HIL capture must await independent review');
    const failures=validatePhysicalEvidenceRecord(record);if(failures.length)throw new Error(`invalid HIL evidence record: ${failures.join(', ')}`);
    this.state='CAPTURED';this.captureRecordId=record.recordId;
    return this.snapshot(['captured-awaiting-independent-review']);
  }
  snapshot(reasons:string[]=[]):CaptureLifecycleSnapshot{return{id:this.scenarioId,state:this.state,reasons:[...reasons],captureRecordId:this.captureRecordId,automaticReview:false,physicalPassClaim:false};}
}

export interface ControlledTrackPrerequisites {
  targetSoakReviewed:boolean;requiredHilReviewed:boolean;oddScenarioBoundsApproved:boolean;prototypeElectricalHarnessReviewed:boolean;physicalReadOnlyCanVerified:boolean;testEmergencyProcedureApproved:boolean;independentObserverAssigned:boolean;synchronizedLoggingReady:boolean;buildConfigurationCalibrationFrozen:boolean;testFacilityApprovalRecorded:boolean;
}
export interface ControlledTrackActors {operator:string;independentObserver:string;}
export class ControlledTrackAgent {
  readonly controlAuthority=PHYSICAL_RUNTIME_CONTROL_AUTHORITY;
  private state:CaptureLifecycleState='BLOCKED';
  private captureRecordId:string|null=null;
  constructor(readonly scenarioId:string){if(!/^CT-\d{3}$/.test(scenarioId))throw new Error('invalid controlled-track scenario id');}
  evaluate(prerequisites:ControlledTrackPrerequisites,actors:ControlledTrackActors):CaptureLifecycleSnapshot{
    const reasons=Object.entries(prerequisites).filter(([,ready])=>ready!==true).map(([key])=>`prerequisite:${key}`);
    if(!boundedText(actors.operator,128)||!boundedText(actors.independentObserver,128))reasons.push('operator-and-independent-observer-required');
    else if(actors.operator===actors.independentObserver)reasons.push('independent-observer-must-differ-from-operator');
    this.state=reasons.length?'BLOCKED':'READY';
    return this.snapshot(reasons);
  }
  capture(record:PhysicalEvidenceRecord):CaptureLifecycleSnapshot{
    if(this.state!=='READY')throw new Error('controlled-track scenario must be READY before capture');
    if(record.evidenceClass!=='closed-track'||record.scenarioId!==this.scenarioId)throw new Error('controlled-track evidence record does not match scenario');
    if(record.reviewStatus!=='pending-independent-review')throw new Error('new controlled-track capture must await independent review');
    const failures=validatePhysicalEvidenceRecord(record);if(failures.length)throw new Error(`invalid controlled-track evidence record: ${failures.join(', ')}`);
    this.state='CAPTURED';this.captureRecordId=record.recordId;
    return this.snapshot(['captured-awaiting-independent-review']);
  }
  snapshot(reasons:string[]=[]):CaptureLifecycleSnapshot{return{id:this.scenarioId,state:this.state,reasons:[...reasons],captureRecordId:this.captureRecordId,automaticReview:false,physicalPassClaim:false};}
}

export interface P0P6PortfolioInput {
  evidenceStore:ReturnType<ProtectedEvidenceStoreRuntime['snapshot']>;
  vehicleRuntime:VehicleRuntimeObservation;
  timeSync:TimeSyncAssessment;
  calibrationStates:CalibrationRecord[];
  hil:CaptureLifecycleSnapshot[];
  externalSimulatorEvidenceRegistered:boolean;
  controlledTrack:CaptureLifecycleSnapshot[];
}

export function buildP0P6Portfolio(input:P0P6PortfolioInput){
  const approvedCalibration=input.calibrationStates.filter((item)=>item.state==='approved').length;
  const capturedHil=input.hil.filter((item)=>item.state==='CAPTURED').length;
  const capturedTrack=input.controlledTrack.filter((item)=>item.state==='CAPTURED').length;
  return{
    schema:'kingmast-p0-p6-runtime-portfolio/v1' as const,
    version:PHYSICAL_RUNTIME_VERSION,
    controlAuthority:'none' as const,
    warningOnly:true as const,
    automaticActuation:false as const,
    canWriteAuthority:false as const,
    p0:{softwareBoundaryReady:input.vehicleRuntime.readOnly&&input.vehicleRuntime.controlAuthority==='none'},
    p1:{protectedEvidenceBackendConfigured:input.evidenceStore.backendConfigured,registeredMetadataRecords:input.evidenceStore.recordCount},
    p2:{vehicleComputerRuntimeState:input.vehicleRuntime.status},
    p3:{timeSyncState:input.timeSync.status,approvedCalibrationCount:approvedCalibration},
    p4:{capturedHilScenarioCount:capturedHil,reviewedHilScenarioCount:0},
    p5:{externalSimulatorEvidenceRegistered:input.externalSimulatorEvidenceRegistered,physicalEvidence:false},
    p6:{capturedControlledTrackScenarioCount:capturedTrack,reviewedControlledTrackScenarioCount:0},
    physicalQualificationComplete:false as const,
    targetHardwareQualified:false as const,
    closedTrackApproved:false as const,
    publicRoadApproved:false as const
  };
}
