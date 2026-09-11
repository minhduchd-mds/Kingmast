import Fastify from 'fastify';
import {describe,expect,it} from 'vitest';
import type {CameraCalibrationProfile} from '@kingmast/contracts/nextgen';
import {NextgenRuntime} from './nextgen-runtime.js';
import {nextgenVisionIngressRoutes} from './nextgen-vision-ingress-routes.js';

function calibration(now:number):CameraCalibrationProfile{return{cameraId:'front-1',mount:'front',intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[]},extrinsics:{xM:1,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg:0},calibratedAtMs:now-10_000,reprojectionErrorPx:.4,calibrationVersion:'bench-1'};}
function cameraPayload(now:number){return{vehicleId:'vehicle-1',observation:{cameraId:'front-1',capturedAtMs:now-80,receivedAtMs:now-40,sequence:1,detections:[],lanes:[{laneId:'left',side:'left',confidence:.9,curvature1pm:.001,distanceToBoundaryM:1.7},{laneId:'right',side:'right',confidence:.9,curvature1pm:.001,distanceToBoundaryM:1.8}],freeSpace:[{bearingStartDeg:-20,bearingEndDeg:20,freeDistanceM:30,confidence:.9}]}};}
async function createApp(deviceId:string|null='vehicle-1'){
  const runtime=new NextgenRuntime();const app=Fastify();
  await app.register(nextgenVisionIngressRoutes,{runtime,requireDevice:(_request,reply)=>{if(deviceId==='DENY'){reply.code(401).send({error:'device-auth-required'});return null;}return{deviceId};}});
  return{app,runtime};
}

describe('nextgen vision ingress routes',()=>{
  it('requires calibration before accepting a calibrated camera observation',async()=>{
    const now=Date.now();const{app}=await createApp();
    const response=await app.inject({method:'POST',url:'/v3/nextgen/perception/camera',payload:cameraPayload(now)});
    expect(response.statusCode).toBe(409);expect(response.json().error).toBe('camera-calibration-required');
    await app.close();
  });

  it('binds per-device identity to the claimed vehicle and stays read-only',async()=>{
    const now=Date.now();const mismatch=await createApp('other-vehicle');mismatch.runtime.configureCamera(calibration(now));
    expect((await mismatch.app.inject({method:'POST',url:'/v3/nextgen/perception/camera',payload:cameraPayload(now)})).statusCode).toBe(403);await mismatch.app.close();
    const allowed=await createApp();allowed.runtime.configureCamera(calibration(now));
    const response=await allowed.app.inject({method:'POST',url:'/v3/nextgen/perception/camera',payload:cameraPayload(now)});
    expect(response.statusCode).toBe(200);expect(response.json().controlAuthority).toBe('none');expect(response.json().visionScene.lane.available).toBe(true);await allowed.app.close();
  });

  it('rejects traffic-control input when device authentication fails',async()=>{
    const now=Date.now();const{app,runtime}=await createApp('DENY');runtime.configureCamera(calibration(now));
    const payload={vehicleId:'vehicle-1',observation:{id:'speed-1',cameraId:'front-1',kind:'speed-limit',speedLimitKmh:50,signalState:null,confidence:.95,relativeBearingDeg:0,estimatedDistanceM:40,capturedAtMs:now-50,receivedAtMs:now-20}};
    const response=await app.inject({method:'POST',url:'/v3/nextgen/perception/traffic-control',payload});
    expect(response.statusCode).toBe(401);await app.close();
  });
});
