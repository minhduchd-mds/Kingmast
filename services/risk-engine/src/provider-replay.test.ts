import {describe,expect,it} from 'vitest';
import {BoundedProviderReplayGuard} from './provider-replay.js';

const input={providerId:'provider-a',keyId:'ed-a',scope:'connected-road:v2x' as const,signature:'same-valid-signature'};

describe('BoundedProviderReplayGuard',()=>{
  it('rejects the same authenticated signature during the replay window',()=>{
    const guard=new BoundedProviderReplayGuard(8,60_000);
    expect(guard.accept({...input,nowMs:1_000})).toEqual({accepted:true,reason:'ok'});
    expect(guard.accept({...input,nowMs:2_000})).toEqual({accepted:false,reason:'replay'});
    expect(guard.snapshot()).toMatchObject({activeEntries:1,rejected:1,capacityRejected:0});
  });

  it('allows a different signed payload fingerprint even at the same time',()=>{
    const guard=new BoundedProviderReplayGuard(8,60_000);
    expect(guard.accept({...input,signature:'signature-a',nowMs:1_000}).accepted).toBe(true);
    expect(guard.accept({...input,signature:'signature-b',nowMs:1_000}).accepted).toBe(true);
  });

  it('expires old fingerprints before applying capacity rejection',()=>{
    const guard=new BoundedProviderReplayGuard(1,30_000);
    expect(guard.accept({...input,signature:'old',nowMs:1_000}).accepted).toBe(true);
    expect(guard.accept({...input,signature:'new',nowMs:2_000})).toEqual({accepted:false,reason:'capacity'});
    expect(guard.accept({...input,signature:'new',nowMs:31_001})).toEqual({accepted:true,reason:'ok'});
  });

  it('namespaces replay fingerprints by provider key and scope',()=>{
    const guard=new BoundedProviderReplayGuard(8,60_000);
    expect(guard.accept({...input,signature:'sig',nowMs:1_000}).accepted).toBe(true);
    expect(guard.accept({...input,keyId:'ed-b',signature:'sig',nowMs:1_000}).accepted).toBe(true);
    expect(guard.accept({...input,scope:'connected-road:provider',signature:'sig',nowMs:1_000}).accepted).toBe(true);
  });
});
