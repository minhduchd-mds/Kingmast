import { describe,expect,it } from 'vitest';
import { DriverAssistRuntime } from './driver-assist-runtime.js';

const base=1_800_000_000_000;

describe('DriverAssistRuntime',()=>{
  it('publishes fresh LDW truth then fails closed when the lane observation expires',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestLane({timestampMs:base,speedKmh:72,laneWidthM:3.5,lateralOffsetM:.65,lateralVelocityMps:.55,headingErrorDeg:0,confidence:.94,turnSignal:'off'});
    const live=runtime.snapshot(base+100,true);
    expect(live.ldw.availability).toBe('live');
    expect(['caution','critical']).toContain(live.ldw.severity);
    expect(live.controlAuthority).toBe('none');
    expect(runtime.snapshot(base+3_000,true).ldw.availability).toBe('unavailable');
  });

  it('uses a temporal DMS window and does not store raw cabin video',()=>{
    const runtime=new DriverAssistRuntime();
    for(let i=0;i<5;i++)runtime.ingestDriverMonitoring({timestampMs:base+i*1_000,faceDetected:true,eyesClosed:false,gazeAway:true,headYawDeg:40,headPitchDeg:0,confidence:.92});
    const status=runtime.snapshot(base+4_100,true).dms;
    expect(status.availability).toBe('live');
    expect(status.state).toBe('prolonged-distraction');
    expect(status.storesRawVideo).toBe(false);
    expect(status.advisoryOnly).toBe(true);
  });

  it('requires four synchronized calibrated cameras before 360 is live',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestSurround({timestampMs:base,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1.2},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1.4},
      {cameraId:'left',synchronized:true,calibrated:true,reprojectionErrorPx:1.7},
      {cameraId:'right',synchronized:true,calibrated:true,reprojectionErrorPx:1.5},
    ]});
    const live=runtime.snapshot(base+100,true).surround;
    expect(live.availability).toBe('live');
    expect(live.cameraCount).toBe(4);
    expect(live.maxReprojectionErrorPx).toBe(1.7);
    expect(runtime.snapshot(base+5_000,true).surround.availability).toBe('unavailable');
  });

  it('only marks the read-only assistant context live when fresh vehicle context exists',()=>{
    const runtime=new DriverAssistRuntime();
    expect(runtime.snapshot(base,false).assistant.availability).toBe('staged');
    const assistant=runtime.snapshot(base,true).assistant;
    expect(assistant.availability).toBe('live');
    expect(assistant.readOnly).toBe(true);
    expect(assistant.actuatorTools).toBe(false);
  });
});
