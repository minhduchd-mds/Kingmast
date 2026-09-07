import {generateKeyPairSync,sign} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {OperatorReplayGuard,operatorSigningPayload,parseOperatorKeyRegistry,verifyOperatorRequest} from './operator-auth.js';

const now=1_800_000_000_000;

function fixture(state:'active'|'revoked'='active'){
  const pair=generateKeyPairSync('ed25519');
  const publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'}).toString();
  const privateKeyPem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const registry=parseOperatorKeyRegistry(JSON.stringify({
    'operator-a':[{keyId:'key-a',publicKeyPem,scopes:['configuration:geofences'],state,notBeforeMs:now-1_000,notAfterMs:now+60_000}],
  }));
  return{registry,privateKeyPem,publicKeyPem};
}

function signedRequest(privateKeyPem:string,payload:unknown,nonce='nonce-operator-a-001'){
  const input={scope:'configuration:geofences' as const,operatorId:'operator-a',keyId:'key-a',timestampMs:now,nonce,payload};
  const signature=sign(null,Buffer.from(operatorSigningPayload(input),'utf8'),privateKeyPem).toString('base64url');
  return{...input,signature};
}

describe('operator identity',()=>{
  it('accepts a fresh scoped Ed25519 configuration request',()=>{
    const {registry,privateKeyPem}=fixture();
    const request=signedRequest(privateKeyPem,{geofences:[]});
    expect(verifyOperatorRequest({...request,registry,replayGuard:new OperatorReplayGuard(),nowMs:now})).toEqual({ok:true,operatorId:'operator-a',keyId:'key-a',scope:'configuration:geofences'});
  });

  it('rejects payload tampering after signature creation',()=>{
    const {registry,privateKeyPem}=fixture();
    const request=signedRequest(privateKeyPem,{geofences:[]});
    const result=verifyOperatorRequest({...request,payload:{geofences:[{id:'tampered'}]},registry,replayGuard:new OperatorReplayGuard(),nowMs:now});
    expect(result).toEqual({ok:false,reason:'invalid-signature'});
  });

  it('rejects nonce replay after a valid request',()=>{
    const {registry,privateKeyPem}=fixture();
    const replayGuard=new OperatorReplayGuard();
    const request=signedRequest(privateKeyPem,{geofences:[]});
    expect(verifyOperatorRequest({...request,registry,replayGuard,nowMs:now}).ok).toBe(true);
    expect(verifyOperatorRequest({...request,registry,replayGuard,nowMs:now+1})).toEqual({ok:false,reason:'replay'});
  });

  it('rejects revoked operator credentials',()=>{
    const {registry,privateKeyPem}=fixture('revoked');
    const request=signedRequest(privateKeyPem,{geofences:[]});
    expect(verifyOperatorRequest({...request,registry,replayGuard:new OperatorReplayGuard(),nowMs:now})).toEqual({ok:false,reason:'revoked-key'});
  });

  it('rejects clock-skewed requests',()=>{
    const {registry,privateKeyPem}=fixture();
    const request=signedRequest(privateKeyPem,{geofences:[]});
    expect(verifyOperatorRequest({...request,registry,replayGuard:new OperatorReplayGuard(),nowMs:now+31_000})).toEqual({ok:false,reason:'clock-skew'});
  });

  it('never accepts private key material in the server registry',()=>{
    const pair=generateKeyPairSync('ed25519');
    const privateKeyPem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    expect(()=>parseOperatorKeyRegistry(JSON.stringify({'operator-a':[{keyId:'key-a',publicKeyPem:privateKeyPem,scopes:['configuration:geofences'],state:'active'}]}))).toThrow(/private key material/i);
  });

  it('bounds replay state and fails closed at capacity',()=>{
    const guard=new OperatorReplayGuard(1,30_000);
    expect(guard.accept('operator-a:key-a:configuration:geofences','nonce-operator-a-001',now)).toBe(true);
    expect(guard.accept('operator-b:key-b:configuration:geofences','nonce-operator-b-001',now)).toBe(false);
    expect(guard.capacityRejected).toBe(1);
  });
});
