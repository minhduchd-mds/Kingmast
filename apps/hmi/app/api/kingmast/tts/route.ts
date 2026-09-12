import { NextRequest,NextResponse } from 'next/server';
import { approvedOutboundUrl,requireOutboundUrl } from '../../../../lib/outbound-security';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const DEFAULT_VI_STYLE='Nói tiếng Việt tự nhiên, ấm áp và gần gũi như một trợ lý đồng hành trên xe. Phát âm rõ theo phong cách miền Bắc, nhịp vừa phải, câu ngắn, ngắt nghỉ tự nhiên. Không dùng chất giọng phát thanh viên, không đọc máy móc, không tạo cảm giác thúc giục trừ cảnh báo an toàn thực sự.';
const DEFAULT_EN_STYLE='Speak naturally like a calm, friendly in-car assistant. Keep the delivery warm, concise and confident with subtle pauses. Avoid announcer-style or robotic delivery.';

type Provider='openai'|'elevenlabs'|'self-host';
type Body={text?:unknown;locale?:unknown;voice?:unknown;moving?:unknown;style?:unknown};

function enabled(name:string){const value=process.env[name]?.trim().toLowerCase();return value==='1'||value==='true'||value==='yes'||value==='on';}
function sameOrigin(request:NextRequest){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).host===request.nextUrl.host;}catch{return false;}}
function cleanText(value:unknown,max:number){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';}
function safeSelfHostUrl(){const raw=(process.env.KINGMAST_TTS_SELF_HOST_URL??'').trim();if(!raw)return null;return approvedOutboundUrl(raw,'tts-self-host');}
function requestedProvider(value:unknown):Provider|null{const raw=cleanText(value,64).toLowerCase();if(raw.startsWith('openai:'))return'openai';if(raw.startsWith('elevenlabs:'))return'elevenlabs';if(raw==='self-host'||raw.startsWith('self-host:'))return'self-host';return null;}
function requestedVoice(value:unknown){const raw=cleanText(value,96);const index=raw.indexOf(':');return index>0?raw.slice(index+1):raw;}
function configuredProviders():Provider[]{if(!enabled('KINGMAST_CLOUD_TTS_ENABLED'))return[];const preferred=(process.env.KINGMAST_TTS_PROVIDER??'auto').trim().toLowerCase();const available:Provider[]=[];if(process.env.OPENAI_API_KEY?.trim())available.push('openai');if(process.env.ELEVENLABS_API_KEY?.trim())available.push('elevenlabs');if(safeSelfHostUrl())available.push('self-host');if(preferred==='auto')return available;const first=available.find((item)=>item===preferred);return first?[first,...available.filter((item)=>item!==first)]:available;}
function durationStyle(locale:string,moving:boolean,dynamic:string){const base=locale==='vi-VN'?DEFAULT_VI_STYLE:DEFAULT_EN_STYLE;const drive=locale==='vi-VN'?(moving?'Xe đang chạy: tối đa hai câu ngắn, ưu tiên thông tin có thể nghe trong một lần.':'Xe đang đỗ: có thể giải thích tự nhiên hơn nhưng vẫn súc tích.'):(moving?'Vehicle is moving: use at most two short sentences that can be understood in one listen.':'Vehicle is parked: a slightly more conversational answer is fine, but stay concise.');return[base,drive,dynamic].filter(Boolean).join('\n').slice(0,1800);}

async function openAiSpeech(input:{text:string;locale:string;voice:string;moving:boolean;style:string}){
  const key=(process.env.OPENAI_API_KEY??'').trim();if(!key)throw new Error('openai-not-configured');
  const model=(process.env.KINGMAST_OPENAI_TTS_MODEL??'gpt-4o-mini-tts').trim();
  const voice=input.voice||(process.env.KINGMAST_OPENAI_TTS_VOICE??'marin').trim();
  const payload:Record<string,unknown>={model,voice,input:input.text,response_format:'mp3'};
  if(model.includes('gpt-4o-mini-tts'))payload.instructions=durationStyle(input.locale,input.moving,input.style);
  const url=requireOutboundUrl('https://api.openai.com/v1/audio/speech','tts-openai');
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${key}`},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw new Error(`openai-tts-${response.status}`);return{response,provider:'openai' as const,voice};
}

async function elevenLabsSpeech(input:{text:string;voice:string}){
  const key=(process.env.ELEVENLABS_API_KEY??'').trim();if(!key)throw new Error('elevenlabs-not-configured');
  const voice=input.voice||(process.env.KINGMAST_ELEVENLABS_TTS_VOICE??'EXAVITQu4vr4xnSDxMaL').trim();
  const model=(process.env.KINGMAST_ELEVENLABS_TTS_MODEL??'eleven_multilingual_v2').trim();
  const url=requireOutboundUrl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`,'tts-elevenlabs');
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','xi-api-key':key},body:JSON.stringify({text:input.text,model_id:model,voice_settings:{stability:.34,similarity_boost:.78,style:.3,use_speaker_boost:true}}),cache:'no-store',signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw new Error(`elevenlabs-tts-${response.status}`);return{response,provider:'elevenlabs' as const,voice};
}

