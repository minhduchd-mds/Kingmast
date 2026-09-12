export type OutboundPurpose =
  | 'navigation-google'
  | 'navigation-mapbox'
  | 'navigation-osrm'
  | 'navigation-geocoding'
  | 'assistant-provider'
  | 'tts-openai'
  | 'tts-elevenlabs'
  | 'tts-self-host';

const BUILTIN_HOSTS: Record<OutboundPurpose, readonly string[]> = {
  'navigation-google': ['routes.googleapis.com'],
  'navigation-mapbox': ['api.mapbox.com'],
  'navigation-osrm': ['router.project-osrm.org'],
  'navigation-geocoding': ['nominatim.openstreetmap.org'],
  'assistant-provider': [],
  'tts-openai': ['api.openai.com'],
  'tts-elevenlabs': ['api.elevenlabs.io'],
  'tts-self-host': [],
};

function enabled(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function normalizedHost(host: string) {
  return host.toLowerCase().replace(/^\[|\]$/g, '');
}

function loopback(host: string) {
  const value = normalizedHost(host);
  return value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

function ipv4Octets(value: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return null;
  const octets = value.split('.').map(Number);
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
}

function privateIpv4(value: string) {
  const octets = ipv4Octets(value);
  if (!octets) return false;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function privateIpLiteral(host: string) {
  const value = normalizedHost(host);
  if (privateIpv4(value)) return true;
  if (!value.includes(':') || !/^[0-9a-f:.]+$/.test(value)) return false;
  if (value.startsWith('::ffff:')) return privateIpv4(value.slice(7));
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value);
}

function customHosts() {
  return new Set(
    (process.env.KINGMAST_OUTBOUND_ALLOWLIST ?? '')
      .split(/[\s,]+/)
      .map((item) => normalizedHost(item.trim()))
      .filter((item) => /^[a-z0-9.-]+$/.test(item) && !item.includes('..')),
  );
}

function localDevAllowed(host: string) {
  return process.env.NODE_ENV !== 'production' && enabled('KINGMAST_ALLOW_INSECURE_LOCAL_DEV') && loopback(host);
}

export function approvedOutboundUrl(input: string | URL, purpose: OutboundPurpose): URL | null {
  if (enabled('KINGMAST_EMERGENCY_LOCKDOWN') || enabled('KINGMAST_OUTBOUND_KILL_SWITCH')) return null;

  let url: URL;
  try { url = input instanceof URL ? new URL(input.toString()) : new URL(input); }
  catch { return null; }

  if (url.username || url.password) return null;
  const host = normalizedHost(url.hostname);
  const isLocalDev = localDevAllowed(host);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalDev)) return null;
  if ((loopback(host) || privateIpLiteral(host)) && !isLocalDev) return null;

  const allowed = new Set([...BUILTIN_HOSTS[purpose], ...customHosts()]);
  if (!allowed.has(host) && !isLocalDev) return null;
  return url;
}

export function requireOutboundUrl(input: string | URL, purpose: OutboundPurpose): URL {
  const url = approvedOutboundUrl(input, purpose);
  if (!url) throw new Error(`outbound-denied:${purpose}`);
  return url;
}
