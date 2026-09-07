import { createHash,generateKeyPairSync,sign } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import type { EdgeTelemetryPacket,SensorHealth } from '@kingmast/contracts';
import { assessRisk } from './risk.js';
import { EdgePacketGuard } from './edge-guard.js';
import { assessDriverMonitoring,type DriverMonitoringSample } from './driver-monitoring.js';
import { DriverAssistRuntime } from './driver-assist-runtime.js';
import { canonicalUpdatePayload,evaluateInstallEligibility,verifyUpdatePackage,type UpdateManifest } from './update-verifier.js';
import { UpdateLifecycle } from './update-state.js';
import { parseDeviceKeyRegistry,signDevicePacket,signDevicePacketEd25519,verifyDevicePacketAuth } from './device-auth.js';
import { BoundedFixedWindowRateLimiter } from './bounded-state.js';

const now=1_800_000_000_000;
const sensors:SensorHealth={radarFront:'ok',radarRear:'unavailable',camera:'ok',can:'ok',gnssImu:'ok',ecu:'ok'};
function edgePacket(sequence:number):EdgeTelemetryPacket{return{protocolVersion:1,deviceId:'edge-fi',bootId:'boot-fi',sequence,timestampMs:now,gnss:{lat:21.0285,lng:105.8542,speedKmh:50,headingDeg:0,accuracyM:3,timestampMs:now,source:'gnss'},sensors};}
function dmsSamples():DriverMonitoringSample[]{return Array.from({length:7},(_,index)=>({timestampMs:now+index*1_000,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:index<5?.2:.95}));}

