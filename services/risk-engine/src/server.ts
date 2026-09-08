import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import type {
  CameraDetectionFrame,
  DetectedObject,
  EdgeDiagnostics,
  EdgeTelemetryPacket,
  Geofence,
  RadarTrackFrame,
  RealtimeHeartbeatEnvelope,
  RealtimeTelemetryEnvelope,
  SensorHealth,
  Severity,
  TelemetryFrame,
  VehiclePosition,
} from '@kingmast/contracts';
import { issueViewerSession,readViewerSession,verifyViewerSession,VIEWER_SESSION_COOKIE,VIEWER_SESSION_TTL_S } from '@kingmast/contracts/viewer-session';
import { assessRisk } from './risk.js';
import { riskMetricsSnapshot } from './risk-observability.js';
import { buildLocationAlerts } from './object-alerts.js';
import { projectPoint } from './geo.js';
import { fuseEdgePerception } from './edge-fusion.js';
import { AlertStabilizer } from './alert-stabilizer.js';
import { EdgeEventBuffer } from './event-buffer.js';
import { applySensorFreshness, EdgePacketGuard, sensorAges } from './edge-guard.js';
import { roadContextRoutes } from './road-context-routes.js';
import { DriverAssistRuntime } from './driver-assist-runtime.js';
import { assertReadOnlyAssistantPlan,planAssistantRequest } from './ai-assistant.js';
import { deviceAuthSummary,parseDeviceKeyRegistry,verifyDeviceIngressAuth,verifyDevicePacketAuth,type DeviceIngressScope } from './device-auth.js';
import { BoundedFixedWindowRateLimiter,BoundedMonotonicTimestampStore } from './bounded-state.js';
import {OperatorReplayGuard,operatorAuthSummary,parseOperatorKeyRegistry,verifyOperatorRequest,type OperatorScope} from './operator-auth.js';
import {ConfigurationAuditBuffer,type ConfigurationAuthMode} from './configuration-audit.js';

const HOST=(process.env.HOST??'127.0.0.1').trim();
const ALLOW_INSECURE_LOCAL_DEV=process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1';
const EDGE_TOKEN=(process.env.KINGMAST_EDGE_TOKEN??'').trim();
const VIEWER_TOKEN=(process.env.KINGMAST_VIEWER_TOKEN??'').trim();
const CONFIG_TOKEN=(process.env.KINGMAST_CONFIG_TOKEN??'').trim();
const REQUIRE_DEVICE_AUTH=process.env.KINGMAST_REQUIRE_DEVICE_AUTH==='1';
const DEVICE_KEYS=parseDeviceKeyRegistry(process.env.KINGMAST_DEVICE_KEYS_JSON??'{}');
const REQUIRE_OPERATOR_AUTH=process.env.KINGMAST_REQUIRE_OPERATOR_AUTH==='1';
const OPERATOR_KEYS=parseOperatorKeyRegistry(process.env.KINGMAST_OPERATOR_KEYS_JSON??'{}');
const LEGACY_MAX_AGE_MS=30_000;
const LEGACY_MAX_FUTURE_SKEW_MS=5_000;
const ROUTE_RATE_LIMIT_MAX_KEYS=4_096;
const PUBLIC_COMPUTE_MAX_KEYS=1_024;
const CONFIG_WRITE_MAX_KEYS=256;
const OPERATOR_REPLAY_MAX_ENTRIES=4_096;
const LEGACY_TIMESTAMP_MAX_KEYS=1_024;
const LEGACY_TIMESTAMP_TTL_MS=5*60_000;
const DEFAULT_ROUTE_RATE_LIMIT={max:600,timeWindow:60_000} as const;

function isLoopback(host:string){return host==='127.0.0.1'||host==='localhost'||host==='::1';}
function validateSecret(name:string,value:string,minLength=16){if(value&&value.length<minLength)throw new Error(`${name} must be at least ${minLength} characters`);}
validateSecret('KINGMAST_EDGE_TOKEN',EDGE_TOKEN);
validateSecret('KINGMAST_VIEWER_TOKEN',VIEWER_TOKEN);
validateSecret('KINGMAST_CONFIG_TOKEN',CONFIG_TOKEN,32);
if(ALLOW_INSECURE_LOCAL_DEV&&!isLoopback(HOST))throw new Error('KINGMAST_ALLOW_INSECURE_LOCAL_DEV may only be used on a loopback host');
if(!ALLOW_INSECURE_LOCAL_DEV&&(!EDGE_TOKEN||!VIEWER_TOKEN))throw new Error('KINGMAST_EDGE_TOKEN and KINGMAST_VIEWER_TOKEN are required unless explicit loopback-only insecure development is enabled');
if(REQUIRE_DEVICE_AUTH&&deviceAuthSummary(DEVICE_KEYS).activeKeys===0)throw new Error('KINGMAST_REQUIRE_DEVICE_AUTH requires at least one currently active per-device key');
if(REQUIRE_OPERATOR_AUTH&&operatorAuthSummary(OPERATOR_KEYS).activeKeys===0)throw new Error('KINGMAST_REQUIRE_OPERATOR_AUTH requires at least one currently active operator key');

