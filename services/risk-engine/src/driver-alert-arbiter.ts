export type DriverAlert={id:string;severity:'info'|'watch'|'warning'|'critical';createdAtMs:number;expiresAtMs:number;message:string};
export type AlertArbitration={visible:DriverAlert[];dropped:string[]};
const rank:Record<DriverAlert['severity'],number>={info:0,watch:1,warning:2,critical:3};

export function arbitrateDriverAlerts(alerts:DriverAlert[],nowMs:number,maxVisible=2):AlertArbitration{
  if(!Number.isFinite(nowMs)||!Number.isInteger(maxVisible)||maxVisible<1)return{visible:[],dropped:alerts.map((alert)=>alert.id)};
  const dropped:string[]=[];
  const unique=new Map<string,DriverAlert>();
  for(const alert of alerts){
    if(!alert.id||!alert.message||!Number.isFinite(alert.createdAtMs)||!Number.isFinite(alert.expiresAtMs)||alert.createdAtMs>nowMs||alert.expiresAtMs<=nowMs||alert.expiresAtMs<=alert.createdAtMs){dropped.push(alert.id);continue;}
    const current=unique.get(alert.id);
    if(!current||rank[alert.severity]>rank[current.severity]||alert.createdAtMs>current.createdAtMs)unique.set(alert.id,alert);
  }
  let candidates=[...unique.values()].sort((a,b)=>rank[b.severity]-rank[a.severity]||b.createdAtMs-a.createdAtMs||a.id.localeCompare(b.id));
  if(candidates.some((alert)=>alert.severity==='critical')){
    for(const alert of candidates.filter((item)=>item.severity==='info'))dropped.push(alert.id);
    candidates=candidates.filter((alert)=>alert.severity!=='info');
  }
  const visible=candidates.slice(0,maxVisible);
  for(const alert of candidates.slice(maxVisible))dropped.push(alert.id);
  return{visible,dropped:[...new Set(dropped)]};
}
