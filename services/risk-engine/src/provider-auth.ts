import {createHmac,createPublicKey,sign as signSignature,timingSafeEqual,verify as verifySignature} from 'node:crypto';

export type ProviderScope='road-context:cameras'|'connected-road:provider'|'connected-road:v2x';
export type ProviderKeyAlgorithm='hmac-sha256'|'ed25519';
export type ProviderKeyState='active'|'revoked';
export interface ProviderKeyRecord{
  keyId:string;
  algorithm:ProviderKeyAlgorithm;
  secret:string|null;
  publicKeyPem:string|null;
  state:ProviderKeyState;
  scopes:ProviderScope[];
  notBeforeMs:number|null;
  notAfterMs:number|null;
}
export type ProviderKeyRegistry=Map<string,ProviderKeyRecord[]>;
export type ProviderAuthReason=
  | 'provider-auth-not-configured'
  | 'provider-id-required'
  | 'provider-key-id-required'
  | 'provider-signature-required'
  | 'provider-timestamp-required'
  | 'provider-clock-skew'
  | 'provider-not-configured'
  | 'provider-key-not-found'
  | 'provider-key-revoked'
  | 'provider-key-not-yet-valid'
  | 'provider-key-expired'
  | 'provider-scope-denied'
  | 'provider-signature-invalid';
export type ProviderAuthResult={ok:true;providerId:string;keyId:string;algorithm:ProviderKeyAlgorithm}|{ok:false;reason:ProviderAuthReason};

const KEY_ID_RE=/^[A-Za-z0-9._:-]{1,96}$/;
const PROVIDER_ID_RE=/^[A-Za-z0-9._:-]{2,96}$/;
const HMAC_SIGNATURE_RE=/^[a-f0-9]{64}$/i;
const BASE64_RE=/^[A-Za-z0-9+/]+={0,2}$/;
const ALL_SCOPES:ProviderScope[]=['road-context:cameras','connected-road:provider','connected-road:v2x'];

