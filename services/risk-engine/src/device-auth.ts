import { createHmac,timingSafeEqual } from 'node:crypto';
import type { EdgeTelemetryPacket } from '@kingmast/contracts';

export type DeviceKeyState='active'|'revoked';
export interface DeviceKeyRecord{
  keyId:string;
  secret:string;
  state:DeviceKeyState;
  notBeforeMs:number|null;
  notAfterMs:number|null;
}
export type DeviceKeyRegistry=Map<string,DeviceKeyRecord[]>;
export type DeviceAuthReason=
  | 'device-auth-not-configured'
  | 'device-key-id-required'
  | 'device-signature-required'
  | 'device-not-configured'
  | 'device-key-not-found'
  | 'device-key-revoked'
  | 'device-key-not-yet-valid'
  | 'device-key-expired'
  | 'device-signature-invalid';
export type DeviceAuthResult={ok:true;deviceId:string;keyId:string}|{ok:false;reason:DeviceAuthReason};

const KEY_ID_RE=/^[A-Za-z0-9._:-]{1,96}$/;
const SIGNATURE_RE=/^[a-f0-9]{64}$/i;

function stable(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map((key)=>`${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}
function equalHex(a:string,b:string){const left=Buffer.from(a,'hex');const right=Buffer.from(b,'hex');return left.length===right.length&&timingSafeEqual(left,right);}
function finiteOrNull(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>0?Math.trunc(value):null;}

export function parseDeviceKeyRegistry(raw:string):DeviceKeyRegistry{
  const registry:DeviceKeyRegistry=new Map();
  if(!raw.trim())return registry;
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw new Error('KINGMAST_DEVICE_KEYS_JSON must be valid JSON');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('KINGMAST_DEVICE_KEYS_JSON must be an object keyed by deviceId');
  for(const [deviceId,value] of Object.entries(parsed as Record<string,unknown>)){
    if(!deviceId||deviceId.length>96)throw new Error(`invalid deviceId in KINGMAST_DEVICE_KEYS_JSON: ${deviceId||'<empty>'}`);
    if(!Array.isArray(value)||value.length===0||value.length>4)throw new Error(`device ${deviceId} must define 1..4 keys`);
    const keys:DeviceKeyRecord[]=[];
    const ids=new Set<string>();
    for(const item of value){
      if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`device ${deviceId} contains an invalid key record`);
      const record=item as Record<string,unknown>;
      const keyId=typeof record.keyId==='string'?record.keyId.trim():'';
      const secret=typeof record.secret==='string'?record.secret:'';
      const state:DeviceKeyState=record.state==='revoked'?'revoked':'active';
      if(!KEY_ID_RE.test(keyId))throw new Error(`device ${deviceId} has an invalid keyId`);
      if(ids.has(keyId))throw new Error(`device ${deviceId} has duplicate keyId ${keyId}`);
      if(secret.length<32)throw new Error(`device ${deviceId} key ${keyId} must be at least 32 characters`);
      ids.add(keyId);
      const notBeforeMs=finiteOrNull(record.notBeforeMs);
      const notAfterMs=finiteOrNull(record.notAfterMs);
      if(notBeforeMs!==null&&notAfterMs!==null&&notAfterMs<=notBeforeMs)throw new Error(`device ${deviceId} key ${keyId} has an invalid validity window`);
      keys.push({keyId,secret,state,notBeforeMs,notAfterMs});
    }
    registry.set(deviceId,keys);
  }
  return registry;
}

export function deviceAuthSummary(registry:DeviceKeyRegistry,nowMs=Date.now()){
  let activeKeys=0,revokedKeys=0,expiredKeys=0,futureKeys=0;
  for(const keys of registry.values())for(const key of keys){
    if(key.state==='revoked'){revokedKeys+=1;continue;}
    if(key.notAfterMs!==null&&nowMs>key.notAfterMs){expiredKeys+=1;continue;}
    if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs){futureKeys+=1;continue;}
    activeKeys+=1;
  }
  return{configuredDevices:registry.size,activeKeys,revokedKeys,expiredKeys,futureKeys};
}

export function signDevicePacket(packet:EdgeTelemetryPacket,keyId:string,secret:string){
  const payload=`KINGMAST-EDGE-V1\n${packet.deviceId}\n${keyId}\n${packet.bootId}\n${packet.sequence}\n${packet.timestampMs}\n${stable(packet)}`;
  return createHmac('sha256',secret).update(payload).digest('hex');
}

export function verifyDevicePacketAuth(input:{packet:EdgeTelemetryPacket;keyId:string;signature:string;registry:DeviceKeyRegistry;nowMs?:number}):DeviceAuthResult{
  const {packet,registry}=input;
  const keyId=input.keyId.trim();
  const signature=input.signature.trim();
  const nowMs=input.nowMs??Date.now();
  if(registry.size===0)return{ok:false,reason:'device-auth-not-configured'};
  if(!KEY_ID_RE.test(keyId))return{ok:false,reason:'device-key-id-required'};
  if(!SIGNATURE_RE.test(signature))return{ok:false,reason:'device-signature-required'};
  const keys=registry.get(packet.deviceId);
  if(!keys)return{ok:false,reason:'device-not-configured'};
  const key=keys.find((candidate)=>candidate.keyId===keyId);
  if(!key)return{ok:false,reason:'device-key-not-found'};
  if(key.state==='revoked')return{ok:false,reason:'device-key-revoked'};
  if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs)return{ok:false,reason:'device-key-not-yet-valid'};
  if(key.notAfterMs!==null&&nowMs>key.notAfterMs)return{ok:false,reason:'device-key-expired'};
  const expected=signDevicePacket(packet,key.keyId,key.secret);
  if(!equalHex(signature.toLowerCase(),expected))return{ok:false,reason:'device-signature-invalid'};
  return{ok:true,deviceId:packet.deviceId,keyId:key.keyId};
}
