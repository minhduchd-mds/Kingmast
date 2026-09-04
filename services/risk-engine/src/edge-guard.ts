import type { EdgeTelemetryPacket, SensorHealth, VehiclePosition } from '@kingmast/contracts';

const MAX_PAST_SKEW_MS = 30_000;
const MAX_FUTURE_SKEW_MS = 5_000;
const GNSS_DEGRADED_ACCURACY_M = 15;
const GNSS_UNAVAILABLE_ACCURACY_M = 50;
const GNSS_STALE_MS = 3_000;
const RADAR_STALE_MS = 350;
const CAMERA_STALE_MS = 500;

export type EdgePacketGuardReason =
  | 'unsupported-protocol'
  | 'clock-skew'
  | 'gnss-clock-mismatch'
  | 'sequence-replay'
  | 'clock-regression';

export type EdgePacketGuardResult =
  | { ok:true }
  | { ok:false; reason:EdgePacketGuardReason };

interface DeviceSession {
  bootId:string;
  lastSequence:number;
  lastTimestampMs:number;
}

export class EdgePacketGuard {
  private readonly sessions = new Map<string,DeviceSession>();
  rejectedPackets = 0;

  accept(packet:EdgeTelemetryPacket, nowMs=Date.now()):EdgePacketGuardResult {
    const reject = (reason:EdgePacketGuardReason):EdgePacketGuardResult => {
      this.rejectedPackets += 1;
      return { ok:false, reason };
    };

    if (packet.protocolVersion !== 1) return reject('unsupported-protocol');
    const skew = packet.timestampMs - nowMs;
    if (skew > MAX_FUTURE_SKEW_MS || skew < -MAX_PAST_SKEW_MS) return reject('clock-skew');
    if (Math.abs(packet.gnss.timestampMs-packet.timestampMs) > 5_000) return reject('gnss-clock-mismatch');

    const previous = this.sessions.get(packet.deviceId);
    if (previous && previous.bootId === packet.bootId) {
      if (packet.sequence <= previous.lastSequence) return reject('sequence-replay');
      if (packet.timestampMs < previous.lastTimestampMs-2_000) return reject('clock-regression');
    }

    this.sessions.set(packet.deviceId, {
      bootId:packet.bootId,
      lastSequence:packet.sequence,
      lastTimestampMs:packet.timestampMs,
    });
    return { ok:true };
  }
}

function ageMs(timestampMs:number|undefined, nowMs:number) {
  if (timestampMs === undefined) return null;
  return Math.max(0,nowMs-timestampMs);
}

export function sensorAges(input:{
  vehicle?:VehiclePosition;
  radarTimestampMs?:number;
  cameraTimestampMs?:number;
  nowMs?:number;
}) {
  const nowMs=input.nowMs??Date.now();
  return {
    gnss:input.vehicle?ageMs(input.vehicle.timestampMs,nowMs):null,
    radarFront:ageMs(input.radarTimestampMs,nowMs),
    camera:ageMs(input.cameraTimestampMs,nowMs),
  };
}

export function applySensorFreshness(input:{
  sensors:SensorHealth;
  vehicle?:VehiclePosition;
  radarTimestampMs?:number;
  cameraTimestampMs?:number;
  nowMs?:number;
}):SensorHealth {
  const nowMs=input.nowMs??Date.now();
  const ages=sensorAges({...input,nowMs});
  const result:SensorHealth={...input.sensors};

  if (!input.vehicle || ages.gnss===null || ages.gnss>GNSS_STALE_MS || input.vehicle.accuracyM>GNSS_UNAVAILABLE_ACCURACY_M) result.gnssImu='unavailable';
  else if (input.vehicle.accuracyM>GNSS_DEGRADED_ACCURACY_M && result.gnssImu!=='unavailable') result.gnssImu='degraded';

  if (ages.radarFront===null || ages.radarFront>RADAR_STALE_MS) result.radarFront='unavailable';
  if (ages.camera===null || ages.camera>CAMERA_STALE_MS) result.camera='unavailable';
  return result;
}
