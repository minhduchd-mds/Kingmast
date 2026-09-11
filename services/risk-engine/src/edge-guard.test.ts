import { describe, expect, it } from 'vitest';
import type { EdgeTelemetryPacket, SensorHealth } from '@kingmast/contracts';
import { applySensorFreshness, EdgePacketGuard } from './edge-guard.js';

const now=1_800_000_000_000;
const sensors:SensorHealth={radarFront:'ok',radarRear:'unavailable',camera:'ok',can:'unavailable',gnssImu:'ok',ecu:'ok'};
const packet=(sequence:number,bootId='boot-a',deviceId='edge-1',timestampMs=now):EdgeTelemetryPacket=>({
  protocolVersion:1,deviceId,bootId,sequence,timestampMs,
  gnss:{lat:21.0285,lng:105.8542,speedKmh:40,headingDeg:12,accuracyM:3,timestampMs,source:'gnss'},
  sensors,
});

describe('EdgePacketGuard',()=>{
  it('rejects replay in the same boot session and accepts a new boot session',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(packet(1),now).ok).toBe(true);
    expect(guard.accept(packet(1),now)).toEqual({ok:false,reason:'sequence-replay'});
    expect(guard.accept(packet(0,'boot-b'),now).ok).toBe(true);
  });

  it('rejects replay of a previously seen boot id after a boot transition',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(packet(10,'boot-a'),now).ok).toBe(true);
    expect(guard.accept(packet(0,'boot-b','edge-1',now+1_000),now+1_000).ok).toBe(true);
    expect(guard.accept(packet(11,'boot-a','edge-1',now+2_000),now+2_000)).toEqual({ok:false,reason:'boot-replay'});
  });

  it('rate limits repeated unique boot-id changes for one device',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(packet(1,'boot-a'),now).ok).toBe(true);
    expect(guard.accept(packet(0,'boot-b','edge-1',now+1_000),now+1_000).ok).toBe(true);
    expect(guard.accept(packet(0,'boot-c','edge-1',now+2_000),now+2_000).ok).toBe(true);
    expect(guard.accept(packet(0,'boot-d','edge-1',now+3_000),now+3_000).ok).toBe(true);
    expect(guard.accept(packet(0,'boot-e','edge-1',now+4_000),now+4_000)).toEqual({ok:false,reason:'boot-churn'});
  });

  it('rejects packets with an invalid wall clock',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(packet(1,'boot-a','edge-1',now-60_000),now)).toEqual({ok:false,reason:'clock-skew'});
  });

  it('rejects clock regression across boot transitions',()=>{
    const guard=new EdgePacketGuard();
    expect(guard.accept(packet(1,'boot-a','edge-1',now),now).ok).toBe(true);
    expect(guard.accept(packet(0,'boot-b','edge-1',now-3_000),now)).toEqual({ok:false,reason:'clock-regression'});
  });

  it('bounds device-session memory and fails closed for new devices at capacity',()=>{
    const guard=new EdgePacketGuard({maxSessions:2,sessionTtlMs:60_000});
    expect(guard.accept(packet(1,'boot-a','edge-1'),now).ok).toBe(true);
    expect(guard.accept(packet(1,'boot-b','edge-2'),now).ok).toBe(true);
    expect(guard.activeSessions).toBe(2);
    expect(guard.accept(packet(1,'boot-c','edge-3'),now)).toEqual({ok:false,reason:'session-capacity'});
    expect(guard.activeSessions).toBe(2);
  });

  it('prunes idle device sessions after the configured TTL',()=>{
    const guard=new EdgePacketGuard({maxSessions:1,sessionTtlMs:1_000});
    expect(guard.accept(packet(1,'boot-a','edge-1'),now).ok).toBe(true);
    const later=now+1_500;
    expect(guard.accept(packet(1,'boot-b','edge-2',later),later).ok).toBe(true);
    expect(guard.activeSessions).toBe(1);
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
