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
  if(bad.length){const detail=bad.map((device)=>{const fault=device.faults[0];return fault?`${device.label}: ${fault.summary} (${fault.layer}/${fault.code})${fault.action?` — ${fault.action}`:''}`:`${device.label}: ${device.health}`;}).join('; ');return locale==='vi-VN'?`Em thấy ${bad.length} thiết bị cần chú ý: ${detail}.`:`I found ${bad.length} device issue(s) that need attention: ${detail}.`;}
  if(disconnected.length){const names=disconnected.map((device)=>device.label).join(', ');return locale==='vi-VN'?`Em chưa thấy kết nối từ: ${names}.`:`I am not seeing a connection from: ${names}.`;}
  return locale==='vi-VN'?'Em chưa thấy thiết bị nào trong danh sách chẩn đoán đang báo lỗi.':'I am not seeing a reported fault in the current diagnostic device list.';
}
function deterministicAnswer(planResponse:PlanResponse|null,devices:Device[],locale:Locale){
  if(!planResponse){if(devices.some((item)=>item.health==='fault'||item.health==='warning'||item.health==='calibration-required'||item.connection==='disconnected'))return deviceFallback(devices,locale);return locale==='vi-VN'?'Em chưa lấy được ngữ cảnh trực tiếp lúc này nên sẽ không đoán tình trạng xe. Em vẫn có thể dùng các trạng thái thiết bị cục bộ đã nhận được.':'I cannot reach live context right now, so I will not guess vehicle state. I can still use locally reported device status.';}
  const{plan,context,executionAllowed}=planResponse;
  if(!executionAllowed)return locale==='vi-VN'?'Phần này chỉ mở khi xe đang đỗ. Khi anh dừng xe, em có thể hướng dẫn tiếp.':'This is available only while parked. I can guide you through it once the vehicle is stopped.';
  if(plan.intent==='unsupported')return locale==='vi-VN'?'Phần này em chưa hỗ trợ trong chế độ trợ lý chỉ đọc. Anh có thể hỏi em về cảnh báo, thiết bị, tuyến đường, tình trạng đường hoặc sạc.':'I cannot do that in the read-only assistant, but I can help with alerts, device health, routes, road context or charging.';
  if(plan.intent==='vehicle-status'){
    const deviceText=deviceFallback(devices,locale);const sensors=sensorSummary(context.sensorHealth,locale);
    return locale==='vi-VN'?`${deviceText} Trạng thái cảm biến hiện tại: ${sensors}.`:`${deviceText} Current sensor state: ${sensors}.`;
  }
  if(plan.intent==='explain-alert')return context.activeAlertCount>0?(locale==='vi-VN'?`Hiện có ${context.activeAlertCount} cảnh báo đang hoạt động. Em sẽ chỉ giải thích dựa trên telemetry đã xác thực, không đoán thêm nguyên nhân.`:`There are ${context.activeAlertCount} active alert(s). I will explain them only from verified telemetry and will not invent a cause.`):(locale==='vi-VN'?'Hiện em chưa thấy cảnh báo nào đang hoạt động trong ngữ cảnh đã xác thực.':'I am not seeing an active alert in the verified runtime context.');
  if(plan.intent==='road-context')return locale==='vi-VN'?'Em cần dữ liệu tình trạng đường trực tiếp để nói chính xác phía trước có gì. Nếu nguồn đó chưa có, em sẽ báo chưa có thay vì đoán.':'I need live road-context data to describe what is ahead accurately. If that source is unavailable, I will say so rather than guess.';
  if(plan.intent==='navigation')return locale==='vi-VN'?'Anh nói điểm đến, ví dụ “tìm đường ít tắc tới Hồ Gươm”, em sẽ tìm tuyến và đưa lên bản đồ nếu dịch vụ định tuyến đang khả dụng.':'Tell me a destination, for example “find the fastest route to the airport,” and I will put the route on the map when routing is available.';
  if(plan.intent==='charging')return locale==='vi-VN'?'Em sẽ chỉ gợi ý trạm sạc khi có tuyến và nguồn trạm sạc phù hợp. Hiện ngữ cảnh này chưa đủ để chọn một trạm cụ thể.':'I will recommend a charger only when the active route and an approved charging source support it. There is not enough context yet to name a specific station.';
  if(plan.intent==='settings')return locale==='vi-VN'?'Em có thể giải thích cài đặt. Những thay đổi cần thao tác sâu vẫn chỉ mở khi xe đỗ và có bước xác nhận trên HMI.':'I can explain settings. Changes that require deeper interaction remain parked-only and still require HMI confirmation.';
  return locale==='vi-VN'?'Anh có thể hỏi em về cảnh báo, tình trạng xe và thiết bị, tuyến đường, tình trạng đường, sạc hoặc các cài đặt được hỗ trợ.':'You can ask me about alerts, vehicle and device health, routes, road conditions, charging or supported settings.';
}

async function providerAnswer(input:string,locale:Locale,grounded:PlanResponse,devices:Device[]){
  const url=providerUrl();if(!url)return null;
  const token=(process.env.KINGMAST_ASSISTANT_PROVIDER_TOKEN??'').trim();if(url.protocol==='https:'&&!token)return null;
  const model=(process.env.KINGMAST_ASSISTANT_PROVIDER_MODEL??'kingmast-assistant').trim().slice(0,96);
  const moving=Boolean(grounded.context.speedKmh!==null&&grounded.context.speedKmh>5);
  const system=locale==='vi-VN'
    ?`Bạn là trợ lý đồng hành KINGMAST, chỉ đọc và không có quyền điều khiển xe. Hãy nói tự nhiên, ấm áp, bình tĩnh; xưng “em” và gọi người dùng là “anh” khi phù hợp. Trả lời ý chính trước, dùng câu ngắn, tránh văn phong máy móc hoặc lặp lại cảnh báo pháp lý không cần thiết. Chỉ dùng JSON ngữ cảnh đã cung cấp; nếu thiếu dữ liệu hãy nói rõ là chưa có. Tuyệt đối không bịa dữ liệu, không tuyên bố điều khiển xe và không đưa lệnh phanh/lái/ga/số/CAN. ${moving?'Xe đang chạy: tối đa 2 câu rất ngắn, ưu tiên nghe hiểu một lần.':'Xe đang đỗ: tối đa 4 câu ngắn, có thể giải thích thân thiện hơn.'}`
    :`You are KINGMAST's read-only in-car companion. Sound natural, warm and calm. Lead with the useful answer, use short conversational sentences, and avoid robotic wording or repetitive safety disclaimers. Use only the supplied JSON context; clearly say when data is unavailable. Never invent data, claim vehicle control, or issue brake/steering/throttle/gear/CAN commands. ${moving?'Vehicle is moving: maximum 2 very short sentences that are easy to understand once.':'Vehicle is parked: maximum 4 short conversational sentences.'}`;
  const payload={model,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify({question:input,plan:grounded.plan,executionAllowed:grounded.executionAllowed,vehicleContext:grounded.context,devices,safety:{controlAuthority:'none',readOnly:true}})}],temperature:0.2,max_tokens:moving?140:320};
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
