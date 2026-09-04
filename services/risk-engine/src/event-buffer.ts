import type { EdgeEventRecord, Severity, TelemetryFrame } from '@kingmast/contracts';

export class EdgeEventBuffer {
  private readonly records:EdgeEventRecord[]=[];
  private readonly seen=new Set<string>();
  constructor(private readonly capacity=300) {}

  ingest(frame:TelemetryFrame) {
    for(const alert of frame.alerts){
      const dedupeKey=`${alert.id}:${alert.severity}`;
      if(this.seen.has(dedupeKey)) continue;
      this.seen.add(dedupeKey);
      this.records.unshift({
        id:`${dedupeKey}:${alert.timestampMs}`,
        timestampMs:alert.timestampMs,
        sequence:frame.sequence,
        severity:alert.severity,
        type:alert.type,
        title:alert.title,
        message:alert.message,
        objectId:alert.objectId,
        position:alert.position,
      });
      if(this.records.length>this.capacity) this.records.length=this.capacity;
      if(this.seen.size>this.capacity*4) this.rebuildSeen();
    }
  }

  list(limit=50,severity?:Severity) {
    const source=severity?this.records.filter((record)=>record.severity===severity):this.records;
    return source.slice(0,Math.max(1,Math.min(200,limit)));
  }

  private rebuildSeen() {
    this.seen.clear();
    for(const record of this.records) this.seen.add(record.id.split(':').slice(0,-1).join(':'));
  }
}
