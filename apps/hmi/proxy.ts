import { NextRequest, NextResponse } from 'next/server';

const MAX_API_BODY_BYTES = 1_048_576;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST']);
const RATE_WINDOW_MS = 60_000;
const MAX_RATE_KEYS = 4096;

type RateEntry = { count: number; resetAt: number };
type OuterStore = { rate: Map<string, RateEntry> };
const globalOuter = globalThis as typeof globalThis & { __kingmastOuterEnvelope?: OuterStore };
const outerStore: OuterStore = globalOuter.__kingmastOuterEnvelope ?? { rate: new Map() };
globalOuter.__kingmastOuterEnvelope = outerStore;

function enabled(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function envelopeHeaders(response: NextResponse, state: 'outer' | 'lockdown' | 'rejected') {
  response.headers.set('x-kingmast-security-envelope', state);
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('cache-control', 'no-store');
  return response;
}

function requestIdentity(request: NextRequest) {
  const forwarded = (
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'unknown'
  ).split(',')[0]?.trim();
  return (forwarded || 'unknown').slice(0, 96);
}

function rateLimitFor(pathname: string) {
  if (pathname === '/api/kingmast/tts') return 12;
  if (pathname === '/api/kingmast/assistant') return 20;
  if (pathname === '/api/kingmast/session') return 20;
  if (pathname.startsWith('/api/kingmast/live-navigation/')) return 10;
  return 120;
}

function pruneRateState(now: number) {
  if (outerStore.rate.size < MAX_RATE_KEYS / 2) return;
  for (const [key, value] of outerStore.rate) if (value.resetAt <= now) outerStore.rate.delete(key);
}

function rateAllowed(request: NextRequest) {
  if (request.method.toUpperCase() === 'OPTIONS') return true;
  const now = Date.now();
  pruneRateState(now);
  const pathname = request.nextUrl.pathname;
  const key = `${pathname}:${requestIdentity(request)}`;
  const limit = rateLimitFor(pathname);
  const current = outerStore.rate.get(key);
  if (!current || current.resetAt <= now) {
    if (!current && outerStore.rate.size >= MAX_RATE_KEYS) return false;
    outerStore.rate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export default function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    return envelopeHeaders(NextResponse.json({ error: 'method-not-allowed' }, { status: 405 }), 'rejected');
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    return envelopeHeaders(NextResponse.json({ error: 'request-too-large' }, { status: 413 }), 'rejected');
  }

  if (enabled('KINGMAST_EMERGENCY_LOCKDOWN')) {
    return envelopeHeaders(NextResponse.json({ error: 'kingmast-emergency-lockdown' }, { status: 503 }), 'lockdown');
  }

  if (!rateAllowed(request)) {
    const response = NextResponse.json({ error: 'outer-rate-limited' }, { status: 429 });
    response.headers.set('retry-after', '60');
    return envelopeHeaders(response, 'rejected');
  }

  return envelopeHeaders(NextResponse.next(), 'outer');
}

export const config = {
  matcher: ['/api/kingmast/:path*'],
};
