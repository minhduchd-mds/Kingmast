import {generateKeyPairSync} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {parseProviderKeyRegistry,signProviderRequest,signProviderRequestEd25519,verifyProviderAuth} from './provider-auth.js';

const now=1_800_000_000_000;
const payload={providerId:'provider-a',cameras:[{id:'cam-1'}]};

describe('provider identity',()=>{
  it('accepts a scoped HMAC provider signature and rejects tampering',()=>{
    const secret='0123456789abcdef0123456789abcdef';
    const registry=parseProviderKeyRegistry(JSON.stringify({'provider-a':[{keyId:'hmac-a',algorithm:'hmac-sha256',secret,scopes:['road-context:cameras']}]}));
    const signature=signProviderRequest('road-context:cameras','provider-a','hmac-a',now,payload,secret);
    expect(verifyProviderAuth({scope:'road-context:cameras',providerId:'provider-a',keyId:'hmac-a',signature,timestampMs:now,payload,registry,nowMs:now})).toEqual({ok:true,providerId:'provider-a',keyId:'hmac-a',algorithm:'hmac-sha256'});
    expect(verifyProviderAuth({scope:'road-context:cameras',providerId:'provider-a',keyId:'hmac-a',signature,timestampMs:now,payload:{...payload,cameras:[{id:'tampered'}]},registry,nowMs:now})).toEqual({ok:false,reason:'provider-signature-invalid'});
  });

  it('enforces scope, validity and revocation independently from shared edge credentials',()=>{
    const secret='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const registry=parseProviderKeyRegistry(JSON.stringify({'provider-a':[
      {keyId:'camera-only',secret,scopes:['road-context:cameras']},
      {keyId:'revoked',secret,state:'revoked',scopes:['connected-road:provider']},
      {keyId:'future',secret,notBeforeMs:now+60_000,scopes:['connected-road:provider']},
    ]}));
    const cameraSig=signProviderRequest('road-context:cameras','provider-a','camera-only',now,payload,secret);
    expect(verifyProviderAuth({scope:'connected-road:provider',providerId:'provider-a',keyId:'camera-only',signature:cameraSig,timestampMs:now,payload,registry,nowMs:now})).toEqual({ok:false,reason:'provider-scope-denied'});
    const revokedSig=signProviderRequest('connected-road:provider','provider-a','revoked',now,payload,secret);
    expect(verifyProviderAuth({scope:'connected-road:provider',providerId:'provider-a',keyId:'revoked',signature:revokedSig,timestampMs:now,payload,registry,nowMs:now})).toEqual({ok:false,reason:'provider-key-revoked'});
    const futureSig=signProviderRequest('connected-road:provider','provider-a','future',now,payload,secret);
    expect(verifyProviderAuth({scope:'connected-road:provider',providerId:'provider-a',keyId:'future',signature:futureSig,timestampMs:now,payload,registry,nowMs:now})).toEqual({ok:false,reason:'provider-key-not-yet-valid'});
  });

  it('supports Ed25519 without storing provider private keys',()=>{
    const pair=generateKeyPairSync('ed25519');
    const publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'}).toString();
    const privateKeyPem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const registry=parseProviderKeyRegistry(JSON.stringify({'provider-v2x':[{keyId:'ed-a',algorithm:'ed25519',publicKeyPem,scopes:['connected-road:v2x']}]}));
    const body={providerId:'provider-v2x',timestampMs:now,spat:[]};
    const signature=signProviderRequestEd25519('connected-road:v2x','provider-v2x','ed-a',now,body,privateKeyPem);
    expect(verifyProviderAuth({scope:'connected-road:v2x',providerId:'provider-v2x',keyId:'ed-a',signature,timestampMs:now,payload:body,registry,nowMs:now})).toEqual({ok:true,providerId:'provider-v2x',keyId:'ed-a',algorithm:'ed25519'});
    expect(JSON.stringify([...registry.values()])).not.toContain('PRIVATE KEY');
  });

  it('rejects replay-window skew',()=>{
    const secret='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const registry=parseProviderKeyRegistry(JSON.stringify({'provider-a':[{keyId:'a',secret,scopes:['road-context:cameras']}]}));
    const signature=signProviderRequest('road-context:cameras','provider-a','a',now,payload,secret);
    expect(verifyProviderAuth({scope:'road-context:cameras',providerId:'provider-a',keyId:'a',signature,timestampMs:now,payload,registry,nowMs:now+31_000,maxSkewMs:30_000})).toEqual({ok:false,reason:'provider-clock-skew'});
  });
});
