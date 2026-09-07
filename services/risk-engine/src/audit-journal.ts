import {appendFile,mkdir,rename,stat,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {EdgeEventRecord} from '@kingmast/contracts';

export interface AuditJournalStatus {
  enabled:boolean;
  path:string|null;
  pending:number;
  written:number;
  writeErrors:number;
  rotations:number;
  lastErrorAtMs:number|null;
}

async function exists(path:string){try{await stat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}

export class BoundedAuditJournal {
  private chain:Promise<void>=Promise.resolve();
  private pending=0;
  private written=0;
  private writeErrors=0;
  private rotations=0;
  private lastErrorAtMs:number|null=null;

  constructor(readonly path:string,private readonly maxBytes=5*1024*1024,private readonly maxFiles=3){
    if(!path.trim())throw new Error('audit journal path is required');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<16*1024||maxBytes>100*1024*1024)throw new Error('audit journal maxBytes must be between 16 KiB and 100 MiB');
    if(!Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>10)throw new Error('audit journal maxFiles must be between 1 and 10');
  }

  append(record:EdgeEventRecord){
    const line=`${JSON.stringify({schema:'kingmast-audit-event/v1',record})}\n`;
    this.pending+=1;
    this.chain=this.chain.then(()=>this.writeLine(line)).then(()=>{
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
    return{enabled:true,path:this.path,pending:this.pending,written:this.written,writeErrors:this.writeErrors,rotations:this.rotations,lastErrorAtMs:this.lastErrorAtMs};
  }

  private async writeLine(line:string){
    await mkdir(dirname(this.path),{recursive:true});
    let size=0;
    if(await exists(this.path))size=(await stat(this.path)).size;
    if(size+Buffer.byteLength(line,'utf8')>this.maxBytes)await this.rotate();
    await appendFile(this.path,line,{encoding:'utf8',flag:'a',mode:0o600});
  }

  private async rotate(){
    if(this.maxFiles===1){if(await exists(this.path))await unlink(this.path);this.rotations+=1;return;}
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
