import {createHash} from 'node:crypto';
import {appendFile,mkdir,readFile,rename,stat,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {EdgeEventRecord} from '@kingmast/contracts';

export interface AuditJournalStatus {
  enabled:boolean;
  path:string|null;
  pending:number;
  written:number;
  writeErrors:number;
  integrityErrors:number;
  rotations:number;
  lastErrorAtMs:number|null;
  integrityHead:string|null;
}

interface AuditEnvelopeV2 {
  schema:'kingmast-audit-event/v2';
  previousHash:string|null;
  record:EdgeEventRecord;
  entryHash:string;
}

async function exists(path:string){try{await stat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
function hashEnvelope(previousHash:string|null,record:EdgeEventRecord){return createHash('sha256').update(JSON.stringify({schema:'kingmast-audit-event/v2',previousHash,record})).digest('hex');}
function validHash(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);}

export function verifyAuditJournalText(text:string){
  const lines=text.split('\n').map((line)=>line.trim()).filter(Boolean);
  let lastHash:string|null=null;
  let entries=0;
  for(const line of lines){
    let parsed:unknown;
    try{parsed=JSON.parse(line);}catch{return{ok:false as const,reason:'invalid-json',entries,lastHash};}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return{ok:false as const,reason:'invalid-envelope',entries,lastHash};
    const envelope=parsed as Partial<AuditEnvelopeV2>;
    if(envelope.schema!=='kingmast-audit-event/v2'||!envelope.record||!validHash(envelope.entryHash))return{ok:false as const,reason:'invalid-envelope',entries,lastHash};
    if(envelope.previousHash!==null&&!validHash(envelope.previousHash))return{ok:false as const,reason:'invalid-previous-hash',entries,lastHash};
    if(entries>0&&envelope.previousHash!==lastHash)return{ok:false as const,reason:'chain-link-mismatch',entries,lastHash};
    const expected=hashEnvelope(envelope.previousHash,envelope.record);
    if(expected!==envelope.entryHash)return{ok:false as const,reason:'entry-hash-mismatch',entries,lastHash};
    lastHash=envelope.entryHash;
    entries+=1;
  }
  return{ok:true as const,entries,lastHash};
}

export class BoundedAuditJournal {
  private chain:Promise<void>=Promise.resolve();
  private pending=0;
  private written=0;
  private writeErrors=0;
  private integrityErrors=0;
  private rotations=0;
  private lastErrorAtMs:number|null=null;
  private integrityHead:string|null=null;
  private initialized=false;

  constructor(readonly path:string,private readonly maxBytes=5*1024*1024,private readonly maxFiles=3){
    if(!path.trim())throw new Error('audit journal path is required');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<16*1024||maxBytes>100*1024*1024)throw new Error('audit journal maxBytes must be between 16 KiB and 100 MiB');
    if(!Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>10)throw new Error('audit journal maxFiles must be between 1 and 10');
  }

  append(record:EdgeEventRecord){
    this.pending+=1;
    this.chain=this.chain.then(async()=>{
      await this.initializeIntegrityHead();
      const previousHash=this.integrityHead;
      const entryHash=hashEnvelope(previousHash,record);
      const line=`${JSON.stringify({schema:'kingmast-audit-event/v2',previousHash,record,entryHash})}\n`;
      await this.writeLine(line);
      this.integrityHead=entryHash;
    }).then(()=>{
      this.written+=1;
      this.pending-=1;
    },()=>{
      this.writeErrors+=1;
      this.lastErrorAtMs=Date.now();
      this.pending-=1;
    });
  }

  async flush(){await this.chain;}

  status():AuditJournalStatus {
    return{enabled:true,path:this.path,pending:this.pending,written:this.written,writeErrors:this.writeErrors,integrityErrors:this.integrityErrors,rotations:this.rotations,lastErrorAtMs:this.lastErrorAtMs,integrityHead:this.integrityHead};
  }

  private async initializeIntegrityHead(){
    if(this.initialized)return;
    await mkdir(dirname(this.path),{recursive:true});
    if(await exists(this.path)){
      const text=await readFile(this.path,'utf8');
      const lines=text.split('\n').map((line)=>line.trim()).filter(Boolean);
      if(lines.length){
        let last:unknown;
        try{last=JSON.parse(lines.at(-1)!);}catch{this.integrityErrors+=1;throw new Error('audit journal integrity initialization failed');}
        if(last&&typeof last==='object'&&!Array.isArray(last)&&(last as {schema?:unknown}).schema==='kingmast-audit-event/v1'){
          // Backward-compatible research migration: v1 had no integrity chain, so v2 starts a new chain boundary.
          this.integrityHead=null;
        }else{
          const verified=verifyAuditJournalText(text);
          if(!verified.ok){this.integrityErrors+=1;throw new Error(`audit journal integrity check failed: ${verified.reason}`);}
          this.integrityHead=verified.lastHash;
        }
      }
    }
    this.initialized=true;
  }

  private async writeLine(line:string){
    await mkdir(dirname(this.path),{recursive:true});
    let size=0;
    if(await exists(this.path))size=(await stat(this.path)).size;
    if(size+Buffer.byteLength(line,'utf8')>this.maxBytes)await this.rotate();
    await appendFile(this.path,line,{encoding:'utf8',flag:'a',mode:0o600});
  }

  private async rotate(){
    if(this.maxFiles===1){if(await exists(this.path))await unlink(this.path);this.rotations+=1;this.integrityHead=null;return;}
    const oldest=`${this.path}.${this.maxFiles-1}`;
    if(await exists(oldest))await unlink(oldest);
    for(let index=this.maxFiles-2;index>=1;index-=1){
      const source=`${this.path}.${index}`;
      if(await exists(source))await rename(source,`${this.path}.${index+1}`);
    }
    if(await exists(this.path))await rename(this.path,`${this.path}.1`);
    this.rotations+=1;
  }
}

function parseBoundedInteger(name:string,value:string|undefined,fallback:number,min:number,max:number){
  if(value===undefined||value.trim()==='')return fallback;
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<min||parsed>max)throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return parsed;
}

export function createAuditJournalFromEnv(env:NodeJS.ProcessEnv=process.env){
  const path=(env.KINGMAST_AUDIT_JOURNAL_PATH??'').trim();
  if(!path)return null;
  const maxBytes=parseBoundedInteger('KINGMAST_AUDIT_MAX_BYTES',env.KINGMAST_AUDIT_MAX_BYTES,5*1024*1024,16*1024,100*1024*1024);
  const maxFiles=parseBoundedInteger('KINGMAST_AUDIT_MAX_FILES',env.KINGMAST_AUDIT_MAX_FILES,3,1,10);
  return new BoundedAuditJournal(path,maxBytes,maxFiles);
}
