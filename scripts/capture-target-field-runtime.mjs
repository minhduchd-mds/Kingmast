const base=new URL(process.env.KINGMAST_TARGET_DIAGNOSTICS_URL??'http://127.0.0.1:4000');
const allowedHosts=new Set(['127.0.0.1','localhost','::1','[::1]']);
if(!allowedHosts.has(base.hostname))throw new Error('KINGMAST target diagnostics capture is restricted to a loopback host');
if(base.protocol!=='http:'&&base.protocol!=='https:')throw new Error('KINGMAST target diagnostics URL must use http or https');
if(base.username||base.password)throw new Error('credentials must not be embedded in KINGMAST target diagnostics URL');
base.pathname='/';base.search='';base.hash='';

const viewerToken=(process.env.KINGMAST_TARGET_VIEWER_TOKEN??'').trim();
const edgeToken=(process.env.KINGMAST_TARGET_EDGE_TOKEN??'').trim();
const MAX_RESPONSE_BYTES=64*1024;

async function responseJson(response,endpoint){
  const text=await response.text();
  if(Buffer.byteLength(text)>MAX_RESPONSE_BYTES)throw new Error(`${endpoint} response exceeded 64 KiB`);
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error(`${endpoint} returned invalid JSON`);}
  if(!response.ok)throw new Error(`${endpoint} returned HTTP ${response.status}`);
  return parsed;
}
async function request(path,init={}){
  const url=new URL(path,base);
  return fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(5_000)});
}
async function healthDetails(){
  let response=await request('/v3/health/details');
  if(response.ok)return responseJson(response,'/v3/health/details');
  await response.arrayBuffer();
  if(!viewerToken)throw new Error('/v3/health/details requires viewer authentication and KINGMAST_TARGET_VIEWER_TOKEN is not configured');
  const bootstrap=await request('/v3/session',{method:'POST',headers:{'x-kingmast-viewer-token':viewerToken}});
  if(!bootstrap.ok){await bootstrap.arrayBuffer();throw new Error(`/v3/session returned HTTP ${bootstrap.status}`);}
  const setCookie=bootstrap.headers.get('set-cookie')??'';
  await bootstrap.arrayBuffer();
  const cookie=setCookie.split(';',1)[0]?.trim();
  if(!cookie)throw new Error('/v3/session did not return a scoped viewer session cookie');
  response=await request('/v3/health/details',{headers:{cookie}});
  return responseJson(response,'/v3/health/details');
}
async function optionalJson(path,headers={}){
  try{
    const response=await request(path,{headers});
    if(!response.ok){await response.arrayBuffer();return null;}
    return await responseJson(response,path);
  }catch{return null;}
}
function boundedCounter(value){return Number.isSafeInteger(value)&&value>=0&&value<=1_000_000_000?value:0;}
function boundedAge(value){return value===null?null:Number.isSafeInteger(value)&&value>=0&&value<=86_400_000?value:null;}
function safeProvider(provider){
  if(!provider||typeof provider!=='object')return null;
  const state=['healthy','degraded','stale'].includes(provider.state)?provider.state:'stale';
  const trustStatus=['verified','expiring','expired','revoked','untrusted','unknown'].includes(provider.trustStatus)?provider.trustStatus:'unknown';
  return{state,trustStatus,liveV2xTrusted:provider.liveV2xTrusted===true,snapshotAgeMs:boundedCounter(provider.snapshotAgeMs)};
}

const health=await healthDetails();
const connected=await optionalJson('/connected-road/status');
const providerIdentity=await optionalJson('/v4/provider-identity/status',edgeToken?{'x-kingmast-edge-token':edgeToken}:{});

const edge=health?.edge??{};
const sensorAges=edge.sensorAgesMs??{};
const providers=Array.isArray(connected?.providers)?connected.providers.map(safeProvider).filter(Boolean).slice(0,32):[];
const replay=providerIdentity?.replay??null;
const runtime={
  edge:{
    status:['live','degraded','offline'].includes(edge.status)?edge.status:'offline',
    rejectedPackets:boundedCounter(edge.rejectedPackets),
    sensorAgesMs:{gnss:boundedAge(sensorAges.gnss),radarFront:boundedAge(sensorAges.radarFront),camera:boundedAge(sensorAges.camera)},
  },
  providerTrust:{
    authRejected:0,
    replayRejected:boundedCounter(replay?.rejected),
    capacityRejected:boundedCounter(replay?.capacityRejected),
    providers,
  },
  coverage:{
    sensorAges:true,
    edgeRejectedPackets:true,
    providerAuthRejected:false,
    providerReplayRejected:replay!==null,
    providerCapacityRejected:replay!==null,
    providerStatuses:connected!==null,
  },
};
const encoded=JSON.stringify(runtime,null,2)+'\n';
if(Buffer.byteLength(encoded)>MAX_RESPONSE_BYTES)throw new Error('bounded target field runtime output exceeded 64 KiB');
process.stdout.write(encoded);
console.error(`KINGMAST bounded target field runtime captured to stdout; provider-auth rejection counter coverage=${runtime.coverage.providerAuthRejected}.`);
