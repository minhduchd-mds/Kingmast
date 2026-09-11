import {describe,expect,it} from 'vitest';
import {CameraPerformanceTracker} from './camera-performance.js';

const NOW=1_800_000_000_000;

describe('camera runtime health',()=>{
  it('reports unavailable before any frame is processed',()=>{
    const tracker=new CameraPerformanceTracker();
    tracker.captured('front');
    expect(tracker.health('front').status).toBe('unavailable');
  });

  it('reports degraded and overloaded latency deterministically',()=>{
    const degraded=new CameraPerformanceTracker();
    degraded.captured('front');degraded.processed('front',NOW-400,NOW);
    expect(degraded.health('front').status).toBe('degraded');

    const overloaded=new CameraPerformanceTracker();
    overloaded.captured('front');overloaded.processed('front',NOW-800,NOW);
    expect(overloaded.health('front').status).toBe('overloaded');
  });

  it('uses drop ratio only after enough volume to avoid noisy startup classification',()=>{
    const tracker=new CameraPerformanceTracker();
    for(let index=0;index<10;index+=1){tracker.captured('front');tracker.dropped('front');}
    tracker.processed('front',NOW-50,NOW);
    expect(tracker.health('front').status).toBe('overloaded');
    expect(tracker.health('front').dropRate).toBe(1);
  });
});
