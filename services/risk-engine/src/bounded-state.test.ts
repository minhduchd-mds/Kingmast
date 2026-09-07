import {describe,expect,it} from 'vitest';
import {BoundedFixedWindowRateLimiter,BoundedMonotonicTimestampStore} from './bounded-state.js';

const now=1_800_000_000_000;

describe('BoundedFixedWindowRateLimiter',()=>{
  it('enforces a fixed request limit and reports retry timing',()=>{
    const limiter=new BoundedFixedWindowRateLimiter(4);
    expect(limiter.consume('a',2,now)).toEqual({allowed:true,retryAfterS:0,reason:'ok'});
    expect(limiter.consume('a',2,now+100)).toEqual({allowed:true,retryAfterS:0,reason:'ok'});
    const denied=limiter.consume('a',2,now+1_000);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe('limit');
    expect(denied.retryAfterS).toBeGreaterThan(0);
  });

  it('bounds unique-key memory and fails closed at capacity',()=>{
    const limiter=new BoundedFixedWindowRateLimiter(2);
    expect(limiter.consume('a',10,now).allowed).toBe(true);
    expect(limiter.consume('b',10,now).allowed).toBe(true);
    expect(limiter.consume('c',10,now)).toEqual({allowed:false,retryAfterS:1,reason:'capacity'});
    expect(limiter.activeKeys).toBe(2);
    expect(limiter.capacityRejected).toBe(1);
  });

  it('prunes expired windows before rejecting a new key',()=>{
    const limiter=new BoundedFixedWindowRateLimiter(1);
    expect(limiter.consume('a',10,now,1_000).allowed).toBe(true);
    expect(limiter.consume('b',10,now+1_001,1_000).allowed).toBe(true);
    expect(limiter.activeKeys).toBe(1);
  });
});

describe('BoundedMonotonicTimestampStore',()=>{
  it('rejects replay and clock skew',()=>{
    const store=new BoundedMonotonicTimestampStore();
    expect(store.accept('camera-a',now,now)).toBe(true);
    expect(store.accept('camera-a',now,now+100)).toBe(false);
    expect(store.accept('camera-b',now-31_000,now)).toBe(false);
    expect(store.accept('camera-c',now+6_000,now)).toBe(false);
  });

  it('bounds key memory and accepts new identities after TTL expiry',()=>{
    const store=new BoundedMonotonicTimestampStore(1,1_000);
    expect(store.accept('camera-a',now,now)).toBe(true);
    expect(store.accept('camera-b',now,now)).toBe(false);
    const later=now+1_100;
    expect(store.accept('camera-b',later,later)).toBe(true);
    expect(store.activeKeys).toBe(1);
  });
});
