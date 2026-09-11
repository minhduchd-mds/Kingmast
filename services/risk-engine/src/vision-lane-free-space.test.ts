import {describe,expect,it} from 'vitest';
import type {CalibratedCameraObservation,CameraCalibrationProfile} from '@kingmast/contracts/nextgen';
import {CameraCalibrationRegistry} from './camera-calibration-registry.js';
import {estimateVisionFreeSpace} from './vision-free-space.js';
import {estimateVisionLane} from './vision-lane-estimator.js';

const NOW=1_800_000_000_000;
const profile:CameraCalibrationProfile={cameraId:'front-1',mount:'front',intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[]},extrinsics:{xM:1.2,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg:0},calibratedAtMs:NOW-10_000,reprojectionErrorPx:.4,calibrationVersion:'bench-1'};
function observation(capturedAtMs=NOW-80):CalibratedCameraObservation{return{cameraId:'front-1',capturedAtMs,receivedAtMs:capturedAtMs+20,sequence:1,detections:[],lanes:[{laneId:'left',side:'left',confidence:.9,curvature1pm:.001,distanceToBoundaryM:1.7},{laneId:'right',side:'right',confidence:.88,curvature1pm:.0012,distanceToBoundaryM:1.8}],freeSpace:[{bearingStartDeg:-20,bearingEndDeg:20,freeDistanceM:34,confidence:.9},{bearingStartDeg:40,bearingEndDeg:80,freeDistanceM:12,confidence:.8}]};}
function registry(){const value=new CameraCalibrationRegistry();expect(value.upsert(profile).accepted).toBe(true);return value;}

describe('vision lane estimator',()=>{
  it('derives a bounded lane corridor only from a fresh calibrated front camera',()=>{
    const lane=estimateVisionLane([observation()],registry(),NOW);
    expect(lane.available).toBe(true);
    expect(lane.laneWidthM).toBeCloseTo(3.5);
    expect(lane.sourceCameraIds).toEqual(['front-1']);
    expect(lane.advisoryOnly).toBe(true);
  });

  it('fails closed when the camera observation is stale',()=>{
    const lane=estimateVisionLane([observation(NOW-5_000)],registry(),NOW);
    expect(lane.available).toBe(false);
    expect(lane.reason).toBe('stale');
  });
});

describe('vision free-space estimator',()=>{
  it('keeps forward and minimum clearance distinct and visualization-only',()=>{
    const free=estimateVisionFreeSpace([observation()],registry(),NOW);
    expect(free.available).toBe(true);
    expect(free.forwardClearanceM).toBe(34);
    expect(free.minimumClearanceM).toBe(12);
    expect(free.visualizationOnly).toBe(true);
  });
});
