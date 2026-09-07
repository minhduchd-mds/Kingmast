import {createHash} from 'node:crypto';

export type ConfigurationAuthMode='operator-ed25519'|'migration-token'|'local-dev';

export interface ConfigurationAuditRecord {
  sequence:number;
  timestampMs:number;
  actorId:string;
  keyId:string|null;
  authMode:ConfigurationAuthMode;
  operation:'replace-geofences';
  resource:'geofences';
  previousDigest:string;
  newDigest:string;
  previousCount:number;
  newCount:number;
  sourceIpHash:string;
  actuatorAuthority:'none';
}

function canonicalize(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalize).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map((key)=>`${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

function sha256(value:string){return createHash('sha256').update(value,'utf8').digest('hex');}

export function configurationDigest(value:unknown){return sha256(canonicalize(value));}

export class ConfigurationAuditBuffer {
  private readonly records:ConfigurationAuditRecord[]=[];
  private sequence=0;
  dropped=0;

  constructor(private readonly capacity=500){
    if(!Number.isSafeInteger(capacity)||capacity<1||capacity>10_000)throw new Error('configuration audit capacity must be 1..10000');
  }

  record(input:{
    timestampMs?:number;
    actorId:string;
    keyId:string|null;
    authMode:ConfigurationAuthMode;
    previousValue:unknown;
    newValue:unknown;
    previousCount:number;
    newCount:number;
    sourceIp:string;
  }){
    const timestampMs=input.timestampMs??Date.now();
    this.sequence+=1;
    const record:ConfigurationAuditRecord={
      sequence:this.sequence,
      timestampMs,
      actorId:input.actorId.slice(0,96),
      keyId:input.keyId?.slice(0,96)??null,
      authMode:input.authMode,
      operation:'replace-geofences',
      resource:'geofences',
      previousDigest:configurationDigest(input.previousValue),
      newDigest:configurationDigest(input.newValue),
      previousCount:input.previousCount,
      newCount:input.newCount,
      sourceIpHash:sha256(input.sourceIp),
      actuatorAuthority:'none',
    };
    if(this.records.length>=this.capacity){this.records.shift();this.dropped+=1;}
    this.records.push(record);
    return record;
  }

  list(limit=50){
    const bounded=Math.max(1,Math.min(200,Math.floor(limit)));
    return this.records.slice(-bounded).reverse();
  }

  status(){return{capacity:this.capacity,retained:this.records.length,dropped:this.dropped,lastSequence:this.sequence,storesRawConfiguration:false,storesRawIp:false,actuatorAuthority:'none' as const};}
}
