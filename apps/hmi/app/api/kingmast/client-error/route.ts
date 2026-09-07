import { NextResponse } from 'next/server';

export const runtime='nodejs';

const MAX_BODY_BYTES=8_192;
const RATE_WINDOW_MS=60_000;
const RATE_LIMIT=20;
const MAX_RATE_KEYS=256;
const MAX_EVENT_SKEW_MS=24*60*60*1_000;
const rateWindows=new Map<string,{startedAtMs:number;count:number}>();

function clip(value:unknown,max:number){return typeof value==='string'?value.slice(0,max):'';}
function sameOrigin(request:Request){
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
}
function requestKey(request:Request){
  const forwarded=(request.headers.get('x-vercel-forwarded-for')??request.headers.get('x-forwarded-for')??'').split(',')[0]?.trim();
  return forwarded?.slice(0,96)||'unknown';
}
function pruneRateWindows(nowMs:number){for(const[key,value]of rateWindows)if(nowMs-value.startedAtMs>=RATE_WINDOW_MS)rateWindows.delete(key);}
function rateAllowed(request:Request,nowMs=Date.now()){
  pruneRateWindows(nowMs);
  let key=requestKey(request);
  if(!rateWindows.has(key)&&rateWindows.size>=MAX_RATE_KEYS)key='overflow';
  const current=rateWindows.get(key);
  if(!current||nowMs-current.startedAtMs>=RATE_WINDOW_MS){rateWindows.set(key,{startedAtMs:nowMs,count:1});return{allowed:true,retryAfterS:0};}
  if(current.count>=RATE_LIMIT)return{allowed:false,retryAfterS:Math.max(1,Math.ceil((RATE_WINDOW_MS-(nowMs-current.startedAtMs))/1_000))};
  current.count+=1;
  return{allowed:true,retryAfterS:0};
}
function redact(value:unknown,max:number){
  return clip(value,max)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/gi,'Bearer [redacted]')
    .replace(/([?&](?:token|key|secret|password|auth|authorization)=)[^&#\s]+/gi,'$1[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,'[redacted]');
}
function safePath(value:unknown){return clip(value,300).split(/[?#]/,1)[0]??'';}

export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({accepted:false,error:'client-report-origin-rejected'},{status:403,headers:{'cache-control':'no-store'}});
  const rate=rateAllowed(request);
  if(!rate.allowed)return NextResponse.json({accepted:false,error:'client-report-rate-limited'},{status:429,headers:{'cache-control':'no-store','retry-after':String(rate.retryAfterS)}});
  const contentLength=Number(request.headers.get('content-length')??'0');
  if(Number.isFinite(contentLength)&&contentLength>MAX_BODY_BYTES)return NextResponse.json({accepted:false,error:'payload-too-large'},{status:413,headers:{'cache-control':'no-store'}});
  if(request.headers.get('x-kingmast-client-error')!=='1')return NextResponse.json({accepted:false,error:'invalid-client-report'},{status:400,headers:{'cache-control':'no-store'}});
  let raw='';
  try{raw=await request.text();}catch{return NextResponse.json({accepted:false,error:'invalid-body'},{status:400,headers:{'cache-control':'no-store'}});}
  if(raw.length>MAX_BODY_BYTES)return NextResponse.json({accepted:false,error:'payload-too-large'},{status:413,headers:{'cache-control':'no-store'}});
  let input:Record<string,unknown>={};
  try{const parsed=JSON.parse(raw) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))input=parsed as Record<string,unknown>;else throw new Error('invalid');}catch{return NextResponse.json({accepted:false,error:'invalid-json'},{status:400,headers:{'cache-control':'no-store'}});}
  const nowMs=Date.now();
  const candidateOccurredAt=typeof input.occurredAtMs==='number'&&Number.isFinite(input.occurredAtMs)?input.occurredAtMs:nowMs;
  const occurredAtMs=Math.abs(candidateOccurredAt-nowMs)<=MAX_EVENT_SKEW_MS?candidateOccurredAt:nowMs;
  const report={
    boundary:input.boundary==='global'?'global':'route',
    name:redact(input.name,80),
    message:redact(input.message,800),
    stack:redact(input.stack,5000),
    digest:redact(input.digest,160),
    path:safePath(input.path),
    occurredAtMs,
  };
  console.error('[KINGMAST_CLIENT_ERROR]',JSON.stringify(report));
  return NextResponse.json({accepted:true},{status:202,headers:{'cache-control':'no-store'}});
}
