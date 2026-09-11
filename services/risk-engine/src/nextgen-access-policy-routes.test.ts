import Fastify from 'fastify';
import {describe,expect,it} from 'vitest';
import type {DriverProfile,VehicleAccessGrant} from '@kingmast/contracts/nextgen';
import {nextgenApiRoutes} from './nextgen-api-routes.js';
import {NextgenRuntime} from './nextgen-runtime.js';
import {InMemoryNextgenPersistence} from './nextgen-persistence.js';
import {DriverProfileRepository} from './driver-profile-repository.js';
import {VehicleAccessRepository} from './vehicle-access-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';

const profile:DriverProfile={id:'owner-1',displayName:'Owner',role:'owner',trustedDeviceIds:['phone-1'],privacy:{locationHistory:false,cameraHistory:false,personalization:true,diagnosticsUpload:false},ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:70},home:null,work:null,updatedAtMs:1_800_000_000_000};

async function createApp(actorProfileId='owner-1'){
  const persistence=new InMemoryNextgenPersistence();
  const accessRepository=new VehicleAccessRepository(persistence);
  const profiles=new DriverProfileRepository(persistence);await profiles.save(profile);
  const runtime=new NextgenRuntime();
  const app=Fastify();
  const accessActorAuthorizer=()=>({ok:true as const,actor:{actorId:'test-operator',profileId:actorProfileId,authMode:'local-dev' as const}});
  await app.register(nextgenApiRoutes,{runtime,profiles,accessRepository,memoryRepository:new ProfileMemoryRepository(persistence),accessActorAuthorizer,requireViewer:()=>true,requireWrite:()=>true});
  return{app,accessRepository,runtime};
}

describe('nextgen access grant API policy',()=>{
  it('bootstraps one owner and rejects a guest requesting management authority',async()=>{
    const{app}=await createApp();
    const now=Date.now();
    const owner:VehicleAccessGrant={grantId:'owner',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use','vehicle.unlock','profile.read.self','keys.share','users.manage'],validFromMs:now-1_000,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};
    const bootstrap=await app.inject({method:'POST',url:'/v3/nextgen/access/grants',payload:owner});
    expect(bootstrap.statusCode).toBe(200);expect(bootstrap.json().controlAuthority).toBe('none');
    const guest:VehicleAccessGrant={grantId:'guest',vehicleId:'vehicle-1',profileId:'guest-1',role:'guest',permissions:['vehicle.use','users.manage'],validFromMs:now,validUntilMs:now+60_000,issuedByProfileId:'owner-1',revokedAtMs:null};
    const rejected=await app.inject({method:'POST',url:'/v3/nextgen/access/grants',payload:guest});
    expect(rejected.statusCode).toBe(409);expect(rejected.json().reason).toBe('role-permission-exceeded');
    await app.close();
  });

  it('allows owner delegation within the role ceiling and returns no control authority',async()=>{
    const{app,accessRepository}=await createApp();
    const now=Date.now();
    const owner:VehicleAccessGrant={grantId:'owner',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use','vehicle.unlock','profile.read.self','keys.share'],validFromMs:now-1_000,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};
    expect((await app.inject({method:'POST',url:'/v3/nextgen/access/grants',payload:owner})).statusCode).toBe(200);
    const guest:VehicleAccessGrant={grantId:'guest',vehicleId:'vehicle-1',profileId:'guest-1',role:'guest',permissions:['vehicle.use','vehicle.unlock','profile.read.self'],validFromMs:now,validUntilMs:now+60_000,issuedByProfileId:'owner-1',revokedAtMs:null};
    const response=await app.inject({method:'POST',url:'/v3/nextgen/access/grants',payload:guest});
    expect(response.statusCode).toBe(200);expect(response.json().controlAuthority).toBe('none');
    expect((await accessRepository.listGrants('vehicle-1')).map((item)=>item.grantId).sort()).toEqual(['guest','owner']);
    await app.close();
  });

  it('rejects an authenticated actor whose server-bound profile does not match the claimed issuer',async()=>{
    const{app}=await createApp('admin-1');
    const now=Date.now();
    const owner:VehicleAccessGrant={grantId:'owner',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use','keys.share'],validFromMs:now-1_000,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};
    const response=await app.inject({method:'POST',url:'/v3/nextgen/access/grants',payload:owner});
    expect(response.statusCode).toBe(403);expect(response.json().error).toBe('access-actor-profile-mismatch');
    await app.close();
  });

  it('viewer self endpoint returns only the backend active profile grant',async()=>{
    const{app,accessRepository,runtime}=await createApp();
    const now=Date.now();
    const owner:VehicleAccessGrant={grantId:'owner',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use','keys.share'],validFromMs:now-1_000,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};
    const other:VehicleAccessGrant={grantId:'guest',vehicleId:'vehicle-1',profileId:'guest-1',role:'guest',permissions:['vehicle.use'],validFromMs:now-1_000,validUntilMs:now+60_000,issuedByProfileId:'owner-1',revokedAtMs:null};
    await accessRepository.saveGrant(owner);await accessRepository.saveGrant(other);
    runtime.resolveDriver([profile],{trustedDeviceId:'phone-1',faceProfileId:null,faceConfidence:null,observedAtMs:now});
    const response=await app.inject({method:'GET',url:'/v3/nextgen/access/self?vehicleId=vehicle-1'});
    expect(response.statusCode).toBe(200);expect(response.json().profileId).toBe('owner-1');expect(response.json().grant.grantId).toBe('owner');
    expect(response.json().permissions).toContain('vehicle.use');expect(response.json().controlAuthority).toBe('none');
    await app.close();
  });
});
