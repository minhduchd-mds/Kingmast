import {describe,expect,it} from 'vitest';
import {parseOperatorProfileBindings,resolveAccessActor} from './operator-profile-binding.js';

describe('operator profile binding',()=>{
  it('maps an individually authenticated operator to a server-owned profile id',()=>{
    const bindings=parseOperatorProfileBindings('{"operator-a":"owner-1"}');
    expect(resolveAccessActor({actorId:'operator-a',authMode:'operator-ed25519'},bindings)).toEqual({actorId:'operator-a',profileId:'owner-1',authMode:'operator-ed25519'});
  });

  it('rejects migration token identity even if a binding is configured',()=>{
    const bindings=parseOperatorProfileBindings('{"config-token":"owner-1"}');
    expect(resolveAccessActor({actorId:'config-token',authMode:'migration-token'},bindings)).toBeNull();
  });

  it('fails closed for an unbound operator and accepts explicitly bound loopback dev only',()=>{
    const bindings=parseOperatorProfileBindings('{"loopback-dev":"dev-owner"}');
    expect(resolveAccessActor({actorId:'operator-x',authMode:'operator-ed25519'},bindings)).toBeNull();
    expect(resolveAccessActor({actorId:'loopback-dev',authMode:'local-dev'},bindings)?.profileId).toBe('dev-owner');
  });

  it('rejects malformed or unbounded binding documents',()=>{
    expect(()=>parseOperatorProfileBindings('[]')).toThrow();
    expect(()=>parseOperatorProfileBindings('{"bad id":"owner-1"}')).toThrow();
    expect(()=>parseOperatorProfileBindings('{"operator-a":""}')).toThrow();
  });
});
