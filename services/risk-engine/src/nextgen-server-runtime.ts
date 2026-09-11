import { NextgenRuntime } from './nextgen-runtime.js';
import { InMemoryNextgenPersistence } from './nextgen-persistence.js';
import { SqliteNextgenPersistence } from './sqlite-nextgen-persistence.js';
import { DriverProfileRepository } from './driver-profile-repository.js';
import { VehicleAccessRepository } from './vehicle-access-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';

const persistenceMode=process.env.KINGMAST_NEXTGEN_PERSISTENCE??'sqlite';
if(!['sqlite','memory'].includes(persistenceMode))throw new Error('invalid-nextgen-persistence-mode');
if(persistenceMode==='memory'&&process.env.KINGMAST_ALLOW_INSECURE_LOCAL_DEV!=='1')throw new Error('memory-persistence-requires-explicit-local-dev');
export const nextgenPersistence=persistenceMode==='memory'
  ?new InMemoryNextgenPersistence()
  :new SqliteNextgenPersistence(process.env.KINGMAST_NEXTGEN_SQLITE_PATH?.trim()||'.kingmast-data/nextgen.sqlite');
export const nextgenRuntime=new NextgenRuntime();
export const nextgenProfiles=new DriverProfileRepository(nextgenPersistence);
export const nextgenAccessRepository=new VehicleAccessRepository(nextgenPersistence);
export const nextgenMemoryRepository=new ProfileMemoryRepository(nextgenPersistence);

export async function hydrateNextgenRuntime(){
  const grants=await nextgenAccessRepository.listGrants();
  for(const grant of grants)nextgenRuntime.access.upsert(grant);
  return{profiles:(await nextgenProfiles.list()).length,grants:grants.length,persistence:persistenceMode,durable:persistenceMode==='sqlite',profileMemoryPersistence:persistenceMode==='sqlite',controlAuthority:'none' as const};
}