interface RouteRateLimitConfig {rateLimit?:{max:number;timeWindow:number};}
const routeRateLimiter=new BoundedFixedWindowRateLimiter(ROUTE_RATE_LIMIT_MAX_KEYS);
const app=Fastify({logger:true,bodyLimit:256_000});
await app.register(helmet);
await app.register(cors,{origin:process.env.HMI_ORIGIN??'http://localhost:3000',methods:['GET','POST'],credentials:true,allowedHeaders:['content-type','authorization','x-kingmast-edge-token','x-kingmast-viewer-token','x-kingmast-config-token','x-kingmast-device-id','x-kingmast-device-key-id','x-kingmast-device-signature','x-kingmast-operator-id','x-kingmast-operator-key-id','x-kingmast-operator-timestamp-ms','x-kingmast-operator-nonce','x-kingmast-operator-signature']});
await app.register(websocket);
app.addHook('onRequest',async(request,reply)=>{
  const config=request.routeOptions.config as RouteRateLimitConfig;
  const policy=config.rateLimit??DEFAULT_ROUTE_RATE_LIMIT;
  const routeKey=request.routeOptions.url||request.url.split('?',1)[0]||'unknown-route';
  const decision=routeRateLimiter.consume(`${request.ip}:${routeKey}`,policy.max,Date.now(),policy.timeWindow);
  if(!decision.allowed)return reply.header('retry-after',String(decision.retryAfterS)).code(429).send({error:'route-rate-limited',reason:decision.reason});
});
await app.register(roadContextRoutes);

const Sample=z.object({timestampMs:z.number().int(),egoSpeedMps:z.number().min(0).max(100),targetSpeedMps:z.number().min(-50).max(100),rangeM:z.number().min(0).max(500),confidence:z.number().min(0).max(1),canHealthy:z.boolean(),radarHealthy:z.boolean(),cameraHealthy:z.boolean()});
const GeoPointSchema=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
const VehiclePositionSchema=GeoPointSchema.extend({speedKmh:z.number().min(0).max(350),headingDeg:z.number().min(0).max(360),accuracyM:z.number().min(0).max(10_000),timestampMs:z.number().int().positive(),source:z.enum(['gnss','device-gps','simulator'])});
const SensorStateSchema=z.enum(['ok','degraded','unavailable']);
const SensorHealthSchema=z.object({radarFront:SensorStateSchema,radarRear:SensorStateSchema,camera:SensorStateSchema,can:SensorStateSchema,gnssImu:SensorStateSchema,ecu:SensorStateSchema});
const CameraDetectionSchema=z.object({id:z.string().min(1).max(96),kind:z.enum(['person','car','motorcycle','bicycle','truck','bus','obstacle','unknown']),confidence:z.number().min(0).max(1),bearingDeg:z.number().min(-180).max(360),estimatedDistanceM:z.number().min(0).max(500).nullable(),timestampMs:z.number().int().positive()});
const CameraFrameSchema=z.object({cameraId:z.string().min(1).max(96),timestampMs:z.number().int().positive(),detections:z.array(CameraDetectionSchema).max(128)});
const RadarTrackSchema=z.object({id:z.string().min(1).max(96),distanceM:z.number().min(0).max(500),bearingDeg:z.number().min(-180).max(360),relativeSpeedMps:z.number().min(-100).max(100),confidence:z.number().min(0).max(1),timestampMs:z.number().int().positive()});
const RadarFrameSchema=z.object({radarId:z.string().min(1).max(96),timestampMs:z.number().int().positive(),tracks:z.array(RadarTrackSchema).max(128)});
const GeofenceSchema=z.object({id:z.string().min(1).max(96),name:z.string().min(1).max(160),center:GeoPointSchema,radiusM:z.number().min(1).max(100_000),severity:z.enum(['caution','critical']),enabled:z.boolean()});
const EdgePacketSchema=z.object({protocolVersion:z.literal(1),deviceId:z.string().min(1).max(96),bootId:z.string().min(6).max(128),sequence:z.number().int().nonnegative(),timestampMs:z.number().int().positive(),gnss:VehiclePositionSchema.extend({source:z.literal('gnss')}),sensors:SensorHealthSchema,radar:RadarFrameSchema.optional(),camera:CameraFrameSchema.optional()});
const TelemetryEvaluationSchema=z.object({vehicle:VehiclePositionSchema,sensors:SensorHealthSchema,objects:z.array(z.object({id:z.string(),kind:z.enum(['person','car','motorcycle','bicycle','truck','bus','obstacle','unknown']),confidence:z.number().min(0).max(1),distanceM:z.number().min(0).max(500),bearingDeg:z.number().min(0).max(360),zone:z.enum(['front','front-left','front-right','left','right','rear']),severity:z.enum(['safe','caution','critical']),relativeSpeedMps:z.number().min(-100).max(100),position:GeoPointSchema,timestampMs:z.number().int()})).max(128),geofences:z.array(GeofenceSchema).max(64).optional()});
const ProjectPointSchema=z.object({origin:GeoPointSchema,bearingDeg:z.number().min(0).max(360),distanceM:z.number().min(0).max(100_000)});
const GeofenceReplaceSchema=z.object({geofences:z.array(GeofenceSchema).max(64)});
const EventsQuerySchema=z.object({limit:z.coerce.number().int().min(1).max(200).default(50),severity:z.enum(['safe','caution','critical']).optional()});
const ConfigurationAuditQuerySchema=z.object({limit:z.coerce.number().int().min(1).max(200).default(50)});
const LaneAssistSchema=z.object({timestampMs:z.number().int().positive(),speedKmh:z.number().min(0).max(350),laneWidthM:z.number().min(2).max(6),lateralOffsetM:z.number().min(-5).max(5),lateralVelocityMps:z.number().min(-5).max(5),headingErrorDeg:z.number().min(-45).max(45),confidence:z.number().min(0).max(1),turnSignal:z.enum(['off','left','right','hazard'])});
const DriverMonitoringSampleSchema=z.object({timestampMs:z.number().int().positive(),faceDetected:z.boolean(),eyesClosed:z.boolean(),gazeAway:z.boolean(),headYawDeg:z.number().min(-90).max(90),headPitchDeg:z.number().min(-90).max(90),confidence:z.number().min(0).max(1)});
const SurroundCameraSchema=z.object({cameraId:z.string().min(1).max(96),synchronized:z.boolean(),calibrated:z.boolean(),reprojectionErrorPx:z.number().min(0).max(100)});
const SurroundObservationSchema=z.object({timestampMs:z.number().int().positive(),cameras:z.array(SurroundCameraSchema).min(1).max(8)});
const AssistantRequestSchema=z.object({input:z.string().trim().min(1).max(240)});

