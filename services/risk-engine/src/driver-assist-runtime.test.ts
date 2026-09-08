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

  it('requires repeated caution evidence while allowing critical LDW to surface immediately',()=>{
    const runtime=new DriverAssistRuntime();
    const first=runtime.ingestLane({timestampMs:base,speedKmh:72,laneWidthM:3.5,lateralOffsetM:.2,lateralVelocityMps:.4,headingErrorDeg:0,confidence:.94,turnSignal:'off'});
    expect(first.severity).toBe('safe');
    expect(first.reason).toBe('lane-departure-pending-confirmation');
    const confirmed=runtime.ingestLane({timestampMs:base+300,speedKmh:72,laneWidthM:3.5,lateralOffsetM:.22,lateralVelocityMps:.4,headingErrorDeg:0,confidence:.94,turnSignal:'off'});
    expect(confirmed.severity).toBe('caution');

    const immediate=new DriverAssistRuntime().ingestLane({timestampMs:base,speedKmh:72,laneWidthM:3.5,lateralOffsetM:.68,lateralVelocityMps:.6,headingErrorDeg:0,confidence:.94,turnSignal:'off'});
    expect(immediate.severity).toBe('critical');
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

  it('marks discontinuous cabin evidence unavailable instead of merely degraded',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestDriverMonitoring({timestampMs:base,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95});
    runtime.ingestDriverMonitoring({timestampMs:base+1_000,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95});
    runtime.ingestDriverMonitoring({timestampMs:base+5_000,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95});
    const status=runtime.snapshot(base+5_100,true).dms;
    expect(status.state).toBe('driver-unavailable');
    expect(status.reason).toBe('cabin-observation-discontinuous');
    expect(status.availability).toBe('unavailable');
  });

  it('keeps short but still-forming DMS windows degraded, not falsely live',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestDriverMonitoring({timestampMs:base,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95});
    runtime.ingestDriverMonitoring({timestampMs:base+1_000,faceDetected:true,eyesClosed:false,gazeAway:false,headYawDeg:0,headPitchDeg:0,confidence:.95});
    const status=runtime.snapshot(base+1_100,true).dms;
    expect(status.reason).toBe('insufficient-temporal-window');
    expect(status.availability).toBe('degraded');
  });

  it('requires every configured surround camera to be synchronized and calibrated before 360 is live',()=>{
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
    expect(live.readyCameraCount).toBe(4);
    expect(live.fullyReady).toBe(true);
    expect(live.geometryConfidence).toBeGreaterThan(.7);
    expect(live.calibrationUncertaintyPx).toBe(1.7);
    expect(runtime.snapshot(base+5_000,true).surround.availability).toBe('unavailable');
  });

  it('degrades surround truth if any configured camera loses synchronization or calibration quality',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestSurround({timestampMs:base,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1.1},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1.3},
      {cameraId:'left',synchronized:false,calibrated:true,reprojectionErrorPx:1.4},
      {cameraId:'right',synchronized:true,calibrated:true,reprojectionErrorPx:3.8},
    ]});
    const status=runtime.snapshot(base+100,true).surround;
    expect(status.availability).toBe('degraded');
    expect(status.fullyReady).toBe(false);
    expect(status.readyCameraCount).toBe(2);
    expect(status.reason).toBe('surround-calibration-incomplete');
    expect(status.maxReprojectionErrorPx).toBe(3.8);
  });

  it('degrades incomplete surround camera coverage even when the available cameras are healthy',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestSurround({timestampMs:base,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'left',synchronized:true,calibrated:true,reprojectionErrorPx:1},
    ]});
    const status=runtime.snapshot(base+100,true).surround;
    expect(status.availability).toBe('degraded');
    expect(status.reason).toBe('surround-camera-coverage-incomplete');
    expect(status.fullyReady).toBe(false);
  });

  it('rejects duplicate surround camera identities from a live 360 readiness claim',()=>{
    const runtime=new DriverAssistRuntime();
    runtime.ingestSurround({timestampMs:base,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'left',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'left',synchronized:true,calibrated:true,reprojectionErrorPx:1},
    ]});
    const status=runtime.snapshot(base+100,true).surround;
    expect(status.availability).toBe('degraded');
    expect(status.reason).toBe('surround-camera-identity-duplicate');
    expect(status.fullyReady).toBe(false);
  });

  it('degrades 360 readiness for occlusion or excessive frame skew',()=>{
    const occluded=new DriverAssistRuntime();
    occluded.ingestSurround({timestampMs:base,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1,occluded:true},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'left',synchronized:true,calibrated:true,reprojectionErrorPx:1},
      {cameraId:'right',synchronized:true,calibrated:true,reprojectionErrorPx:1},
    ]});
    expect(occluded.snapshot(base+100,true).surround.reason).toBe('surround-camera-occluded');

    const skewed=new DriverAssistRuntime();
    skewed.ingestSurround({timestampMs:base,cameras:[
      {cameraId:'front',synchronized:true,calibrated:true,reprojectionErrorPx:1,frameSkewMs:120},
      {cameraId:'rear',synchronized:true,calibrated:true,reprojectionErrorPx:1,frameSkewMs:20},
      {cameraId:'left',synchronized:true,calibrated:true,reprojectionErrorPx:1,frameSkewMs:25},
      {cameraId:'right',synchronized:true,calibrated:true,reprojectionErrorPx:1,frameSkewMs:18},
    ]});
    expect(skewed.snapshot(base+100,true).surround.reason).toBe('surround-frame-skew-exceeded');
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
