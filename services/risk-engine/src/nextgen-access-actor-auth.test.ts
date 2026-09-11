import {generateKeyPairSync,sign} from 'node:crypto';
import type {FastifyRequest} from 'fastify';
import {describe,expect,it} from 'vitest';
import {operatorSigningPayload} from './operator-auth.js';
import {createNextgenAccessActorAuthorizer} from './nextgen-access-actor-auth.js';

const NOW=1_800_000_000_000;

function fixture(){
  const pair=generateKeyPairSync('ed25519');
  const publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'}).toString();
  const privateKeyPem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const operatorKeysJson=JSON.stringify({'operator-a':[{keyId:'key-a',publicKeyPem,scopes:['configuration:nextgen'],state:'active',notBeforeMs:NOW-1_000,notAfterMs:NOW+60_000}]});
  const profileBindingsJson=JSON.stringify({'operator-a':'owner-1','loopback-dev':'dev-owner'});
  return{privateKeyPem,operatorKeysJson,profileBindingsJson};
}

function request(privateKeyPem:string,payload:unknown,nonce='nonce-nextgen-actor-001'){
  const input={scope:'configuration:nextgen' as const,operatorId:'operator-a',keyId:'key-a',timestampMs:NOW,nonce,payload};
  const signature=sign(null,Buffer.from(operatorSigningPayload(input),'utf8'),privateKeyPem).toString('base64url');
  return{ip:'10.0.0.5',headers:{'x-kingmast-operator-id':input.operatorId,'x-kingmast-operator-key-id':input.keyId,'x-kingmast-operator-timestamp-ms':String(input.timestampMs),'x-kingmast-operator-nonce':nonce,'x-kingmast-operator-signature':signature}} as unknown as FastifyRequest;
}

describe('nextgen access actor auth',()=>{
  it('returns only the server-bound profile after a valid Ed25519 request',()=>{
    const f=fixture();const payload={grantId:'g1'};
    const authorize=createNextgenAccessActorAuthorizer({operatorKeysJson:f.operatorKeysJson,profileBindingsJson:f.profileBindingsJson});
    expect(authorize(request(f.privateKeyPem,payload),payload,NOW)).toEqual({ok:true,actor:{actorId:'operator-a',profileId:'owner-1',authMode:'operator-ed25519'}});
  });

  it('rejects payload tampering and nonce replay',()=>{
    const f=fixture();const payload={grantId:'g1'};
    const authorize=createNextgenAccessActorAuthorizer({operatorKeysJson:f.operatorKeysJson,profileBindingsJson:f.profileBindingsJson});
    const req=request(f.privateKeyPem,payload);
    expect(authorize(req,{grantId:'tampered'},NOW)).toMatchObject({ok:false,reason:'operator-auth-failed'});
    const fresh=request(f.privateKeyPem,payload,'nonce-nextgen-actor-002');
    expect(authorize(fresh,payload,NOW).ok).toBe(true);
    expect(authorize(fresh,payload,NOW+1)).toMatchObject({ok:false,reason:'operator-auth-failed',detail:'replay'});
  });

  it('does not infer a profile for an unbound authenticated operator',()=>{
    const f=fixture();const payload={grantId:'g1'};
    const authorize=createNextgenAccessActorAuthorizer({operatorKeysJson:f.operatorKeysJson,profileBindingsJson:'{}'});
    expect(authorize(request(f.privateKeyPem,payload),payload,NOW)).toEqual({ok:false,reason:'missing-actor-binding'});
  });

  it('allows loopback dev only when explicitly enabled and bound',()=>{
    const f=fixture();
    const authorize=createNextgenAccessActorAuthorizer({operatorKeysJson:'{}',profileBindingsJson:f.profileBindingsJson,allowInsecureLocalDev:true});
    const req={ip:'127.0.0.1',headers:{}} as unknown as FastifyRequest;
    expect(authorize(req,{},NOW)).toEqual({ok:true,actor:{actorId:'loopback-dev',profileId:'dev-owner',authMode:'local-dev'}});
  });
});
