import {describe,expect,it} from 'vitest';
import {ConfigurationAuditBuffer,configurationDigest} from './configuration-audit.js';

describe('ConfigurationAuditBuffer',()=>{
  it('stores metadata digests instead of raw configuration or IP',()=>{
    const audit=new ConfigurationAuditBuffer(4);
    const previous=[{id:'a',name:'Old'}];
    const next=[{id:'b',name:'New'}];
    const record=audit.record({timestampMs:1_800_000_000_000,actorId:'operator-a',keyId:'key-a',authMode:'operator-ed25519',previousValue:previous,newValue:next,previousCount:1,newCount:1,sourceIp:'203.0.113.10'});
    expect(record.previousDigest).toBe(configurationDigest(previous));
    expect(record.newDigest).toBe(configurationDigest(next));
    expect(record.sourceIpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(record)).not.toContain('203.0.113.10');
    expect(JSON.stringify(record)).not.toContain('Old');
    expect(JSON.stringify(record)).not.toContain('New');
    expect(record.actuatorAuthority).toBe('none');
  });

  it('bounds retained records and reports dropped metadata',()=>{
    const audit=new ConfigurationAuditBuffer(2);
    for(let index=0;index<3;index++)audit.record({timestampMs:1_800_000_000_000+index,actorId:'operator-a',keyId:'key-a',authMode:'operator-ed25519',previousValue:[index],newValue:[index+1],previousCount:1,newCount:1,sourceIp:'127.0.0.1'});
    expect(audit.list(10).map((item)=>item.sequence)).toEqual([3,2]);
    expect(audit.status()).toMatchObject({capacity:2,retained:2,dropped:1,lastSequence:3,storesRawConfiguration:false,storesRawIp:false,actuatorAuthority:'none'});
  });
});