interface SocketLike{readyState:number;send(data:string):void;close(code?:number,reason?:string):void;on(event:'close',callback:()=>void):void;}
interface ConfigurationAuthority {actorId:string;keyId:string|null;authMode:ConfigurationAuthMode;}
const clients=new Set<SocketLike>();
const packetGuard=new EdgePacketGuard();
const alertStabilizer=new AlertStabilizer();
const eventBuffer=new EdgeEventBuffer(300);
const driverAssistRuntime=new DriverAssistRuntime();
const publicComputeLimiter=new BoundedFixedWindowRateLimiter(PUBLIC_COMPUTE_MAX_KEYS);
const configWriteLimiter=new BoundedFixedWindowRateLimiter(CONFIG_WRITE_MAX_KEYS);
const operatorReplayGuard=new OperatorReplayGuard(OPERATOR_REPLAY_MAX_ENTRIES);
const configurationAudit=new ConfigurationAuditBuffer(500);
const legacyTimestamps=new BoundedMonotonicTimestampStore(LEGACY_TIMESTAMP_MAX_KEYS,LEGACY_TIMESTAMP_TTL_MS);
let latestCamera:CameraDetectionFrame|undefined;
let latestRadar:RadarTrackFrame|undefined;
let latestVehicle:VehiclePosition|undefined;
let latestSensors:SensorHealth={radarFront:'unavailable',radarRear:'unavailable',camera:'unavailable',can:'unavailable',gnssImu:'unavailable',ecu:'ok'};
let latestSequence=0;
let latestDeviceId:string|null=null;
let latestBootId:string|null=null;
let lastIngressAtMs:number|null=null;
let lastPublishAtMs:number|null=null;
let geofences:Geofence[]=[];

