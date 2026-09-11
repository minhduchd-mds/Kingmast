import {mkdtempSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {afterEach, describe, expect, it} from 'vitest';
import {SqliteNextgenPersistence} from './sqlite-nextgen-persistence.js';
import {persistenceRecord} from './nextgen-persistence.js';
import {DriverProfileRepository} from './driver-profile-repository.js';
import {ProfileMemoryRepository} from './profile-memory-repository.js';
import {VehicleAccessRepository} from './vehicle-access-repository.js';
import type {DriverProfile} from '@kingmast/contracts/nextgen';

const dirs: string[] = [];
const stores: SqliteNextgenPersistence[] = [];
function location() {const dir=mkdtempSync(join(tmpdir(),'kingmast-store-'));dirs.push(dir);return join(dir,'nextgen.sqlite');}
function open(file:string) {const store=new SqliteNextgenPersistence(file);stores.push(store);return store;}
afterEach(()=>{for(const store of stores.splice(0)){try{store.close();}catch{}}for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});

describe('durable nextgen storage',()=>{
  it('preserves profiles, memory and grant revocation across restart and another process',async()=>{
    const file=location(), first=open(file);
    const profile:DriverProfile={id:'owner',displayName:'Owner',role:'owner',trustedDeviceIds:[],privacy:{locationHistory:true,cameraHistory:false,personalization:true,diagnosticsUpload:false},ui:{language:'vi',theme:'auto',mapZoom:15,warningVolume:70},home:null,work:null,updatedAtMs:100};
    await new DriverProfileRepository(first).save(profile,100);
    await new ProfileMemoryRepository(first).save(profile,{id:'home',profileId:'owner',kind:'recent-place',label:'Home',position:{lat:21,lng:105},routeKey:null,createdAtMs:100,lastUsedAtMs:100});
    // Store the revocation record itself: a restart must never revive access.
    await first.set('nextgen:grant:g1',persistenceRecord({grantId:'g1',vehicleId:'v1',profileId:'owner',issuedByProfileId:'owner',permissions:[],validFromMs:100,revokedAtMs:200},200));
    first.close();
    const second=open(file);
    expect((await new DriverProfileRepository(second).get('owner'))?.displayName).toBe('Owner');
    expect((await new ProfileMemoryRepository(second).list(profile))[0].label).toBe('Home');
    expect((await new VehicleAccessRepository(second).getGrant('g1'))?.revokedAtMs).toBe(200);
    const output=execFileSync(process.execPath,['--input-type=module','-e',
      "import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync(process.argv[1]); console.log(db.prepare('SELECT count(*) AS n FROM nextgen_records').get().n); db.close();",file],{encoding:'utf8'});
    expect(output.trim()).toBe('3');
    expect(statSync(file).mode&0o777).toBe(0o600);
  });

  it('persists privacy deletions and does not restore deleted location history',async()=>{
    const file=location(),first=open(file);
    await first.set('nextgen:memory:owner:home',persistenceRecord({kind:'recent-place'},100));
    await first.set('nextgen:memory:owner:theme',persistenceRecord({kind:'ui-preference'},100));
    await new ProfileMemoryRepository(first).clearLocationMemory('owner');first.close();
    expect(await open(file).list('nextgen:memory:owner:')).toEqual(['nextgen:memory:owner:theme']);
  });

  it('serializes independent connections without losing another writer updates',async()=>{
    const file=location(),a=open(file),b=open(file);
    await Promise.all([a.set('a',persistenceRecord(1)),b.set('b',persistenceRecord(2))]);
    expect(await a.list('')).toEqual(['a','b']);
    expect((await b.get('a'))?.value).toBe(1);
  });

  it('rejects oversize writes without damaging existing data and treats prefixes literally',async()=>{
    const store=open(location());
    await store.set('a%_1',persistenceRecord('retained'));
    await store.set('abc1',persistenceRecord('other'));
    await expect(store.set('a%_1',persistenceRecord('x'.repeat(70_000)))).rejects.toThrow('too-large');
    expect((await store.get('a%_1'))?.value).toBe('retained');
    expect(await store.list('a%_')).toEqual(['a%_1']);
  });

  it('fails closed on a corrupt database instead of silently starting empty',()=>{
    const file=location();writeFileSync(file,'not a SQLite database');
    expect(()=>open(file)).toThrow();
  });
});
