import {describe,expect,it} from 'vitest';
import {createReadOnlyVehiclePort} from '@kingmast/contracts/vehicle-readonly';
import {
  ProtectedEvidenceStoreRuntime,VehicleComputerRuntime,TimeSyncMonitor,transitionCalibration,HilBenchAgent,ControlledTrackAgent,buildP0P6Portfolio,
  type PhysicalEvidenceRecord,type CalibrationRecord,type ControlledTrackPrerequisites
} from './physical-validation-runtime.js';

const commit='a'.repeat(40);
const digest='b'.repeat(64);
const evidenceDigest='c'.repeat(64);

function evidence(overrides:Partial<PhysicalEvidenceRecord>={}):PhysicalEvidenceRecord{
  return{
    recordId:'EV-HIL-001-A',evidenceClass:'hil',scenarioId:'HIL-001',sourceSoftwareCommit:commit,packageSha256:digest,capturedAt:'2026-09-09T06:00:00Z',objectRef:'evidence://qualification/HIL-001/package.json',retentionClass:'qualification',immutabilityMode:'object-lock',encryptedAtRest:true,accessControlReviewed:true,contentDigestVerified:true,evidenceDigests:[{ref:'measurement/HIL-001.bin',sha256:evidenceDigest}],reviewStatus:'pending-independent-review',...overrides
  };
}

