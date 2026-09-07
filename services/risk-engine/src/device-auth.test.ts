import { describe,expect,it } from 'vitest';
import type { EdgeTelemetryPacket,SensorHealth } from '@kingmast/contracts';
import { deviceAuthSummary,parseDeviceKeyRegistry,signDevicePacket,verifyDevicePacketAuth } from './device-auth.js';

const now=1_800_000_000_000;
const sensors:SensorHealth={radarFront:'ok',radarRear:'unavailable',camera:'ok',can:'unavailable',gnssImu:'ok',ecu:'ok'};
const packet:EdgeTelemetryPacket={protocolVersion:1,deviceId:'edge-1',bootId:'boot-001',sequence:42,timestampMs:now,gnss:{lat:21.0285,lng:105.8542,speedKmh:40,headingDeg:12,accuracyM:3,timestampMs:now,source:'gnss'},sensors};
const secret='0123456789abcdef0123456789abcdef';

function registry(){return parseDeviceKeyRegistry(JSON.stringify({'edge-1':[
  {keyId:'k-active',secret,state:'active',notBeforeMs:now-60_000,notAfterMs:now+60_000},
  {keyId:'k-revoked',secret:'abcdef0123456789abcdef0123456789',state:'revoked'},
]}));}

describe('device packet authentication',()=>{
  it('accepts a packet signed by the configured active per-device key',()=>{
    const signature=signDevicePacket(packet,'k-active',secret);
    expect(verifyDevicePacketAuth({packet,keyId:'k-active',signature,registry:registry(),nowMs:now})).toEqual({ok:true,deviceId:'edge-1',keyId:'k-active'});
  });

  it('rejects tampering after signing',()=>{
    const signature=signDevicePacket(packet,'k-active',secret);
    const tampered={...packet,sequence:packet.sequence+1};
    expect(verifyDevicePacketAuth({packet:tampered,keyId:'k-active',signature,registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-signature-invalid'});
  });

  it('rejects revoked and unknown device keys',()=>{
    const revokedSignature=signDevicePacket(packet,'k-revoked','abcdef0123456789abcdef0123456789');
    expect(verifyDevicePacketAuth({packet,keyId:'k-revoked',signature:revokedSignature,registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-key-revoked'});
    expect(verifyDevicePacketAuth({packet:{...packet,deviceId:'edge-2'},keyId:'k-active',signature:'0'.repeat(64),registry:registry(),nowMs:now})).toEqual({ok:false,reason:'device-not-configured'});
  });

  it('tracks active/revoked/expired/future keys without exposing secret material',()=>{
    const parsed=parseDeviceKeyRegistry(JSON.stringify({'edge-1':[
      {keyId:'active',secret,state:'active'},
      {keyId:'revoked',secret:'abcdef0123456789abcdef0123456789',state:'revoked'},
      {keyId:'expired',secret:'fedcba9876543210fedcba9876543210',state:'active',notAfterMs:now-1},
      {keyId:'future',secret:'00112233445566778899aabbccddeeff',state:'active',notBeforeMs:now+1},
    ]}));
    expect(deviceAuthSummary(parsed,now)).toEqual({configuredDevices:1,activeKeys:1,revokedKeys:1,expiredKeys:1,futureKeys:1});
  });

  it('fails configuration on weak secrets or duplicate key ids',()=>{
    expect(()=>parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'k1',secret:'weak'}]}))).toThrow(/at least 32/);
    expect(()=>parseDeviceKeyRegistry(JSON.stringify({'edge-1':[{keyId:'k1',secret},{keyId:'k1',secret}]}))).toThrow(/duplicate/);
  });
});