describe('KINGMAST v0.0.6 traceable safety scenarios',()=>{
  it('FI-001 HZ-003/HZ-010 rejects replayed edge sequence',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(edgePacket(1),now).ok).toBe(true);
    expect(guard.accept(edgePacket(1),now)).toEqual({ok:false,reason:'sequence-replay'});
  });

  it('FI-002 HZ-001/HZ-003 rejects stale risk input',()=>{
    const result=assessRisk({timestampMs:now-1_000,egoSpeedMps:20,targetSpeedMps:5,rangeM:8,confidence:.98,canHealthy:true,radarHealthy:true,cameraHealthy:true},now);
    expect(result.severity).toBe('safe');
    expect(result.reasons).toContain('stale-data-rejected');
  });

  it('FI-003 HZ-001/HZ-008 removes range authority when radar is unavailable',()=>{
    const result=assessRisk({timestampMs:now,egoSpeedMps:20,targetSpeedMps:5,rangeM:8,confidence:.98,canHealthy:true,radarHealthy:false,cameraHealthy:true},now);
    expect(result.severity).toBe('safe');
    expect(result.ttcS).toBeNull();
    expect(result.reasons).toContain('radar-unavailable');
  });

  it('FI-004 HZ-006 ST-016/ST-017/ST-018 degrades low-quality DMS evidence',()=>{
    const result=assessDriverMonitoring(dmsSamples());
    expect(result.state).toBe('driver-unavailable');
    expect(result.reason).toBe('cabin-observation-quality-low');
    expect(result.storesRawVideo).toBe(false);
  });

  it('FI-005 HZ-009 rejects a tampered signed-update artifact',()=>{
    const artifact=Buffer.from('expected-artifact');
    const{privateKey,publicKey}=generateKeyPairSync('ed25519');
    const unsigned:Omit<UpdateManifest,'signature'>={updateId:'123e4567-e89b-42d3-a456-426614174001',product:'KINGMAST',softwareVersion:'0.0.7',artifactSha256:createHash('sha256').update(artifact).digest('hex'),targetPlatform:'kingmast-edge-linux',compatibleHardware:['bench-v1'],configurationSchemaVersion:'1',calibrationCompatibility:'v1',createdAt:new Date(now).toISOString(),signerKeyId:'scenario-key',rollbackIndex:7};
    const manifest:UpdateManifest={...unsigned,signature:sign(null,Buffer.from(canonicalUpdatePayload(unsigned)),privateKey).toString('base64')};
    const result=verifyUpdatePackage({manifest,artifact:Buffer.from('tampered-artifact'),publicKeyPem:publicKey.export({format:'pem',type:'spki'}).toString(),expectedPlatform:'kingmast-edge-linux',hardwareId:'bench-v1',minimumRollbackIndex:7,nowMs:now});
    expect(result).toEqual({verified:false,reason:'artifact-hash-mismatch'});
  });

  it('FI-006 HZ-009/HZ-011 blocks update eligibility while moving',()=>{
    const result=evaluateInstallEligibility({packageVerified:true,parked:true,speedKmh:7,powerStable:true,energyReserveOk:true,thermalOk:true,storageOk:true,criticalOperationActive:false});
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('vehicle-moving');
  });

  it('FI-007 HZ-010 rejects packet tampering after per-device signing',()=>{
    const secret='0123456789abcdef0123456789abcdef';
    const packet=edgePacket(7);
    const registry=parseDeviceKeyRegistry(JSON.stringify({'edge-fi':[{keyId:'active',secret,state:'active'}]}));
    const signature=signDevicePacket(packet,'active',secret);
    const tampered={...packet,gnss:{...packet.gnss,speedKmh:95}};
    expect(verifyDevicePacketAuth({packet:tampered,keyId:'active',signature,registry,nowMs:now})).toEqual({ok:false,reason:'device-signature-invalid'});
  });

  it('FI-008 HZ-010 rejects a revoked device credential',()=>{
    const secret='0123456789abcdef0123456789abcdef';
    const packet=edgePacket(8);
    const registry=parseDeviceKeyRegistry(JSON.stringify({'edge-fi':[{keyId:'revoked',secret,state:'revoked'}]}));
    const signature=signDevicePacket(packet,'revoked',secret);
    expect(verifyDevicePacketAuth({packet,keyId:'revoked',signature,registry,nowMs:now})).toEqual({ok:false,reason:'device-key-revoked'});
  });

  it('FI-009 HZ-009 requires rollback after post-install boot-health failure',()=>{
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage({updateId:'123e4567-e89b-42d3-a456-426614174009',softwareVersion:'0.0.7',rollbackIndex:7});
    lifecycle.markVerified();
    lifecycle.markReady({eligible:true,reasons:[]});
    lifecycle.beginInstall();
    lifecycle.markInstalled();
    expect(lifecycle.reportBootFailure('watchdog-reset').state).toBe('rollback-required');
  });

  it('FI-010 HZ-009 prevents install when package verification was skipped',()=>{
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage({updateId:'123e4567-e89b-42d3-a456-426614174010',softwareVersion:'0.0.7',rollbackIndex:7});
    expect(()=>lifecycle.beginInstall()).toThrow(/requires ready/);
  });

  it('FI-011 HZ-012 fails closed when bounded runtime capacity is exhausted',()=>{
    const limiter=new BoundedFixedWindowRateLimiter(1);
    expect(limiter.consume('client-a',10,now).allowed).toBe(true);
    expect(limiter.consume('client-b',10,now)).toEqual({allowed:false,retryAfterS:1,reason:'capacity'});
    expect(limiter.capacityRejected).toBe(1);
  });

  it('FI-012 HZ-006 treats discontinuous DMS evidence as unavailable',()=>{
    const samples:DriverMonitoringSample[]=[
      {timestampMs:now,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95},
      {timestampMs:now+1_000,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95},
      {timestampMs:now+5_000,faceDetected:true,eyesClosed:false,gazeAway:true,headYawDeg:40,headPitchDeg:0,confidence:.95},
      {timestampMs:now+6_000,faceDetected:true,eyesClosed:false,gazeAway:true,headYawDeg:40,headPitchDeg:0,confidence:.95},
    ];
    const result=assessDriverMonitoring(samples);
    expect(result.state).toBe('driver-unavailable');
    expect(result.reason).toBe('cabin-observation-discontinuous');
  });

  it('FI-013 HZ-008 degrades surround truth when calibration/synchronization is incomplete',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestSurround({timestampMs:now,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1.1},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1.2},
      {cameraId:'left',synchronized:false,calibrated:true,reprojectionErrorPx:1.4},
      {cameraId:'right',synchronized:true,calibrated:true,reprojectionErrorPx:3.6},
    ]});
    const result=runtime.snapshot(now+100,true).surround;
    expect(result.availability).toBe('degraded');
    expect(result.fullyReady).toBe(false);
    expect(result.readyCameraCount).toBe(2);
    expect(result.geometryConfidence).toBeLessThan(1);
  });

  it('FI-014 HZ-010 rejects tampering of Ed25519-authenticated edge packets',()=>{
    const{privateKey,publicKey}=generateKeyPairSync('ed25519');
    const privateKeyPem=privateKey.export({format:'pem',type:'pkcs8'}).toString();
    const publicKeyPem=publicKey.export({format:'pem',type:'spki'}).toString();
    const packet=edgePacket(14);
    const registry=parseDeviceKeyRegistry(JSON.stringify({'edge-fi':[{keyId:'ed-fi',algorithm:'ed25519',publicKeyPem,state:'active'}]}));
    const signature=signDevicePacketEd25519(packet,'ed-fi',privateKeyPem);
    expect(verifyDevicePacketAuth({packet,keyId:'ed-fi',signature,registry,nowMs:now}).ok).toBe(true);
    const tampered={...packet,sequence:15};
    expect(verifyDevicePacketAuth({packet:tampered,keyId:'ed-fi',signature,registry,nowMs:now})).toEqual({ok:false,reason:'device-signature-invalid'});
  });
});
