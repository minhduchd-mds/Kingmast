import type {
  DetectedObject,
  Geofence,
  LocationAlert,
  Severity,
  SensorHealth,
  VehiclePosition,
} from '@kingmast/contracts';
import { insideGeofence } from './geo.js';

const vulnerableKinds = new Set(['person', 'bicycle', 'motorcycle']);
const vehicleKinds = new Set(['car', 'truck', 'bus', 'motorcycle']);

function severityRank(severity: Severity) {
  return severity === 'critical' ? 3 : severity === 'caution' ? 2 : 1;
}

function objectAlert(object: DetectedObject): LocationAlert | null {
  if (object.confidence < 0.55) return null;

  const isFront = object.zone === 'front' || object.zone === 'front-left' || object.zone === 'front-right';
  const isLateralOnly = object.zone === 'left' || object.zone === 'right';

  // Left/right object detection is spatial context only. The current fusion severity is
  // distance-based and is not a dedicated lateral-collision assessment, so it must not
  // create a textual driver alert. A future lateral warning needs its own validated risk signal.
  if (isLateralOnly) return null;

  if (object.kind === 'person' && isFront && object.distanceM <= 22) {
    const severity: Severity = object.distanceM <= 10 ? 'critical' : 'caution';
    return {
      id: `person-${object.id}-${object.timestampMs}`,
      type: 'pedestrian-ahead',
      severity,
      title: 'Pedestrian ahead',
      message: `Pedestrian detected ${Math.round(object.distanceM)} m ${object.zone.replace('-', ' ')}.`,
      distanceM: object.distanceM,
      objectId: object.id,
      position: object.position,
      timestampMs: object.timestampMs,
      acknowledged: false,
    };
  }

  if (vehicleKinds.has(object.kind) && isFront && object.distanceM <= 16) {
    const severity: Severity = object.distanceM <= 8 ? 'critical' : 'caution';
    return {
      id: `vehicle-${object.id}-${object.timestampMs}`,
      type: 'vehicle-too-close',
      severity,
      title: 'Vehicle too close',
      message: `${object.kind} is ${object.distanceM.toFixed(1)} m ahead. Increase following distance.`,
      distanceM: object.distanceM,
      objectId: object.id,
      position: object.position,
      timestampMs: object.timestampMs,
      acknowledged: false,
    };
  }

  if (vulnerableKinds.has(object.kind) && object.distanceM <= 12) {
    const severity: Severity = object.distanceM <= 6 || object.severity === 'critical' ? 'critical' : 'caution';
    return {
      id: `vru-${object.id}-${object.timestampMs}`,
      type: 'vulnerable-road-user',
      severity,
      title: 'Road user nearby',
      message: `${object.kind} detected ${object.distanceM.toFixed(1)} m on the ${object.zone.replace('-', ' ')} side.`,
      distanceM: object.distanceM,
      objectId: object.id,
      position: object.position,
      timestampMs: object.timestampMs,
      acknowledged: false,
    };
  }

  if (object.severity === 'critical' && object.distanceM <= 9) {
    return {
      id: `object-${object.id}-${object.timestampMs}`,
      type: 'object-in-danger-zone',
      severity: 'critical',
      title: 'Object in danger zone',
      message: `${object.kind} entered the immediate safety zone.`,
      distanceM: object.distanceM,
      objectId: object.id,
      position: object.position,
      timestampMs: object.timestampMs,
      acknowledged: false,
    };
  }

  return null;
}

export function buildLocationAlerts(input: {
  vehicle: VehiclePosition;
  objects: DetectedObject[];
  sensors: SensorHealth;
  geofences?: Geofence[];
}): LocationAlert[] {
  const alerts = input.objects.map(objectAlert).filter((alert): alert is LocationAlert => alert !== null);

  for (const geofence of input.geofences ?? []) {
    if (!insideGeofence(input.vehicle, geofence)) continue;
    alerts.push({
      id: `geofence-${geofence.id}-${input.vehicle.timestampMs}`,
      type: 'geofence-entry',
      severity: geofence.severity,
      title: geofence.name,
      message: `Vehicle entered ${geofence.name}. Follow the local safety rule.`,
      distanceM: null,
      objectId: null,
      position: { lat: input.vehicle.lat, lng: input.vehicle.lng },
      timestampMs: input.vehicle.timestampMs,
      acknowledged: false,
    });
  }

  const degraded = Object.entries(input.sensors).filter(([, state]) => state !== 'ok');
  if (degraded.length > 0) {
    alerts.push({
      id: `sensor-${input.vehicle.timestampMs}`,
      type: 'sensor-degraded',
      severity: 'caution',
      title: 'Reduced sensing confidence',
      message: `${degraded.map(([name]) => name).join(', ')} degraded. Unavailable inputs are excluded from decisions.`,
      distanceM: null,
      objectId: null,
      position: { lat: input.vehicle.lat, lng: input.vehicle.lng },
      timestampMs: input.vehicle.timestampMs,
      acknowledged: false,
    });
  }

  return alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.timestampMs - a.timestampMs);
}
