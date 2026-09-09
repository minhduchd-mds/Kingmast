export type AssistantIntent='navigation'|'vehicle-status'|'road-context'|'charging'|'settings'|'explain-alert'|'help'|'unsupported';
export type AssistantTool='navigation.summary'|'navigation.alternatives'|'vehicle.health'|'road.active-hazards'|'road.next-maneuver'|'charging.options'|'settings.summary'|'alerts.explain';
export interface AssistantPlan{
  intent:AssistantIntent;
  confidence:number;
  tools:AssistantTool[];
  requiresParked:boolean;
  advisoryOnly:true;
  responseHint:string;
}

export const ASSISTANT_TOOL_ALLOWLIST:readonly AssistantTool[]=['navigation.summary','navigation.alternatives','vehicle.health','road.active-hazards','road.next-maneuver','charging.options','settings.summary','alerts.explain'] as const;

const patterns:Array<{intent:AssistantIntent;tools:AssistantTool[];terms:string[];parked?:boolean;hint:string}>=[
  {intent:'explain-alert',tools:['alerts.explain','road.active-hazards','vehicle.health'],terms:['why warning','why alert','why lane warning','why dms warning','tại sao cảnh báo','giải thích cảnh báo','vì sao lệch làn','vì sao cảnh báo buồn ngủ','cảnh báo này là gì','tại sao xe cảnh báo'],hint:'Explain the observed warning using traceable telemetry, driver-assist runtime state and risk reasons only.'},
  {intent:'charging',tools:['charging.options','navigation.summary'],terms:['charge','charging','charger','sạc','trạm sạc','điểm sạc','sạc ở đâu','nạp điện'],hint:'Summarize route-relevant charging options and reserve impact.'},
  {intent:'vehicle-status',tools:['vehicle.health'],terms:['vehicle status','sensor','health','device','fault','disconnected','ldw','dms','lane departure','driver attention','camera 360','surround camera','front radar','gnss','imu','can interface','xe thế nào','tình trạng xe','cảm biến','thiết bị','thiết bị nào đang lỗi','lỗi thiết bị','mất kết nối','chưa kết nối','hỏng','radar trước','camera trước','lệch làn','tài xế mất tập trung','camera toàn cảnh'],hint:'Summarize read-only vehicle, sensor, connected-device and driver-assistance runtime health. Distinguish live, degraded, unavailable and staged states.'},
  {intent:'road-context',tools:['road.active-hazards','road.next-maneuver'],terms:['ahead','road','hazard','traffic ahead','phía trước','đường','nguy hiểm','phía trước có gì','tình trạng đường','sự cố phía trước'],hint:'Summarize high-priority road context without inventing provider data.'},
  {intent:'navigation',tools:['navigation.summary','road.next-maneuver','navigation.alternatives'],terms:['route','navigate','navigation','direction','directions','đường đi','dẫn đường','tuyến','tóm tắt tuyến','đi hướng nào','đường nào'],hint:'Use current route and maneuver data only.'},
  {intent:'settings',tools:['settings.summary'],terms:['settings','setting','preferences','cài đặt','tùy chọn','thiết lập'],parked:true,hint:'Explain settings; deep edits remain parked-only.'},
  {intent:'help',tools:[],terms:['help','what can you do','what do you do','trợ giúp','làm được gì','em làm được gì','trợ lý làm gì'],hint:'Describe read-only assistant capabilities and safety boundary.'},
];

function fold(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
function normalizedForms(input:string){const normalized=input.trim().toLocaleLowerCase('vi');return{normalized,folded:fold(normalized)};}

export function planAssistantRequest(input:string):AssistantPlan{
  const{normalized,folded}=normalizedForms(input);
  if(!normalized)return{intent:'help',confidence:1,tools:[],requiresParked:false,advisoryOnly:true,responseHint:'Ask the driver what information they need.'};
  let best:typeof patterns[number]|null=null;let bestMatches=0;
  for(const candidate of patterns){const matches=candidate.terms.filter((term)=>{const lowered=term.toLocaleLowerCase('vi');return normalized.includes(lowered)||folded.includes(fold(lowered));}).length;if(matches>bestMatches){best=candidate;bestMatches=matches;}}
  if(!best)return{intent:'unsupported',confidence:.2,tools:[],requiresParked:false,advisoryOnly:true,responseHint:'This request is outside the read-only KINGMAST assistant scope.'};
  const confidence=Math.min(.98,.62+bestMatches*.14);
  return{intent:best.intent,confidence:Number(confidence.toFixed(2)),tools:best.tools.filter((tool)=>ASSISTANT_TOOL_ALLOWLIST.includes(tool)),requiresParked:Boolean(best.parked),advisoryOnly:true,responseHint:best.hint};
}

export function assertReadOnlyAssistantPlan(plan:AssistantPlan){for(const tool of plan.tools)if(!ASSISTANT_TOOL_ALLOWLIST.includes(tool))throw new Error(`assistant-tool-not-allowed:${tool}`);return true;}
