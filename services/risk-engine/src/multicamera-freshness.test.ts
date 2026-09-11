import {describe,expect,it} from 'vitest';
import type {CalibratedCameraObservation,CameraCalibrationProfile} from '@kingmast/contracts/nextgen';
import {MultiCameraRuntime} from './multicamera-runtime.js';

const NOW=1_800_000_000_000;
const calibration:CameraCalibrationProfile={cameraId:'front-1',mount:'front',intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[]},extrinsics:{xM:0,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg:0},calibratedAtMs:NOW-10_000,reprojectionErrorPx:.4,calibrationVersion:'bench-1'};
const observation=(capturedAtMs:number,sequence=1):CalibratedCameraObservation=>({cameraId:'front-1',capturedAtMs,receivedAtMs:capturedAtMs+20,sequence,detections:[],lanes:[],freeSpace:[]});

function runtime(){const value=new MultiCameraRuntime();expect(value.configure(calibration).accepted).toBe(true);return value;}

describe('multi-camera freshness',()=>{
  it('accepts a fresh calibrated frame',()=>{
    expect(runtime().ingest(observation(NOW-100),NOW)).toEqual({accepted:true,reason:'accepted'});
  });

  it('rejects stale frames even when their sequence is new',()=>{
    expect(runtime().ingest(observation(NOW-1_001),NOW)).toEqual({accepted:false,reason:'stale-frame'});
  });

  it('rejects future camera timestamps beyond bounded clock skew',()=>{
    expect(runtime().ingest(observation(NOW+251),NOW)).toEqual({accepted:false,reason:'future-frame'});
  });

  it('rejects sequence replay after accepting a fresh frame',()=>{
    const value=runtime();
    expect(value.ingest(observation(NOW-100,5),NOW).accepted).toBe(true);
    expect(value.ingest(observation(NOW-50,5),NOW)).toEqual({accepted:false,reason:'sequence-replay'});
  });
});
