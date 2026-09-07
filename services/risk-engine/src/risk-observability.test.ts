import {describe,expect,it} from 'vitest';
import {BoundedRiskMetrics} from './risk-observability.js';

describe('BoundedRiskMetrics',()=>{
  it('tracks only fixed counters and latency buckets',()=>{
    const metrics=new BoundedRiskMetrics();
    metrics.observe({severity:'safe',ttcS:null,thwS:null,closingSpeedMps:0,confidence:0,reasons:['stale-data-rejected']},.5);
    metrics.observe({severity:'caution',ttcS:2,thwS:1.5,closingSpeedMps:4,confidence:.7,reasons:['closing-gap']},7);
    metrics.observe({severity:'critical',ttcS:1,thwS:.8,closingSpeedMps:8,confidence:.9,reasons:['closing-gap']},30);
    expect(metrics.snapshot()).toEqual({
      assessments:3,
      severity:{safe:1,caution:1,critical:1},
      rejected:{stale:1,future:0,radarUnavailable:0},
      latencyMs:{last:30,max:30,buckets:{le1:1,le5:0,le10:1,le25:0,gt25:1}},
    });
  });

  it('counts future-clock rejection without retaining the input sample',()=>{
    const metrics=new BoundedRiskMetrics();
    metrics.observe({severity:'safe',ttcS:null,thwS:null,closingSpeedMps:0,confidence:0,reasons:['future-data-rejected']},1.5);
    const snapshot=metrics.snapshot();
    expect(snapshot.rejected).toEqual({stale:0,future:1,radarUnavailable:0});
    expect(snapshot.assessments).toBe(1);
    expect(snapshot.latencyMs.buckets.le5).toBe(1);
  });

  it('bounds invalid or pathological latency values instead of retaining samples',()=>{
    const metrics=new BoundedRiskMetrics();
    metrics.observe({severity:'safe',ttcS:null,thwS:null,closingSpeedMps:0,confidence:0,reasons:['radar-unavailable']},Number.POSITIVE_INFINITY);
    const snapshot=metrics.snapshot();
    expect(snapshot.assessments).toBe(1);
    expect(snapshot.rejected.radarUnavailable).toBe(1);
    expect(snapshot.latencyMs.last).toBe(60_000);
    expect(snapshot.latencyMs.buckets.gt25).toBe(1);
  });
});
