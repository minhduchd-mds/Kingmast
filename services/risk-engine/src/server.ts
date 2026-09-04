import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { z } from 'zod';
import type {
  CameraDetectionFrame,
  DetectedObject,
  EdgeTelemetryPacket,
  Geofence,
  RadarTrackFrame,
  RealtimeTelemetryEnvelope,
  SensorHealth,
  TelemetryFrame,
  VehiclePosition,
} from '@kingmast/contracts';
import { assessRisk } from './risk.js';
import { buildLocationAlerts } from './object-alerts.js';
import { projectPoint } from './geo.js';
import { fuseEdgePerception } from './edge-fusion.js';

const app = Fastify({ logger: true, bodyLimit: 256_000 });
await app.register(helmet);
await app.register(cors, {
  origin: process.env.HMI_ORIGIN ?? 'http://localhost:3000',
  methods: ['GET', 'POST'],
});
await app.register(websocket);

const Sample = z.object({
  timestampMs: z.number().int(), egoSpeedMps: z.number().min(0).max(100), targetSpeedMps: z.number().min(-50).max(100),
  rangeM: z.number().min(0).max(500), confidence: z.number().min(0).max(1), canHealthy: z.boolean(), radarHealthy: z.boolean(), cameraHealthy: z.boolean(),
});
const GeoPointSchema = z.object({ lat:z.number().min(-90).max(90), lng:z.number().min(-180).max(180) });
const VehiclePositionSchema = GeoPointSchema.extend({ speedKmh:z.number().min(0).max(350), headingDeg:z.number().min(0).max(360), accuracyM:z.number().min(0).max(10_000), timestampMs:z.number().int(), source:z.enum(['gnss','device-gps','simulator']) });
const SensorStateSchema = z.enum(['ok','degraded','unavailable']);
const SensorHealthSchema = z.object({ radarFront:SensorStateSchema, radarRear:SensorStateSchema, camera:SensorStateSchema, can:SensorStateSchema, gnssImu:SensorStateSchema, ecu:SensorStateSchema });
const CameraDetectionSchema = z.object({ id:z.string().min(1).max(96), kind:z.enum(['person','car','motorcycle','bicycle','truck','bus','obstacle','unknown']), confidence:z.number().min(0).max(1), bearingDeg:z.number().min(-180).max(360), estimatedDistanceM:z.number().min(0).max(500).nullable(), timestampMs:z.number().int() });
const CameraFrameSchema = z.object({ cameraId:z.string().min(1).max(96), timestampMs:z.number().int(), detections:z.array(CameraDetectionSchema).max(128) });
const RadarTrackSchema = z.object({ id:z.string().min(1).max(96), distanceM:z.number().min(0).max(500), bearingDeg:z.number().min(-180).max(360), relativeSpeedMps:z.number().min(-100).max(100), confidence:z.number().min(0).max(1), timestampMs:z.number().int() });
const RadarFrameSchema = z.object({ radarId:z.string().min(1).max(96), timestampMs:z.number().int(), tracks:z.array(RadarTrackSchema).max(128) });
const GeofenceSchema = z.object({ id:z.string().min(1).max(96), name:z.string().min(1).max(160), center:GeoPointSchema, radiusM:z.number().min(1).max(100_000), severity:z.enum(['caution','critical']), enabled:z.boolean() });
const EdgePacketSchema = z.object({
  deviceId:z.string().min(1).max(96), sequence:z.number().int().nonnegative(), timestampMs:z.number().int(),
  gnss:VehiclePositionSchema.extend({source:z.literal('gnss')}), sensors:SensorHealthSchema,
  radar:RadarFrameSchema.optional(), camera:CameraFrameSchema.optional(),
});
const TelemetryEvaluationSchema = z.object({ vehicle:VehiclePositionSchema, sensors:SensorHealthSchema, objects:z.array(z.object({
  id:z.string(), kind:z.enum(['person','car','motorcycle','bicycle','truck','bus','obstacle','unknown']), confidence:z.number().min(0).max(1), distanceM:z.number().min(0).max(500), bearingDeg:z.number().min(0).max(360), zone:z.enum(['front','front-left','front-right','left','right','rear']), severity:z.enum(['safe','caution','critical']), relativeSpeedMps:z.number().min(-100).max(100), position:GeoPointSchema, timestampMs:z.number().int(),
})).max(128), geofences:z.array(GeofenceSchema).max(32).optional() });
const ProjectPointSchema = z.object({ origin:GeoPointSchema, bearingDeg:z.number().min(0).max(360), distanceM:z.number().min(0).max(100_000) });

