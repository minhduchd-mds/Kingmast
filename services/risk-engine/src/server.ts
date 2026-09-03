import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import type {
  DetectedObject,
  Geofence,
  SensorHealth,
  VehiclePosition,
} from '@kingmast/contracts';
import { assessRisk } from './risk.js';
import { buildLocationAlerts } from './object-alerts.js';
import { projectPoint } from './geo.js';

const app = Fastify({ logger: true, bodyLimit: 128_000 });
await app.register(helmet);
await app.register(cors, {
  origin: process.env.HMI_ORIGIN ?? 'http://localhost:3000',
  methods: ['GET', 'POST'],
});

const Sample = z.object({
  timestampMs: z.number().int(),
  egoSpeedMps: z.number().min(0).max(100),
  targetSpeedMps: z.number().min(-50).max(100),
  rangeM: z.number().min(0).max(500),
  confidence: z.number().min(0).max(1),
  canHealthy: z.boolean(),
  radarHealthy: z.boolean(),
  cameraHealthy: z.boolean(),
});

const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const VehiclePositionSchema = GeoPointSchema.extend({
  speedKmh: z.number().min(0).max(350),
  headingDeg: z.number().min(0).max(360),
  accuracyM: z.number().min(0).max(10_000),
  timestampMs: z.number().int(),
  source: z.enum(['gnss', 'device-gps', 'simulator']),
});

const SensorStateSchema = z.enum(['ok', 'degraded', 'unavailable']);
const SensorHealthSchema = z.object({
  radarFront: SensorStateSchema,
  radarRear: SensorStateSchema,
  camera: SensorStateSchema,
  can: SensorStateSchema,
  gnssImu: SensorStateSchema,
  ecu: SensorStateSchema,
});

const DetectedObjectSchema = z.object({
  id: z.string().min(1).max(96),
  kind: z.enum(['person', 'car', 'motorcycle', 'bicycle', 'truck', 'bus', 'obstacle', 'unknown']),
  confidence: z.number().min(0).max(1),
  distanceM: z.number().min(0).max(500),
  bearingDeg: z.number().min(0).max(360),
  zone: z.enum(['front', 'front-left', 'front-right', 'left', 'right', 'rear']),
  severity: z.enum(['safe', 'caution', 'critical']),
  relativeSpeedMps: z.number().min(-100).max(100),
  position: GeoPointSchema,
  timestampMs: z.number().int(),
});

const GeofenceSchema = z.object({
  id: z.string().min(1).max(96),
  name: z.string().min(1).max(160),
  center: GeoPointSchema,
  radiusM: z.number().min(1).max(100_000),
  severity: z.enum(['caution', 'critical']),
  enabled: z.boolean(),
});

const TelemetryEvaluationSchema = z.object({
  vehicle: VehiclePositionSchema,
  sensors: SensorHealthSchema,
  objects: z.array(DetectedObjectSchema).max(128),
  geofences: z.array(GeofenceSchema).max(32).optional(),
});

const ProjectPointSchema = z.object({
  origin: GeoPointSchema,
  bearingDeg: z.number().min(0).max(360),
  distanceM: z.number().min(0).max(100_000),
});

app.get('/health', async () => ({
  status: 'ok',
  mode: 'warning-only',
  version: '2.0',
}));

app.post('/v1/risk', async (request, reply) => {
  const parsed = Sample.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid-sample' });
  return assessRisk(parsed.data);
});

app.post('/v2/telemetry/evaluate', async (request, reply) => {
  const parsed = TelemetryEvaluationSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid-telemetry-frame', details: parsed.error.flatten() });
  }

  const vehicle = parsed.data.vehicle as VehiclePosition;
  const sensors = parsed.data.sensors as SensorHealth;
  const objects = parsed.data.objects as DetectedObject[];
  const geofences = (parsed.data.geofences ?? []) as Geofence[];
  const alerts = buildLocationAlerts({ vehicle, sensors, objects, geofences });

  return {
    vehicle,
    objects,
    alerts,
    safetyMode: 'warning-only',
    controlAuthority: 'none',
  };
});

app.post('/v2/geo/project', async (request, reply) => {
  const parsed = ProjectPointSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid-geo-input' });
  return projectPoint(parsed.data.origin, parsed.data.bearingDeg, parsed.data.distanceM);
});

app.get('/v1/capabilities', async () => ({
  vehicleControl: false,
  canWrite: false,
  brake: false,
  steer: false,
  throttle: false,
  gpsPositioning: true,
  objectDetection: true,
  geofenceAlerts: true,
  mapAlerts: true,
}));

await app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' });
