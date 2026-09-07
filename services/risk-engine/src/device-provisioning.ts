import {createHash,createPublicKey} from 'node:crypto';

export type ProvisioningKeyState='pending'|'active'|'revoked';

export interface ProvisionedDeviceKey {
  keyId:string;
  algorithm:'ed25519';
  publicKeyPem:string;
  publicKeyFingerprintSha256:string;
  state:ProvisioningKeyState;
  notBeforeMs:number|null;
  notAfterMs:number|null;
  enrolledAtMs:number;
  activatedAtMs:number|null;
  revokedAtMs:number|null;
  revocationReason:string|null;
}

export interface DeviceProvisioningSnapshot {
  deviceId:string;
  keys:ProvisionedDeviceKey[];
}

const ID_RE=/^[A-Za-z0-9._:-]{1,96}$/;

function assertId(name:string,value:string){
  if(!ID_RE.test(value))throw new Error(`${name} must match ${ID_RE}`);
}

function normalizeEd25519PublicKey(pem:string){
  const candidate=pem.trim();
  if(!candidate||candidate.length>4096)throw new Error('public key must be 1..4096 characters');
  if(/PRIVATE KEY/.test(candidate))throw new Error('device provisioning accepts public keys only');
  let key;
  try{key=createPublicKey(candidate);}catch{throw new Error('device provisioning requires a valid public key');}
  if(key.asymmetricKeyType!=='ed25519')throw new Error('device provisioning requires an Ed25519 public key');
  const publicKeyPem=key.export({type:'spki',format:'pem'}).toString().trim();
  const der=key.export({type:'spki',format:'der'});
  const publicKeyFingerprintSha256=createHash('sha256').update(der).digest('hex');
  return{publicKeyPem,publicKeyFingerprintSha256};
}

function cloneKey(key:ProvisionedDeviceKey):ProvisionedDeviceKey{return{...key};}

export class DeviceProvisioningRegistry {
  private readonly devices=new Map<string,ProvisionedDeviceKey[]>();

  constructor(private readonly maxDevices=1024,private readonly maxKeysPerDevice=4){
    if(!Number.isSafeInteger(maxDevices)||maxDevices<1||maxDevices>100_000)throw new Error('maxDevices must be between 1 and 100000');
    if(!Number.isSafeInteger(maxKeysPerDevice)||maxKeysPerDevice<1||maxKeysPerDevice>8)throw new Error('maxKeysPerDevice must be between 1 and 8');
  }

  enroll(input:{deviceId:string;keyId:string;publicKeyPem:string;notBeforeMs?:number|null;notAfterMs?:number|null},nowMs=Date.now()){
    const deviceId=input.deviceId.trim();
    const keyId=input.keyId.trim();
    assertId('deviceId',deviceId);
    assertId('keyId',keyId);
    if(!Number.isSafeInteger(nowMs)||nowMs<=0)throw new Error('nowMs must be a positive integer');
    const notBeforeMs=input.notBeforeMs??null;
    const notAfterMs=input.notAfterMs??null;
    if(notBeforeMs!==null&&(!Number.isSafeInteger(notBeforeMs)||notBeforeMs<=0))throw new Error('notBeforeMs must be a positive integer or null');
    if(notAfterMs!==null&&(!Number.isSafeInteger(notAfterMs)||notAfterMs<=0))throw new Error('notAfterMs must be a positive integer or null');
    if(notBeforeMs!==null&&notAfterMs!==null&&notAfterMs<=notBeforeMs)throw new Error('notAfterMs must be greater than notBeforeMs');
    const normalized=normalizeEd25519PublicKey(input.publicKeyPem);
    let keys=this.devices.get(deviceId);
    if(!keys){
      if(this.devices.size>=this.maxDevices)throw new Error('device provisioning capacity reached');
      keys=[];
      this.devices.set(deviceId,keys);
    }
    if(keys.some((item)=>item.keyId===keyId))throw new Error(`device ${deviceId} already contains key ${keyId}`);
    if(keys.length>=this.maxKeysPerDevice)throw new Error(`device ${deviceId} key capacity reached`);
    const record:ProvisionedDeviceKey={
      keyId,
      algorithm:'ed25519',
      publicKeyPem:normalized.publicKeyPem,
      publicKeyFingerprintSha256:normalized.publicKeyFingerprintSha256,
      state:'pending',
      notBeforeMs,
      notAfterMs,
      enrolledAtMs:nowMs,
      activatedAtMs:null,
      revokedAtMs:null,
      revocationReason:null,
    };
    keys.push(record);
    return cloneKey(record);
  }

  activate(deviceId:string,keyId:string,nowMs=Date.now()){
    const key=this.requireKey(deviceId,keyId);
    if(key.state==='revoked')throw new Error('revoked device key cannot be reactivated');
    if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs)throw new Error('device key is not yet valid');
    if(key.notAfterMs!==null&&nowMs>key.notAfterMs)throw new Error('device key is expired');
    key.state='active';
    key.activatedAtMs=key.activatedAtMs??nowMs;
    return cloneKey(key);
  }

  revoke(deviceId:string,keyId:string,reason:string,nowMs=Date.now()){
    const key=this.requireKey(deviceId,keyId);
    const normalizedReason=reason.trim();
    if(!normalizedReason||normalizedReason.length>160)throw new Error('revocation reason must be 1..160 characters');
    key.state='revoked';
    key.revokedAtMs=nowMs;
    key.revocationReason=normalizedReason;
    return cloneKey(key);
  }

  snapshot(deviceId:string):DeviceProvisioningSnapshot|null {
    const keys=this.devices.get(deviceId.trim());
    return keys?{deviceId:deviceId.trim(),keys:keys.map(cloneKey)}:null;
  }

  summary(nowMs=Date.now()){
    let pending=0,active=0,revoked=0,expired=0;
    for(const keys of this.devices.values())for(const key of keys){
      if(key.state==='revoked'){revoked+=1;continue;}
      if(key.notAfterMs!==null&&nowMs>key.notAfterMs){expired+=1;continue;}
      if(key.state==='active')active+=1;else pending+=1;
    }
    return{devices:this.devices.size,pending,active,revoked,expired,maxDevices:this.maxDevices,maxKeysPerDevice:this.maxKeysPerDevice,privateKeyCustody:'device-only' as const};
  }

  exportServerRegistry(){
    const output:Record<string,Array<{keyId:string;algorithm:'ed25519';publicKeyPem:string;state:'active'|'revoked';notBeforeMs?:number;notAfterMs?:number}>>={};
    for(const [deviceId,keys] of this.devices){
      const exportable=keys.filter((key)=>key.state!=='pending').map((key)=>({
        keyId:key.keyId,
        algorithm:'ed25519' as const,
        publicKeyPem:key.publicKeyPem,
        state:key.state as 'active'|'revoked',
        ...(key.notBeforeMs===null?{}:{notBeforeMs:key.notBeforeMs}),
        ...(key.notAfterMs===null?{}:{notAfterMs:key.notAfterMs}),
      }));
      if(exportable.length>0)output[deviceId]=exportable;
    }
    return output;
  }

  private requireKey(deviceId:string,keyId:string){
    const normalizedDeviceId=deviceId.trim();
    const normalizedKeyId=keyId.trim();
    const key=this.devices.get(normalizedDeviceId)?.find((candidate)=>candidate.keyId===normalizedKeyId);
    if(!key)throw new Error(`unknown device/key ${normalizedDeviceId}/${normalizedKeyId}`);
    return key;
  }
}
