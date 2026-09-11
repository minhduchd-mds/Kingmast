import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';

export type OperatorScope='configuration:geofences'|'configuration:nextgen';
export type OperatorKeyState='active'|'revoked';

export interface OperatorKeyRecord {
  operatorId:string;
  keyId:string;
  publicKeyPem:string;
  scopes:OperatorScope[];
  state:OperatorKeyState;
  notBeforeMs?:number;
  notAfterMs?:number;
}

export type OperatorKeyRegistry=Map<string,OperatorKeyRecord[]>;

export interface OperatorAuthSuccess {
  ok:true;
  operatorId:string;
  keyId:string;
  scope:OperatorScope;
}

export interface OperatorAuthFailure {
  ok:false;
  reason:'missing-identity'|'unknown-operator'|'unknown-key'|'revoked-key'|'scope-denied'|'key-not-yet-valid'|'key-expired'|'clock-skew'|'invalid-nonce'|'invalid-signature'|'replay';
}

export type OperatorAuthResult=OperatorAuthSuccess|OperatorAuthFailure;

const OPERATOR_ID=/^[A-Za-z0-9._:@-]{1,96}$/;
const KEY_ID=/^[A-Za-z0-9._:@-]{1,96}$/;
const NONCE=/^[A-Za-z0-9_-]{16,96}$/;
const MAX_OPERATORS=256;
const MAX_KEYS_PER_OPERATOR=4;
const MAX_CLOCK_SKEW_MS=30_000;

