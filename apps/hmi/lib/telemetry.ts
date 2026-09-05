import type {
  DetectedObject,
  GeoPoint,
  LocationAlert,
  ObjectKind,
  RelativeZone,
  SensorHealth,
  Severity,
  TelemetryFrame,
  VehiclePosition,
} from '@kingmast/contracts';

const EARTH_RADIUS_M = 6_371_000;
const BASE_POSITION: GeoPoint = { lat: 21.0285, lng: 105.8542 };

const SENSOR_HEALTH: SensorHealth = {
  radarFront: 'ok',
  radarRear: 'ok',
  camera: 'ok',
  can: 'ok',
  gnssImu: 'ok',
  ecu: 'ok',
};

const scenarioObjects: Array<
  Array<{
    id: string;
    kind: ObjectKind;
    distanceM: number;
    bearingOffsetDeg: number;
    zone: RelativeZone;
    confidence: number;
    relativeSpeedMps: number;
  }>
> = [
  [
    { id: 'lead-car', kind: 'car', distanceM: 34, bearingOffsetDeg: 0, zone: 'front', confidence: 0.98, relativeSpeedMps: -2.8 },
    { id: 'left-bike', kind: 'bicycle', distanceM: 16, bearingOffsetDeg: -76, zone: 'left', confidence: 0.91, relativeSpeedMps: -0.4 },
    { id: 'rear-car', kind: 'car', distanceM: 22, bearingOffsetDeg: 180, zone: 'rear', confidence: 0.97, relativeSpeedMps: 1.1 },
  ],
  [
    { id: 'lead-car', kind: 'car', distanceM: 21, bearingOffsetDeg: 1, zone: 'front', confidence: 0.99, relativeSpeedMps: -4.6 },
    { id: 'right-moto', kind: 'motorcycle', distanceM: 11, bearingOffsetDeg: 64, zone: 'right', confidence: 0.92, relativeSpeedMps: -0.8 },
    { id: 'left-truck', kind: 'truck', distanceM: 29, bearingOffsetDeg: -48, zone: 'front-left', confidence: 0.95, relativeSpeedMps: -1.3 },
  ],
  [
    { id: 'pedestrian', kind: 'person', distanceM: 17, bearingOffsetDeg: 8, zone: 'front-right', confidence: 0.94, relativeSpeedMps: -0.3 },
    { id: 'lead-car', kind: 'car', distanceM: 15, bearingOffsetDeg: -2, zone: 'front', confidence: 0.99, relativeSpeedMps: -5.2 },
    { id: 'rear-car', kind: 'car', distanceM: 18, bearingOffsetDeg: 180, zone: 'rear', confidence: 0.96, relativeSpeedMps: 0.7 },
  ],
  [
    { id: 'pedestrian', kind: 'person', distanceM: 8, bearingOffsetDeg: 5, zone: 'front-right', confidence: 0.97, relativeSpeedMps: -0.2 },
    { id: 'lead-car', kind: 'car', distanceM: 7, bearingOffsetDeg: 0, zone: 'front', confidence: 0.99, relativeSpeedMps: -6.4 },
    { id: 'right-moto', kind: 'motorcycle', distanceM: 6, bearingOffsetDeg: 73, zone: 'right', confidence: 0.95, relativeSpeedMps: -1.1 },
  ],
  [
    { id: 'lead-car', kind: 'car', distanceM: 19, bearingOffsetDeg: 0, zone: 'front', confidence: 0.99, relativeSpeedMps: -3.1 },
    { id: 'left-bike', kind: 'bicycle', distanceM: 10, bearingOffsetDeg: -82, zone: 'left', confidence: 0.89, relativeSpeedMps: -0.2 },
    { id: 'front-bus', kind: 'bus', distanceM: 32, bearingOffsetDeg: 14, zone: 'front-right', confidence: 0.96, relativeSpeedMps: -1.2 },
  ],
  [
    { id: 'lead-car', kind: 'car', distanceM: 39, bearingOffsetDeg: 0, zone: 'front', confidence: 0.99, relativeSpeedMps: -1.4 },
    { id: 'rear-car', kind: 'car', distanceM: 24, bearingOffsetDeg: 180, zone: 'rear', confidence: 0.98, relativeSpeedMps: 0.5 },
    { id: 'right-truck', kind: 'truck', distanceM: 27, bearingOffsetDeg: 58, zone: 'front-right', confidence: 0.96, relativeSpeedMps: -0.7 },
  ],
];

const speeds = [48, 51, 47, 39, 43, 50];
const headings = [32, 35, 37, 39, 42, 44];

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function toDeg(value: number) {
  return (value * 180) / Math.PI;
}

