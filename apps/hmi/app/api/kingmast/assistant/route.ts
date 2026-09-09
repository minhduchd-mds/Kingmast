import { NextRequest,NextResponse } from 'next/server';

export const runtime='nodejs';

type Locale='en-US'|'vi-VN';
type Fault={code:string;layer:string;severity:string;summary:string;action:string|null};
type Device={id:string;label:string;connection:string;health:string;faults:Fault[]};
type Plan={intent:string;confidence:number;tools:string[];requiresParked:boolean;advisoryOnly:true;responseHint:string};
type PlanResponse={plan:Plan;executionAllowed:boolean;context:{vehicleContextFresh:boolean;speedKmh:number|null;sensorHealth:Record<string,string>;activeAlertCount:number};runtime?:unknown;controlAuthority:'none'};

const READ_ONLY_TOOLS=new Set(['navigation.summary','navigation.alternatives','vehicle.health','road.active-hazards','road.next-maneuver','charging.options','settings.summary','alerts.explain']);

function sameOrigin(request:NextRequest){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).host===request.nextUrl.host;}catch{return false;}}
function cleanText(value:unknown,max:number){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';}
function normalizeLocale(value:unknown):Locale{return value==='vi-VN'?'vi-VN':'en-US';}
function apiBase(){return(process.env.NEXT_PUBLIC_KINGMAST_API_URL??process.env.KINGMAST_API_URL??'http://127.0.0.1:4000').replace(/\/$/,'');}
function viewerToken(){return(process.env.KINGMAST_VIEWER_TOKEN??'').trim();}
function isLoopback(host:string){return host==='127.0.0.1'||host==='localhost'||host==='::1';}
function providerUrl(){const raw=(process.env.KINGMAST_ASSISTANT_PROVIDER_URL??'').trim();if(!raw)return null;try{const url=new URL(raw);if(url.protocol==='https:')return url;if(url.protocol==='http:'&&isLoopback(url.hostname))return url;return null;}catch{return null;}}

function sanitizeDevices(value:unknown):Device[]{
  if(!Array.isArray(value))return[];
  return value.slice(0,16).map((item)=>{
    const source=(item&&typeof item==='object'?item:{}) as Record<string,unknown>;
    const rawFaults=Array.isArray(source.faults)?source.faults:[];
    const faults=rawFaults.slice(0,8).map((fault)=>{const f=(fault&&typeof fault==='object'?fault:{}) as Record<string,unknown>;return{code:cleanText(f.code,48)||'UNKNOWN',layer:cleanText(f.layer,32)||'unknown',severity:cleanText(f.severity,16)||'warning',summary:cleanText(f.summary,120)||'Device fault',action:cleanText(f.action,160)||null};});
    return{id:cleanText(source.id,64)||'unknown-device',label:cleanText(source.label,96)||'Device',connection:cleanText(source.connection,24)||'unavailable',health:cleanText(source.health,32)||'unavailable',faults};
  });
}

async function fetchGroundedPlan(input:string):Promise<PlanResponse>{
  const base=apiBase();const token=viewerToken();let cookie='';
  if(token){
    const session=await fetch(`${base}/v3/session`,{method:'POST',headers:{'x-kingmast-viewer-token':token},cache:'no-store',signal:AbortSignal.timeout(2500)});
    if(!session.ok)throw new Error(`viewer-session:${session.status}`);
    cookie=session.headers.get('set-cookie')??'';
  }
  const response=await fetch(`${base}/v3/assistant/plan`,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify({input}),cache:'no-store',signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error(`assistant-plan:${response.status}`);
  const payload=await response.json() as PlanResponse;
  if(payload.controlAuthority!=='none'||payload.plan.advisoryOnly!==true||!Array.isArray(payload.plan.tools)||payload.plan.tools.some((tool)=>!READ_ONLY_TOOLS.has(tool)))throw new Error('assistant-plan-safety-boundary');
  return payload;
}

function sensorSummary(sensorHealth:Record<string,string>,locale:Locale){const entries=Object.entries(sensorHealth);if(entries.length===0)return locale==='vi-VN'?'chưa có dữ liệu':'no data';return entries.map(([key,value])=>`${key}: ${value}`).join(', ');}
function deviceFallback(devices:Device[],locale:Locale){
  const bad=devices.filter((device)=>device.health==='fault'||device.health==='warning'||device.health==='calibration-required');
  const disconnected=devices.filter((device)=>device.connection==='disconnected');
  if(bad.length){const detail=bad.map((device)=>{const fault=device.faults[0];return fault?`${device.label}: ${fault.summary} (${fault.layer}/${fault.code})${fault.action?` — ${fault.action}`:''}`:`${device.label}: ${device.health}`;}).join('; ');return locale==='vi-VN'?`Có ${bad.length} thiết bị cần chú ý: ${detail}.`:`${bad.length} device issue(s) need attention: ${detail}.`;}
  if(disconnected.length){const names=disconnected.map((device)=>device.label).join(', ');return locale==='vi-VN'?`Chưa kết nối: ${names}.`:`Not connected: ${names}.`;}
  return locale==='vi-VN'?'Hiện không có thiết bị nào trong danh sách chẩn đoán báo lỗi.':'No device in the diagnostic list is currently reporting a fault.';
}
function deterministicAnswer(planResponse:PlanResponse|null,devices:Device[],locale:Locale){
  if(!planResponse){if(devices.some((item)=>item.health==='fault'||item.health==='warning'||item.health==='calibration-required'||item.connection==='disconnected'))return deviceFallback(devices,locale);return locale==='vi-VN'?'Dịch vụ ngữ cảnh trực tiếp đang ngoại tuyến. KINGMAST sẽ không đoán dữ liệu xe; em chỉ có thể dùng trạng thái thiết bị cục bộ đã nhận được.':'Live context is offline. KINGMAST will not guess vehicle data; only locally reported device state is available.';}
  const{plan,context,executionAllowed}=planResponse;
  if(!executionAllowed)return locale==='vi-VN'?'Tác vụ này chỉ được mở khi xe đang đỗ. KINGMAST không thực hiện thay đổi cài đặt khi xe đang chạy.':'This request is parked-only. KINGMAST will not perform settings changes while moving.';
  if(plan.intent==='unsupported')return locale==='vi-VN'?'Yêu cầu này nằm ngoài phạm vi trợ lý chỉ đọc của KINGMAST.':'That request is outside the read-only KINGMAST assistant scope.';
  if(plan.intent==='vehicle-status'){
    const deviceText=deviceFallback(devices,locale);const sensors=sensorSummary(context.sensorHealth,locale);
    return locale==='vi-VN'?`${deviceText} Tình trạng cảm biến runtime: ${sensors}.`:`${deviceText} Runtime sensor health: ${sensors}.`;
  }
  if(plan.intent==='explain-alert')return context.activeAlertCount>0?(locale==='vi-VN'?`Hiện có ${context.activeAlertCount} cảnh báo đang hoạt động. Cần đối chiếu cảnh báo đang hiển thị với telemetry hiện tại; KINGMAST không suy đoán nguyên nhân ngoài dữ liệu đã xác thực.`:`There are ${context.activeAlertCount} active alert(s). The displayed alert should be explained only from current telemetry; KINGMAST will not infer a cause beyond grounded data.`):(locale==='vi-VN'?'Hiện không có cảnh báo hoạt động trong ngữ cảnh runtime đã xác thực.':'There is no active alert in the grounded runtime context.');
  if(plan.intent==='road-context')return locale==='vi-VN'?'Ngữ cảnh nguy cơ phía trước cần dữ liệu road-context trực tiếp. Nếu nguồn đó không có trong plan hiện tại, KINGMAST sẽ không tự bịa tình trạng đường.':'Ahead-hazard guidance requires live road-context data. KINGMAST will not invent road conditions when that source is unavailable.';
  if(plan.intent==='navigation')return locale==='vi-VN'?'Em có thể tóm tắt tuyến khi dữ liệu tuyến trực tiếp được cung cấp. Plan hiện tại không chứa chi tiết tuyến nên em không đoán đường đi.':'I can summarize a route when live route data is available. The current plan does not contain route details, so I will not guess.';
  if(plan.intent==='charging')return locale==='vi-VN'?'Thông tin sạc phải dựa trên tuyến và nguồn trạm sạc đã được phê duyệt. Chưa đủ dữ liệu trong ngữ cảnh hiện tại để đề xuất một trạm cụ thể.':'Charging guidance must use the active route and an approved charging source. The current context is insufficient to recommend a specific charger.';
  if(plan.intent==='settings')return locale==='vi-VN'?'Em có thể giải thích cài đặt, nhưng thay đổi sâu chỉ thực hiện khi xe đang đỗ và vẫn cần luồng xác nhận của HMI.':'I can explain settings, but deep changes remain parked-only and require the HMI confirmation flow.';
  return locale==='vi-VN'?'Em có thể giải thích cảnh báo, tình trạng xe và thiết bị, tuyến đường, nguy cơ phía trước, sạc và cài đặt được hỗ trợ. Em không điều khiển xe.':'I can explain warnings, vehicle/device health, route context, road hazards, charging and supported settings. I cannot control the vehicle.';
}

async function providerAnswer(input:string,locale:Locale,grounded:PlanResponse,devices:Device[]){
  const url=providerUrl();if(!url)return null;
  const token=(process.env.KINGMAST_ASSISTANT_PROVIDER_TOKEN??'').trim();if(url.protocol==='https:'&&!token)return null;
  const model=(process.env.KINGMAST_ASSISTANT_PROVIDER_MODEL??'kingmast-assistant').trim().slice(0,96);
  const moving=Boolean(grounded.context.speedKmh!==null&&grounded.context.speedKmh>5);
  const system=locale==='vi-VN'
    ?`Bạn là Trợ lý KINGMAST chỉ đọc. Chỉ trả lời từ JSON ngữ cảnh đã cung cấp. Không bịa dữ liệu, không tuyên bố điều khiển xe, không đưa lệnh phanh/lái/ga/số/CAN. Nếu thiếu dữ liệu, nói rõ là chưa có. ${moving?'Xe đang chạy: tối đa 2 câu ngắn.':'Xe đang đỗ: tối đa 4 câu ngắn.'}`
    :`You are the read-only KINGMAST Assistant. Answer only from the supplied JSON context. Do not invent data, claim vehicle control, or issue brake/steering/throttle/gear/CAN commands. State when data is unavailable. ${moving?'Vehicle is moving: maximum 2 short sentences.':'Vehicle is parked: maximum 4 short sentences.'}`;
  const payload={model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({question:input,plan:grounded.plan,executionAllowed:grounded.executionAllowed,vehicleContext:grounded.context,devices,safety:{controlAuthority:'none',readOnly:true}})}],temperature:0.1,max_tokens:moving?140:320};
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  const data=await response.json() as {text?:unknown;choices?:Array<{message?:{content?:unknown}}>};
  const text=cleanText(data.text??data.choices?.[0]?.message?.content,moving?360:900);
  return text||null;
}

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:'assistant-origin-rejected'},{status:403,headers:{'cache-control':'no-store'}});
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return NextResponse.json({error:'invalid-assistant-request'},{status:400});}
  const input=cleanText(body.input,240);if(!input)return NextResponse.json({error:'invalid-assistant-request'},{status:400});
  const locale=normalizeLocale(body.locale);const devices=sanitizeDevices(body.devices);
  let grounded:PlanResponse|null=null;try{grounded=await fetchGroundedPlan(input);}catch{}
  let answer:string|null=null;let mode:'provider'|'grounded-fallback'|'offline-fallback'='offline-fallback';
  if(grounded?.executionAllowed){try{answer=await providerAnswer(input,locale,grounded,devices);if(answer)mode='provider';}catch{answer=null;}}
  if(!answer){answer=deterministicAnswer(grounded,devices,locale);mode=grounded?'grounded-fallback':'offline-fallback';}
  return NextResponse.json({answer,mode,grounded:Boolean(grounded),executionAllowed:grounded?.executionAllowed??false,plan:grounded?.plan??null,context:grounded?.context??null,providerConfigured:Boolean(providerUrl()),controlAuthority:'none'},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
}