function constantTimeEqual(a:string,b:string){const left=Buffer.from(a);const right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);}
function localDevAuthorized(request:FastifyRequest){return ALLOW_INSECURE_LOCAL_DEV&&isLoopback(HOST)&&(request.ip==='127.0.0.1'||request.ip==='::1'||request.ip==='localhost');}
function headerToken(request:FastifyRequest,name:'x-kingmast-edge-token'|'x-kingmast-viewer-token'|'x-kingmast-config-token'){const candidate=request.headers[name];return typeof candidate==='string'?candidate:'';}
function stringHeader(request:FastifyRequest,name:string){const candidate=request.headers[name];return typeof candidate==='string'?candidate:'';}
function bearerToken(request:FastifyRequest){const value=request.headers.authorization;return typeof value==='string'&&value.startsWith('Bearer ')?value.slice(7).trim():'';}
function cookieToken(request:FastifyRequest,name:string){const raw=request.headers.cookie??'';for(const part of raw.split(';')){const [key,...rest]=part.trim().split('=');if(key===name)return decodeURIComponent(rest.join('='));}return '';}
function edgeAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!EDGE_TOKEN)return false;const candidate=headerToken(request,'x-kingmast-edge-token');return Boolean(candidate)&&constantTimeEqual(candidate,EDGE_TOKEN);}
function configAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!CONFIG_TOKEN)return false;const candidate=headerToken(request,'x-kingmast-config-token');return Boolean(candidate)&&constantTimeEqual(candidate,CONFIG_TOKEN);}
function viewerBootstrapAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!VIEWER_TOKEN)return false;const candidates=[headerToken(request,'x-kingmast-viewer-token'),bearerToken(request)].filter(Boolean);return candidates.some((candidate)=>constantTimeEqual(candidate,VIEWER_TOKEN));}
function viewerAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!VIEWER_TOKEN)return false;return verifyViewerSession(cookieToken(request,VIEWER_SESSION_COOKIE),VIEWER_TOKEN);}
function requireEdgeAuth(request:FastifyRequest,reply:FastifyReply){if(edgeAuthorized(request))return true;reply.code(401).send({error:'edge-auth-required'});return false;}
function requireConfigurationAuthority(request:FastifyRequest,reply:FastifyReply,scope:OperatorScope,payload:unknown):ConfigurationAuthority|null {
  const decision=configWriteLimiter.consume(request.ip,30);
  if(!decision.allowed){reply.header('retry-after',String(decision.retryAfterS)).code(429).send({error:'configuration-write-rate-limited',reason:decision.reason});return null;}
  if(localDevAuthorized(request))return{actorId:'loopback-dev',keyId:null,authMode:'local-dev'};
  const timestampMs=Number(stringHeader(request,'x-kingmast-operator-timestamp-ms'));
  const operator=verifyOperatorRequest({scope,operatorId:stringHeader(request,'x-kingmast-operator-id'),keyId:stringHeader(request,'x-kingmast-operator-key-id'),timestampMs,nonce:stringHeader(request,'x-kingmast-operator-nonce'),signature:stringHeader(request,'x-kingmast-operator-signature'),payload,registry:OPERATOR_KEYS,replayGuard:operatorReplayGuard});
  if(operator.ok)return{actorId:operator.operatorId,keyId:operator.keyId,authMode:'operator-ed25519'};
  if(!REQUIRE_OPERATOR_AUTH&&configAuthorized(request))return{actorId:'config-token',keyId:null,authMode:'migration-token'};
  reply.code(401).send({error:'configuration-auth-required',reason:operator.reason});
  return null;
}
function requireEdgePacketAuth(request:FastifyRequest,reply:FastifyReply,packet:EdgeTelemetryPacket){
  if(localDevAuthorized(request))return true;
  const deviceAuth=verifyDevicePacketAuth({packet,keyId:stringHeader(request,'x-kingmast-device-key-id'),signature:stringHeader(request,'x-kingmast-device-signature'),registry:DEVICE_KEYS});
  if(deviceAuth.ok)return true;
  if(!REQUIRE_DEVICE_AUTH&&edgeAuthorized(request))return true;
  reply.code(401).send({error:'device-auth-required',reason:deviceAuth.reason});
  return false;
}
function requireDeviceIngressAuth(request:FastifyRequest,reply:FastifyReply,scope:DeviceIngressScope,timestampMs:number,payload:unknown){
  if(localDevAuthorized(request))return{deviceId:null as string|null};
  const deviceAuth=verifyDeviceIngressAuth({scope,deviceId:stringHeader(request,'x-kingmast-device-id'),keyId:stringHeader(request,'x-kingmast-device-key-id'),signature:stringHeader(request,'x-kingmast-device-signature'),timestampMs,payload,registry:DEVICE_KEYS});
  if(deviceAuth.ok)return{deviceId:deviceAuth.deviceId as string|null};
  if(!REQUIRE_DEVICE_AUTH&&edgeAuthorized(request))return{deviceId:null as string|null};
  reply.code(401).send({error:'device-auth-required',reason:deviceAuth.reason});
  return null;
}
function requireViewerAuth(request:FastifyRequest,reply:FastifyReply){if(viewerAuthorized(request))return true;reply.code(401).send({error:'viewer-auth-required'});return false;}
function requirePublicComputeBudget(request:FastifyRequest,reply:FastifyReply,route:string,limit:number){
  const decision=publicComputeLimiter.consume(`${request.ip}:${route}`,limit);
  if(decision.allowed)return true;
  reply.header('retry-after',String(decision.retryAfterS)).code(429).send({error:'public-compute-rate-limited',reason:decision.reason});
  return false;
}
function ingressIdentity(deviceId:string|null){return deviceId??'shared-edge-token';}
function acceptLegacyTimestamp(stream:string,timestampMs:number,nowMs=Date.now()){return legacyTimestamps.accept(stream,timestampMs,nowMs,LEGACY_MAX_AGE_MS,LEGACY_MAX_FUTURE_SKEW_MS);}
function runtimeGuardStatus(){return{routeRequests:{activeKeys:routeRateLimiter.activeKeys,rejected:routeRateLimiter.rejected,capacityRejected:routeRateLimiter.capacityRejected,maxKeys:ROUTE_RATE_LIMIT_MAX_KEYS},publicCompute:{activeKeys:publicComputeLimiter.activeKeys,rejected:publicComputeLimiter.rejected,capacityRejected:publicComputeLimiter.capacityRejected,maxKeys:PUBLIC_COMPUTE_MAX_KEYS},configurationWrite:{activeKeys:configWriteLimiter.activeKeys,rejected:configWriteLimiter.rejected,capacityRejected:configWriteLimiter.capacityRejected,maxKeys:CONFIG_WRITE_MAX_KEYS},operatorReplay:{activeEntries:operatorReplayGuard.activeEntries,rejected:operatorReplayGuard.rejected,capacityRejected:operatorReplayGuard.capacityRejected,maxEntries:OPERATOR_REPLAY_MAX_ENTRIES},legacyReplay:{activeKeys:legacyTimestamps.activeKeys,rejected:legacyTimestamps.rejected,capacityRejected:legacyTimestamps.capacityRejected,maxKeys:LEGACY_TIMESTAMP_MAX_KEYS,ttlMs:LEGACY_TIMESTAMP_TTL_MS}};}
function ages(nowMs=Date.now()){return sensorAges({vehicle:latestVehicle,radarTimestampMs:latestRadar?.timestampMs,cameraTimestampMs:latestCamera?.timestampMs,nowMs});}
function hasFreshVehicleContext(nowMs=Date.now()){return Boolean(latestVehicle&&Math.max(0,nowMs-latestVehicle.timestampMs)<=2_500);}
function diagnostics(nowMs=Date.now()):EdgeDiagnostics{
  const sensorAgesMs=ages(nowMs);
  const ingressAge=lastIngressAtMs===null?Number.POSITIVE_INFINITY:nowMs-lastIngressAtMs;
  const freshSensors=applySensorFreshness({sensors:latestSensors,vehicle:latestVehicle,radarTimestampMs:latestRadar?.timestampMs,cameraTimestampMs:latestCamera?.timestampMs,nowMs});
  const essentialDegraded=freshSensors.gnssImu!=='ok'||freshSensors.radarFront!=='ok'||freshSensors.camera!=='ok';
  return{status:ingressAge>5_000?'offline':essentialDegraded?'degraded':'live',deviceId:latestDeviceId,bootId:latestBootId,lastSequence:latestSequence,lastIngressAtMs,lastPublishAtMs,connectedClients:clients.size,rejectedPackets:packetGuard.rejectedPackets,sensorAgesMs};
}
function currentEnvelope(source:'edge'|'simulator'='edge',commit=false):RealtimeTelemetryEnvelope|null{
  if(!latestVehicle)return null;
  const nowMs=Date.now();
  const objects=fuseEdgePerception({vehicle:latestVehicle,camera:latestCamera,radar:latestRadar,nowMs});
  const sensors=applySensorFreshness({sensors:latestSensors,vehicle:latestVehicle,radarTimestampMs:latestRadar?.timestampMs,cameraTimestampMs:latestCamera?.timestampMs,nowMs});
  const rawAlerts=buildLocationAlerts({vehicle:latestVehicle,sensors,objects,geofences});
  const alerts=commit?alertStabilizer.update(rawAlerts,nowMs):alertStabilizer.preview(rawAlerts,nowMs);
  const frame:TelemetryFrame={sequence:latestSequence,vehicle:latestVehicle,sensors,objects,alerts,assist:driverAssistRuntime.snapshot(nowMs,hasFreshVehicleContext(nowMs))};
  return{type:'telemetry',source,receivedAtMs:nowMs,frame,diagnostics:diagnostics(nowMs)};
}
function broadcast(payload:object){const data=JSON.stringify(payload);for(const client of clients)if(client.readyState===1)client.send(data);}
function publish(source:'edge'|'simulator'='edge'){const envelope=currentEnvelope(source,true);if(!envelope)return null;eventBuffer.ingest(envelope.frame);lastPublishAtMs=envelope.receivedAtMs;envelope.diagnostics=diagnostics(envelope.receivedAtMs);broadcast(envelope);return envelope;}
function heartbeat(){const payload:RealtimeHeartbeatEnvelope={type:'heartbeat',receivedAtMs:Date.now(),lastSequence:latestSequence,connectedClients:clients.size};broadcast(payload);}
const heartbeatTimer=setInterval(heartbeat,1_000);heartbeatTimer.unref();

