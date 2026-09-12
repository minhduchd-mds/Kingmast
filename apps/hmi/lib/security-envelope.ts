import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

type RuntimeMode = 'normal' | 'degraded' | 'isolated' | 'lockdown';
type Admission = { ok: true; principal: string; local: boolean } | { ok: false; status: 401 | 403 | 429; reason: string };

type Bucket = { count: number; resetAt: number };
type ReplayEntry = { expiresAt: number };

type SecurityStore = {
  buckets: Map<string, Bucket>;
  capabilityReplay: Map<string, ReplayEntry>;
  paidDay: string;
  paidCalls: number;
};

const globalSecurity = globalThis as typeof globalThis & { __kingmastSecurityEnvelope?: SecurityStore };
const store: SecurityStore = globalSecurity.__kingmastSecurityEnvelope ?? {
  buckets: new Map(),
  capabilityReplay: new Map(),
  paidDay: '',
  paidCalls: 0,
};
globalSecurity.__kingmastSecurityEnvelope = store;

function enabled(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function boundedInt(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function runtimeMode(): RuntimeMode {
  if (enabled('KINGMAST_EMERGENCY_LOCKDOWN')) return 'lockdown';
  const value = process.env.KINGMAST_RUNTIME_MODE?.trim().toLowerCase();
  return value === 'degraded' || value === 'isolated' || value === 'lockdown' ? value : 'normal';
}

function isLoopbackHost(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function clientIdentity(request: NextRequest) {
  const device = request.headers.get('x-kingmast-device-id')?.trim().slice(0, 96);
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  const network = (forwarded || real || 'unknown').slice(0, 96);
  return `${device || 'nodevice'}@${network}`;
}

function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = store.buckets.get(key);
  if (!current || current.resetAt <= now) {
    store.buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function pruneReplay(now: number) {
  if (store.capabilityReplay.size < 4096) return;
  for (const [key, value] of store.capabilityReplay) {
    if (value.expiresAt <= now) store.capabilityReplay.delete(key);
  }
  if (store.capabilityReplay.size > 8192) {
    const overflow = store.capabilityReplay.size - 8192;
    let removed = 0;
    for (const key of store.capabilityReplay.keys()) {
      store.capabilityReplay.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

function verifyCapability(request: NextRequest, scope: string) {
  const secret = process.env.KINGMAST_NAV_CAPABILITY_SECRET?.trim();
  if (!secret || secret.length < 32) return false;

  const raw = request.headers.get('x-kingmast-capability')?.trim();
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;

  const expiresAt = Number(parts[1]);
  const nonce = parts[2];
  const signature = parts[3];
  const now = Date.now();
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + 15 * 60_000) return false;
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const canonical = `${scope}\n${request.method.toUpperCase()}\n${request.nextUrl.pathname}\n${expiresAt}\n${nonce}`;
  const expected = createHmac('sha256', secret).update(canonical).digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;

  const replayKey = createHash('sha256').update(raw).digest('hex');
  pruneReplay(now);
  if (store.capabilityReplay.has(replayKey)) return false;
  store.capabilityReplay.set(replayKey, { expiresAt });
  return true;
}

export function admitNavigationRequest(request: NextRequest, scope: 'navigation:route' | 'navigation:search'): Admission {
  if (!enabled('KINGMAST_SECURITY_ENVELOPE_ENABLED', true)) {
    return { ok: false, status: 403, reason: 'security-envelope-disabled' };
  }

  const mode = runtimeMode();
  if (mode === 'isolated' || mode === 'lockdown') {
    return { ok: false, status: 403, reason: `runtime-${mode}` };
  }

  const local = isLoopbackHost(request) && enabled('KINGMAST_ALLOW_INSECURE_LOCAL_DEV');
  const authRequired = enabled('KINGMAST_NAV_AUTH_REQUIRED', true);
  const capabilityOk = !authRequired || verifyCapability(request, scope);
  if (!local && !capabilityOk) return { ok: false, status: 401, reason: 'navigation-capability-required' };

  const principal = local ? 'loopback-dev' : clientIdentity(request);
  const perMinute = boundedInt('KINGMAST_NAV_RATE_LIMIT_PER_MINUTE', 5, 1, 120);
  const perHour = boundedInt('KINGMAST_NAV_RATE_LIMIT_PER_HOUR', 60, perMinute, 5000);
  if (!rateLimit(`${scope}:minute:${principal}`, perMinute, 60_000)) return { ok: false, status: 429, reason: 'navigation-rate-minute' };
  if (!rateLimit(`${scope}:hour:${principal}`, perHour, 60 * 60_000)) return { ok: false, status: 429, reason: 'navigation-rate-hour' };

  return { ok: true, principal, local };
}

export function paidRoutingEnabled() {
  if (!enabled('KINGMAST_SECURITY_ENVELOPE_ENABLED', true)) return false;
  if (enabled('KINGMAST_NAV_KILL_SWITCH') || enabled('KINGMAST_EMERGENCY_LOCKDOWN')) return false;
  if (runtimeMode() !== 'normal') return false;
  return enabled('KINGMAST_PAID_ROUTING_ENABLED');
}

export function consumePaidRoutingQuota() {
  if (!paidRoutingEnabled()) return false;
  const day = new Date().toISOString().slice(0, 10);
  if (store.paidDay !== day) {
    store.paidDay = day;
    store.paidCalls = 0;
  }
  const limit = boundedInt('KINGMAST_NAV_DAILY_PAID_LIMIT', 500, 1, 100_000);
  if (store.paidCalls >= limit) return false;
  store.paidCalls += 1;
  return true;
}

export function securityEnvelopeHeaders(reason?: string) {
  return {
    'cache-control': 'no-store',
    'x-kingmast-security-envelope': 'enforced',
    ...(reason ? { 'x-kingmast-security-reason': reason } : {}),
  };
}
