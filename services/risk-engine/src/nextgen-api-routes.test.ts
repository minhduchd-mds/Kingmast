import Fastify from 'fastify';
import { describe,expect,it } from 'vitest';
import type { DriverProfile,VehicleAccessGrant } from '@kingmast/contracts/nextgen';
import { nextgenApiRoutes } from './nextgen-api-routes.js';
import { NextgenRuntime } from './nextgen-runtime.js';
import { InMemoryNextgenPersistence } from './nextgen-persistence.js';
import { DriverProfileRepository } from './driver-profile-repository.js';
import { VehicleAccessRepository } from './vehicle-access-repository.js';

const NOW=1_800_000_000_000;
const profile:DriverProfile={id:'owner-1',displayName:'Owner',role:'owner',trustedDeviceIds:['phone-1'],privacy:{locationHistory:false,cameraHistory:false,personalization:true,diagnosticsUpload:false},ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:70},home:{lat:21,lng:105},work:{lat:20.9,lng:105.8},updatedAtMs:NOW};

async function createApp(viewer=true,writer=true){
  const persistence=new InMemoryNextgenPersistence();
  const profiles=new DriverProfileRepository(persistence);
  const accessRepository=new VehicleAccessRepository(persistence);
  const runtime=new NextgenRuntime();
  const app=Fastify();
  await app.register(nextgenApiRoutes,{runtime,profiles,accessRepository,requireViewer:(_request,reply)=>{if(viewer)return true;reply.code(401).send({error:'viewer-auth-required'});return false;},requireWrite:(_request,reply)=>{if(writer)return true;reply.code(401).send({error:'configuration-auth-required'});return false;}});
  return{app,profiles,accessRepository,runtime};
}

describe('nextgen API routes',()=>{
  it('fails closed when viewer authorization is absent',async()=>{
    const{app}=await createApp(false,true);
    const response=await app.inject({method:'GET',url:'/v3/nextgen/runtime'});
    expect(response.statusCode).toBe(401);
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
