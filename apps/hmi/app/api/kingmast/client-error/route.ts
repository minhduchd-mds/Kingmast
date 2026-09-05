import { NextResponse } from 'next/server';

export const runtime='nodejs';

const MAX_BODY_BYTES=8_192;
function clip(value:unknown,max:number){return typeof value==='string'?value.slice(0,max):'';}

export async function POST(request:Request){
  const contentLength=Number(request.headers.get('content-length')??'0');
  if(Number.isFinite(contentLength)&&contentLength>MAX_BODY_BYTES)return NextResponse.json({accepted:false,error:'payload-too-large'},{status:413,headers:{'cache-control':'no-store'}});
  if(request.headers.get('x-kingmast-client-error')!=='1')return NextResponse.json({accepted:false,error:'invalid-client-report'},{status:400,headers:{'cache-control':'no-store'}});
  let raw='';
  try{raw=await request.text();}catch{return NextResponse.json({accepted:false,error:'invalid-body'},{status:400,headers:{'cache-control':'no-store'}});}
  if(raw.length>MAX_BODY_BYTES)return NextResponse.json({accepted:false,error:'payload-too-large'},{status:413,headers:{'cache-control':'no-store'}});
  let input:Record<string,unknown>={};
  try{const parsed=JSON.parse(raw) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))input=parsed as Record<string,unknown>;else throw new Error('invalid');}catch{return NextResponse.json({accepted:false,error:'invalid-json'},{status:400,headers:{'cache-control':'no-store'}});}
  const report={
    boundary:input.boundary==='global'?'global':'route',
    name:clip(input.name,80),
    message:clip(input.message,800),
    stack:clip(input.stack,5000),
    digest:clip(input.digest,160),
    path:clip(input.path,300),
    occurredAtMs:typeof input.occurredAtMs==='number'&&Number.isFinite(input.occurredAtMs)?input.occurredAtMs:Date.now(),
  };
  console.error('[KINGMAST_CLIENT_ERROR]',JSON.stringify(report));
  return NextResponse.json({accepted:true},{status:202,headers:{'cache-control':'no-store'}});
}
