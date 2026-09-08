import { describe,expect,it } from 'vitest';
import { assessLaneDeparture } from './lane-departure.js';

const base={timestampMs:1_800_000_000_000,speedKmh:72,laneWidthM:3.5,lateralOffsetM:0,lateralVelocityMps:0,headingErrorDeg:0,confidence:.94,turnSignal:'off' as const};

describe('assessLaneDeparture',()=>{
  it('warns on an imminent unindicated lane crossing',()=>{
    const result=assessLaneDeparture({...base,lateralOffsetM:.7,lateralVelocityMps:.55});
    expect(result.side).toBe('right');
    expect(['caution','critical']).toContain(result.severity);
    expect(result.laneMarginM).toBeLessThanOrEqual(0);
    expect(result.riskScore).toBeGreaterThan(.7);
    expect(result.advisoryOnly).toBe(true);
  });
  it('suppresses an intentional indicated maneuver without inventing control authority',()=>{
    const result=assessLaneDeparture({...base,lateralVelocityMps:.65,turnSignal:'right'});
    expect(result.severity).toBe('safe');
    expect(result.reason).toBe('intentional-maneuver-suppressed');
    expect(result.advisoryOnly).toBe(true);
  });
  it('keeps a stable centered lane low risk',()=>{
    const result=assessLaneDeparture(base);
    expect(result.reason).toBe('stable-lane-position');
    expect(result.laneMarginM).toBeGreaterThan(.5);
    expect(result.riskScore).toBeLessThan(.1);
  });
  it('fails quiet when the lane model is not reliable',()=>{
    const result=assessLaneDeparture({...base,confidence:.4,lateralVelocityMps:1});
    expect(result.reason).toBe('lane-model-not-reliable');
    expect(result.riskScore).toBe(0);
  });
});
