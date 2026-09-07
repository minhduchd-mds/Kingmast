import {describe,expect,it} from 'vitest';
import {UpdateLifecycle} from './update-state.js';

const manifest={updateId:'11111111-1111-4111-8111-111111111111',softwareVersion:'0.0.7-test',rollbackIndex:7};
const eligible={eligible:true,reasons:[]};

describe('UpdateLifecycle',()=>{
  it('accepts only the verified and eligible happy path',()=>{
    const lifecycle=new UpdateLifecycle();
    expect(lifecycle.stage(manifest,1).state).toBe('staged');
    expect(lifecycle.markVerified(2).state).toBe('verified');
    expect(lifecycle.markReady(eligible,3).state).toBe('ready');
    expect(lifecycle.beginInstall(4).state).toBe('installing');
    expect(lifecycle.markInstalled(5).state).toBe('pending-boot');
    expect(lifecycle.reportBootHealthy(6).state).toBe('accepted');
  });

  it('fails closed when install eligibility is not satisfied',()=>{
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage(manifest);
    lifecycle.markVerified();
    const result=lifecycle.markReady({eligible:false,reasons:['vehicle-moving','power-not-stable']});
    expect(result.state).toBe('failed');
    expect(result.lastReason).toContain('vehicle-moving');
    expect(()=>lifecycle.beginInstall()).toThrow();
  });

  it('requires rollback after boot-health failure',()=>{
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage(manifest);
    lifecycle.markVerified();
    lifecycle.markReady(eligible);
    lifecycle.beginInstall();
    lifecycle.markInstalled();
    expect(lifecycle.reportBootFailure('watchdog-reset').state).toBe('rollback-required');
  });

  it('moves an install-time failure to rollback-required',()=>{
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage(manifest);
    lifecycle.markVerified();
    lifecycle.markReady(eligible);
    lifecycle.beginInstall();
    expect(lifecycle.fail('write-verification-failed').state).toBe('rollback-required');
  });

  it('rejects skipped verification transitions',()=>{
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage(manifest);
    expect(()=>lifecycle.beginInstall()).toThrow();
    expect(()=>lifecycle.reportBootHealthy()).toThrow();
  });
});
