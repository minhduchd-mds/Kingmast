import {describe,expect,it} from 'vitest';
import type {TrafficControlObservation} from '@kingmast/contracts/nextgen';
import {VisionTrafficControlTracker} from './vision-traffic-control-tracker.js';

const NOW=1_800_000_000_000;
function observation(overrides:Partial<TrafficControlObservation>={}):TrafficControlObservation{return{id:'sign-1',cameraId:'front-1',kind:'speed-limit',speedLimitKmh:50,signalState:null,confidence:.85,relativeBearingDeg:0,estimatedDistanceM:40,capturedAtMs:NOW-120,receivedAtMs:NOW-80,...overrides};}

describe('vision traffic-control tracker',()=>{
  it('requires repeated medium-confidence speed evidence before publishing a limit',()=>{
    const tracker=new VisionTrafficControlTracker();
    tracker.ingest(observation(),NOW);
    expect(tracker.snapshot(NOW).speedLimitKmh).toBeNull();
    tracker.ingest(observation({id:'sign-2',capturedAtMs:NOW-60,receivedAtMs:NOW-40}),NOW);
    const snapshot=tracker.snapshot(NOW);
    expect(snapshot.speedLimitKmh).toBe(50);
    expect(snapshot.speedLimitConfidence).toBeCloseTo(.85);
    expect(snapshot.advisoryOnly).toBe(true);
  });

  it('accepts a single very-high-confidence signal observation but expires it when stale',()=>{
    const tracker=new VisionTrafficControlTracker();
    tracker.ingest(observation({id:'light-1',kind:'traffic-light',speedLimitKmh:null,signalState:'red',confidence:.96,estimatedDistanceM:30}),NOW);
    expect(tracker.snapshot(NOW).signalState).toBe('red');
    expect(tracker.snapshot(NOW+5_000).signalState).toBeNull();
  });

  it('rejects low-confidence observations before they enter stable history',()=>{
    const tracker=new VisionTrafficControlTracker();
    const result=tracker.ingest(observation({confidence:.4}),NOW);
    expect(result.usable).toBe(false);
    expect(result.reason).toBe('low-confidence');
    expect(tracker.snapshot(NOW).speedLimitKmh).toBeNull();
  });
});