describe('P0-P6 physical validation runtime',()=>{
  it('keeps an unprovisioned evidence backend fail-closed',()=>{
    const store=new ProtectedEvidenceStoreRuntime({backendConfigured:false,maxRecords:8,reviewedAccessControl:false,encryptedAtRest:false,immutableRetention:false});
    const result=store.register(evidence());
    expect(result.accepted).toBe(false);expect(result.code).toBe('backend-unavailable');expect(result.automaticQualification).toBe(false);expect(store.snapshot().targetHardwareQualified).toBe(false);
  });

  it('registers bounded metadata only when the protected store is reviewed',()=>{
    const store=new ProtectedEvidenceStoreRuntime({backendConfigured:true,maxRecords:2,reviewedAccessControl:true,encryptedAtRest:true,immutableRetention:true});
    const first=store.register(evidence());
    const duplicate=store.register(evidence({recordId:'EV-HIL-001-B'}));
    expect(first.accepted).toBe(true);expect(duplicate.code).toBe('duplicate-package');expect(store.listMetadata()).toHaveLength(1);expect(store.repositoryStoresRawEvidence).toBe(false);
  });

  it('observes only through the read-only vehicle port and degrades stale data',async()=>{
    const port=createReadOnlyVehiclePort(async()=>({observedAtMs:1_000,speedKmh:42,position:null,sensors:{can:'ok',gnssImu:'ok',ecu:'ok'},source:'can-rx',provenance:'bench-fixture'}));
    const runtime=new VehicleComputerRuntime(port,{maxSnapshotAgeMs:500,maxFutureSkewMs:50,maxBufferedEvents:4});
    const result=await runtime.observe(2_000);
    expect(result.controlAuthority).toBe('none');expect(result.readOnly).toBe(true);expect(result.status).toBe('degraded');expect(result.reasons).toContain('stale-vehicle-snapshot');expect(runtime.recentEvents()).toHaveLength(1);
  });

  it('requires independently reviewed numeric limits before time sync may qualify evidence',()=>{
    const observation={clockDomain:'bench',offsetMs:2,uncertaintyMs:1,driftPpm:3,discontinuityObserved:false,observedAtMs:1_000};
    const pending=new TimeSyncMonitor({maxOffsetMs:null,maxUncertaintyMs:null,maxDriftPpm:null,reviewed:false,reviewRef:null}).assess(observation);
    const reviewed=new TimeSyncMonitor({maxOffsetMs:5,maxUncertaintyMs:2,maxDriftPpm:10,reviewed:true,reviewRef:'REV-TIME-001'}).assess(observation);
    expect(pending.status).toBe('unreviewed-limits');expect(pending.qualifiedForPhysicalEvidence).toBe(false);expect(reviewed.status).toBe('within-reviewed-limits');expect(reviewed.qualifiedForPhysicalEvidence).toBe(true);
  });

  it('prevents automatic calibration approval and requires a different reviewer',()=>{
    let calibration:CalibrationRecord={sensorId:'front-radar',state:'unprovisioned',operator:null,reviewer:null,sourceSoftwareCommit:null,calibrationSha256:null,updatedAtMs:0};
    calibration=transitionCalibration(calibration,{action:'provision',actor:'operator-a'});
    calibration=transitionCalibration(calibration,{action:'begin-calibration',actor:'operator-a',timeSyncQualified:true});
    calibration=transitionCalibration(calibration,{action:'capture',actor:'operator-a',sourceSoftwareCommit:commit,calibrationSha256:digest});
    expect(calibration.state).toBe('captured-awaiting-independent-review');
    expect(()=>transitionCalibration(calibration,{action:'approve',actor:'operator-a'})).toThrow(/independent reviewer/);
    calibration=transitionCalibration(calibration,{action:'approve',actor:'reviewer-b'});
    expect(calibration.state).toBe('approved');expect(calibration.reviewer).toBe('reviewer-b');
  });

  it('moves HIL only through BLOCKED -> READY -> CAPTURED without claiming a physical pass',()=>{
    const agent=new HilBenchAgent('HIL-001');
    expect(agent.evaluate({hardwareReviewed:false,calibrationReviewed:false,timeSyncQualified:false,readOnlyAuthorityVerified:false,sourceCommitBound:false}).state).toBe('BLOCKED');
    expect(agent.evaluate({hardwareReviewed:true,calibrationReviewed:true,timeSyncQualified:true,readOnlyAuthorityVerified:true,sourceCommitBound:true}).state).toBe('READY');
    const captured=agent.capture(evidence());
    expect(captured.state).toBe('CAPTURED');expect(captured.automaticReview).toBe(false);expect(captured.physicalPassClaim).toBe(false);
  });

  it('keeps controlled-track execution blocked until all ten prerequisites and an independent observer are present',()=>{
    const prerequisites:ControlledTrackPrerequisites={targetSoakReviewed:true,requiredHilReviewed:true,oddScenarioBoundsApproved:true,prototypeElectricalHarnessReviewed:true,physicalReadOnlyCanVerified:true,testEmergencyProcedureApproved:true,independentObserverAssigned:true,synchronizedLoggingReady:true,buildConfigurationCalibrationFrozen:true,testFacilityApprovalRecorded:true};
    const agent=new ControlledTrackAgent('CT-001');
    expect(agent.evaluate(prerequisites,{operator:'operator-a',independentObserver:'operator-a'}).state).toBe('BLOCKED');
    expect(agent.evaluate(prerequisites,{operator:'operator-a',independentObserver:'observer-b'}).state).toBe('READY');
    const captured=agent.capture(evidence({recordId:'EV-CT-001-A',evidenceClass:'closed-track',scenarioId:'CT-001',packageSha256:'d'.repeat(64),objectRef:'evidence://qualification/CT-001/package.json'}));
    expect(captured.state).toBe('CAPTURED');expect(captured.physicalPassClaim).toBe(false);
  });

  it('reports software progress without converting it into qualification',async()=>{
    const store=new ProtectedEvidenceStoreRuntime({backendConfigured:false,maxRecords:8,reviewedAccessControl:false,encryptedAtRest:false,immutableRetention:false});
    const port=createReadOnlyVehiclePort(async()=>({observedAtMs:1_000,speedKmh:0,position:null,sensors:{can:'ok',gnssImu:'ok',ecu:'ok'},source:'simulator',provenance:'fixture'}));
    const vehicle=await new VehicleComputerRuntime(port,{maxSnapshotAgeMs:500,maxFutureSkewMs:50,maxBufferedEvents:4}).observe(1_100);
    const timeSync=new TimeSyncMonitor({maxOffsetMs:null,maxUncertaintyMs:null,maxDriftPpm:null,reviewed:false,reviewRef:null}).assess({clockDomain:'fixture',offsetMs:0,uncertaintyMs:0,driftPpm:0,discontinuityObserved:false,observedAtMs:1_100});
    const portfolio=buildP0P6Portfolio({evidenceStore:store.snapshot(),vehicleRuntime:vehicle,timeSync,calibrationStates:[],hil:[],externalSimulatorEvidenceRegistered:false,controlledTrack:[]});
    expect(portfolio.controlAuthority).toBe('none');expect(portfolio.automaticActuation).toBe(false);expect(portfolio.canWriteAuthority).toBe(false);expect(portfolio.physicalQualificationComplete).toBe(false);expect(portfolio.publicRoadApproved).toBe(false);
  });
});
