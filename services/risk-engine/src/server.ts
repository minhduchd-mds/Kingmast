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
import { issueViewerSession,verifyViewerSession,VIEWER_SESSION_COOKIE,VIEWER_SESSION_TTL_S } from '@kingmast/contracts/viewer-session';
import { assessRisk } from './risk.js';
import { buildLocationAlerts } from './object-alerts.js';
import { projectPoint } from './geo.js';
import { fuseEdgePerception } from './edge-fusion.js';
import { AlertStabilizer } from './alert-stabilizer.js';
import { EdgeEventBuffer } from './event-buffer.js';
import { applySensorFreshness, EdgePacketGuard, sensorAges } from './edge-guard.js';
import { roadContextRoutes } from './road-context-routes.js';
import { DriverAssistRuntime } from './driver-assist-runtime.js';
import { assertReadOnlyAssistantPlan,planAssistantRequest } from './ai-assistant.js';

const HOST=(process.env.HOST??'127.0.0.1').trim();
const ALLOW_INSECURE_LOCAL_DEV=process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV==='1';
const EDGE_TOKEN=(process.env.KINGMAST_EDGE_TOKEN??'').trim();
const VIEWER_TOKEN=(process.env.KINGMAST_VIEWER_TOKEN??'').trim();
const LEGACY_MAX_AGE_MS=30_000;
const LEGACY_MAX_FUTURE_SKEW_MS=5_000;

function isLoopback(host:string){return host==='127.0.0.1'||host==='localhost'||host==='::1';}
function validateSecret(name:string,value:string){if(value&&value.length<16)throw new Error(`${name} must be at least 16 characters`);}
validateSecret('KINGMAST_EDGE_TOKEN',EDGE_TOKEN);
validateSecret('KINGMAST_VIEWER_TOKEN',VIEWER_TOKEN);
if(ALLOW_INSECURE_LOCAL_DEV&&!isLoopback(HOST))throw new Error('KINGMAST_ALLOW_INSECURE_LOCAL_DEV may only be used on a loopback host');
if(!ALLOW_INSECURE_LOCAL_DEV&&(!EDGE_TOKEN||!VIEWER_TOKEN))throw new Error('KINGMAST_EDGE_TOKEN and KINGMAST_VIEWER_TOKEN are required unless explicit loopback-only insecure development is enabled');

const app=Fastify({logger:true,bodyLimit:256_000});
await app.register(helmet);
await app.register(cors,{origin:process.env.HMI_ORIGIN??'http://localhost:3000',methods:['GET','POST'],credentials:true,allowedHeaders:['content-type','authorization','x-kingmast-edge-token','x-kingmast-viewer-token']});
await app.register(websocket);
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
const LaneAssistSchema=z.object({timestampMs:z.number().int().positive(),speedKmh:z.number().min(0).max(350),laneWidthM:z.number().min(2).max(6),lateralOffsetM:z.number().min(-5).max(5),lateralVelocityMps:z.number().min(-5).max(5),headingErrorDeg:z.number().min(-45).max(45),confidence:z.number().min(0).max(1),turnSignal:z.enum(['off','left','right','hazard'])});
const DriverMonitoringSampleSchema=z.object({timestampMs:z.number().int().positive(),faceDetected:z.boolean(),eyesClosed:z.boolean(),gazeAway:z.boolean(),headYawDeg:z.number().min(-90).max(90),headPitchDeg:z.number().min(-90).max(90),confidence:z.number().min(0).max(1)});
const SurroundCameraSchema=z.object({cameraId:z.string().min(1).max(96),synchronized:z.boolean(),calibrated:z.boolean(),reprojectionErrorPx:z.number().min(0).max(100)});
const SurroundObservationSchema=z.object({timestampMs:z.number().int().positive(),cameras:z.array(SurroundCameraSchema).min(1).max(8)});
const AssistantRequestSchema=z.object({input:z.string().trim().min(1).max(240)});

