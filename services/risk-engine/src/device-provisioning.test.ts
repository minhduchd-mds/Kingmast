import {generateKeyPairSync} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {parseDeviceKeyRegistry} from './device-auth.js';
import {DeviceProvisioningRegistry} from './device-provisioning.js';

function ed25519(){
  const pair=generateKeyPairSync('ed25519');
  return{
    publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),
    privateKeyPem:pair.privateKey.export({type:'pkcs8',format:'pem'}).toString(),
  };
}

describe('DeviceProvisioningRegistry',()=>{
  it('enrolls public identity, activates rotation and exports device-auth compatible registry',()=>{
    const registry=new DeviceProvisioningRegistry(10,4);
    const oldKey=ed25519();
    const nextKey=ed25519();
    registry.enroll({deviceId:'edge-01',keyId:'2026-09-a',publicKeyPem:oldKey.publicKeyPem},1000);
    registry.activate('edge-01','2026-09-a',1100);
    registry.enroll({deviceId:'edge-01',keyId:'2026-10-b',publicKeyPem:nextKey.publicKeyPem,notBeforeMs:1200},1150);
    registry.activate('edge-01','2026-10-b',1200);
    registry.revoke('edge-01','2026-09-a','rotation-complete',1300);
    const exported=registry.exportServerRegistry();
    const parsed=parseDeviceKeyRegistry(JSON.stringify(exported));
    expect(parsed.get('edge-01')).toHaveLength(2);
    expect(parsed.get('edge-01')?.find((key)=>key.keyId==='2026-09-a')?.state).toBe('revoked');
    expect(parsed.get('edge-01')?.find((key)=>key.keyId==='2026-10-b')?.state).toBe('active');
    expect(registry.summary(1300)).toMatchObject({devices:1,active:1,revoked:1,privateKeyCustody:'device-only'});
  });

  it('never accepts private key material as provisioning input',()=>{
    const registry=new DeviceProvisioningRegistry();
    const key=ed25519();
    expect(()=>registry.enroll({deviceId:'edge-01',keyId:'bad',publicKeyPem:key.privateKeyPem})).toThrow(/public keys only/);
  });

  it('keeps pending keys out of the runtime authentication registry',()=>{
    const registry=new DeviceProvisioningRegistry();
    registry.enroll({deviceId:'edge-01',keyId:'pending-a',publicKeyPem:ed25519().publicKeyPem});
    expect(registry.exportServerRegistry()).toEqual({});
  });

  it('fails closed at bounded device and key capacity',()=>{
    const registry=new DeviceProvisioningRegistry(1,1);
    registry.enroll({deviceId:'edge-01',keyId:'a',publicKeyPem:ed25519().publicKeyPem});
    expect(()=>registry.enroll({deviceId:'edge-01',keyId:'b',publicKeyPem:ed25519().publicKeyPem})).toThrow(/key capacity/);
    expect(()=>registry.enroll({deviceId:'edge-02',keyId:'a',publicKeyPem:ed25519().publicKeyPem})).toThrow(/device provisioning capacity/);
  });

  it('does not reactivate revoked credentials',()=>{
    const registry=new DeviceProvisioningRegistry();
    registry.enroll({deviceId:'edge-01',keyId:'a',publicKeyPem:ed25519().publicKeyPem});
    registry.activate('edge-01','a');
    registry.revoke('edge-01','a','compromised');
    expect(()=>registry.activate('edge-01','a')).toThrow(/cannot be reactivated/);
  });
});
