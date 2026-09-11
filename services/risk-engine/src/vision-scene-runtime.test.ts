import {describe,expect,it} from 'vitest';
import type {CalibratedCameraObservation,CameraCalibrationProfile,TrafficControlObservation} from '@kingmast/contracts/nextgen';
import {NextgenRuntime} from './nextgen-runtime.js';

const NOW=1_800_000_000_000;
const calibration:CameraCalibrationProfile={cameraId:'front-1',mount:'front',intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[]},extrinsics:{xM:1.2,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg:0},calibratedAtMs:NOW-10_000,reprojectionErrorPx:.4,calibrationVersion:'bench-1'};
const camera:CalibratedCameraObservation={cameraId:'front-1',capturedAtMs:NOW-80,receivedAtMs:NOW-40,sequence:1,detections:[],lanes:[{laneId:'left',side:'left',confidence:.9,curvature1pm:.001,distanceToBoundaryM:1.7},{laneId:'right',side:'right',confidence:.9,curvature1pm:.001,distanceToBoundaryM:1.8}],freeSpace:[{bearingStartDeg:-25,bearingEndDeg:25,freeDistanceM:30,confidence:.9}]};
function speed(id:string,capturedAtMs:number):TrafficControlObservation{return{id,cameraId:'front-1',kind:'speed-limit',speedLimitKmh:50,signalState:null,confidence:.86,relativeBearingDeg:0,estimatedDistanceM:35,capturedAtMs,receivedAtMs:capturedAtMs+20};}

describe('nextgen calibrated vision scene integration',()=>{
  it('surfaces fresh lane and free-space evidence without gaining control authority',()=>{
    const runtime=new NextgenRuntime();
    expect(runtime.configureCamera(calibration).accepted).toBe(true);
    const result=runtime.ingestCalibratedCamera('vehicle-1',camera,NOW);
    expect(result.accepted).toBe(true);
    expect(result.visionScene.lane.available).toBe(true);
    expect(result.visionScene.freeSpace.available).toBe(true);
    expect(result.visionScene.controlAuthority).toBe('none');
  });

  it('publishes traffic controls only after stable evidence and expires stale scene evidence',()=>{
    const runtime=new NextgenRuntime();runtime.configureCamera(calibration);runtime.ingestCalibratedCamera('vehicle-1',camera,NOW);
    runtime.ingestTrafficControl(speed('speed-1',NOW-120),NOW);
    expect(runtime.snapshot(NOW).visionScene.trafficControls.speedLimitKmh).toBeNull();
    runtime.ingestTrafficControl(speed('speed-2',NOW-60),NOW);
    expect(runtime.snapshot(NOW).visionScene.trafficControls.speedLimitKmh).toBe(50);
    const stale=runtime.snapshot(NOW+5_000);
    expect(stale.visionScene.lane.available).toBe(false);
    expect(stale.visionScene.freeSpace.available).toBe(false);
    expect(stale.visionScene.trafficControls.speedLimitKmh).toBeNull();
    expect(stale.controlAuthority).toBe('none');
  });
});
