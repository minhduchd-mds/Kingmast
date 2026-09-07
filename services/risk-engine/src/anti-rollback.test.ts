import { describe,expect,it } from 'vitest';
import { AntiRollbackGuard,MemoryRollbackIndexStore } from './anti-rollback.js';
import { UpdateLifecycle } from './update-state.js';

describe('KINGMAST anti-rollback guard',()=>{
  it('rejects a candidate below the committed rollback floor',async()=>{
    const guard=new AntiRollbackGuard(new MemoryRollbackIndexStore(7));
    await expect(guard.evaluateCandidate(6)).resolves.toEqual({allowed:false,minimumRollbackIndex:7,candidateRollbackIndex:6,reason:'rollback-index-below-floor'});
  });

  it('does not advance the floor before the installed image passes boot health',async()=>{
    const store=new MemoryRollbackIndexStore(7);
    const guard=new AntiRollbackGuard(store);
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage({updateId:'123e4567-e89b-42d3-a456-426614174020',softwareVersion:'0.0.8',rollbackIndex:8});
    lifecycle.markVerified();
    lifecycle.markReady({eligible:true,reasons:[]});
    lifecycle.beginInstall();
    lifecycle.markInstalled();
    await expect(guard.commitAcceptedUpdate(lifecycle.snapshot())).resolves.toMatchObject({committed:false,reason:'update-not-boot-accepted',minimumRollbackIndex:7});
    await expect(store.read()).resolves.toBe(7);
  });

  it('advances monotonically only after boot acceptance',async()=>{
    const store=new MemoryRollbackIndexStore(7);
    const guard=new AntiRollbackGuard(store);
    const lifecycle=new UpdateLifecycle();
    lifecycle.stage({updateId:'123e4567-e89b-42d3-a456-426614174021',softwareVersion:'0.0.8',rollbackIndex:8});
    lifecycle.markVerified();
    lifecycle.markReady({eligible:true,reasons:[]});
    lifecycle.beginInstall();
    lifecycle.markInstalled();
    lifecycle.reportBootHealthy();
    await expect(guard.commitAcceptedUpdate(lifecycle.snapshot())).resolves.toEqual({committed:true,rollbackIndex:8,protection:'memory-test-only'});
    await expect(store.read()).resolves.toBe(8);
    await expect(guard.evaluateCandidate(7)).resolves.toMatchObject({allowed:false,reason:'rollback-index-below-floor'});
  });
});
