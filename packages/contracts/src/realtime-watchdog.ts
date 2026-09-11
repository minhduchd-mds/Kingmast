/** One timeout per connection, including a handshake that never completes. */
export class RealtimeHeartbeatWatchdog {
  private lastActivityAtMs: number | null = null;
  constructor(private readonly onTimeout: () => void, private readonly timeoutMs = 5_000) {}
  arm(nowMs: number) { this.lastActivityAtMs = nowMs; }
  pulse(nowMs: number) { if (this.lastActivityAtMs !== null) this.lastActivityAtMs = nowMs; }
  disarm() { this.lastActivityAtMs = null; }
  check(nowMs: number) {
    if (this.lastActivityAtMs === null || nowMs - this.lastActivityAtMs <= this.timeoutMs) return;
    this.disarm();
    this.onTimeout();
  }
}
