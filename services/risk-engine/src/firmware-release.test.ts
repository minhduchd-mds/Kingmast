import {generateKeyPairSync} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {createSignedUpdateManifest} from './firmware-release.js';
import {verifyUpdatePackage} from './update-verifier.js';

function ed25519(){
  const pair=generateKeyPairSync('ed25519');
  return{
    publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),
    privateKeyPem:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString(),
  };
}

const base={
  updateId:'11111111-1111-4111-8111-111111111111',
  softwareVersion:'0.0.7-test',
  targetPlatform:'esp32-research-edge',
  compatibleHardware:['esp32-devkit-v1'],
  configurationSchemaVersion:'v1',
  calibrationCompatibility:'bench-calibration-v1',
  signerKeyId:'release-2026-09-a',
  rollbackIndex:7,
  createdAtMs:1_800_000_000_000,
};

describe('createSignedUpdateManifest',()=>{
  it('creates a manifest accepted by the production verifier',()=>{
    const keys=ed25519();
    const artifact=Buffer.from('kingmast-firmware-bench-artifact-v1');
    const manifest=createSignedUpdateManifest({...base,artifact,privateKeyPem:keys.privateKeyPem});
    const verified=verifyUpdatePackage({
      manifest,
      artifact,
      publicKeyPem:keys.publicKeyPem,
      expectedPlatform:'esp32-research-edge',
      hardwareId:'esp32-devkit-v1',
      minimumRollbackIndex:7,
      nowMs:base.createdAtMs+1000,
    });
    expect(verified.verified).toBe(true);
    expect(manifest.signature.length).toBeGreaterThan(40);
  });

  it('detects artifact tampering after release signing',()=>{
    const keys=ed25519();
    const artifact=Buffer.from('original-firmware');
    const manifest=createSignedUpdateManifest({...base,artifact,privateKeyPem:keys.privateKeyPem});
    const result=verifyUpdatePackage({
      manifest,
      artifact:Buffer.from('tampered-firmware'),
      publicKeyPem:keys.publicKeyPem,
      expectedPlatform:'esp32-research-edge',
      hardwareId:'esp32-devkit-v1',
      minimumRollbackIndex:7,
      nowMs:base.createdAtMs+1000,
    });
    expect(result).toEqual({verified:false,reason:'artifact-hash-mismatch'});
  });

  it('rejects non-Ed25519 release keys',()=>{
    const rsa=generateKeyPairSync('rsa',{modulusLength:2048});
    const privateKeyPem=rsa.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    expect(()=>createSignedUpdateManifest({...base,artifact:Buffer.from('firmware'),privateKeyPem})).toThrow(/must be Ed25519/);
  });

  it('normalizes and deduplicates hardware compatibility before signing',()=>{
    const keys=ed25519();
    const manifest=createSignedUpdateManifest({...base,artifact:Buffer.from('firmware'),privateKeyPem:keys.privateKeyPem,compatibleHardware:['esp32-b',' esp32-a ','esp32-b']});
    expect(manifest.compatibleHardware).toEqual(['esp32-a','esp32-b']);
  });
});
