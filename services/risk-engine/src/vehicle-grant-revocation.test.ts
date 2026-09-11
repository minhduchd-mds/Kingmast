import {describe,expect,it} from 'vitest';
import type {VehicleAccessGrant} from '@kingmast/contracts/nextgen';
import {validateGrantRevocation} from './vehicle-grant-revocation.js';

const NOW=1_800_000_000_000;
const owner=(id:string):VehicleAccessGrant=>({grantId:`owner-${id}`,vehicleId:'vehicle-1',profileId:id,role:'owner',permissions:['vehicle.use','keys.share'],validFromMs:NOW-1_000,validUntilMs:null,issuedByProfileId:id,revokedAtMs:null});
const guest:VehicleAccessGrant={grantId:'guest-1',vehicleId:'vehicle-1',profileId:'guest-1',role:'guest',permissions:['vehicle.use'],validFromMs:NOW-500,validUntilMs:NOW+60_000,issuedByProfileId:'owner-a',revokedAtMs:null};

describe('vehicle grant revocation policy',()=>{
  it('allows an active owner with keys.share to revoke a lower role',()=>{
    const decision=validateGrantRevocation({grantId:'guest-1',actorProfileId:'owner-a',grants:[owner('owner-a'),guest],nowMs:NOW});
    expect(decision.allowed).toBe(true);expect(decision.reason).toBe('allowed');
  });

  it('denies an actor without an active keys.share grant',()=>{
    const weak={...owner('owner-a'),permissions:['vehicle.use'] as VehicleAccessGrant['permissions']};
    expect(validateGrantRevocation({grantId:'guest-1',actorProfileId:'owner-a',grants:[weak,guest],nowMs:NOW}).reason).toBe('actor-cannot-share-keys');
  });

  it('protects the last active owner and disallows self-revocation',()=>{
    const only=owner('owner-a');
    expect(validateGrantRevocation({grantId:only.grantId,actorProfileId:only.profileId,grants:[only],nowMs:NOW}).reason).toBe('last-owner-protected');
  });

  it('supports explicit owner rotation without allowing peer self-delete',()=>{
    const a=owner('owner-a'),b={...owner('owner-b'),issuedByProfileId:'owner-a'};
    expect(validateGrantRevocation({grantId:b.grantId,actorProfileId:a.profileId,grants:[a,b],nowMs:NOW}).allowed).toBe(true);
    expect(validateGrantRevocation({grantId:a.grantId,actorProfileId:a.profileId,grants:[a,b],nowMs:NOW}).reason).toBe('actor-role-insufficient');
  });

  it('rejects missing and already-revoked targets',()=>{
    expect(validateGrantRevocation({grantId:'missing',actorProfileId:'owner-a',grants:[owner('owner-a')],nowMs:NOW}).reason).toBe('target-not-found');
    expect(validateGrantRevocation({grantId:'guest-1',actorProfileId:'owner-a',grants:[owner('owner-a'),{...guest,revokedAtMs:NOW-1}],nowMs:NOW}).reason).toBe('target-already-revoked');
  });
});
