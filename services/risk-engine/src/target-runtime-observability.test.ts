import { describe,expect,it } from 'vitest';
import { TargetRuntimeAccumulator,type TargetRuntimeSnapshot } from './target-runtime-observability.js';

function snapshot(overrides:Partial<TargetRuntimeSnapshot>={}):TargetRuntimeSnapshot{
  return{
    capturedAtMs:1,
    uptimeS:100,
    load1:0.5,
    load5:0.4,
    load15:0.3,
    totalMemoryMiB:4096,
    freeMemoryMiB:1024,
    thermal:{available:true,sensors:2,minC:42,maxC:55},
    ...overrides,
  };
}

describe('TargetRuntimeAccumulator',()=>{
  it('aggregates bounded host load, memory and thermal evidence',()=>{
    const accumulator=new TargetRuntimeAccumulator();
    accumulator.observe(snapshot());
    accumulator.observe(snapshot({uptimeS:105,load1:1.8,freeMemoryMiB:768,thermal:{available:true,sensors:3,minC:40,maxC:71}}));
    const summary=accumulator.summary({thermalRequired:true,maxTemperatureC:85,minFreeMemoryMiB:512});
    expect(summary.sampleCount).toBe(2);
    expect(summary.uptimeStartS).toBe(100);
    expect(summary.uptimeEndS).toBe(105);
    expect(summary.load.max1m).toBe(1.8);
    expect(summary.memory.freeMinMiB).toBe(768);
    expect(summary.thermal.maxC).toBe(71);
    expect(summary.thermal.sensorsMax).toBe(3);
    expect(summary.passed).toBe(true);
  });

  it('fails when physical policy requires thermal telemetry but none is available',()=>{
    const accumulator=new TargetRuntimeAccumulator();
    accumulator.observe(snapshot({thermal:{available:false,sensors:0,minC:null,maxC:null}}));
    const summary=accumulator.summary({thermalRequired:true,maxTemperatureC:85,minFreeMemoryMiB:0});
    expect(summary.thermal.availabilityPassed).toBe(false);
    expect(summary.passed).toBe(false);
  });

  it('enforces configured temperature and free-memory budgets',()=>{
    const accumulator=new TargetRuntimeAccumulator();
    accumulator.observe(snapshot({freeMemoryMiB:200,thermal:{available:true,sensors:1,minC:80,maxC:96}}));
    const summary=accumulator.summary({thermalRequired:false,maxTemperatureC:90,minFreeMemoryMiB:256});
    expect(summary.thermal.temperaturePassed).toBe(false);
    expect(summary.memory.passed).toBe(false);
    expect(summary.passed).toBe(false);
    expect(summary.privacy.rawHardwareSerialIncluded).toBe(false);
    expect(summary.privacy.hostnameIncluded).toBe(false);
  });
});
