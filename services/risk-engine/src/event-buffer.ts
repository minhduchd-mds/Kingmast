import type { EdgeEventRecord, Severity, TelemetryFrame } from '@kingmast/contracts';
import { createAuditJournalFromEnv, type AuditJournalStatus, type BoundedAuditJournal } from './audit-journal.js';

const DISABLED_AUDIT_STATUS:AuditJournalStatus={enabled:false,path:null,pending:0,written:0,writeErrors:0,rotations:0,lastErrorAtMs:null};

export class EdgeEventBuffer {
  private readonly records:EdgeEventRecord[]=[];
  private readonly seen=new Set<string>();
  constructor(private readonly capacity=300,private readonly journal:BoundedAuditJournal|null=createAuditJournalFromEnv()) {
    if(!Number.isSafeInteger(capacity)||capacity<1||capacity>10_000)throw new Error('event buffer capacity must be between 1 and 10000');
  }

  ingest(frame:TelemetryFrame) {
    const created:EdgeEventRecord[]=[];
    for(const alert of frame.alerts){
      const dedupeKey=`${alert.id}:${alert.severity}`;
      if(this.seen.has(dedupeKey)) continue;
      this.seen.add(dedupeKey);
      const record:EdgeEventRecord={
        id:`${dedupeKey}:${alert.timestampMs}`,
        timestampMs:alert.timestampMs,
        sequence:frame.sequence,
        severity:alert.severity,
        type:alert.type,
        title:alert.title,
        message:alert.message,
        objectId:alert.objectId,
        position:alert.position,
      };
      this.records.unshift(record);
      created.push(record);
      this.journal?.append(record);
      if(this.records.length>this.capacity) this.records.length=this.capacity;
      if(this.seen.size>this.capacity*4) this.rebuildSeen();
    }
    return created;
  }

  list(limit=50,severity?:Severity) {
    const source=severity?this.records.filter((record)=>record.severity===severity):this.records;
    return source.slice(0,Math.max(1,Math.min(200,limit)));
  }

  auditStatus(){return this.journal?.status()??DISABLED_AUDIT_STATUS;}
  async flushAudit(){await this.journal?.flush();}

  private rebuildSeen() {
    this.seen.clear();
    for(const record of this.records) this.seen.add(record.id.split(':').slice(0,-1).join(':'));
  }
}