async function selfHostedSpeech(input:{text:string;locale:string;voice:string;moving:boolean;style:string}){
  const url=safeSelfHostUrl();if(!url)throw new Error('self-host-not-configured');
  const token=(process.env.KINGMAST_TTS_SELF_HOST_TOKEN??'').trim();
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({text:input.text,locale:input.locale,voice:input.voice||undefined,moving:input.moving,style:durationStyle(input.locale,input.moving,input.style)}),cache:'no-store',signal:AbortSignal.timeout(6500)});
  if(!response.ok)throw new Error(`self-host-tts-${response.status}`);const type=response.headers.get('content-type')??'';if(!type.startsWith('audio/'))throw new Error('self-host-invalid-content-type');return{response,provider:'self-host' as const,voice:input.voice||'default'};
}

async function synthesize(provider:Provider,input:{text:string;locale:string;voice:string;moving:boolean;style:string}){if(provider==='openai')return openAiSpeech(input);if(provider==='elevenlabs')return elevenLabsSpeech(input);return selfHostedSpeech(input);}

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:'tts-origin-rejected'},{status:403,headers:{'cache-control':'no-store'}});
  if(!enabled('KINGMAST_CLOUD_TTS_ENABLED'))return NextResponse.json({error:'cloud-tts-disabled',fallback:'client-voice'},{status:503,headers:{'cache-control':'no-store','x-kingmast-cloud-policy':'disabled'}});
  let body:Body;try{body=await request.json() as Body;}catch{return NextResponse.json({error:'invalid-tts-request'},{status:400});}
  const moving=body.moving===true;const text=cleanText(body.text,moving?520:1800);if(!text)return NextResponse.json({error:'invalid-tts-text'},{status:400});
  const locale=body.locale==='vi-VN'?'vi-VN':'en-US';const voice=requestedVoice(body.voice);const style=cleanText(body.style,600);
  const requested=requestedProvider(body.voice);const configured=configuredProviders();const providers=requested&&configured.includes(requested)?[requested,...configured.filter((item)=>item!==requested)]:configured;
  if(!providers.length)return NextResponse.json({error:'neural-tts-not-configured',fallback:'client-voice'},{status:503,headers:{'cache-control':'no-store'}});
  for(const provider of providers){try{const result=await synthesize(provider,{text,locale,voice,moving,style});const bytes=await result.response.arrayBuffer();if(!bytes.byteLength)continue;return new NextResponse(bytes,{status:200,headers:{'content-type':result.response.headers.get('content-type')||'audio/mpeg','cache-control':'no-store','x-content-type-options':'nosniff','x-kingmast-tts-provider':result.provider,'x-kingmast-tts-voice':result.voice}});}catch{/* bounded provider failover */}}
  return NextResponse.json({error:'neural-tts-unavailable',fallback:'client-voice'},{status:502,headers:{'cache-control':'no-store'}});
}
