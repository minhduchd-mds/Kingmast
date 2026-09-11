import Fastify from 'fastify';
import {describe,expect,it} from 'vitest';
import type {VehicleAccessGrant} from '@kingmast/contracts/nextgen';
import {nextgenApiRoutes} from './nextgen-api-routes.js';
import {NextgenRuntime} from './nextgen-runtime.js';
import {InMemoryNextgenPersistence} from './nextgen-persistence.js';
import {DriverProfileRepository} from './driver-profile-repository.js';
import {VehicleAccessRepository} from './vehicle-access-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';

async function createApp(){
  const persistence=new InMemoryNextgenPersistence();
  const accessRepository=new VehicleAccessRepository(persistence);
  const app=Fastify();
  await app.register(nextgenApiRoutes,{runtime:new NextgenRuntime(),profiles:new DriverProfileRepository(persistence),accessRepository,memoryRepository:new ProfileMemoryRepository(persistence),requireViewer:()=>true,requireWrite:()=>true});
  return{app,accessRepository};
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
});
