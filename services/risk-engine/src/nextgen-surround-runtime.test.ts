import {describe,expect,it} from 'vitest';
import type {CameraCalibrationProfile,CalibratedCameraObservation,NavigationHorizon} from '@kingmast/contracts/nextgen';
import {NextgenRuntime} from './nextgen-runtime.js';

const NOW=1_800_000_000_000;
function calibration(cameraId:string,mount:CameraCalibrationProfile['mount'],yawDeg:number):CameraCalibrationProfile{return{cameraId,mount,intrinsics:{widthPx:1280,heightPx:720,fx:800,fy:800,cx:640,cy:360,distortion:[]},extrinsics:{xM:0,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg},calibratedAtMs:NOW-1_000,reprojectionErrorPx:.5,calibrationVersion:'v1'};}
function observation(cameraId:string,bearing:number):CalibratedCameraObservation{return{cameraId,capturedAtMs:NOW-60,receivedAtMs:NOW-30,sequence:1,detections:[{id:`${cameraId}-1`,kind:'car',confidence:.9,distanceM:20,relativeBearingDeg:bearing,relativeSpeedMps:0,position:null,firstSeenAtMs:NOW-100,lastSeenAtMs:NOW-60,sources:['camera']}],lanes:[],freeSpace:[]};}

describe('NextgenRuntime surround and horizon composition',()=>{
  it('exposes live surround only after four calibrated synchronized physical mounts',()=>{
    const runtime=new NextgenRuntime();
    for(const[id,mount,yaw,bearing]of[['front','front',0,0],['rear','rear',180,180],['left','left',-90,-90],['right','right',90,90]] as const){runtime.configureCamera(calibration(id,mount,yaw));runtime.ingestCalibratedCamera('vehicle-1',observation(id,bearing),NOW);}
    const snapshot=runtime.snapshot(NOW);
    expect(snapshot.surround?.availability).toBe('live');
    expect(snapshot.surround?.uniqueCameraCount).toBe(4);
    expect(snapshot.controlAuthority).toBe('none');
  });

  it('drops expired surround and navigation horizon from current snapshot',()=>{
    const runtime=new NextgenRuntime();runtime.configureCamera(calibration('front','front',0));runtime.ingestCalibratedCamera('vehicle-1',observation('front',0),NOW);
    const horizon:NavigationHorizon={vehicleId:'vehicle-1',generatedAtMs:NOW,origin:{lat:21,lng:105},headingDeg:0,lookaheadM:1000,coverage:'partial',events:[],notes:[]};
    runtime.updateNavigationHorizon(horizon,50,NOW);
    expect(runtime.snapshot(NOW).navigationHorizon).not.toBeNull();
    expect(runtime.snapshot(NOW+20_000).navigationHorizon).toBeNull();
    expect(runtime.snapshot(NOW+20_000).surround).toBeNull();
  });
});
