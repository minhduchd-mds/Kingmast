import {describe,expect,it} from 'vitest';
import type {DriverProfile,ProfileMemoryEntry} from '@kingmast/contracts/nextgen';
import {InMemoryNextgenPersistence} from './nextgen-persistence.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';

const NOW=1_800_000_000_000;
function profile(overrides:Partial<DriverProfile>={}):DriverProfile{return{id:'owner-1',displayName:'Owner',role:'owner',trustedDeviceIds:[],privacy:{locationHistory:true,cameraHistory:false,personalization:true,diagnosticsUpload:false},ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:70},home:null,work:null,updatedAtMs:NOW,...overrides};}
function entry(kind:ProfileMemoryEntry['kind'],id:string,lastUsedAtMs=NOW):ProfileMemoryEntry{return{id,profileId:'owner-1',kind,label:id,position:kind==='recent-place'?{lat:21,lng:105}:null,routeKey:kind==='recent-place'?null:`route-${id}`,createdAtMs:NOW-100,lastUsedAtMs};}

describe('profile memory repository',()=>{
  it('never persists location memory when location history is disabled',async()=>{
    const persistence=new InMemoryNextgenPersistence(),repository=new ProfileMemoryRepository(persistence);
    const locked=profile({privacy:{locationHistory:false,cameraHistory:false,personalization:true,diagnosticsUpload:false}});
    expect(await repository.save(locked,entry('recent-place','home'))).toBeNull();
    expect(await repository.save(locked,entry('preferred-route','work-route'))).toBeNull();
    expect(await repository.save(locked,entry('ui-preference','units'))).not.toBeNull();
    expect((await repository.list(locked)).map((item)=>item.kind)).toEqual(['ui-preference']);
  });

  it('purges previously stored location memory when privacy is switched off',async()=>{
    const persistence=new InMemoryNextgenPersistence(),repository=new ProfileMemoryRepository(persistence),open=profile();
    await repository.save(open,entry('recent-place','home'));await repository.save(open,entry('ui-preference','theme'));
    const locked=profile({privacy:{locationHistory:false,cameraHistory:false,personalization:true,diagnosticsUpload:false}});
    expect((await repository.list(locked)).map((item)=>item.kind)).toEqual(['ui-preference']);
    expect((await persistence.list('nextgen:memory:owner-1:')).length).toBe(1);
  });

  it('clears all memory when personalization is disabled',async()=>{
    const persistence=new InMemoryNextgenPersistence(),repository=new ProfileMemoryRepository(persistence),open=profile();
    await repository.save(open,entry('ui-preference','theme'));
    const closed=profile({privacy:{locationHistory:false,cameraHistory:false,personalization:false,diagnosticsUpload:false}});
    expect(await repository.list(closed)).toEqual([]);expect(await persistence.list('nextgen:memory:owner-1:')).toEqual([]);
  });
});