export function projectPoint(origin: GeoPoint, bearingDeg: number, distanceM: number): GeoPoint {
  const angularDistance = distanceM / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

function severityFor(kind: ObjectKind, distanceM: number, zone: RelativeZone): Severity {
  const front = zone === 'front' || zone === 'front-left' || zone === 'front-right';
  if (kind === 'person' && front && distanceM <= 10) return 'critical';
  if (kind === 'person' && front && distanceM <= 22) return 'caution';
  if ((kind === 'car' || kind === 'truck' || kind === 'bus' || kind === 'motorcycle') && front && distanceM <= 8) return 'critical';
  if ((kind === 'car' || kind === 'truck' || kind === 'bus' || kind === 'motorcycle') && front && distanceM <= 16) return 'caution';
  if ((kind === 'person' || kind === 'bicycle' || kind === 'motorcycle') && distanceM <= 6) return 'critical';
  if ((kind === 'person' || kind === 'bicycle' || kind === 'motorcycle') && distanceM <= 12) return 'caution';
  return 'safe';
}

function alertForObject(object: DetectedObject): LocationAlert | null {
  if (object.severity === 'safe') return null;
  const lateralOnly = object.zone === 'left' || object.zone === 'right';
  if (lateralOnly && object.severity !== 'critical') return null;
  const isPedestrian = object.kind === 'person';
  const isVulnerable = isPedestrian || object.kind === 'bicycle' || object.kind === 'motorcycle';
  const type = isPedestrian
    ? 'pedestrian-ahead'
    : isVulnerable
      ? 'vulnerable-road-user'
      : 'vehicle-too-close';
  const title = isPedestrian
    ? 'Pedestrian ahead'
    : isVulnerable
      ? 'Road user nearby'
      : 'Vehicle too close';
  return {
    id: `alert-${object.id}-${object.timestampMs}`,
    type,
    severity: object.severity,
    title,
    message: `${object.kind} detected ${object.distanceM.toFixed(1)} m ${object.zone.replace('-', ' ')}.`,
    distanceM: object.distanceM,
    objectId: object.id,
    position: object.position,
    timestampMs: object.timestampMs,
    acknowledged: false,
  };
}

export function createSimulationFrame(sequence: number, origin: GeoPoint = BASE_POSITION): TelemetryFrame {
  const index = Math.abs(sequence) % scenarioObjects.length;
  const headingDeg = headings[index] ?? headings[0]!;
  const timestampMs = Date.now();
  const traveledM = sequence * 7;
  const vehiclePoint = projectPoint(origin, 34, traveledM);
  const vehicle: VehiclePosition = {
    ...vehiclePoint,
    speedKmh: speeds[index] ?? speeds[0]!,
    headingDeg,
    accuracyM: 2.8,
    timestampMs,
    source: 'simulator',
  };

  const objects: DetectedObject[] = (scenarioObjects[index] ?? scenarioObjects[0]!).map((item) => {
    const bearingDeg = (headingDeg + item.bearingOffsetDeg + 360) % 360;
    return {
      id: item.id,
      kind: item.kind,
      confidence: item.confidence,
      distanceM: item.distanceM,
      bearingDeg,
      zone: item.zone,
      severity: severityFor(item.kind, item.distanceM, item.zone),
      relativeSpeedMps: item.relativeSpeedMps,
      position: projectPoint(vehicle, bearingDeg, item.distanceM),
      timestampMs,
    };
  });

  const sensors: SensorHealth = {
    ...SENSOR_HEALTH,
    camera: index === 2 ? 'degraded' : 'ok',
    gnssImu: index === 4 ? 'degraded' : 'ok',
  };
  const alerts = objects.map(alertForObject).filter((alert): alert is LocationAlert => alert !== null);
  if (sensors.camera !== 'ok' || sensors.gnssImu !== 'ok') {
    alerts.push({
      id: `sensor-${timestampMs}`,
      type: 'sensor-degraded',
      severity: 'caution',
      title: 'Reduced sensing confidence',
      message: 'A sensing input is degraded. KINGMAST remains warning-only.',
      distanceM: null,
      objectId: null,
      position: vehicle,
      timestampMs,
      acknowledged: false,
    });
  }

  return { sequence, vehicle, sensors, objects, alerts };
}

export function withDevicePosition(frame: TelemetryFrame, position: VehiclePosition): TelemetryFrame {
  const objects = frame.objects.map((object) => ({
    ...object,
    position: projectPoint(position, object.bearingDeg, object.distanceM),
    timestampMs: position.timestampMs,
  }));
  const alerts = frame.alerts.map((alert) => {
    const object = alert.objectId ? objects.find((item) => item.id === alert.objectId) : null;
    return {
      ...alert,
      position: object?.position ?? { lat: position.lat, lng: position.lng },
      timestampMs: position.timestampMs,
    };
  });
  return { ...frame, vehicle: position, objects, alerts };
}