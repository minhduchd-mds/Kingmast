import { describe,expect,it } from 'vitest';
import { assessLaneDeparture } from './lane-departure.js';

const base={timestampMs:1_800_000_000_000,speedKmh:72,laneWidthM:3.5,lateralOffsetM:0,lateralVelocityMps:0,headingErrorDeg:0,confidence:.94,turnSignal:'off' as const};

describe('assessLaneDeparture',()=>{
  it('warns on an imminent unindicated lane crossing',()=>{
    const result=assessLaneDeparture({...base,lateralOffsetM:.7,lateralVelocityMps:.55});
    expect(result.side).toBe('right');
    expect(['caution','critical']).toContain(result.severity);
    expect(result.advisoryOnly).toBe(true);
  });
  it('suppresses an intentional indicated maneuver',()=>{
    expect(assessLaneDeparture({...base,lateralVelocityMps:.65,turnSignal:'right'}).severity).toBe('safe');
  });
  it('fails quiet when the lane model is not reliable',()=>{
    expect(assessLaneDeparture({...base,confidence:.4,lateralVelocityMps:1}).reason).toBe('lane-model-not-reliable');
  });
});
