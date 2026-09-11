import {describe,expect,it} from 'vitest';
import type {VehicleAccessGrant} from '@kingmast/contracts/nextgen';
import {validateGrantIssuance} from './vehicle-grant-policy.js';

const NOW=1_800_000_000_000;
const DAY=24*60*60*1000;
const owner:VehicleAccessGrant={grantId:'owner',vehicleId:'vehicle-1',profileId:'owner-1',role:'owner',permissions:['vehicle.use','vehicle.unlock','profile.read.self','profile.edit.self','trip.history.read','camera.live.view','camera.history.export','users.manage','keys.share','settings.safety.change','diagnostics.read'],validFromMs:NOW-DAY,validUntilMs:null,issuedByProfileId:'owner-1',revokedAtMs:null};

function grant(patch:Partial<VehicleAccessGrant>={}):VehicleAccessGrant{return{grantId:'guest-1',vehicleId:'vehicle-1',profileId:'guest-1',role:'guest',permissions:['vehicle.use','vehicle.unlock','profile.read.self'],validFromMs:NOW,validUntilMs:NOW+DAY,issuedByProfileId:'owner-1',revokedAtMs:null,...patch};}

describe('vehicle grant issuance policy',()=>{
  it('allows only a self-issued owner for first vehicle bootstrap',()=>{
    expect(validateGrantIssuance({...owner,validFromMs:NOW},[],NOW).allowed).toBe(true);
    expect(validateGrantIssuance(grant(),[],NOW).reason).toBe('bootstrap-owner-required');
  });

  it('rejects permissions outside the target role ceiling',()=>{
    const decision=validateGrantIssuance(grant({permissions:['vehicle.use','users.manage']}),[owner],NOW);
    expect(decision.allowed).toBe(false);expect(decision.reason).toBe('role-permission-exceeded');
  });

  it('caps valet credentials to one day and guest credentials to seven days',()=>{
    expect(validateGrantIssuance(grant({role:'valet',validUntilMs:NOW+DAY+1}),[owner],NOW).reason).toBe('role-duration-exceeded');
    expect(validateGrantIssuance(grant({validUntilMs:NOW+8*DAY}),[owner],NOW).reason).toBe('role-duration-exceeded');
  });

  it('prevents an admin from creating an equal or higher role',()=>{
    const admin:VehicleAccessGrant={...owner,grantId:'admin',profileId:'admin-1',role:'admin',permissions:['vehicle.use','vehicle.unlock','profile.read.self','profile.edit.self','trip.history.read','camera.live.view','camera.history.export','users.manage','keys.share','diagnostics.read'],issuedByProfileId:'owner-1'};
    const decision=validateGrantIssuance(grant({role:'admin',profileId:'admin-2',issuedByProfileId:'admin-1',permissions:['vehicle.use','keys.share']}),[owner,admin],NOW);
    expect(decision.allowed).toBe(false);expect(decision.reason).toBe('issuer-role-insufficient');
  });

  it('prevents delegated grants from outliving the issuer',()=>{
    const admin:VehicleAccessGrant={...owner,grantId:'admin',profileId:'admin-1',role:'admin',permissions:['vehicle.use','vehicle.unlock','profile.read.self','keys.share'],validUntilMs:NOW+2*DAY,issuedByProfileId:'owner-1'};
    const decision=validateGrantIssuance(grant({role:'driver',profileId:'driver-1',issuedByProfileId:'admin-1',permissions:['vehicle.use'],validUntilMs:NOW+3*DAY}),[owner,admin],NOW);
    expect(decision.allowed).toBe(false);expect(decision.reason).toBe('issuer-validity-exceeded');
  });

  it('prevents an issuer from delegating a permission it does not hold',()=>{
    const admin:VehicleAccessGrant={...owner,grantId:'admin',profileId:'admin-1',role:'admin',permissions:['vehicle.use','keys.share'],issuedByProfileId:'owner-1'};
    const decision=validateGrantIssuance(grant({role:'driver',profileId:'driver-1',issuedByProfileId:'admin-1',permissions:['vehicle.use','camera.live.view']}),[owner,admin],NOW);
    expect(decision.allowed).toBe(false);expect(decision.reason).toBe('issuer-permission-exceeded');
  });
});