function stable(value:unknown):string{
  if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).filter((key)=>key!=='security').sort().map((key)=>`${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}
function optionalTime(providerId:string,keyId:string,field:string,value:unknown){
  if(value===undefined||value===null)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new Error(`provider ${providerId} key ${keyId} has invalid ${field}`);
  return Math.trunc(value);
}
function parseScopes(providerId:string,keyId:string,value:unknown):ProviderScope[]{
  if(value===undefined)return [...ALL_SCOPES];
  if(!Array.isArray(value)||value.length===0||value.length>ALL_SCOPES.length)throw new Error(`provider ${providerId} key ${keyId} must define 1..${ALL_SCOPES.length} scopes`);
  const scopes=[...new Set(value)];
  if(scopes.some((scope)=>typeof scope!=='string'||!ALL_SCOPES.includes(scope as ProviderScope)))throw new Error(`provider ${providerId} key ${keyId} has invalid scope`);
  return scopes as ProviderScope[];
}
function validateEd25519PublicKey(providerId:string,keyId:string,pem:string){
  if(pem.length>4096)throw new Error(`provider ${providerId} key ${keyId} public key is too large`);
  try{const key=createPublicKey(pem);if(key.asymmetricKeyType!=='ed25519')throw new Error('not-ed25519');}
  catch{throw new Error(`provider ${providerId} key ${keyId} must contain a valid Ed25519 public key`);}
}
function parseAlgorithm(record:Record<string,unknown>):ProviderKeyAlgorithm{
  if(record.algorithm===undefined)return typeof record.publicKeyPem==='string'&&record.publicKeyPem.trim()?'ed25519':'hmac-sha256';
  if(record.algorithm==='hmac-sha256'||record.algorithm==='ed25519')return record.algorithm;
  throw new Error('provider key algorithm must be hmac-sha256 or ed25519');
}
function canonicalPayload(scope:ProviderScope,providerId:string,keyId:string,timestampMs:number,payload:unknown){
  return Buffer.from(`KINGMAST-PROVIDER-V1\n${scope}\n${providerId}\n${keyId}\n${timestampMs}\n${stable(payload)}`);
}
function equalHex(a:string,b:string){const left=Buffer.from(a,'hex');const right=Buffer.from(b,'hex');return left.length===right.length&&timingSafeEqual(left,right);}
function verifyEd25519(signature:string,payload:Buffer,publicKeyPem:string){
  if(signature.length>256||!BASE64_RE.test(signature))return false;
  let decoded:Buffer;
  try{decoded=Buffer.from(signature,'base64');}catch{return false;}
  if(decoded.length!==64||decoded.toString('base64')!==signature)return false;
  try{return verifySignature(null,payload,publicKeyPem,decoded);}catch{return false;}
}

export function parseProviderKeyRegistry(raw:string):ProviderKeyRegistry{
  const registry:ProviderKeyRegistry=new Map();
  if(!raw.trim())return registry;
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw new Error('KINGMAST_PROVIDER_KEYS_JSON must be valid JSON');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('KINGMAST_PROVIDER_KEYS_JSON must be an object keyed by providerId');
  for(const [providerId,value] of Object.entries(parsed as Record<string,unknown>)){
    if(!PROVIDER_ID_RE.test(providerId))throw new Error(`invalid providerId in KINGMAST_PROVIDER_KEYS_JSON: ${providerId||'<empty>'}`);
    if(!Array.isArray(value)||value.length===0||value.length>8)throw new Error(`provider ${providerId} must define 1..8 keys`);
    const keys:ProviderKeyRecord[]=[];
    const ids=new Set<string>();
    for(const item of value){
      if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`provider ${providerId} contains an invalid key record`);
      const record=item as Record<string,unknown>;
      const keyId=typeof record.keyId==='string'?record.keyId.trim():'';
      if(!KEY_ID_RE.test(keyId))throw new Error(`provider ${providerId} has an invalid keyId`);
      if(ids.has(keyId))throw new Error(`provider ${providerId} has duplicate keyId ${keyId}`);
      const algorithm=parseAlgorithm(record);
      let secret:string|null=null;
      let publicKeyPem:string|null=null;
      if(algorithm==='hmac-sha256'){
        secret=typeof record.secret==='string'?record.secret:'';
        if(secret.length<32)throw new Error(`provider ${providerId} key ${keyId} must be at least 32 characters`);
        if(typeof record.publicKeyPem==='string'&&record.publicKeyPem.trim())throw new Error(`provider ${providerId} key ${keyId} cannot mix HMAC secret and publicKeyPem`);
      }else{
        if(typeof record.secret==='string'&&record.secret)throw new Error(`provider ${providerId} key ${keyId} Ed25519 record must not contain a shared secret`);
        publicKeyPem=typeof record.publicKeyPem==='string'?record.publicKeyPem.trim():'';
        if(!publicKeyPem)throw new Error(`provider ${providerId} key ${keyId} requires publicKeyPem`);
        validateEd25519PublicKey(providerId,keyId,publicKeyPem);
      }
      const state=record.state===undefined?'active':record.state;
      if(state!=='active'&&state!=='revoked')throw new Error(`provider ${providerId} key ${keyId} has invalid state`);
      const notBeforeMs=optionalTime(providerId,keyId,'notBeforeMs',record.notBeforeMs);
      const notAfterMs=optionalTime(providerId,keyId,'notAfterMs',record.notAfterMs);
      if(notBeforeMs!==null&&notAfterMs!==null&&notAfterMs<=notBeforeMs)throw new Error(`provider ${providerId} key ${keyId} has invalid validity window`);
      ids.add(keyId);
      keys.push({keyId,algorithm,secret,publicKeyPem,state,scopes:parseScopes(providerId,keyId,record.scopes),notBeforeMs,notAfterMs});
    }
    registry.set(providerId,keys);
  }
  return registry;
}

export function providerAuthSummary(registry:ProviderKeyRegistry,nowMs=Date.now()){
  let activeKeys=0,revokedKeys=0,expiredKeys=0,futureKeys=0,hmacKeys=0,ed25519Keys=0;
  for(const keys of registry.values())for(const key of keys){
    if(key.algorithm==='ed25519')ed25519Keys+=1;else hmacKeys+=1;
    if(key.state==='revoked'){revokedKeys+=1;continue;}
    if(key.notAfterMs!==null&&nowMs>key.notAfterMs){expiredKeys+=1;continue;}
    if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs){futureKeys+=1;continue;}
    activeKeys+=1;
  }
  return{configuredProviders:registry.size,activeKeys,revokedKeys,expiredKeys,futureKeys,hmacKeys,ed25519Keys,preferredProductionIntent:'Ed25519+mTLS' as const};
}

export function signProviderRequest(scope:ProviderScope,providerId:string,keyId:string,timestampMs:number,payload:unknown,secret:string){
  return createHmac('sha256',secret).update(canonicalPayload(scope,providerId,keyId,timestampMs,payload)).digest('hex');
}
export function signProviderRequestEd25519(scope:ProviderScope,providerId:string,keyId:string,timestampMs:number,payload:unknown,privateKeyPem:string){
  return signSignature(null,canonicalPayload(scope,providerId,keyId,timestampMs,payload),privateKeyPem).toString('base64');
}

export function verifyProviderAuth(input:{scope:ProviderScope;providerId:string;keyId:string;signature:string;timestampMs:number;payload:unknown;registry:ProviderKeyRegistry;nowMs?:number;maxSkewMs?:number}):ProviderAuthResult{
  const providerId=input.providerId.trim();
  const keyId=input.keyId.trim();
  const signature=input.signature.trim();
  const nowMs=input.nowMs??Date.now();
  const maxSkewMs=input.maxSkewMs??30_000;
  if(input.registry.size===0)return{ok:false,reason:'provider-auth-not-configured'};
  if(!PROVIDER_ID_RE.test(providerId))return{ok:false,reason:'provider-id-required'};
  if(!KEY_ID_RE.test(keyId))return{ok:false,reason:'provider-key-id-required'};
  if(!signature||signature.length>512)return{ok:false,reason:'provider-signature-required'};
  if(!Number.isSafeInteger(input.timestampMs)||input.timestampMs<=0)return{ok:false,reason:'provider-timestamp-required'};
  if(Math.abs(nowMs-input.timestampMs)>maxSkewMs)return{ok:false,reason:'provider-clock-skew'};
  const keys=input.registry.get(providerId);
  if(!keys)return{ok:false,reason:'provider-not-configured'};
  const key=keys.find((candidate)=>candidate.keyId===keyId);
  if(!key)return{ok:false,reason:'provider-key-not-found'};
  if(key.state==='revoked')return{ok:false,reason:'provider-key-revoked'};
  if(key.notBeforeMs!==null&&nowMs<key.notBeforeMs)return{ok:false,reason:'provider-key-not-yet-valid'};
  if(key.notAfterMs!==null&&nowMs>key.notAfterMs)return{ok:false,reason:'provider-key-expired'};
  if(!key.scopes.includes(input.scope))return{ok:false,reason:'provider-scope-denied'};
  const payload=canonicalPayload(input.scope,providerId,keyId,input.timestampMs,input.payload);
  if(key.algorithm==='hmac-sha256'){
    if(!HMAC_SIGNATURE_RE.test(signature)||!key.secret)return{ok:false,reason:'provider-signature-invalid'};
    const expected=createHmac('sha256',key.secret).update(payload).digest('hex');
    if(!equalHex(signature.toLowerCase(),expected))return{ok:false,reason:'provider-signature-invalid'};
  }else if(!key.publicKeyPem||!verifyEd25519(signature,payload,key.publicKeyPem))return{ok:false,reason:'provider-signature-invalid'};
  return{ok:true,providerId,keyId,algorithm:key.algorithm};
}
