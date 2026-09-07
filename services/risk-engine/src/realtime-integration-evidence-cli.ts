import {spawn,type ChildProcess} from 'node:child_process';
import {RealtimeLinkAccumulator} from '@kingmast/contracts/realtime-health';

const PORT=4177;
const HOST='127.0.0.1';
const HTTP=`http://${HOST}:${PORT}`;
const WS=`ws://${HOST}:${PORT}/v3/stream`;
const SERVER_READY_TIMEOUT_MS=15_000;
const MESSAGE_TIMEOUT_MS=5_000;
const MAX_LOG_CHARS=16_384;

interface ServerHandle{process:ChildProcess;startedAtMs:number;logs:()=>string;}

function boundedAppend(current:string,chunk:string){const next=current+chunk;return next.length<=MAX_LOG_CHARS?next:next.slice(-MAX_LOG_CHARS);}
function delay(ms:number){return new Promise((resolve)=>setTimeout(resolve,ms));}

function startServer():ServerHandle{
  const command=process.platform==='win32'?'pnpm.cmd':'pnpm';
  const child=spawn(command,['exec','tsx','src/server.ts'],{
    cwd:process.cwd(),
    env:{...process.env,HOST,PORT:String(PORT),KINGMAST_ALLOW_INSECURE_LOCAL_DEV:'1',KINGMAST_REQUIRE_DEVICE_AUTH:'0',KINGMAST_REQUIRE_OPERATOR_AUTH:'0'},
    stdio:['ignore','pipe','pipe'],
  });
  let log='';
  child.stdout?.on('data',(chunk)=>{log=boundedAppend(log,String(chunk));});
  child.stderr?.on('data',(chunk)=>{log=boundedAppend(log,String(chunk));});
  return{process:child,startedAtMs:Date.now(),logs:()=>log};
}

async function waitForServer(handle:ServerHandle){
  const deadline=Date.now()+SERVER_READY_TIMEOUT_MS;
  while(Date.now()<deadline){
    if(handle.process.exitCode!==null)throw new Error(`risk-engine exited before readiness (${handle.process.exitCode})\n${handle.logs()}`);
    try{const response=await fetch(`${HTTP}/health`);if(response.ok)return Date.now()-handle.startedAtMs;}catch{}
    await delay(100);
  }
  throw new Error(`risk-engine readiness timeout\n${handle.logs()}`);
}

async function stopServer(handle:ServerHandle){
  if(handle.process.exitCode!==null)return;
  handle.process.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve)=>handle.process.once('exit',()=>resolve())),
    delay(3_000).then(()=>{if(handle.process.exitCode===null)handle.process.kill('SIGKILL');}),
  ]);
}

async function connectSocket():Promise<WebSocket>{
  const Ctor=globalThis.WebSocket;
  if(!Ctor)throw new Error('Node WebSocket client is unavailable');
  const socket=new Ctor(WS);
  await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('WebSocket open timeout')),MESSAGE_TIMEOUT_MS);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('WebSocket open error'));},{once:true});
  });
  return socket;
}

async function waitForTelemetry(socket:WebSocket,sequence:number){
  return await new Promise<{message:any;clientAtMs:number}>((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error(`telemetry sequence ${sequence} timeout`));},MESSAGE_TIMEOUT_MS);
    const onMessage=(event:MessageEvent)=>{
      try{
        const parsed=JSON.parse(String(event.data));
        if(parsed?.type!=='telemetry'||parsed?.frame?.sequence!==sequence)return;
        const result={message:parsed,clientAtMs:Date.now()};cleanup();resolve(result);
      }catch{}
    };
    const onClose=()=>{cleanup();reject(new Error('WebSocket closed before telemetry'));};
    function cleanup(){clearTimeout(timer);socket.removeEventListener('message',onMessage);socket.removeEventListener('close',onClose);}
    socket.addEventListener('message',onMessage);socket.addEventListener('close',onClose,{once:true});
  });
}

function packet(bootId:string,sequence:number){
  const now=Date.now();
  return{
    protocolVersion:1,deviceId:'ci-vehicle-computer',bootId,sequence,timestampMs:now,
    gnss:{lat:21.0278,lng:105.8342,speedKmh:36,headingDeg:90,accuracyM:2,timestampMs:now,source:'gnss'},
    sensors:{radarFront:'ok',radarRear:'ok',camera:'ok',can:'ok',gnssImu:'ok',ecu:'ok'},
    radar:{radarId:'ci-radar-front',timestampMs:now,tracks:[]},
    camera:{cameraId:'ci-camera-front',timestampMs:now,detections:[]},
  } as const;
}