interface SocketLike{readyState:number;send(data:string):void;close(code?:number,reason?:string):void;on(event:'close',callback:()=>void):void;}
const clients=new Set<SocketLike>();
const packetGuard=new EdgePacketGuard();
const alertStabilizer=new AlertStabilizer();
const eventBuffer=new EdgeEventBuffer(300);
const driverAssistRuntime=new DriverAssistRuntime();
const legacyTimestamps=new Map<string,number>();
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
function headerToken(request:FastifyRequest,name:'x-kingmast-edge-token'|'x-kingmast-viewer-token'){const candidate=request.headers[name];return typeof candidate==='string'?candidate:'';}
function bearerToken(request:FastifyRequest){const value=request.headers.authorization;return typeof value==='string'&&value.startsWith('Bearer ')?value.slice(7).trim():'';}
function cookieToken(request:FastifyRequest,name:string){const raw=request.headers.cookie??'';for(const part of raw.split(';')){const [key,...rest]=part.trim().split('=');if(key===name)return decodeURIComponent(rest.join('='));}return '';}
function edgeAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!EDGE_TOKEN)return false;const candidate=headerToken(request,'x-kingmast-edge-token');return Boolean(candidate)&&constantTimeEqual(candidate,EDGE_TOKEN);}
function viewerBootstrapAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!VIEWER_TOKEN)return false;const candidates=[headerToken(request,'x-kingmast-viewer-token'),bearerToken(request)].filter(Boolean);return candidates.some((candidate)=>constantTimeEqual(candidate,VIEWER_TOKEN));}
function viewerAuthorized(request:FastifyRequest){if(localDevAuthorized(request))return true;if(!VIEWER_TOKEN)return false;return verifyViewerSession(cookieToken(request,VIEWER_SESSION_COOKIE),VIEWER_TOKEN);}
function requireEdgeAuth(request:FastifyRequest,reply:FastifyReply){if(edgeAuthorized(request))return true;reply.code(401).send({error:'edge-auth-required'});return false;}
function requireViewerAuth(request:FastifyRequest,reply:FastifyReply){if(viewerAuthorized(request))return true;reply.code(401).send({error:'viewer-auth-required'});return false;}
function acceptLegacyTimestamp(stream:string,timestampMs:number,nowMs=Date.now()){if(timestampMs>nowMs+LEGACY_MAX_FUTURE_SKEW_MS||nowMs-timestampMs>LEGACY_MAX_AGE_MS)return false;const previous=legacyTimestamps.get(stream);if(previous!==undefined&&timestampMs<=previous)return false;legacyTimestamps.set(stream,timestampMs);return true;}
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

