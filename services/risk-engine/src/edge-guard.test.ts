import { describe, expect, it } from 'vitest';
import type { EdgeTelemetryPacket, SensorHealth } from '@kingmast/contracts';
import { applySensorFreshness, EdgePacketGuard } from './edge-guard.js';

const now=1_800_000_000_000;
const sensors:SensorHealth={radarFront:'ok',radarRear:'unavailable',camera:'ok',can:'unavailable',gnssImu:'ok',ecu:'ok'};
const packet=(sequence:number,bootId='boot-a'):EdgeTelemetryPacket=>({
  protocolVersion:1,deviceId:'edge-1',bootId,sequence,timestampMs:now,
  gnss:{lat:21.0285,lng:105.8542,speedKmh:40,headingDeg:12,accuracyM:3,timestampMs:now,source:'gnss'},
  sensors,
});

describe('EdgePacketGuard',()=>{
  it('rejects replay in the same boot session and accepts a new boot session',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(packet(1),now).ok).toBe(true);
    expect(guard.accept(packet(1),now)).toEqual({ok:false,reason:'sequence-replay'});
    expect(guard.accept(packet(0,'boot-b'),now).ok).toBe(true);
  });

  it('rejects packets with an invalid wall clock',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept({...packet(1),timestampMs:now-60_000},now)).toEqual({ok:false,reason:'clock-skew'});
  });
});

describe('applySensorFreshness',()=>{
  it('degrades inaccurate GNSS and removes stale perception inputs',()=>{
    const result=applySensorFreshness({
      sensors,
      vehicle:{...packet(1).gnss,accuracyM:20},
      radarTimestampMs:now-500,
      cameraTimestampMs:now-700,
      nowMs:now,
    });
    expect(result.gnssImu).toBe('degraded');
    expect(result.radarFront).toBe('unavailable');
    expect(result.camera).toBe('unavailable');
  });
});
