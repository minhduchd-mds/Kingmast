import { NextRequest, NextResponse } from 'next/server';
import { issueNavigationCapability, securityEnvelopeHeaders, type NavigationScope } from '../../../../../lib/security-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function enabled(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function loopback(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === request.nextUrl.host; } catch { return false; }
}

function target(scope: NavigationScope) {
  return scope === 'navigation:search'
    ? { method: 'GET' as const, pathname: '/api/kingmast/live-navigation/search' }
    : { method: 'POST' as const, pathname: '/api/kingmast/live-navigation/alternatives' };
}

export async function POST(request: NextRequest) {
  if (!enabled('KINGMAST_NAV_LOOPBACK_BROKER_ENABLED')) {
    return NextResponse.json({ error: 'navigation-broker-disabled' }, { status: 403, headers: securityEnvelopeHeaders('broker-disabled') });
  }
  if (!loopback(request.nextUrl.hostname) || !sameOrigin(request)) {
    return NextResponse.json({ error: 'navigation-broker-loopback-only' }, { status: 403, headers: securityEnvelopeHeaders('broker-loopback-only') });
  }
  if (enabled('KINGMAST_EMERGENCY_LOCKDOWN') || enabled('KINGMAST_NAV_KILL_SWITCH')) {
    return NextResponse.json({ error: 'navigation-broker-lockdown' }, { status: 503, headers: securityEnvelopeHeaders('broker-lockdown') });
  }

  let body: { scope?: unknown };
  try { body = await request.json() as { scope?: unknown }; }
  catch { return NextResponse.json({ error: 'invalid-capability-request' }, { status: 400, headers: securityEnvelopeHeaders() }); }

  const scope: NavigationScope | null = body.scope === 'navigation:search' || body.scope === 'navigation:route' ? body.scope : null;
  if (!scope) return NextResponse.json({ error: 'invalid-capability-scope' }, { status: 400, headers: securityEnvelopeHeaders() });

  const destination = target(scope);
  const issued = issueNavigationCapability(scope, destination.method, destination.pathname);
  if (!issued) return NextResponse.json({ error: 'navigation-capability-unavailable' }, { status: 503, headers: securityEnvelopeHeaders('capability-unavailable') });

  return NextResponse.json({
    capability: issued.token,
    expiresAt: issued.expiresAt,
    scope,
    oneTime: true,
    broker: 'loopback-only',
  }, { headers: securityEnvelopeHeaders() });
}
