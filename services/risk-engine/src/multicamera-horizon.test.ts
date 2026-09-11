import {describe,expect,it} from 'vitest';
import type {CameraCalibrationProfile,CalibratedCameraObservation} from '@kingmast/contracts/nextgen';
import {MultiCameraRuntime} from './multicamera-runtime.js';
import {NavigationHorizonStore} from './navigation-horizon-store.js';
import {buildNavigationHorizonFromRoad} from './navigation-horizon-adapter.js';

const NOW=1_800_000_000_000;
function calibration(cameraId:string,mount:CameraCalibrationProfile['mount'],yawDeg=0):CameraCalibrationProfile{return{cameraId,mount,intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[0,0,0,0]},extrinsics:{xM:0,yM:0,zM:1.4,rollDeg:0,pitchDeg:0,yawDeg},calibratedAtMs:NOW-10_000,reprojectionErrorPx:.6,calibrationVersion:'bench-1'};}
function observation(cameraId:string,sequence:number,bearing:number):CalibratedCameraObservation{return{cameraId,capturedAtMs:NOW-80,receivedAtMs:NOW-50,sequence,detections:[{id:`${cameraId}-car`,kind:'car',confidence:.9,distanceM:15,relativeBearingDeg:bearing,relativeSpeedMps:-1,position:null,firstSeenAtMs:NOW-200,lastSeenAtMs:NOW-80,sources:['camera']}],lanes:[],freeSpace:[]};}

describe('multi-camera runtime',()=>{
  it('requires unique calibrated physical mounts before surround becomes live',()=>{
    const runtime=new MultiCameraRuntime();
    for(const [id,mount,yaw] of [['front','front',0],['rear','rear',180],['left','left',-90],['right','right',90]] as const)expect(runtime.configure(calibration(id,mount,yaw)).accepted).toBe(true);
    runtime.ingest(observation('front',1,2),NOW);runtime.ingest(observation('rear',1,178),NOW);runtime.ingest(observation('left',1,-88),NOW);runtime.ingest(observation('right',1,92),NOW);
    const surround=runtime.surround('vehicle-1',NOW);
    expect(surround.availability).toBe('live');
    expect(surround.missingMounts).toEqual([]);
    expect(surround.synchronized).toBe(true);
    expect(surround.visualizationOnly).toBe(true);
  });

  it('rejects duplicate physical mount calibration and sequence replay',()=>{
    const runtime=new MultiCameraRuntime();
    expect(runtime.configure(calibration('front-a','front')).accepted).toBe(true);
    expect(runtime.configure(calibration('front-b','front')).reason).toBe('mount-conflict');
    expect(runtime.ingest(observation('front-a',2,0),NOW).accepted).toBe(true);
    expect(runtime.ingest(observation('front-a',2,0),NOW).reason).toBe('sequence-replay');
  });

  it('never reports stale camera observations as live surround',()=>{
    const runtime=new MultiCameraRuntime();runtime.configure(calibration('front','front'));
    expect(runtime.ingest({...observation('front',1,0),capturedAtMs:NOW-5_000,receivedAtMs:NOW-4_900},NOW).reason).toBe('stale-frame');
    expect(runtime.surround('vehicle-1',NOW).availability).toBe('unavailable');
  });
});

describe('navigation horizon',()=>{
  it('derives a speed-limit event from route intelligence and expires stale horizons',()=>{
    const horizon=buildNavigationHorizonFromRoad({vehicleId:'vehicle-1',vehicle:{lat:21,lng:105,speedKmh:70,headingDeg:0,accuracyM:3,timestampMs:NOW,source:'gnss'},intelligence:{speedZones:[{id:'z1',position:{lat:21.001,lng:105},distanceAlongRouteM:300,limitKmh:50,roadName:'Road',source:'map',confidence:.9}],junctions:[],chargingStations:[],coverage:'partial-public-map',generatedAtMs:NOW,notes:[]},connected:null,nowMs:NOW});
    expect(horizon.events[0]?.kind).toBe('speed-limit');
    const store=new NavigationHorizonStore();store.upsert(horizon);
    expect(store.snapshot('vehicle-1',NOW+5_000).fresh).toBe(true);
    expect(store.snapshot('vehicle-1',NOW+20_000).reason).toBe('stale');
  });
});
