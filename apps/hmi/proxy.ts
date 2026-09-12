import { NextRequest, NextResponse } from 'next/server';

const MAX_API_BODY_BYTES = 1_048_576;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'POST']);

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

export default function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    return envelopeHeaders(
      NextResponse.json({ error: 'method-not-allowed' }, { status: 405 }),
      'rejected',
    );
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    return envelopeHeaders(
      NextResponse.json({ error: 'request-too-large' }, { status: 413 }),
      'rejected',
    );
  }

  if (enabled('KINGMAST_EMERGENCY_LOCKDOWN')) {
    return envelopeHeaders(
      NextResponse.json({ error: 'kingmast-emergency-lockdown' }, { status: 503 }),
      'lockdown',
    );
  }

  return envelopeHeaders(NextResponse.next(), 'outer');
}

export const config = {
  matcher: ['/api/kingmast/:path*'],
};