interface SocketLike { readyState:number; send(data:string):void; on(event:'close',callback:()=>void):void; }
const clients = new Set<SocketLike>();
let latestCamera:CameraDetectionFrame|undefined;
let latestRadar:RadarTrackFrame|undefined;
let latestVehicle:VehiclePosition|undefined;
let latestSensors:SensorHealth = { radarFront:'unavailable', radarRear:'unavailable', camera:'unavailable', can:'unavailable', gnssImu:'unavailable', ecu:'ok' };
let latestSequence = 0;
const geofences:Geofence[] = [];

function publish(source:'edge'|'simulator'='edge') {
  if (!latestVehicle) return null;
  const nowMs = Date.now();
  const objects = fuseEdgePerception({ vehicle:latestVehicle, camera:latestCamera, radar:latestRadar, nowMs });
  const sensors:SensorHealth = {
    ...latestSensors,
    camera: latestCamera && nowMs-latestCamera.timestampMs <= 500 ? latestSensors.camera : 'unavailable',
    radarFront: latestRadar && nowMs-latestRadar.timestampMs <= 350 ? latestSensors.radarFront : 'unavailable',
    gnssImu: nowMs-latestVehicle.timestampMs <= 1500 ? latestSensors.gnssImu : 'unavailable',
  };
  const frame:TelemetryFrame = {
    sequence:latestSequence,
    vehicle:latestVehicle,
    sensors,
    objects,
    alerts:buildLocationAlerts({vehicle:latestVehicle,sensors,objects,geofences}),
  };
  const envelope:RealtimeTelemetryEnvelope = { type:'telemetry', source, receivedAtMs:nowMs, frame };
  const payload = JSON.stringify(envelope);
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
  return envelope;
}

app.get('/health', async () => ({ status:'ok', mode:'warning-only', version:'3.0-edge' }));
app.post('/v1/risk', async (request,reply) => { const parsed=Sample.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'invalid-sample'}); return assessRisk(parsed.data); });
app.post('/v2/telemetry/evaluate', async (request,reply) => {
  const parsed=TelemetryEvaluationSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'invalid-telemetry-frame',details:parsed.error.flatten()});
  const vehicle=parsed.data.vehicle as VehiclePosition; const sensors=parsed.data.sensors as SensorHealth; const objects=parsed.data.objects as DetectedObject[]; const fences=(parsed.data.geofences??[]) as Geofence[];
  return { vehicle, objects, alerts:buildLocationAlerts({vehicle,sensors,objects,geofences:fences}), safetyMode:'warning-only', controlAuthority:'none' };
});
app.post('/v2/geo/project', async (request,reply) => { const parsed=ProjectPointSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'invalid-geo-input'}); return projectPoint(parsed.data.origin,parsed.data.bearingDeg,parsed.data.distanceM); });

app.post('/v3/perception/camera', async (request,reply) => {
  const parsed=CameraFrameSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'invalid-camera-frame',details:parsed.error.flatten()});
  latestCamera=parsed.data as CameraDetectionFrame; latestSensors={...latestSensors,camera:'ok'}; return publish();
});
app.post('/v3/perception/radar', async (request,reply) => {
  const parsed=RadarFrameSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'invalid-radar-frame',details:parsed.error.flatten()});
  latestRadar=parsed.data as RadarTrackFrame; latestSensors={...latestSensors,radarFront:'ok'}; return publish();
});
app.post('/v3/edge/gnss', async (request,reply) => {
  const parsed=VehiclePositionSchema.safeParse(request.body); if(!parsed.success || parsed.data.source!=='gnss')return reply.code(400).send({error:'invalid-gnss-sample'});
  latestVehicle=parsed.data as VehiclePosition; latestSensors={...latestSensors,gnssImu:'ok'}; latestSequence += 1; return publish();
});
app.post('/v3/edge/frame', async (request,reply) => {
  const parsed=EdgePacketSchema.safeParse(request.body); if(!parsed.success)return reply.code(400).send({error:'invalid-edge-packet',details:parsed.error.flatten()});
  const packet=parsed.data as EdgeTelemetryPacket; latestSequence=packet.sequence; latestVehicle=packet.gnss; latestSensors=packet.sensors; if(packet.camera)latestCamera=packet.camera; if(packet.radar)latestRadar=packet.radar; return publish();
});
app.get('/v3/edge/latest', async () => publish());
app.get('/v3/stream', { websocket:true }, (socket) => {
  const client=socket as unknown as SocketLike; clients.add(client); const initial=publish(); if(initial && client.readyState===1)client.send(JSON.stringify(initial)); client.on('close',()=>clients.delete(client));
});

app.get('/v1/capabilities', async () => ({ vehicleControl:false, canWrite:false, brake:false, steer:false, throttle:false, gpsPositioning:true, objectDetection:true, radarFusion:true, cameraClassification:true, realtimeWebSocket:true, geofenceAlerts:true, mapAlerts:true }));
await app.listen({ port:Number(process.env.PORT??4000), host:'0.0.0.0' });
