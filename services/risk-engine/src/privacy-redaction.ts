export type ExportRecord={eventId:string;timestampMs:number;preciseLocation?:{lat:number;lng:number}|null;rawImageRef?:string|null;hardwareSerial?:string|null;driverId?:string|null;summary:string};
export type RedactedExport={eventId:string;timestampMs:number;summary:string;locationRegion:'present-redacted'|'absent';redactedFields:string[]};

export function redactEvidenceForExport(record:ExportRecord):RedactedExport|null{
  if(!record.eventId||!record.summary||!Number.isFinite(record.timestampMs)||record.timestampMs<0)return null;
  const redactedFields:string[]=[];
  if(record.preciseLocation){
    if(!Number.isFinite(record.preciseLocation.lat)||!Number.isFinite(record.preciseLocation.lng))return null;
    redactedFields.push('preciseLocation');
  }
  if(record.rawImageRef)redactedFields.push('rawImageRef');
  if(record.hardwareSerial)redactedFields.push('hardwareSerial');
  if(record.driverId)redactedFields.push('driverId');
  return{eventId:record.eventId,timestampMs:record.timestampMs,summary:record.summary,locationRegion:record.preciseLocation?'present-redacted':'absent',redactedFields};
}

export function containsForbiddenExportKey(value:unknown):boolean{
  if(!value||typeof value!=='object')return false;
  const forbidden=new Set(['preciseLocation','rawImageRef','hardwareSerial','driverId','lat','lng','latitude','longitude','token','password','secret']);
  return Object.entries(value as Record<string,unknown>).some(([key,child])=>forbidden.has(key)||containsForbiddenExportKey(child));
}