async function postPacket(payload:ReturnType<typeof packet>){
  const response=await fetch(`${HTTP}/v3/edge/frame`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  let body:unknown=null;try{body=await response.json();}catch{}
  return{status:response.status,ok:response.ok,body};
}

const link=new RealtimeLinkAccumulator();
let firstServer:ServerHandle|null=null;
let secondServer:ServerHandle|null=null;
let firstSocket:WebSocket|null=null;
let secondSocket:WebSocket|null=null;
let firstReadyMs=0;
let restartReadyMs=0;
let firstTransportMs:number|null=null;
let secondTransportMs:number|null=null;
let regressionStatus=0;
let failure:string|null=null;

try{
  firstServer=startServer();firstReadyMs=await waitForServer(firstServer);
  link.recordConnectAttempt();firstSocket=await connectSocket();link.recordConnected();
  const firstWait=waitForTelemetry(firstSocket,1);const firstPost=await postPacket(packet('boot-a-ci',1));if(!firstPost.ok)throw new Error(`first edge packet rejected: ${firstPost.status}`);
  const first=await firstWait;
  const firstSession=`${first.message.diagnostics?.deviceId??'unknown'}:${first.message.diagnostics?.bootId??'unknown'}`;
  const firstDecision=link.observeTelemetry({serverEnvelopeAtMs:first.message.receivedAtMs,ingressAtMs:first.message.diagnostics?.lastIngressAtMs??null,clientAtMs:first.clientAtMs,session:firstSession,sequence:first.message.frame.sequence});
  if(!firstDecision.accepted)throw new Error('first realtime observation rejected');
  firstTransportMs=firstDecision.serverToClientMs;

  const regression=await postPacket(packet('boot-a-ci',0));regressionStatus=regression.status;
  if(regression.ok)throw new Error('same-boot sequence regression unexpectedly accepted by edge guard');

  firstSocket.close();link.recordDisconnect();firstSocket=null;await stopServer(firstServer);firstServer=null;
  const restartStarted=Date.now();secondServer=startServer();await waitForServer(secondServer);restartReadyMs=Date.now()-restartStarted;
  link.recordConnectAttempt();secondSocket=await connectSocket();link.recordConnected();
  const secondWait=waitForTelemetry(secondSocket,0);const secondPost=await postPacket(packet('boot-b-ci',0));if(!secondPost.ok)throw new Error(`post-restart edge packet rejected: ${secondPost.status}`);
  const second=await secondWait;
  const secondSession=`${second.message.diagnostics?.deviceId??'unknown'}:${second.message.diagnostics?.bootId??'unknown'}`;
  const secondDecision=link.observeTelemetry({serverEnvelopeAtMs:second.message.receivedAtMs,ingressAtMs:second.message.diagnostics?.lastIngressAtMs??null,clientAtMs:second.clientAtMs,session:secondSession,sequence:second.message.frame.sequence});
  if(!secondDecision.accepted||!secondDecision.sessionChanged)throw new Error('boot-session reset was not accepted after process restart');
  secondTransportMs=secondDecision.serverToClientMs;
}catch(error){failure=error instanceof Error?error.message:String(error);
}finally{
  try{secondSocket?.close();}catch{}
  try{firstSocket?.close();}catch{}
  if(secondServer)await stopServer(secondServer);
  if(firstServer)await stopServer(firstServer);
}

const snapshot=link.snapshot();
const checks={
  firstServerReady:firstReadyMs>0,
  firstTelemetryDelivered:firstTransportMs!==null,
  edgeSequenceRegressionRejected:regressionStatus>=400,
  processRestartReady:restartReadyMs>0&&restartReadyMs<=SERVER_READY_TIMEOUT_MS,
  reconnectSucceeded:snapshot.successfulConnections===2&&snapshot.reconnects===1,
  bootSessionChanged:snapshot.sessionChanges===1&&snapshot.lastSequence===0,
  postRestartTelemetryDelivered:secondTransportMs!==null,
  noMalformedMessages:snapshot.malformedMessages===0,
  noClockAnomalies:snapshot.clockAnomalies===0,
};
const allPassed=!failure&&Object.values(checks).every(Boolean);
const report={
  schema:'kingmast-realtime-loopback-integration-report/v1',generatedAt:new Date().toISOString(),controlAuthority:'none',
  qualificationClaim:'ci-loopback-process-integration-only-not-target-hardware',physicalControllerTest:false,targetHardwareQualified:false,browserRenderMeasured:false,
  transport:'loopback-http-websocket',serverStartMs:firstReadyMs,restartReadyMs,firstServerToClientMs:firstTransportMs,postRestartServerToClientMs:secondTransportMs,
  regressionHttpStatus:regressionStatus,snapshot,checks,failure,allPassed,
  note:'Exercises the real Fastify edge ingress and WebSocket stream on CI loopback. It is not a physical network, browser render, vehicle-computer or HIL qualification result.',
};
console.log(JSON.stringify(report,null,2));
if(!allPassed)process.exitCode=1;
