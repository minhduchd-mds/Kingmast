import Fastify from 'fastify';
import {describe,expect,it} from 'vitest';
import type {CameraCalibrationProfile} from '@kingmast/contracts/nextgen';
import {parseDeviceKeyRegistry,signDeviceIngress} from './device-auth.js';
import {NextgenRuntime} from './nextgen-runtime.js';
import {createVisionIngressAuthorizer} from './nextgen-vision-ingress-auth.js';
import {nextgenVisionIngressRoutes} from './nextgen-vision-ingress-routes.js';

const SECRET='0123456789abcdef0123456789abcdef';
const EDGE='edge-token-0123456789abcdef';
function calibration(now:number):CameraCalibrationProfile{return{cameraId:'front-1',mount:'front',intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[]},extrinsics:{xM:1,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg:0},calibratedAtMs:now-10_000,reprojectionErrorPx:.4,calibrationVersion:'bench-1'};}
function payload(now:number){return{vehicleId:'vehicle-1',observation:{cameraId:'front-1',capturedAtMs:now-50,receivedAtMs:now-20,sequence:1,detections:[],lanes:[],freeSpace:[]}};}
function registry(){return parseDeviceKeyRegistry(JSON.stringify({'vehicle-1':[{keyId:'key-1',secret:SECRET,state:'active'}]}));}

async function appFor(requireDeviceAuth:boolean){
  const runtime=new NextgenRuntime();runtime.configureCamera(calibration(Date.now()));
  const app=Fastify();
  await app.register(nextgenVisionIngressRoutes,{runtime,requireDevice:createVisionIngressAuthorizer({registry:registry(),requireDeviceAuth,edgeToken:EDGE,allowInsecureLocalDev:false})});
  return app;
}

describe('nextgen vision ingress authentication',()=>{
  it('accepts a correctly signed per-device camera payload',async()=>{
    const now=Date.now(),body=payload(now),app=await appFor(true);
    const signature=signDeviceIngress('perception:camera','vehicle-1','key-1',body.observation.capturedAtMs,body,SECRET);
    const response=await app.inject({method:'POST',url:'/v3/nextgen/perception/camera',payload:body,headers:{'x-kingmast-device-id':'vehicle-1','x-kingmast-device-key-id':'key-1','x-kingmast-device-signature':signature}});
    expect(response.statusCode).toBe(200);expect(response.json().controlAuthority).toBe('none');await app.close();
  });

  it('fails closed on a missing device signature when per-device auth is required',async()=>{
    const app=await appFor(true);const response=await app.inject({method:'POST',url:'/v3/nextgen/perception/camera',payload:payload(Date.now())});
    expect(response.statusCode).toBe(401);expect(response.json().error).toBe('device-auth-required');await app.close();
  });

  it('allows the existing shared edge token only while device auth is in transition mode',async()=>{
    const app=await appFor(false);const response=await app.inject({method:'POST',url:'/v3/nextgen/perception/camera',payload:payload(Date.now()),headers:{'x-kingmast-edge-token':EDGE}});
    expect(response.statusCode).toBe(200);await app.close();
  });
});
