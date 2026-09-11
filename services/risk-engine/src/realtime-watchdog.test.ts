import {describe,expect,it,vi} from 'vitest';
import {RealtimeHeartbeatWatchdog} from '@kingmast/contracts/realtime-watchdog';

describe('realtime heartbeat watchdog',()=>{
  it('retires a half-open connection without waiting for a close event',()=>{
    const reconnect=vi.fn(),watchdog=new RealtimeHeartbeatWatchdog(reconnect);
    watchdog.arm(100);watchdog.pulse(200);watchdog.check(5_200);
    expect(reconnect).not.toHaveBeenCalled();
    watchdog.check(5_201);watchdog.check(6_000);
    expect(reconnect).toHaveBeenCalledTimes(1);
    watchdog.arm(6_100);watchdog.pulse(6_200);watchdog.check(11_201);
    expect(reconnect).toHaveBeenCalledTimes(2);
  });
  it('times out a stuck handshake and does not reconnect after cleanup',()=>{
    const reconnect=vi.fn(),watchdog=new RealtimeHeartbeatWatchdog(reconnect);
    watchdog.arm(0);watchdog.check(5_001);expect(reconnect).toHaveBeenCalledOnce();
    watchdog.arm(6_000);watchdog.disarm();watchdog.check(20_000);
    expect(reconnect).toHaveBeenCalledOnce();
  });
});
