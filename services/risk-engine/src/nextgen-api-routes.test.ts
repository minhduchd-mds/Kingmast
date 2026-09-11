import Fastify from 'fastify';
import { describe,expect,it } from 'vitest';
import type { CameraCalibrationProfile,DriverProfile,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { nextgenApiRoutes } from './nextgen-api-routes.js';
import { NextgenRuntime } from './nextgen-runtime.js';
import { InMemoryNextgenPersistence } from './nextgen-persistence.js';
import { DriverProfileRepository } from './driver-profile-repository.js';
import { VehicleAccessRepository } from './vehicle-access-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';

const NOW=1_800_000_000_000;
const profile:DriverProfile={id:'owner-1',displayName:'Owner',role:'owner',trustedDeviceIds:['phone-1'],privacy:{locationHistory:false,cameraHistory:false,personalization:true,diagnosticsUpload:false},ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:70},home:{lat:21,lng:105},work:{lat:20.9,lng:105.8},updatedAtMs:NOW};
const calibration=(cameraId:string,mount:CameraCalibrationProfile['mount']):CameraCalibrationProfile=>({cameraId,mount,intrinsics:{widthPx:1920,heightPx:1080,fx:1200,fy:1200,cx:960,cy:540,distortion:[]},extrinsics:{xM:0,yM:0,zM:1.3,rollDeg:0,pitchDeg:0,yawDeg:0},calibratedAtMs:NOW-1_000,reprojectionErrorPx:.5,calibrationVersion:'bench-1'});

async function createApp(viewer=true,writer=true){
  const persistence=new InMemoryNextgenPersistence();
  const profiles=new DriverProfileRepository(persistence);
  const accessRepository=new VehicleAccessRepository(persistence);
  const memoryRepository=new ProfileMemoryRepository(persistence);
  const runtime=new NextgenRuntime();
  const app=Fastify();
  const accessActorAuthorizer=()=>({ok:true as const,actor:{actorId:'test-operator',profileId:'owner-1',authMode:'local-dev' as const}});
  await app.register(nextgenApiRoutes,{runtime,profiles,accessRepository,memoryRepository,accessActorAuthorizer,requireViewer:(_request,reply)=>{if(viewer)return true;reply.code(401).send({error:'viewer-auth-required'});return false;},requireWrite:(_request,reply)=>{if(writer)return true;reply.code(401).send({error:'configuration-auth-required'});return false;}});
  return{app,profiles,accessRepository,memoryRepository,runtime};
}

