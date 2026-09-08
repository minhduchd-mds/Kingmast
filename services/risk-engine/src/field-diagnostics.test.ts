import { describe,expect,it } from 'vitest';
import { buildFieldDiagnosticsReport,fieldDiagnosticIdentityFromEnv } from './field-diagnostics.js';

const completeIdentity={
  productVersion:'0.0.6',
  buildCommit:'6f86ec9055af9be631143890b4cc4003d1e96dce',
  buildId:'build-34196791582',
  hardwareTarget:'raspberry-pi-5',
  hardwareInstanceHash:'a'.repeat(64),
  firmwareRevision:'esp32-v006-17',
  configurationRevision:'cfg-v006-04',
  calibrationRevision:'cal-v006-03',
};

describe('field diagnostics evidence',()=>{
  it('builds a privacy-bounded software-only report by default',()=>{
    const report=buildFieldDiagnosticsReport({identity:fieldDiagnosticIdentityFromEnv({})});
    expect(report.schema).toBe('kingmast-field-diagnostics-report/v1');
    expect(report.controlAuthority).toBe('none');
    expect(report.targetHardwareQualified).toBe(false);
    expect(report.physicalVehicleComputerTest).toBe(false);
    expect(report.physicalCaptureReady).toBe(false);
    expect(report.privacy).toEqual({rawCabinVideoIncluded:false,rawCameraFramesIncluded:false,preciseCoordinatesIncluded:false,requestPayloadsIncluded:false,secretsIncluded:false,rawHardwareSerialIncluded:false});
  });

  it('aggregates bounded sensor and provider trust health without provider identifiers',()=>{
    const report=buildFieldDiagnosticsReport({
      identity:completeIdentity,
      runtime:{
        edge:{status:'degraded',rejectedPackets:7,sensorAgesMs:{gnss:400,radarFront:800,camera:1200},token:'must-be-stripped'},
        providerTrust:{authRejected:3,replayRejected:2,capacityRejected:1,providers:[
          {state:'healthy',trustStatus:'verified',liveV2xTrusted:true,snapshotAgeMs:250},
          {state:'stale',trustStatus:'untrusted',liveV2xTrusted:false,snapshotAgeMs:9000,providerId:'private-provider-name'},
        ]},
        coordinates:{lat:21.0,lng:105.8},
      },
    });
    expect(report.health.edgeStatus).toBe('degraded');
    expect(report.health.rejectedPackets).toBe(7);
    expect(report.health.providerTrustFailures).toEqual({authRejected:3,replayRejected:2,capacityRejected:1});
    expect(report.health.providers).toMatchObject({total:2,liveV2xTrusted:1,maxSnapshotAgeMs:9000,states:{healthy:1,degraded:0,stale:1}});
    expect(JSON.stringify(report)).not.toContain('private-provider-name');
    expect(JSON.stringify(report)).not.toContain('must-be-stripped');
    expect(JSON.stringify(report)).not.toContain('105.8');
  });

  it('requires complete hashed identity before a physical capture is considered ready',()=>{
    const ready=buildFieldDiagnosticsReport({identity:completeIdentity,physicalVehicleComputerTest:true});
    expect(ready.identity.complete).toBe(true);
    expect(ready.identity.hardwareInstanceIsHashed).toBe(true);
    expect(ready.physicalCaptureReady).toBe(true);
    expect(ready.targetHardwareQualified).toBe(false);

    const incomplete=buildFieldDiagnosticsReport({identity:{...completeIdentity,calibrationRevision:null},physicalVehicleComputerTest:true});
    expect(incomplete.identity.complete).toBe(false);
    expect(incomplete.physicalCaptureReady).toBe(false);
  });

  it('rejects unbounded or malformed diagnostics counters',()=>{
    expect(()=>buildFieldDiagnosticsReport({identity:completeIdentity,runtime:{edge:{status:'live',rejectedPackets:-1,sensorAgesMs:{gnss:1,radarFront:1,camera:1}}}})).toThrow();
    expect(()=>buildFieldDiagnosticsReport({identity:{...completeIdentity,hardwareInstanceHash:'raw-serial-number'}})).toThrow();
  });
});
