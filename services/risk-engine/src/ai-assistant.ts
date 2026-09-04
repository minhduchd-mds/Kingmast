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
  {intent:'explain-alert',tools:['alerts.explain','road.active-hazards'],terms:['why warning','why alert','tại sao cảnh báo','giải thích cảnh báo'],hint:'Explain the observed warning using traceable telemetry/risk reasons only.'},
  {intent:'charging',tools:['charging.options','navigation.summary'],terms:['charge','charging','sạc','trạm sạc'],hint:'Summarize route-relevant charging options and reserve impact.'},
  {intent:'vehicle-status',tools:['vehicle.health'],terms:['vehicle status','sensor','health','xe thế nào','tình trạng xe','cảm biến'],hint:'Summarize read-only vehicle and sensor health.'},
  {intent:'road-context',tools:['road.active-hazards','road.next-maneuver'],terms:['ahead','road','hazard','phía trước','đường','nguy hiểm'],hint:'Summarize high-priority road context without inventing provider data.'},
  {intent:'navigation',tools:['navigation.summary','road.next-maneuver','navigation.alternatives'],terms:['route','navigate','direction','đường đi','dẫn đường','tuyến'],hint:'Use current route and maneuver data only.'},
  {intent:'settings',tools:['settings.summary'],terms:['settings','setting','cài đặt','tùy chọn'],parked:true,hint:'Explain settings; deep edits remain parked-only.'},
  {intent:'help',tools:[],terms:['help','what can you do','trợ giúp','làm được gì'],hint:'Describe read-only assistant capabilities and safety boundary.'},
];

export function planAssistantRequest(input:string):AssistantPlan{
  const normalized=input.trim().toLocaleLowerCase('vi');
  if(!normalized)return{intent:'help',confidence:1,tools:[],requiresParked:false,advisoryOnly:true,responseHint:'Ask the driver what information they need.'};
  let best:typeof patterns[number]|null=null;let bestMatches=0;
  for(const candidate of patterns){const matches=candidate.terms.filter((term)=>normalized.includes(term)).length;if(matches>bestMatches){best=candidate;bestMatches=matches;}}
  if(!best)return{intent:'unsupported',confidence:.2,tools:[],requiresParked:false,advisoryOnly:true,responseHint:'This request is outside the read-only KINGMAST assistant scope.'};
  const confidence=Math.min(.98,.62+bestMatches*.14);
  return{intent:best.intent,confidence:Number(confidence.toFixed(2)),tools:best.tools.filter((tool)=>ASSISTANT_TOOL_ALLOWLIST.includes(tool)),requiresParked:Boolean(best.parked),advisoryOnly:true,responseHint:best.hint};
}

export function assertReadOnlyAssistantPlan(plan:AssistantPlan){for(const tool of plan.tools)if(!ASSISTANT_TOOL_ALLOWLIST.includes(tool))throw new Error(`assistant-tool-not-allowed:${tool}`);return true;}
