import {describe,expect,it} from 'vitest';
import {assessProviderCertificate,parseProviderCertificateRegistry,providerCertificateSummary} from './provider-certificate.js';

const now=1_800_000_000_000;
const fpA='a'.repeat(64);
const fpB='b'.repeat(64);

describe('provider certificate lifecycle scaffold',()=>{
  it('supports bounded overlapping certificate rotation without accepting revoked identities',()=>{
    const registry=parseProviderCertificateRegistry(JSON.stringify({'provider-a':[
      {certificateId:'old',fingerprintSha256:fpA,state:'revoked',scopes:['connected-road:provider'],notBeforeMs:now-100_000,notAfterMs:now+100_000,issuer:'KINGMAST research CA'},
      {certificateId:'next',fingerprintSha256:fpB,state:'active',scopes:['connected-road:provider','connected-road:v2x'],notBeforeMs:now-10_000,notAfterMs:now+100_000,issuer:'KINGMAST research CA'},
    ]}));
    expect(assessProviderCertificate({providerId:'provider-a',fingerprintSha256:fpA,scope:'connected-road:provider',registry,nowMs:now})).toEqual({trusted:false,reason:'certificate-revoked'});
    expect(assessProviderCertificate({providerId:'provider-a',fingerprintSha256:fpB,scope:'connected-road:v2x',registry,nowMs:now})).toEqual({trusted:true,providerId:'provider-a',certificateId:'next'});
    expect(providerCertificateSummary(registry,now)).toMatchObject({configuredProviders:1,activeCertificates:1,revokedCertificates:1,enforcement:'trusted-gateway-required'});
  });

  it('rejects scope escalation and expired certificates',()=>{
    const registry=parseProviderCertificateRegistry(JSON.stringify({'provider-camera':[
      {certificateId:'camera',fingerprintSha256:fpA,scopes:['road-context:cameras'],notBeforeMs:now-100_000,notAfterMs:now+10_000},
    ]}));
    expect(assessProviderCertificate({providerId:'provider-camera',fingerprintSha256:fpA,scope:'connected-road:v2x',registry,nowMs:now})).toEqual({trusted:false,reason:'certificate-scope-denied'});
    expect(assessProviderCertificate({providerId:'provider-camera',fingerprintSha256:fpA,scope:'road-context:cameras',registry,nowMs:now+20_000})).toEqual({trusted:false,reason:'certificate-expired'});
  });

  it('rejects duplicate certificate identities',()=>{
    expect(()=>parseProviderCertificateRegistry(JSON.stringify({'provider-a':[
      {certificateId:'a',fingerprintSha256:fpA,scopes:['road-context:cameras'],notBeforeMs:now-1000,notAfterMs:now+1000},
      {certificateId:'b',fingerprintSha256:fpA,scopes:['road-context:cameras'],notBeforeMs:now-1000,notAfterMs:now+1000},
    ]}))).toThrow(/duplicate certificate identity/);
  });
});
