import type {ProviderScope} from './provider-auth.js';

export type ProviderCertificateState='active'|'revoked';
export interface ProviderCertificateRecord{
  certificateId:string;
  fingerprintSha256:string;
  state:ProviderCertificateState;
  scopes:ProviderScope[];
  notBeforeMs:number;
  notAfterMs:number;
  issuer:string|null;
}
export type ProviderCertificateRegistry=Map<string,ProviderCertificateRecord[]>;
export type ProviderCertificateAssessment={trusted:true;providerId:string;certificateId:string}|{trusted:false;reason:'provider-not-configured'|'certificate-not-found'|'certificate-revoked'|'certificate-not-yet-valid'|'certificate-expired'|'certificate-scope-denied'};

const PROVIDER_ID_RE=/^[A-Za-z0-9._:-]{2,96}$/;
const CERT_ID_RE=/^[A-Za-z0-9._:-]{1,128}$/;
const FINGERPRINT_RE=/^[a-f0-9]{64}$/i;
const ALL_SCOPES:ProviderScope[]=['road-context:cameras','connected-road:provider','connected-road:v2x'];

function parseTime(providerId:string,certificateId:string,field:string,value:unknown){
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new Error(`provider ${providerId} certificate ${certificateId} has invalid ${field}`);
  return Math.trunc(value);
}
function parseScopes(providerId:string,certificateId:string,value:unknown):ProviderScope[]{
  if(!Array.isArray(value)||value.length===0||value.length>ALL_SCOPES.length)throw new Error(`provider ${providerId} certificate ${certificateId} must define 1..${ALL_SCOPES.length} scopes`);
  const scopes=[...new Set(value)];
  if(scopes.some((scope)=>typeof scope!=='string'||!ALL_SCOPES.includes(scope as ProviderScope)))throw new Error(`provider ${providerId} certificate ${certificateId} has invalid scope`);
  return scopes as ProviderScope[];
}

export function parseProviderCertificateRegistry(raw:string):ProviderCertificateRegistry{
  const registry:ProviderCertificateRegistry=new Map();
  if(!raw.trim())return registry;
  let parsed:unknown;
  try{parsed=JSON.parse(raw);}catch{throw new Error('KINGMAST_PROVIDER_CERTIFICATES_JSON must be valid JSON');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('KINGMAST_PROVIDER_CERTIFICATES_JSON must be an object keyed by providerId');
  for(const [providerId,value] of Object.entries(parsed as Record<string,unknown>)){
    if(!PROVIDER_ID_RE.test(providerId))throw new Error(`invalid providerId in KINGMAST_PROVIDER_CERTIFICATES_JSON: ${providerId||'<empty>'}`);
    if(!Array.isArray(value)||value.length===0||value.length>4)throw new Error(`provider ${providerId} must define 1..4 certificate records`);
    const records:ProviderCertificateRecord[]=[];
    const ids=new Set<string>();
    const fingerprints=new Set<string>();
    for(const item of value){
      if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`provider ${providerId} contains an invalid certificate record`);
      const record=item as Record<string,unknown>;
      const certificateId=typeof record.certificateId==='string'?record.certificateId.trim():'';
      const fingerprintSha256=typeof record.fingerprintSha256==='string'?record.fingerprintSha256.toLowerCase():'';
      if(!CERT_ID_RE.test(certificateId))throw new Error(`provider ${providerId} has invalid certificateId`);
      if(!FINGERPRINT_RE.test(fingerprintSha256))throw new Error(`provider ${providerId} certificate ${certificateId} requires a SHA-256 fingerprint`);
      if(ids.has(certificateId)||fingerprints.has(fingerprintSha256))throw new Error(`provider ${providerId} has duplicate certificate identity`);
      const state=record.state===undefined?'active':record.state;
      if(state!=='active'&&state!=='revoked')throw new Error(`provider ${providerId} certificate ${certificateId} has invalid state`);
      const notBeforeMs=parseTime(providerId,certificateId,'notBeforeMs',record.notBeforeMs);
      const notAfterMs=parseTime(providerId,certificateId,'notAfterMs',record.notAfterMs);
      if(notAfterMs<=notBeforeMs)throw new Error(`provider ${providerId} certificate ${certificateId} has invalid validity window`);
      const issuer=record.issuer===undefined||record.issuer===null?null:typeof record.issuer==='string'?record.issuer.trim():'';
      if(issuer!==null&&!issuer)throw new Error(`provider ${providerId} certificate ${certificateId} has invalid issuer`);
      ids.add(certificateId);fingerprints.add(fingerprintSha256);
      records.push({certificateId,fingerprintSha256,state,scopes:parseScopes(providerId,certificateId,record.scopes),notBeforeMs,notAfterMs,issuer});
    }
    registry.set(providerId,records);
  }
  return registry;
}

export function assessProviderCertificate(input:{providerId:string;fingerprintSha256:string;scope:ProviderScope;registry:ProviderCertificateRegistry;nowMs?:number}):ProviderCertificateAssessment{
  const records=input.registry.get(input.providerId);
  if(!records)return{trusted:false,reason:'provider-not-configured'};
  const record=records.find((item)=>item.fingerprintSha256===input.fingerprintSha256.toLowerCase());
  if(!record)return{trusted:false,reason:'certificate-not-found'};
  if(record.state==='revoked')return{trusted:false,reason:'certificate-revoked'};
  const nowMs=input.nowMs??Date.now();
  if(nowMs<record.notBeforeMs)return{trusted:false,reason:'certificate-not-yet-valid'};
  if(nowMs>record.notAfterMs)return{trusted:false,reason:'certificate-expired'};
  if(!record.scopes.includes(input.scope))return{trusted:false,reason:'certificate-scope-denied'};
  return{trusted:true,providerId:input.providerId,certificateId:record.certificateId};
}

export function providerCertificateSummary(registry:ProviderCertificateRegistry,nowMs=Date.now()){
  let active=0,revoked=0,expired=0,future=0;
  for(const records of registry.values())for(const record of records){
    if(record.state==='revoked'){revoked+=1;continue;}
    if(nowMs<record.notBeforeMs){future+=1;continue;}
    if(nowMs>record.notAfterMs){expired+=1;continue;}
    active+=1;
  }
  return{configuredProviders:registry.size,activeCertificates:active,revokedCertificates:revoked,expiredCertificates:expired,futureCertificates:future,enforcement:'trusted-gateway-required' as const};
}
