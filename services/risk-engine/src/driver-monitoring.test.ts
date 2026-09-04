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
});
