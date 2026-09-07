import { describe,expect,it } from 'vitest';
import { assessDriverMonitoring,type DriverMonitoringSample } from './driver-monitoring.js';

function windowSamples(seconds:number,patch:(index:number)=>Partial<DriverMonitoringSample>){return Array.from({length:seconds+1},(_,index)=>({timestampMs:1_800_000_000_000+index*1000,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95,...patch(index)}));}

describe('assessDriverMonitoring',()=>{
  it('requires temporal evidence before drowsiness is suspected',()=>{
    const result=assessDriverMonitoring(windowSamples(10,(index)=>({eyesClosed:index>=4})));
    expect(result.state).toBe('drowsiness-suspected');
    expect(result.storesRawVideo).toBe(false);
  });
  it('detects sustained distraction without treating one frame as a driver state',()=>{
    const result=assessDriverMonitoring(windowSamples(5,(index)=>({gazeAway:index>=1})));
    expect(result.state).toBe('prolonged-distraction');
  });
  it('reports unavailable when the face is consistently missing',()=>{
    const result=assessDriverMonitoring(windowSamples(5,()=>({faceDetected:false})));
    expect(result.state).toBe('driver-unavailable');
  });
  it('never reports attentive from an insufficient temporal window',()=>{
    const result=assessDriverMonitoring(windowSamples(1,()=>({})));
    expect(result.state).toBe('driver-unavailable');
    expect(result.reason).toBe('insufficient-temporal-window');
    expect(result.confidence).toBe(0);
  });
  it('fails unavailable when most cabin observations are below the reliability floor',()=>{
    const result=assessDriverMonitoring(windowSamples(6,(index)=>({confidence:index<5?.2:.95})));
    expect(result.state).toBe('driver-unavailable');
    expect(result.reason).toBe('cabin-observation-quality-low');
  });
  it('weights PERCLOS by observation confidence instead of treating all visible frames equally',()=>{
    const result=assessDriverMonitoring(windowSamples(10,(index)=>({eyesClosed:index>=6,confidence:index>=6?.95:.6})));
    expect(result.perclos).toBeGreaterThan(.45);
    expect(result.state).toBe('drowsiness-suspected');
  });
});
