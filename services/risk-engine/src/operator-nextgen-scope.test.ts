import {generateKeyPairSync,sign} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {OperatorReplayGuard,operatorSigningPayload,parseOperatorKeyRegistry,verifyOperatorRequest} from './operator-auth.js';

const NOW=1_800_000_000_000;

describe('nextgen operator scope',()=>{
  it('authorizes nextgen writes without implicitly granting geofence writes',()=>{
    const pair=generateKeyPairSync('ed25519');
    const publicKeyPem=pair.publicKey.export({type:'spki',format:'pem'}).toString();
    const privateKeyPem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();
    const registry=parseOperatorKeyRegistry(JSON.stringify({'profile-admin':[{keyId:'nextgen-key',publicKeyPem,scopes:['configuration:nextgen'],state:'active'}]}));
    const payload={profileId:'owner-1'};
    const base={scope:'configuration:nextgen' as const,operatorId:'profile-admin',keyId:'nextgen-key',timestampMs:NOW,nonce:'nonce-nextgen-config-001',payload};
    const signature=sign(null,Buffer.from(operatorSigningPayload(base),'utf8'),privateKeyPem).toString('base64url');
    expect(verifyOperatorRequest({...base,signature,registry,replayGuard:new OperatorReplayGuard(),nowMs:NOW}).ok).toBe(true);
    const geofence={...base,scope:'configuration:geofences' as const,nonce:'nonce-nextgen-config-002'};
    const geofenceSignature=sign(null,Buffer.from(operatorSigningPayload(geofence),'utf8'),privateKeyPem).toString('base64url');
    expect(verifyOperatorRequest({...geofence,signature:geofenceSignature,registry,replayGuard:new OperatorReplayGuard(),nowMs:NOW})).toEqual({ok:false,reason:'scope-denied'});
  });
});