describe('nextgen API routes',()=>{
  it('fails closed when viewer authorization is absent',async()=>{
    const{app}=await createApp(false,true);
    const response=await app.inject({method:'GET',url:'/v3/nextgen/runtime'});
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('requires configuration authority to write calibration and exposes read-only viewer state',async()=>{
    const denied=await createApp(true,false);
    expect((await denied.app.inject({method:'POST',url:'/v3/nextgen/cameras/calibration',payload:calibration('front-1','front')})).statusCode).toBe(401);
    await denied.app.close();
    const allowed=await createApp(true,true);
    expect((await allowed.app.inject({method:'POST',url:'/v3/nextgen/cameras/calibration',payload:calibration('front-1','front')})).statusCode).toBe(200);
    const listing=await allowed.app.inject({method:'GET',url:'/v3/nextgen/cameras/calibration'});
    expect(listing.statusCode).toBe(200);expect(listing.json().calibrations).toHaveLength(1);expect(listing.json().controlAuthority).toBe('none');
    await allowed.app.close();
  });

  it('rejects two camera identities claiming the same physical mount',async()=>{
    const{app}=await createApp();
    expect((await app.inject({method:'POST',url:'/v3/nextgen/cameras/calibration',payload:calibration('front-a','front')})).statusCode).toBe(200);
    const conflict=await app.inject({method:'POST',url:'/v3/nextgen/cameras/calibration',payload:calibration('front-b','front')});
    expect(conflict.statusCode).toBe(409);expect(conflict.json().reason).toBe('mount-conflict');
    await app.close();
  });

  it('refreshes predictive horizon from existing connected-road context without control authority',async()=>{
    const{app,runtime}=await createApp();
    const response=await app.inject({method:'POST',url:'/v3/nextgen/navigation/horizon/refresh',payload:{vehicleId:'vehicle-sim',vehicle:{lat:21.03,lng:105.84,speedKmh:42,headingDeg:0,accuracyM:4,timestampMs:NOW,source:'simulator'},route:null,collisionCritical:false,lookaheadM:3000}});
    expect(response.statusCode).toBe(200);
    const body=response.json();
    expect(body.controlAuthority).toBe('none');
    expect(body.horizon.vehicleId).toBe('vehicle-sim');
    expect(body.horizon.events.length).toBeGreaterThan(0);
    expect(runtime.snapshot().navigationHorizon?.vehicleId).toBe('vehicle-sim');
    await app.close();
  });

  it('sanitizes home and work when location history is disabled',async()=>{
    const{app,profiles}=await createApp();
    const response=await app.inject({method:'POST',url:'/v3/nextgen/profiles',payload:profile});
    expect(response.statusCode).toBe(200);
    const stored=await profiles.get('owner-1');
    expect(stored?.home).toBeNull();
    expect(stored?.work).toBeNull();
    await app.close();
  });

  it('persists memory only with write authority and purges location memory when privacy closes',async()=>{
    const open:DriverProfile={...profile,privacy:{...profile.privacy,locationHistory:true},home:null,work:null};
    const{app}=await createApp();
    expect((await app.inject({method:'POST',url:'/v3/nextgen/profiles',payload:open})).statusCode).toBe(200);
    const memory={id:'place:cafe',profileId:'owner-1',kind:'recent-place',label:'Cafe',position:{lat:21.03,lng:105.84},routeKey:null,createdAtMs:NOW,lastUsedAtMs:NOW};
    expect((await app.inject({method:'POST',url:'/v3/nextgen/memory',payload:memory})).statusCode).toBe(200);
    expect((await app.inject({method:'GET',url:'/v3/nextgen/memory?profileId=owner-1'})).json().entries).toHaveLength(1);
    expect((await app.inject({method:'POST',url:'/v3/nextgen/profiles',payload:profile})).statusCode).toBe(200);
    const after=(await app.inject({method:'GET',url:'/v3/nextgen/memory?profileId=owner-1'})).json();
    expect(after.entries).toEqual([]);expect(after.privacy.locationHistory).toBe(false);expect(after.controlAuthority).toBe('none');
    await app.close();

    const denied=await createApp(true,false);await denied.profiles.save(open,NOW);
    expect((await denied.app.inject({method:'POST',url:'/v3/nextgen/memory',payload:memory})).statusCode).toBe(401);await denied.app.close();
  });

  it('resolves a trusted device but never needs face-only authorization',async()=>{
    const{app,profiles}=await createApp();await profiles.save(profile,NOW);
    const trusted=await app.inject({method:'POST',url:'/v3/nextgen/identity/resolve',payload:{trustedDeviceId:'phone-1',faceProfileId:null,faceConfidence:null,observedAtMs:NOW}});
    expect(trusted.statusCode).toBe(200);expect(trusted.json().profile.id).toBe('owner-1');
    const faceOnly=await app.inject({method:'POST',url:'/v3/nextgen/identity/resolve',payload:{trustedDeviceId:null,faceProfileId:'owner-1',faceConfidence:.99,observedAtMs:NOW}});
    expect(faceOnly.json().profile).toBeNull();
    await app.close();
  });

  it('persists grants and returns audited decisions',async()=>{
    const{app}=await createApp();
    const grant:VehicleAccessGrant={grantId:'g1',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use'],validFromMs:NOW-1000,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};
    expect((await app.inject({method:'POST',url:'/v3/nextgen/access/grants',payload:grant})).statusCode).toBe(200);
    const decision=await app.inject({method:'POST',url:'/v3/nextgen/access/decision',payload:{vehicleId:'vehicle-1',profileId:'owner-1',permission:'vehicle.use',nowMs:NOW}});
    expect(decision.json().allowed).toBe(true);
    const audit=await app.inject({method:'GET',url:'/v3/nextgen/access/audit?limit=10'});
    expect(audit.json().events).toHaveLength(1);
    await app.close();
  });
});
