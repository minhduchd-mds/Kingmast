import type { EdgeTelemetryPacket, SensorHealth, VehiclePosition } from '@kingmast/contracts';

const MAX_PAST_SKEW_MS = 30_000;
const MAX_FUTURE_SKEW_MS = 5_000;
const GNSS_DEGRADED_ACCURACY_M = 15;
const GNSS_UNAVAILABLE_ACCURACY_M = 50;
const GNSS_STALE_MS = 3_000;
const RADAR_STALE_MS = 350;
const CAMERA_STALE_MS = 500;
const DEFAULT_MAX_SESSIONS = 2_048;
const DEFAULT_SESSION_TTL_MS = 24*60*60*1_000;
const MAX_PRUNE_INTERVAL_MS = 60_000;
const BOOT_HISTORY_LIMIT = 8;
const BOOT_CHANGE_WINDOW_MS = 60_000;
const MAX_BOOT_CHANGES_PER_WINDOW = 3;

export type EdgePacketGuardReason =
  | 'unsupported-protocol'
  | 'clock-skew'
  | 'gnss-clock-mismatch'
  | 'sequence-replay'
  | 'boot-replay'
  | 'boot-churn'
  | 'clock-regression'
  | 'session-capacity';

export type EdgePacketGuardResult =
  | { ok:true }
  | { ok:false; reason:EdgePacketGuardReason };

interface DeviceSession {
  bootId:string;
  lastSequence:number;
  lastTimestampMs:number;
  lastSeenAtMs:number;
  recentBootIds:string[];
  bootWindowStartedAtMs:number;
  bootChangesInWindow:number;
}

export interface EdgePacketGuardOptions {
  maxSessions?:number;
  sessionTtlMs?:number;
}

export class EdgePacketGuard {
  private readonly sessions = new Map<string,DeviceSession>();
  private readonly maxSessions:number;
  private readonly sessionTtlMs:number;
  private lastPruneAtMs=0;
  rejectedPackets = 0;

  constructor(options:EdgePacketGuardOptions={}) {
    this.maxSessions=Math.max(1,Math.min(100_000,Math.floor(options.maxSessions??DEFAULT_MAX_SESSIONS)));
    this.sessionTtlMs=Math.max(1_000,Math.min(7*24*60*60*1_000,Math.floor(options.sessionTtlMs??DEFAULT_SESSION_TTL_MS)));
  }

  get activeSessions(){return this.sessions.size;}

  private pruneExpired(nowMs:number) {
    const interval=Math.min(MAX_PRUNE_INTERVAL_MS,this.sessionTtlMs);
    if(this.sessions.size<this.maxSessions&&nowMs-this.lastPruneAtMs<interval)return;
    this.lastPruneAtMs=nowMs;
    for(const[deviceId,session]of this.sessions)if(nowMs-session.lastSeenAtMs>this.sessionTtlMs)this.sessions.delete(deviceId);
  }

  accept(packet:EdgeTelemetryPacket, nowMs=Date.now()):EdgePacketGuardResult {
    const reject = (reason:EdgePacketGuardReason):EdgePacketGuardResult => {
      this.rejectedPackets += 1;
      return { ok:false, reason };
    };

    this.pruneExpired(nowMs);
    if (packet.protocolVersion !== 1) return reject('unsupported-protocol');
    const skew = packet.timestampMs - nowMs;
    if (skew > MAX_FUTURE_SKEW_MS || skew < -MAX_PAST_SKEW_MS) return reject('clock-skew');
    if (Math.abs(packet.gnss.timestampMs-packet.timestampMs) > 5_000) return reject('gnss-clock-mismatch');

    const previous = this.sessions.get(packet.deviceId);
    if (!previous && this.sessions.size >= this.maxSessions) return reject('session-capacity');
    if (previous && packet.timestampMs < previous.lastTimestampMs-2_000) return reject('clock-regression');

    if (previous && previous.bootId === packet.bootId) {
      if (packet.sequence <= previous.lastSequence) return reject('sequence-replay');
      this.sessions.set(packet.deviceId, {
        ...previous,
        lastSequence:packet.sequence,
        lastTimestampMs:packet.timestampMs,
        lastSeenAtMs:nowMs,
      });
      return { ok:true };
    }

    if (previous) {
      if (previous.recentBootIds.includes(packet.bootId)) return reject('boot-replay');
      const inWindow=nowMs-previous.bootWindowStartedAtMs<=BOOT_CHANGE_WINDOW_MS;
      const bootChangesInWindow=inWindow?previous.bootChangesInWindow:0;
      if (bootChangesInWindow>=MAX_BOOT_CHANGES_PER_WINDOW) return reject('boot-churn');
      this.sessions.set(packet.deviceId, {
        bootId:packet.bootId,
        lastSequence:packet.sequence,
        lastTimestampMs:packet.timestampMs,
        lastSeenAtMs:nowMs,
        recentBootIds:[...previous.recentBootIds.slice(-(BOOT_HISTORY_LIMIT-1)),packet.bootId],
        bootWindowStartedAtMs:inWindow?previous.bootWindowStartedAtMs:nowMs,
        bootChangesInWindow:bootChangesInWindow+1,
      });
      return { ok:true };
    }

    this.sessions.set(packet.deviceId, {
      bootId:packet.bootId,
      lastSequence:packet.sequence,
      lastTimestampMs:packet.timestampMs,
      lastSeenAtMs:nowMs,
      recentBootIds:[packet.bootId],
      bootWindowStartedAtMs:nowMs,
      bootChangesInWindow:0,
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
