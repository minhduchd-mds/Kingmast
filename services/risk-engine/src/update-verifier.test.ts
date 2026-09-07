import { createHash,generateKeyPairSync,sign } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { canonicalUpdatePayload,evaluateInstallEligibility,verifyUpdatePackage,type UpdateManifest } from './update-verifier.js';

const artifact=Buffer.from('KINGMAST-update-artifact-v006');
const artifactSha256=createHash('sha256').update(artifact).digest('hex');
const{privateKey,publicKey}=generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({format:'pem',type:'spki'}).toString();
const nowMs=1_800_000_000_000;

function signedManifest(patch:Partial<UpdateManifest>={}):UpdateManifest{
  const unsigned:Omit<UpdateManifest,'signature'>={
    updateId:'123e4567-e89b-42d3-a456-426614174000',
    product:'KINGMAST',
    softwareVersion:'0.0.7',
    artifactSha256,
    targetPlatform:'kingmast-edge-linux',
    compatibleHardware:['bench-v1','edge-v2'],
    configurationSchemaVersion:'1',
    calibrationCompatibility:'v1',
    createdAt:new Date(nowMs).toISOString(),
    signerKeyId:'release-key-2026-01',
    rollbackIndex:7,
    ...Object.fromEntries(Object.entries(patch).filter(([key])=>key!=='signature')),
  } as Omit<UpdateManifest,'signature'>;
  const signature=sign(null,Buffer.from(canonicalUpdatePayload(unsigned)),privateKey).toString('base64');
  return{...unsigned,signature:patch.signature??signature};
}

describe('verifyUpdatePackage',()=>{
  it('accepts a correctly signed compatible artifact',()=>{
    const result=verifyUpdatePackage({manifest:signedManifest(),artifact,publicKeyPem,expectedPlatform:'kingmast-edge-linux',hardwareId:'bench-v1',minimumRollbackIndex:7,nowMs});
    expect(result.verified).toBe(true);
  });
  it('rejects artifact tampering before installation',()=>{
    const result=verifyUpdatePackage({manifest:signedManifest(),artifact:Buffer.from('tampered'),publicKeyPem,expectedPlatform:'kingmast-edge-linux',hardwareId:'bench-v1',minimumRollbackIndex:7,nowMs});
    expect(result).toEqual({verified:false,reason:'artifact-hash-mismatch'});
  });
  it('rejects rollback below the monotonic policy floor',()=>{
    const result=verifyUpdatePackage({manifest:signedManifest({rollbackIndex:6}),artifact,publicKeyPem,expectedPlatform:'kingmast-edge-linux',hardwareId:'bench-v1',minimumRollbackIndex:7,nowMs});
    expect(result).toEqual({verified:false,reason:'rollback-rejected'});
  });
  it('rejects a valid signature when the target hardware is incompatible',()=>{
    const result=verifyUpdatePackage({manifest:signedManifest(),artifact,publicKeyPem,expectedPlatform:'kingmast-edge-linux',hardwareId:'unknown-hardware',minimumRollbackIndex:7,nowMs});
    expect(result).toEqual({verified:false,reason:'incompatible-target'});
  });
  it('rejects a manifest signed by an untrusted key',()=>{
    const other=generateKeyPairSync('ed25519').publicKey.export({format:'pem',type:'spki'}).toString();
    const result=verifyUpdatePackage({manifest:signedManifest(),artifact,publicKeyPem:other,expectedPlatform:'kingmast-edge-linux',hardwareId:'bench-v1',minimumRollbackIndex:7,nowMs});
    expect(result).toEqual({verified:false,reason:'signature-invalid'});
  });
});

describe('evaluateInstallEligibility',()=>{
  const ready={packageVerified:true,parked:true,speedKmh:0,powerStable:true,energyReserveOk:true,thermalOk:true,storageOk:true,criticalOperationActive:false};
  it('requires verified parked and stationary state plus healthy install preconditions',()=>{
    expect(evaluateInstallEligibility(ready)).toEqual({eligible:true,reasons:[]});
  });
  it('fails closed when motion state is unknown or the package is not verified',()=>{
    const result=evaluateInstallEligibility({...ready,packageVerified:false,speedKmh:null});
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('package-not-verified');
    expect(result.reasons).toContain('vehicle-motion-state-unverified');
  });
  it('blocks installation while the vehicle is moving',()=>{
    const result=evaluateInstallEligibility({...ready,speedKmh:12});
    expect(result).toEqual({eligible:false,reasons:['vehicle-moving']});
  });
});