app.get('/health',{config:{rateLimit:{max:600,timeWindow:60_000}}},async()=>({status:'ok',mode:'warning-only',version:'3.10-route-rate-limit'}));
app.post('/v3/session',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{if(localDevAuthorized(request)&&!VIEWER_TOKEN)return{authenticated:true,mode:'loopback-dev',expiresInS:0};if(!viewerBootstrapAuthorized(request))return reply.code(401).send({error:'viewer-auth-required'});const session=issueViewerSession(VIEWER_TOKEN);const secure=process.env.NODE_ENV==='production';reply.header('set-cookie',`${VIEWER_SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; ${secure?'Secure; SameSite=None':'SameSite=Lax'}; Max-Age=${VIEWER_SESSION_TTL_S}`);return{authenticated:true,mode:'scoped-viewer-session',expiresInS:VIEWER_SESSION_TTL_S};});
app.get('/v3/health/details',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{status:'ok',mode:'warning-only',edge:diagnostics(),assist:driverAssistRuntime.snapshot(Date.now(),hasFreshVehicleContext()),deviceIdentity:{required:REQUIRE_DEVICE_AUTH,...deviceAuthSummary(DEVICE_KEYS)},configuration:{operatorAuthRequired:REQUIRE_OPERATOR_AUTH,operatorIdentity:operatorAuthSummary(OPERATOR_KEYS),migrationTokenEnabled:!REQUIRE_OPERATOR_AUTH&&CONFIG_TOKEN.length>=32,audit:configurationAudit.status()},observability:{risk:riskMetricsSnapshot(),audit:eventBuffer.auditStatus(),runtimeGuards:runtimeGuardStatus()}};});
app.post('/v1/risk',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requirePublicComputeBudget(request,reply,'v1-risk',120))return;const parsed=Sample.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-sample'});return assessRisk(parsed.data);});
app.post('/v2/telemetry/evaluate',{config:{rateLimit:{max:60,timeWindow:60_000}}},async(request,reply)=>{if(!requirePublicComputeBudget(request,reply,'v2-telemetry-evaluate',60))return;const parsed=TelemetryEvaluationSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-telemetry-frame',details:parsed.error.flatten()});const vehicle=parsed.data.vehicle as VehiclePosition;const sensors=parsed.data.sensors as SensorHealth;const objects=parsed.data.objects as DetectedObject[];const fences=(parsed.data.geofences??[]) as Geofence[];return{vehicle,objects,alerts:buildLocationAlerts({vehicle,sensors,objects,geofences:fences}),safetyMode:'warning-only',controlAuthority:'none'};});
app.post('/v2/geo/project',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requirePublicComputeBudget(request,reply,'v2-geo-project',120))return;const parsed=ProjectPointSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-geo-input'});return projectPoint(parsed.data.origin,parsed.data.bearingDeg,parsed.data.distanceM);});
app.post('/v3/perception/camera',{config:{rateLimit:{max:3000,timeWindow:60_000}}},async(request,reply)=>{const parsed=CameraFrameSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-camera-frame',details:parsed.error.flatten()});const auth=requireDeviceIngressAuth(request,reply,'perception:camera',parsed.data.timestampMs,parsed.data);if(!auth)return;if(!acceptLegacyTimestamp(`camera:${ingressIdentity(auth.deviceId)}:${parsed.data.cameraId}`,parsed.data.timestampMs))return reply.code(409).send({error:'legacy-frame-rejected',reason:'replay-or-clock-skew'});latestCamera=parsed.data as CameraDetectionFrame;latestSensors={...latestSensors,camera:'ok'};lastIngressAtMs=Date.now();return publish();});
app.post('/v3/perception/radar',{config:{rateLimit:{max:3000,timeWindow:60_000}}},async(request,reply)=>{const parsed=RadarFrameSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-radar-frame',details:parsed.error.flatten()});const auth=requireDeviceIngressAuth(request,reply,'perception:radar',parsed.data.timestampMs,parsed.data);if(!auth)return;if(!acceptLegacyTimestamp(`radar:${ingressIdentity(auth.deviceId)}:${parsed.data.radarId}`,parsed.data.timestampMs))return reply.code(409).send({error:'legacy-frame-rejected',reason:'replay-or-clock-skew'});latestRadar=parsed.data as RadarTrackFrame;latestSensors={...latestSensors,radarFront:'ok'};lastIngressAtMs=Date.now();return publish();});
app.post('/v3/edge/gnss',{config:{rateLimit:{max:1200,timeWindow:60_000}}},async(request,reply)=>{const parsed=VehiclePositionSchema.safeParse(request.body);if(!parsed.success||parsed.data.source!=='gnss')return reply.code(400).send({error:'invalid-gnss-sample'});const auth=requireDeviceIngressAuth(request,reply,'edge:gnss',parsed.data.timestampMs,parsed.data);if(!auth)return;if(!acceptLegacyTimestamp(`gnss:${ingressIdentity(auth.deviceId)}`,parsed.data.timestampMs))return reply.code(409).send({error:'legacy-frame-rejected',reason:'replay-or-clock-skew'});latestVehicle=parsed.data as VehiclePosition;latestSensors={...latestSensors,gnssImu:'ok'};latestSequence+=1;lastIngressAtMs=Date.now();return publish();});
app.post('/v3/assist/lane',{config:{rateLimit:{max:1200,timeWindow:60_000}}},async(request,reply)=>{const parsed=LaneAssistSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-lane-observation',details:parsed.error.flatten()});const auth=requireDeviceIngressAuth(request,reply,'assist:lane',parsed.data.timestampMs,parsed.data);if(!auth)return;if(!acceptLegacyTimestamp(`assist:lane:${ingressIdentity(auth.deviceId)}`,parsed.data.timestampMs))return reply.code(409).send({error:'lane-observation-rejected',reason:'replay-or-clock-skew'});const assessment=driverAssistRuntime.ingestLane(parsed.data);lastIngressAtMs=Date.now();const envelope=publish();return{assessment,runtime:envelope?.frame.assist?.ldw??driverAssistRuntime.snapshot().ldw,controlAuthority:'none'};});
app.post('/v3/assist/dms',{config:{rateLimit:{max:1200,timeWindow:60_000}}},async(request,reply)=>{const parsed=DriverMonitoringSampleSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-driver-monitoring-sample',details:parsed.error.flatten()});const auth=requireDeviceIngressAuth(request,reply,'assist:dms',parsed.data.timestampMs,parsed.data);if(!auth)return;if(!acceptLegacyTimestamp(`assist:dms:${ingressIdentity(auth.deviceId)}`,parsed.data.timestampMs))return reply.code(409).send({error:'dms-sample-rejected',reason:'replay-or-clock-skew'});const assessment=driverAssistRuntime.ingestDriverMonitoring(parsed.data);lastIngressAtMs=Date.now();const envelope=publish();return{assessment,runtime:envelope?.frame.assist?.dms??driverAssistRuntime.snapshot().dms,storesRawVideo:false,controlAuthority:'none'};});
app.post('/v3/assist/surround',{config:{rateLimit:{max:1200,timeWindow:60_000}}},async(request,reply)=>{const parsed=SurroundObservationSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-surround-observation',details:parsed.error.flatten()});const auth=requireDeviceIngressAuth(request,reply,'assist:surround',parsed.data.timestampMs,parsed.data);if(!auth)return;if(!acceptLegacyTimestamp(`assist:surround:${ingressIdentity(auth.deviceId)}`,parsed.data.timestampMs))return reply.code(409).send({error:'surround-observation-rejected',reason:'replay-or-clock-skew'});driverAssistRuntime.ingestSurround(parsed.data);lastIngressAtMs=Date.now();const envelope=publish();return{runtime:envelope?.frame.assist?.surround??driverAssistRuntime.snapshot().surround,visualizationOnly:true,controlAuthority:'none'};});
app.post('/v3/assistant/plan',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;const parsed=AssistantRequestSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-assistant-request'});const plan=planAssistantRequest(parsed.data.input);assertReadOnlyAssistantPlan(plan);const vehicleContextFresh=hasFreshVehicleContext();const moving=Boolean(latestVehicle&&latestVehicle.speedKmh>5);const executionAllowed=plan.intent!=='unsupported'&&(!plan.requiresParked||!moving);return{plan,executionAllowed,context:{vehicleContextFresh,speedKmh:latestVehicle?.speedKmh??null,sensorHealth:latestSensors,activeAlertCount:currentEnvelope()?.frame.alerts.length??0},runtime:driverAssistRuntime.snapshot(Date.now(),vehicleContextFresh).assistant,controlAuthority:'none'};});
app.post('/v3/edge/frame',{config:{rateLimit:{max:3000,timeWindow:60_000}}},async(request,reply)=>{const parsed=EdgePacketSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-edge-packet',details:parsed.error.flatten()});const packet=parsed.data as EdgeTelemetryPacket;if(!requireEdgePacketAuth(request,reply,packet))return;const accepted=packetGuard.accept(packet);if(!accepted.ok)return reply.code(409).send({error:'edge-packet-rejected',reason:accepted.reason});latestDeviceId=packet.deviceId;latestBootId=packet.bootId;latestSequence=packet.sequence;latestVehicle=packet.gnss;latestSensors=packet.sensors;if(packet.camera)latestCamera=packet.camera;if(packet.radar)latestRadar=packet.radar;lastIngressAtMs=Date.now();return publish();});
app.get('/v3/edge/latest',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return currentEnvelope();});
app.get('/v3/assist/status',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return driverAssistRuntime.snapshot(Date.now(),hasFreshVehicleContext());});
app.get('/v3/diagnostics',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{...diagnostics(),risk:riskMetricsSnapshot(),audit:eventBuffer.auditStatus(),configurationAudit:configurationAudit.status(),operatorIdentity:{required:REQUIRE_OPERATOR_AUTH,...operatorAuthSummary(OPERATOR_KEYS)},runtimeGuards:runtimeGuardStatus()};});
app.get('/v3/audit/status',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return eventBuffer.auditStatus();});
app.get('/v3/device-identity/status',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{mode:REQUIRE_DEVICE_AUTH?'required':'transition',sharedEdgeTokenFallback:!REQUIRE_DEVICE_AUTH,consolidatedPacketBinding:['deviceId','keyId','bootId','sequence','timestampMs','canonical-packet'],legacyIngressBinding:['scope','deviceId','keyId','timestampMs','canonical-payload'],legacyIngressDeviceAuthRequired:REQUIRE_DEVICE_AUTH,...deviceAuthSummary(DEVICE_KEYS)};});
app.get('/v3/configuration/identity/status',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{mode:REQUIRE_OPERATOR_AUTH?'operator-required':'transition',migrationTokenFallback:!REQUIRE_OPERATOR_AUTH&&CONFIG_TOKEN.length>=32,scope:'configuration:geofences',...operatorAuthSummary(OPERATOR_KEYS),replay:{activeEntries:operatorReplayGuard.activeEntries,rejected:operatorReplayGuard.rejected,capacityRejected:operatorReplayGuard.capacityRejected,maxEntries:OPERATOR_REPLAY_MAX_ENTRIES}};});
app.get('/v3/configuration/audit',{config:{rateLimit:{max:120,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;const parsed=ConfigurationAuditQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'invalid-configuration-audit-query'});return{status:configurationAudit.status(),records:configurationAudit.list(parsed.data.limit)};});
app.get('/v3/events',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;const parsed=EventsQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'invalid-events-query'});return{events:eventBuffer.list(parsed.data.limit,parsed.data.severity as Severity|undefined)};});
app.get('/v3/geofences',{config:{rateLimit:{max:300,timeWindow:60_000}}},async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{geofences};});
app.post('/v3/geofences',{config:{rateLimit:{max:30,timeWindow:60_000}}},async(request,reply)=>{const authority=requireConfigurationAuthority(request,reply,'configuration:geofences',request.body);if(!authority)return;const parsed=GeofenceReplaceSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-geofences',details:parsed.error.flatten()});const previous=geofences;const next=parsed.data.geofences as Geofence[];geofences=next;const audit=configurationAudit.record({actorId:authority.actorId,keyId:authority.keyId,authMode:authority.authMode,previousValue:previous,newValue:next,previousCount:previous.length,newCount:next.length,sourceIp:request.ip});return{updated:geofences.length,geofences,auditSequence:audit.sequence,authorization:authority.authMode};});
app.get('/v3/stream',{websocket:true,config:{rateLimit:{max:60,timeWindow:60_000}}},(socket,request)=>{const client=socket as unknown as SocketLike;let expiryTimer:NodeJS.Timeout|null=null;if(localDevAuthorized(request)){clients.add(client);}else{const session=VIEWER_TOKEN?readViewerSession(cookieToken(request,VIEWER_SESSION_COOKIE),VIEWER_TOKEN):null;if(!session){client.close(1008,'viewer-auth-required');return;}clients.add(client);expiryTimer=setTimeout(()=>client.close(1008,'viewer-session-expired'),Math.max(1,session.expiresAtMs-Date.now()));expiryTimer.unref();}const initial=currentEnvelope();if(initial&&client.readyState===1)client.send(JSON.stringify(initial));client.on('close',()=>{if(expiryTimer)clearTimeout(expiryTimer);clients.delete(client);});});

app.get('/v1/capabilities',{config:{rateLimit:{max:600,timeWindow:60_000}}},async()=>({vehicleControl:false,canWrite:false,brake:false,steer:false,throttle:false,gpsPositioning:true,objectDetection:true,radarFusion:true,cameraClassification:true,realtimeWebSocket:true,heartbeat:true,edgeReplayProtection:true,legacyReplayProtection:true,boundedLegacyReplayState:true,boundedRouteRateLimit:true,boundedPublicComputeRateLimit:true,edgeAuthentication:EDGE_TOKEN.length>=16,perDevicePacketAuthentication:DEVICE_KEYS.size>0,legacyPerDeviceAuthentication:DEVICE_KEYS.size>0,deviceAuthRequired:REQUIRE_DEVICE_AUTH,viewerAuthentication:VIEWER_TOKEN.length>=16,viewerSessionTtlS:VIEWER_SESSION_TTL_S,configurationWriteAuthentication:REQUIRE_OPERATOR_AUTH?'operator-ed25519-required':OPERATOR_KEYS.size>0?'operator-ed25519-or-migration-token':CONFIG_TOKEN.length>=32?'migration-token':'disabled-outside-loopback',configurationWriteRateLimited:true,configurationMutationAudit:true,operatorReplayProtection:true,diagnostics:true,riskMetrics:true,auditJournalStatus:true,eventHistory:true,geofenceAlerts:true,mapAlerts:true,navigationRouting:true,speedLimitAwareness:true,speedSignVision:true,trafficCameraContext:true,driverAssistRuntime:true,laneDepartureRuntime:true,driverMonitoringRuntime:true,surroundReadinessRuntime:true,readOnlyAssistantPlanner:true,trafficCameraAccessPolicy:'public-or-authorized-only'}));
await app.listen({port:Number(process.env.PORT??4000),host:HOST});
