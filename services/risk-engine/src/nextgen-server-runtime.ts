import { NextgenRuntime } from './nextgen-runtime.js';
import { InMemoryNextgenPersistence } from './nextgen-persistence.js';
import { DriverProfileRepository } from './driver-profile-repository.js';
import { VehicleAccessRepository } from './vehicle-access-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';

export const nextgenPersistence=new InMemoryNextgenPersistence();
export const nextgenRuntime=new NextgenRuntime();
export const nextgenProfiles=new DriverProfileRepository(nextgenPersistence);
export const nextgenAccessRepository=new VehicleAccessRepository(nextgenPersistence);
export const nextgenMemoryRepository=new ProfileMemoryRepository(nextgenPersistence);

export async function hydrateNextgenRuntime(){
  const grants=await nextgenAccessRepository.listGrants();
  for(const grant of grants)nextgenRuntime.access.upsert(grant);
  return{profiles:(await nextgenProfiles.list()).length,grants:grants.length,persistence:'memory' as const,profileMemoryPersistence:true,controlAuthority:'none' as const};
}
