import { createHmac,createPublicKey,sign as signSignature,timingSafeEqual,verify as verifySignature } from 'node:crypto';
import type { EdgeTelemetryPacket } from '@kingmast/contracts';

export type DeviceKeyState='active'|'revoked';
export type DeviceKeyAlgorithm='hmac-sha256'|'ed25519';
export interface DeviceKeyRecord{
  keyId:string;
  algorithm:DeviceKeyAlgorithm;
  secret:string|null;
  publicKeyPem:string|null;
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
const HMAC_SIGNATURE_RE=/^[a-f0-9]{64}$/i;
const BASE64_RE=/^[A-Za-z0-9+/]+={0,2}$/;

function stable(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map((key)=>`${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}
function equalHex(a:string,b:string){const left=Buffer.from(a,'hex');const right=Buffer.from(b,'hex');return left.length===right.length&&timingSafeEqual(left,right);}
function optionalTime(deviceId:string,keyId:string,field:string,value:unknown){
  if(value===undefined||value===null)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new Error(`device ${deviceId} key ${keyId} has invalid ${field}`);
  return Math.trunc(value);
}
function canonicalDevicePacketPayload(packet:EdgeTelemetryPacket,keyId:string){
  return Buffer.from(`KINGMAST-EDGE-V1\n${packet.deviceId}\n${keyId}\n${packet.bootId}\n${packet.sequence}\n${packet.timestampMs}\n${stable(packet)}`);
}
function validateEd25519PublicKey(deviceId:string,keyId:string,pem:string){
  if(pem.length>4096)throw new Error(`device ${deviceId} key ${keyId} public key is too large`);
  try{
    const key=createPublicKey(pem);
    if(key.asymmetricKeyType!=='ed25519')throw new Error('not-ed25519');
  }catch{throw new Error(`device ${deviceId} key ${keyId} must contain a valid Ed25519 public key`);}
}
function parseAlgorithm(record:Record<string,unknown>):DeviceKeyAlgorithm{
  if(record.algorithm===undefined)return typeof record.publicKeyPem==='string'&&record.publicKeyPem.trim()?'ed25519':'hmac-sha256';
  if(record.algorithm==='hmac-sha256'||record.algorithm==='ed25519')return record.algorithm;
  throw new Error('device key algorithm must be hmac-sha256 or ed25519');
}

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
      if(!KEY_ID_RE.test(keyId))throw new Error(`device ${deviceId} has an invalid keyId`);
      if(ids.has(keyId))throw new Error(`device ${deviceId} has duplicate keyId ${keyId}`);
      const algorithm=parseAlgorithm(record);
      let secret:string|null=null;
      let publicKeyPem:string|null=null;
      if(algorithm==='hmac-sha256'){
        secret=typeof record.secret==='string'?record.secret:'';
        if(secret.length<32)throw new Error(`device ${deviceId} key ${keyId} must be at least 32 characters`);
        if(typeof record.publicKeyPem==='string'&&record.publicKeyPem.trim())throw new Error(`device ${deviceId} key ${keyId} cannot mix HMAC secret and publicKeyPem`);
      }else{
        if(typeof record.secret==='string'&&record.secret)throw new Error(`device ${deviceId} key ${keyId} Ed25519 record must not contain a shared secret`);
        publicKeyPem=typeof record.publicKeyPem==='string'?record.publicKeyPem.trim():'';
        if(!publicKeyPem)throw new Error(`device ${deviceId} key ${keyId} requires publicKeyPem`);
        validateEd25519PublicKey(deviceId,keyId,publicKeyPem);
      }
      let state:DeviceKeyState='active';
      if(record.state!==undefined){
        if(record.state!=='active'&&record.state!=='revoked')throw new Error(`device ${deviceId} key ${keyId} has invalid state`);
        state=record.state;
      }
      ids.add(keyId);
      const notBeforeMs=optionalTime(deviceId,keyId,'notBeforeMs',record.notBeforeMs);
      const notAfterMs=optionalTime(deviceId,keyId,'notAfterMs',record.notAfterMs);
      if(notBeforeMs!==null&&notAfterMs!==null&&notAfterMs<=notBeforeMs)throw new Error(`device ${deviceId} key ${keyId} has an invalid validity window`);
      keys.push({keyId,algorithm,secret,publicKeyPem,state,notBeforeMs,notAfterMs});
    }
    registry.set(deviceId,keys);
  }
  return registry;
}

export function deviceAuthSummary(registry:DeviceKeyRegistry,nowMs=Date.now()){
  let activeKeys=0,revokedKeys=0,expiredKeys=0,futureKeys=0,hmacKeys=0,ed25519Keys=0;
  for(const keys of registry.values())for(const key of keys){
    if(key.algorithm==='ed25519')ed25519Keys+=1;else hmacKeys+=1;
    if(key.state==='revoked'){revokedKeys+=1;continue;}
    if(key.notAfterMs!==null&&nowMs>key.notAfterMs){expiredKeys+=1;continue;}
    if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs){futureKeys+=1;continue;}
    activeKeys+=1;
  }
  return{configuredDevices:registry.size,activeKeys,revokedKeys,expiredKeys,futureKeys,hmacKeys,ed25519Keys};
}

export function signDevicePacket(packet:EdgeTelemetryPacket,keyId:string,secret:string){
  return createHmac('sha256',secret).update(canonicalDevicePacketPayload(packet,keyId)).digest('hex');
}

export function signDevicePacketEd25519(packet:EdgeTelemetryPacket,keyId:string,privateKeyPem:string){
  return signSignature(null,canonicalDevicePacketPayload(packet,keyId),privateKeyPem).toString('base64');
}

function verifyEd25519(signature:string,payload:Buffer,publicKeyPem:string){
  if(signature.length>256||!BASE64_RE.test(signature))return false;
  let decoded:Buffer;
  try{decoded=Buffer.from(signature,'base64');}catch{return false;}
  if(decoded.length!==64||decoded.toString('base64')!==signature)return false;
  try{return verifySignature(null,payload,publicKeyPem,decoded);}catch{return false;}
}

export function verifyDevicePacketAuth(input:{packet:EdgeTelemetryPacket;keyId:string;signature:string;registry:DeviceKeyRegistry;nowMs?:number}):DeviceAuthResult{
  const {packet,registry}=input;
  const keyId=input.keyId.trim();
  const signature=input.signature.trim();
  const nowMs=input.nowMs??Date.now();
  if(registry.size===0)return{ok:false,reason:'device-auth-not-configured'};
  if(!KEY_ID_RE.test(keyId))return{ok:false,reason:'device-key-id-required'};
  if(!signature||signature.length>512)return{ok:false,reason:'device-signature-required'};
  const keys=registry.get(packet.deviceId);
  if(!keys)return{ok:false,reason:'device-not-configured'};
  const key=keys.find((candidate)=>candidate.keyId===keyId);
  if(!key)return{ok:false,reason:'device-key-not-found'};
  if(key.state==='revoked')return{ok:false,reason:'device-key-revoked'};
  if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs)return{ok:false,reason:'device-key-not-yet-valid'};
  if(key.notAfterMs!==null&&nowMs>key.notAfterMs)return{ok:false,reason:'device-key-expired'};
  const payload=canonicalDevicePacketPayload(packet,key.keyId);
  if(key.algorithm==='hmac-sha256'){
    if(!HMAC_SIGNATURE_RE.test(signature)||!key.secret)return{ok:false,reason:'device-signature-invalid'};
    const expected=createHmac('sha256',key.secret).update(payload).digest('hex');
    if(!equalHex(signature.toLowerCase(),expected))return{ok:false,reason:'device-signature-invalid'};
  }else{
    if(!key.publicKeyPem||!verifyEd25519(signature,payload,key.publicKeyPem))return{ok:false,reason:'device-signature-invalid'};
  }
  return{ok:true,deviceId:packet.deviceId,keyId:key.keyId};
}