app.get('/health',async()=>({status:'ok',mode:'warning-only',version:'3.4-live-driver-assist-runtime'}));
app.post('/v3/session',async(request,reply)=>{if(localDevAuthorized(request)&&!VIEWER_TOKEN)return{authenticated:true,mode:'loopback-dev',expiresInS:0};if(!viewerBootstrapAuthorized(request))return reply.code(401).send({error:'viewer-auth-required'});const session=issueViewerSession(VIEWER_TOKEN);const secure=process.env.NODE_ENV==='production';reply.header('set-cookie',`${VIEWER_SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; HttpOnly; ${secure?'Secure; SameSite=None':'SameSite=Lax'}; Max-Age=${VIEWER_SESSION_TTL_S}`);return{authenticated:true,mode:'scoped-viewer-session',expiresInS:VIEWER_SESSION_TTL_S};});
app.get('/v3/health/details',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{status:'ok',mode:'warning-only',edge:diagnostics(),assist:driverAssistRuntime.snapshot(Date.now(),hasFreshVehicleContext())};});
app.post('/v1/risk',async(request,reply)=>{const parsed=Sample.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-sample'});return assessRisk(parsed.data);});
app.post('/v2/telemetry/evaluate',async(request,reply)=>{const parsed=TelemetryEvaluationSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-telemetry-frame',details:parsed.error.flatten()});const vehicle=parsed.data.vehicle as VehiclePosition;const sensors=parsed.data.sensors as SensorHealth;const objects=parsed.data.objects as DetectedObject[];const fences=(parsed.data.geofences??[]) as Geofence[];return{vehicle,objects,alerts:buildLocationAlerts({vehicle,sensors,objects,geofences:fences}),safetyMode:'warning-only',controlAuthority:'none'};});
app.post('/v2/geo/project',async(request,reply)=>{const parsed=ProjectPointSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-geo-input'});return projectPoint(parsed.data.origin,parsed.data.bearingDeg,parsed.data.distanceM);});
app.post('/v3/perception/camera',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=CameraFrameSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-camera-frame',details:parsed.error.flatten()});if(!acceptLegacyTimestamp(`camera:${parsed.data.cameraId}`,parsed.data.timestampMs))return reply.code(409).send({error:'legacy-frame-rejected',reason:'replay-or-clock-skew'});latestCamera=parsed.data as CameraDetectionFrame;latestSensors={...latestSensors,camera:'ok'};lastIngressAtMs=Date.now();return publish();});
app.post('/v3/perception/radar',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=RadarFrameSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-radar-frame',details:parsed.error.flatten()});if(!acceptLegacyTimestamp(`radar:${parsed.data.radarId}`,parsed.data.timestampMs))return reply.code(409).send({error:'legacy-frame-rejected',reason:'replay-or-clock-skew'});latestRadar=parsed.data as RadarTrackFrame;latestSensors={...latestSensors,radarFront:'ok'};lastIngressAtMs=Date.now();return publish();});
app.post('/v3/edge/gnss',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=VehiclePositionSchema.safeParse(request.body);if(!parsed.success||parsed.data.source!=='gnss')return reply.code(400).send({error:'invalid-gnss-sample'});if(!acceptLegacyTimestamp('gnss',parsed.data.timestampMs))return reply.code(409).send({error:'legacy-frame-rejected',reason:'replay-or-clock-skew'});latestVehicle=parsed.data as VehiclePosition;latestSensors={...latestSensors,gnssImu:'ok'};latestSequence+=1;lastIngressAtMs=Date.now();return publish();});
app.post('/v3/assist/lane',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=LaneAssistSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-lane-observation',details:parsed.error.flatten()});if(!acceptLegacyTimestamp('assist:lane',parsed.data.timestampMs))return reply.code(409).send({error:'lane-observation-rejected',reason:'replay-or-clock-skew'});const assessment=driverAssistRuntime.ingestLane(parsed.data);lastIngressAtMs=Date.now();const envelope=publish();return{assessment,runtime:envelope?.frame.assist?.ldw??driverAssistRuntime.snapshot().ldw,controlAuthority:'none'};});
app.post('/v3/assist/dms',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=DriverMonitoringSampleSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-driver-monitoring-sample',details:parsed.error.flatten()});if(!acceptLegacyTimestamp('assist:dms',parsed.data.timestampMs))return reply.code(409).send({error:'dms-sample-rejected',reason:'replay-or-clock-skew'});const assessment=driverAssistRuntime.ingestDriverMonitoring(parsed.data);lastIngressAtMs=Date.now();const envelope=publish();return{assessment,runtime:envelope?.frame.assist?.dms??driverAssistRuntime.snapshot().dms,storesRawVideo:false,controlAuthority:'none'};});
app.post('/v3/assist/surround',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=SurroundObservationSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-surround-observation',details:parsed.error.flatten()});if(!acceptLegacyTimestamp('assist:surround',parsed.data.timestampMs))return reply.code(409).send({error:'surround-observation-rejected',reason:'replay-or-clock-skew'});driverAssistRuntime.ingestSurround(parsed.data);lastIngressAtMs=Date.now();const envelope=publish();return{runtime:envelope?.frame.assist?.surround??driverAssistRuntime.snapshot().surround,visualizationOnly:true,controlAuthority:'none'};});
app.post('/v3/assistant/plan',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;const parsed=AssistantRequestSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-assistant-request'});const plan=planAssistantRequest(parsed.data.input);assertReadOnlyAssistantPlan(plan);const vehicleContextFresh=hasFreshVehicleContext();const moving=Boolean(latestVehicle&&latestVehicle.speedKmh>5);const executionAllowed=plan.intent!=='unsupported'&&(!plan.requiresParked||!moving);return{plan,executionAllowed,context:{vehicleContextFresh,speedKmh:latestVehicle?.speedKmh??null,sensorHealth:latestSensors,activeAlertCount:currentEnvelope()?.frame.alerts.length??0},runtime:driverAssistRuntime.snapshot(Date.now(),vehicleContextFresh).assistant,controlAuthority:'none'};});
app.post('/v3/edge/frame',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=EdgePacketSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-edge-packet',details:parsed.error.flatten()});const packet=parsed.data as EdgeTelemetryPacket;const accepted=packetGuard.accept(packet);if(!accepted.ok)return reply.code(409).send({error:'edge-packet-rejected',reason:accepted.reason});latestDeviceId=packet.deviceId;latestBootId=packet.bootId;latestSequence=packet.sequence;latestVehicle=packet.gnss;latestSensors=packet.sensors;if(packet.camera)latestCamera=packet.camera;if(packet.radar)latestRadar=packet.radar;lastIngressAtMs=Date.now();return publish();});
app.get('/v3/edge/latest',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return currentEnvelope();});
app.get('/v3/assist/status',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return driverAssistRuntime.snapshot(Date.now(),hasFreshVehicleContext());});
app.get('/v3/diagnostics',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return diagnostics();});
app.get('/v3/events',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;const parsed=EventsQuerySchema.safeParse(request.query);if(!parsed.success)return reply.code(400).send({error:'invalid-events-query'});return{events:eventBuffer.list(parsed.data.limit,parsed.data.severity as Severity|undefined)};});
app.get('/v3/geofences',async(request,reply)=>{if(!requireViewerAuth(request,reply))return;return{geofences};});
app.post('/v3/geofences',async(request,reply)=>{if(!requireEdgeAuth(request,reply))return;const parsed=GeofenceReplaceSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:'invalid-geofences',details:parsed.error.flatten()});geofences=parsed.data.geofences as Geofence[];return{updated:geofences.length,geofences};});
app.get('/v3/stream',{websocket:true},(socket,request)=>{const client=socket as unknown as SocketLike;if(!viewerAuthorized(request)){client.close(1008,'viewer-auth-required');return;}clients.add(client);const initial=currentEnvelope();if(initial&&client.readyState===1)client.send(JSON.stringify(initial));client.on('close',()=>clients.delete(client));});

app.get('/v1/capabilities',async()=>({vehicleControl:false,canWrite:false,brake:false,steer:false,throttle:false,gpsPositioning:true,objectDetection:true,radarFusion:true,cameraClassification:true,realtimeWebSocket:true,heartbeat:true,edgeReplayProtection:true,legacyReplayProtection:true,edgeAuthentication:EDGE_TOKEN.length>=16,viewerAuthentication:VIEWER_TOKEN.length>=16,viewerSessionTtlS:VIEWER_SESSION_TTL_S,diagnostics:true,eventHistory:true,geofenceAlerts:true,mapAlerts:true,navigationRouting:true,speedLimitAwareness:true,speedSignVision:true,trafficCameraContext:true,driverAssistRuntime:true,laneDepartureRuntime:true,driverMonitoringRuntime:true,surroundReadinessRuntime:true,readOnlyAssistantPlanner:true,trafficCameraAccessPolicy:'public-or-authorized-only'}));
await app.listen({port:Number(process.env.PORT??4000),host:HOST});