function canonicalize(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map((key)=>`${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function sha256(value:string){return createHash('sha256').update(value,'utf8').digest('hex');}

export function operatorSigningPayload(input:{scope:OperatorScope;operatorId:string;keyId:string;timestampMs:number;nonce:string;payload:unknown}){
  const payloadDigest=sha256(canonicalize(input.payload));
  return `KINGMAST-OPERATOR-V1\n${input.scope}\n${input.operatorId}\n${input.keyId}\n${input.timestampMs}\n${input.nonce}\n${payloadDigest}`;
}

function isFiniteTimestamp(value:unknown):value is number {
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
}

function parseScopes(value:unknown):OperatorScope[]|null {
  if(!Array.isArray(value)||value.length===0)return null;
  const scopes=[...new Set(value.filter((item):item is OperatorScope=>item==='configuration:geofences'||item==='configuration:nextgen'))];
  return scopes.length===value.length?scopes:null;
}

function validatePublicKeyPem(candidate:string){
  if(/PRIVATE KEY/.test(candidate))throw new Error('operator registry must never contain private key material');
  const key=createPublicKey(candidate);
  if(key.asymmetricKeyType!=='ed25519')throw new Error('operator identity keys must be Ed25519 public keys');
}

export function parseOperatorKeyRegistry(raw:string):OperatorKeyRegistry {
  let parsed:unknown;
  try{parsed=JSON.parse(raw||'{}');}catch{throw new Error('KINGMAST_OPERATOR_KEYS_JSON must be valid JSON');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('KINGMAST_OPERATOR_KEYS_JSON must be an object');
  const entries=Object.entries(parsed as Record<string,unknown>);
  if(entries.length>MAX_OPERATORS)throw new Error(`operator registry exceeds ${MAX_OPERATORS} identities`);
  const registry:OperatorKeyRegistry=new Map();
  for(const[operatorId,value]of entries){
    if(!OPERATOR_ID.test(operatorId))throw new Error(`invalid operatorId ${operatorId}`);
    if(!Array.isArray(value)||value.length<1||value.length>MAX_KEYS_PER_OPERATOR)throw new Error(`operator ${operatorId} must contain 1..${MAX_KEYS_PER_OPERATOR} keys`);
    const records:OperatorKeyRecord[]=[];
    const keyIds=new Set<string>();
    for(const candidate of value){
      if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw new Error(`operator ${operatorId} contains an invalid key record`);
      const record=candidate as Record<string,unknown>;
      const keyId=typeof record.keyId==='string'?record.keyId:'';
      const publicKeyPem=typeof record.publicKeyPem==='string'?record.publicKeyPem:'';
      const state:OperatorKeyState=record.state==='revoked'?'revoked':record.state==='active'?'active':(()=>{throw new Error(`operator ${operatorId}/${keyId||'unknown'} has invalid state`);})();
      const scopes=parseScopes(record.scopes);
      if(!KEY_ID.test(keyId)||keyIds.has(keyId))throw new Error(`operator ${operatorId} has invalid or duplicate keyId`);
      if(!scopes)throw new Error(`operator ${operatorId}/${keyId} has invalid scopes`);
      validatePublicKeyPem(publicKeyPem);
      const notBeforeMs=record.notBeforeMs===undefined?undefined:record.notBeforeMs;
      const notAfterMs=record.notAfterMs===undefined?undefined:record.notAfterMs;
      if(notBeforeMs!==undefined&&!isFiniteTimestamp(notBeforeMs))throw new Error(`operator ${operatorId}/${keyId} has invalid notBeforeMs`);
      if(notAfterMs!==undefined&&!isFiniteTimestamp(notAfterMs))throw new Error(`operator ${operatorId}/${keyId} has invalid notAfterMs`);
      if(notBeforeMs!==undefined&&notAfterMs!==undefined&&notAfterMs<=notBeforeMs)throw new Error(`operator ${operatorId}/${keyId} validity window is invalid`);
      keyIds.add(keyId);
      records.push({operatorId,keyId,publicKeyPem,scopes,state,notBeforeMs:notBeforeMs as number|undefined,notAfterMs:notAfterMs as number|undefined});
    }
    registry.set(operatorId,records);
  }
  return registry;
}

export class OperatorReplayGuard {
  private readonly entries=new Map<string,number>();
  rejected=0;
  capacityRejected=0;

  constructor(private readonly maxEntries=4_096,private readonly ttlMs=2*60_000){
    if(!Number.isSafeInteger(maxEntries)||maxEntries<1)throw new Error('maxEntries must be a positive integer');
    if(!Number.isSafeInteger(ttlMs)||ttlMs<30_000)throw new Error('ttlMs must be at least 30000');
  }

  get activeEntries(){return this.entries.size;}

  private prune(nowMs:number){for(const[key,expiresAt]of this.entries)if(expiresAt<=nowMs)this.entries.delete(key);}

  accept(identity:string,nonce:string,nowMs=Date.now()){
    this.prune(nowMs);
    const key=sha256(`${identity}\n${nonce}`);
    if(this.entries.has(key)){this.rejected+=1;return false;}
    if(this.entries.size>=this.maxEntries){this.rejected+=1;this.capacityRejected+=1;return false;}
    this.entries.set(key,nowMs+this.ttlMs);
    return true;
  }
}

export function verifyOperatorRequest(input:{
  scope:OperatorScope;
  operatorId:string;
  keyId:string;
  timestampMs:number;
  nonce:string;
  signature:string;
  payload:unknown;
  registry:OperatorKeyRegistry;
  replayGuard:OperatorReplayGuard;
  nowMs?:number;
  maxClockSkewMs?:number;
}):OperatorAuthResult {
  const nowMs=input.nowMs??Date.now();
  const maxClockSkewMs=input.maxClockSkewMs??MAX_CLOCK_SKEW_MS;
  if(!OPERATOR_ID.test(input.operatorId)||!KEY_ID.test(input.keyId)||!Number.isSafeInteger(input.timestampMs)||!input.signature)return{ok:false,reason:'missing-identity'};
  if(!NONCE.test(input.nonce))return{ok:false,reason:'invalid-nonce'};
  if(Math.abs(nowMs-input.timestampMs)>maxClockSkewMs)return{ok:false,reason:'clock-skew'};
  const records=input.registry.get(input.operatorId);
  if(!records)return{ok:false,reason:'unknown-operator'};
  const record=records.find((item)=>item.keyId===input.keyId);
  if(!record)return{ok:false,reason:'unknown-key'};
  if(record.state!=='active')return{ok:false,reason:'revoked-key'};
  if(!record.scopes.includes(input.scope))return{ok:false,reason:'scope-denied'};
  if(record.notBeforeMs!==undefined&&nowMs<record.notBeforeMs)return{ok:false,reason:'key-not-yet-valid'};
  if(record.notAfterMs!==undefined&&nowMs>record.notAfterMs)return{ok:false,reason:'key-expired'};
  let signature:Buffer;
  try{signature=Buffer.from(input.signature,'base64url');}catch{return{ok:false,reason:'invalid-signature'};}
  if(signature.length!==64)return{ok:false,reason:'invalid-signature'};
  const message=Buffer.from(operatorSigningPayload(input),'utf8');
  const publicKey=createPublicKey(record.publicKeyPem);
  if(!verifySignature(null,message,publicKey,signature))return{ok:false,reason:'invalid-signature'};
  if(!input.replayGuard.accept(`${input.operatorId}:${input.keyId}:${input.scope}`,input.nonce,nowMs))return{ok:false,reason:'replay'};
  return{ok:true,operatorId:input.operatorId,keyId:input.keyId,scope:input.scope};
}

export function operatorAuthSummary(registry:OperatorKeyRegistry,nowMs=Date.now()){
  let activeKeys=0,revokedKeys=0,expiredKeys=0,futureKeys=0;
  for(const records of registry.values())for(const record of records){
    if(record.state==='revoked'){revokedKeys+=1;continue;}
    if(record.notBeforeMs!==undefined&&record.notBeforeMs>nowMs){futureKeys+=1;continue;}
    if(record.notAfterMs!==undefined&&record.notAfterMs<nowMs){expiredKeys+=1;continue;}
    activeKeys+=1;
  }
  return{operators:registry.size,activeKeys,revokedKeys,expiredKeys,futureKeys};
}
