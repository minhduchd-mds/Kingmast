import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,describe,expect,it} from 'vitest';
import type {EdgeEventRecord} from '@kingmast/contracts';
import {BoundedAuditJournal,createAuditJournalFromEnv} from './audit-journal.js';

const dirs:string[]=[];
function record(index:number):EdgeEventRecord{return{id:`event-${index}`,timestampMs:1_800_000_000_000+index,sequence:index,severity:'caution',type:'vehicle-too-close',title:'Vehicle too close',message:`bounded audit ${index}`.padEnd(96,'x'),objectId:`obj-${index}`,position:{lat:21.0285,lng:105.8542}};}
afterEach(async()=>{await Promise.all(dirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));});

describe('BoundedAuditJournal',()=>{
  it('persists only bounded event metadata as JSONL',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'kingmast-audit-'));dirs.push(dir);
    const path=join(dir,'events.jsonl');
    const journal=new BoundedAuditJournal(path,16*1024,3);
    journal.append(record(1));
    await journal.flush();
    const lines=(await readFile(path,'utf8')).trim().split('\n');
    const payload=JSON.parse(lines[0]!);
    expect(payload.schema).toBe('kingmast-audit-event/v1');
    expect(payload.record.id).toBe('event-1');
    expect(payload.record).not.toHaveProperty('rawVideo');
    expect(journal.status()).toMatchObject({enabled:true,pending:0,written:1,writeErrors:0});
  });

  it('rotates and bounds the number of journal files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'kingmast-audit-'));dirs.push(dir);
    const path=join(dir,'events.jsonl');
    const journal=new BoundedAuditJournal(path,16*1024,2);
    for(let index=0;index<140;index+=1)journal.append(record(index));
    await journal.flush();
    const files=(await readdir(dir)).filter((name)=>name.startsWith('events.jsonl'));
    expect(files.length).toBeLessThanOrEqual(2);
    expect(journal.status().rotations).toBeGreaterThan(0);
  });

  it('fails configuration instead of silently accepting unbounded settings',()=>{
    expect(()=>createAuditJournalFromEnv({KINGMAST_AUDIT_JOURNAL_PATH:'/tmp/audit',KINGMAST_AUDIT_MAX_FILES:'1000'})).toThrow(/between 1 and 10/);
  });
});
