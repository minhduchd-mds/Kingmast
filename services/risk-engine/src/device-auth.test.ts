import { generateKeyPairSync } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import type { EdgeTelemetryPacket,SensorHealth } from '@kingmast/contracts';
import { deviceAuthSummary,parseDeviceKeyRegistry,signDevicePacket,signDevicePacketEd25519,verifyDevicePacketAuth } from './device-auth.js';

const now=1_800_000_000_000;
const sensors:SensorHealth={radarFront:'ok',radarRear:'unavailable',camera:'ok',can:'unavailable',gnssImu:'ok',ecu:'ok'};
const packet:EdgeTelemetryPacket={protocolVersion:1,deviceId:'edge-1',bootId:'boot-001',sequence:42,timestampMs:now,gnss:{lat:21.0285,lng:105.8542,speedKmh:40,headingDeg:12,accuracyM:3,timestampMs:now,source:'gnss'},sensors};
const secret='0123456789abcdef0123456789abcdef';
const ed25519=generateKeyPairSync('ed25519');
const publicKeyPem=ed25519.publicKey.export({format:'pem',type:'spki'}).toString();
const privateKeyPem=ed25519.privateKey.export({format:'pem',type:'pkcs8'}).toString();

function registry(){return parseDeviceKeyRegistry(JSON.stringify({'edge-1':[
  {keyId:'k-active',algorithm:'hmac-sha256',secret,state:'active',notBeforeMs:now-60_000,notAfterMs:now+60_000},
  {keyId:'k-ed25519',algorithm:'ed25519',publicKeyPem,state:'active'},
  {keyId:'k-revoked',secret:'abcdef0123456789abcdef0123456789',state:'revoked'},
]}));}

describe('device packet authentication',()=>{
  it('accepts a packet signed by the configured active HMAC per-device key',()=>{
    const signature=signDevicePacket(packet,'k-active',secret);
    expect(verifyDevicePacketAuth({packet,keyId:'k-active',signature,registry:registry(),nowMs:now})).toEqual({ok:true,deviceId:'edge-1',keyId:'k-active'});
  });

  it('accepts Ed25519 packet signatures without storing a device shared secret',()=>{
    const signature=signDevicePacketEd25519(packet,'k-ed25519',privateKeyPem);
    expect(verifyDevicePacketAuth({packet,keyId:'k-ed25519',signature,registry:registry(),nowMs:now})).toEqual({ok:true,deviceId:'edge-1',keyId:'k-ed25519'});
    const configured=registry().get('edge-1')!.find((key)=>key.keyId==='k-ed25519')!;
    expect(configured.secret).toBeNull();
    expect(configured.publicKeyPem).toContain('BEGIN PUBLIC KEY');
  });

  it('rejects tampering after HMAC or Ed25519 signing',()=>{
    const hmacSignature=signDevicePacket(packet,'k-active',secret);
    const edSignature=signDevicePacketEd25519(packet,'k-ed25519',privateKeyPem);
    const tampered={...packet,sequence:packet.sequence+1};
    expect(verifyDevicePacketAuth({packet:tampered,keyId:'k-active',signature:hmacSignature,registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-signature-invalid'});
    expect(verifyDevicePacketAuth({packet:tampered,keyId:'k-ed25519',signature:edSignature,registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-signature-invalid'});
  });

  it('rejects revoked and unknown device keys',()=>{
    const revokedSignature=signDevicePacket(packet,'k-revoked','abcdef0123456789abcdef0123456789');
    expect(verifyDevicePacketAuth({packet,keyId:'k-revoked',signature:revokedSignature,registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-key-revoked'});
    expect(verifyDevicePacketAuth({packet:{...packet,deviceId:'edge-2'},keyId:'k-active',signature:'0'.repeat(64),registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-not-configured'});
  });

  it('tracks lifecycle and algorithm counts without exposing key material',()=>{
    const parsed=parseDeviceKeyRegistry(JSON.stringify({'edge-1':[
      {keyId:'active',secret,state:'active'},
      {keyId:'ed',algorithm:'ed25519',publicKeyPem,state:'active'},
      {keyId:'revoked',secret:'abcdef0123456789abcdef0123456789',state:'revoked'},
      {keyId:'expired',secret:'fedcba9876543210fedcba9876543210',state:'active',notAfterMs:now-1},
    ],'edge-2':[
      {keyId:'future',secret:'00112233445566778899aabbccddeeff',state:'active',notBeforeMs:now+1},
    ]}));
    expect(deviceAuthSummary(parsed,now)).toEqual({configuredDevices:2,activeKeys:2,revokedKeys:1,expiredKeys:1,futureKeys:1,hmacKeys:4,ed25519Keys:1,algorithm:'HMAC-SHA256+Ed25519',preferredProductionIntent:'Ed25519'});
  });

  it('reports Ed25519 when only asymmetric device credentials are configured',()=>{
    const parsed=parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'ed',algorithm:'ed25519',publicKeyPem,state:'active'}]}));
    expect(deviceAuthSummary(parsed,now).algorithm).toBe('Ed25519');
  });

  it('fails configuration on weak secrets, duplicate ids, mixed credentials or invalid asymmetric keys',()=>{
    expect(()=>parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'k1',secret:'weak'}]}))).toThrow(/at least 32/);
    expect(()=>parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'k1',secret},{keyId:'k1',secret}]}))).toThrow(/duplicate/);
    expect(()=>parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'k1',algorithm:'ed25519',secret,publicKeyPem}]}))).toThrow(/must not contain a shared secret/);
    expect(()=>parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'k1',algorithm:'ed25519',publicKeyPem:'not-a-key'}]}))).toThrow(/valid Ed25519 public key/);
  });
});
