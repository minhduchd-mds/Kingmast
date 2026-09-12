import { NextRequest, NextResponse } from 'next/server';
import type { GeoPoint, NavigationRoute, NavigationRouteOption, NavigationStep } from '@kingmast/contracts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Backend = 'google' | 'mapbox' | 'osrm';

type OsrmStep = { distance?: number; duration?: number; name?: string; maneuver?: { type?: string; modifier?: string; location?: [number, number] } };
type OsrmRoute = { distance?: number; duration?: number; geometry?: { coordinates?: Array<[number, number]> }; legs?: Array<{ steps?: OsrmStep[] }> };
type OsrmResponse = { code?: string; routes?: OsrmRoute[] };
type MapboxStep = { distance?: number; duration?: number; name?: string; maneuver?: { instruction?: string; location?: [number, number] } };
type MapboxRoute = { distance?: number; duration?: number; duration_typical?: number; geometry?: { coordinates?: Array<[number, number]> }; legs?: Array<{ steps?: MapboxStep[] }> };
type MapboxResponse = { code?: string; routes?: MapboxRoute[] };
type GoogleStep = { distanceMeters?: number; staticDuration?: string; startLocation?: { latLng?: { latitude?: number; longitude?: number } }; navigationInstruction?: { instructions?: string } };
type GoogleRoute = { distanceMeters?: number; duration?: string; staticDuration?: string; polyline?: { geoJsonLinestring?: { coordinates?: unknown } }; legs?: Array<{ steps?: GoogleStep[] }> };
type GoogleResponse = { routes?: GoogleRoute[] };

function point(value: unknown): GeoPoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function durationSeconds(value: unknown) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?s$/.test(value)) return 0;
  const parsed = Number(value.slice(0, -1));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function geometry(value: unknown): GeoPoint[] {
  if (!Array.isArray(value)) return [];
  const points: GeoPoint[] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const lng = Number(item[0]);
    const lat = Number(item[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) points.push({ lat, lng });
  }
  if (points.length <= 900) return points;
  const stride = Math.ceil(points.length / 900);
  const compacted = points.filter((_, index) => index % stride === 0);
  const last = points[points.length - 1];
  if (compacted[compacted.length - 1] !== last) compacted.push(last);
  return compacted;
}

function fallbackStep(origin: GeoPoint, distanceM: number, durationS: number): NavigationStep {
  return { instruction: 'Theo tuyến được đánh dấu', distanceM, durationS, location: origin, roadName: null };
}

function osrmInstruction(step: OsrmStep) {
  const type = (step.maneuver?.type ?? 'continue').replace(/_/g, ' ');
  const modifier = step.maneuver?.modifier?.replace(/_/g, ' ');
  const road = step.name?.trim();
  return `${type}${modifier ? ` ${modifier}` : ''}${road ? ` onto ${road}` : ''}`.replace(/^./, (letter) => letter.toUpperCase());
}

function fromOsrm(raw: OsrmRoute, origin: GeoPoint, destination: GeoPoint): NavigationRoute {
  const distanceM = Math.max(0, raw.distance ?? 0);
  const durationS = Math.max(0, raw.duration ?? 0);
  const routeGeometry = geometry(raw.geometry?.coordinates);
  const steps: NavigationStep[] = (raw.legs ?? []).flatMap((leg) => leg.steps ?? []).slice(0, 120).map((step) => {
    const location = step.maneuver?.location ?? [origin.lng, origin.lat];
    return {
      instruction: osrmInstruction(step),
      distanceM: Math.max(0, step.distance ?? 0),
      durationS: Math.max(0, step.duration ?? 0),
      location: { lng: location[0], lat: location[1] },
      roadName: step.name?.trim() || null,
    };
  });
  return {
    provider: 'osrm', origin, destination, distanceM, durationS,
    geometry: routeGeometry.length >= 2 ? routeGeometry : [origin, destination],
    steps: steps.length ? steps : [fallbackStep(origin, distanceM, durationS)],
    fetchedAtMs: Date.now(),
    traffic: { aware: false, source: 'none', delayS: null, observedAtMs: null },
  };
}

function fromMapbox(raw: MapboxRoute, origin: GeoPoint, destination: GeoPoint): NavigationRoute {
  const distanceM = Math.max(0, raw.distance ?? 0);
  const durationS = Math.max(0, raw.duration ?? 0);
  const typical = Math.max(0, raw.duration_typical ?? 0);
  const routeGeometry = geometry(raw.geometry?.coordinates);
  const steps: NavigationStep[] = (raw.legs ?? []).flatMap((leg) => leg.steps ?? []).slice(0, 120).map((step) => {
    const location = step.maneuver?.location ?? [origin.lng, origin.lat];
    return {
      instruction: (step.maneuver?.instruction ?? 'Tiếp tục').trim().slice(0, 500),
      distanceM: Math.max(0, step.distance ?? 0),
      durationS: Math.max(0, step.duration ?? 0),
      location: { lng: location[0], lat: location[1] },
      roadName: step.name?.trim() || null,
    };
  });
  return {
    provider: 'mapbox', origin, destination, distanceM, durationS,
    geometry: routeGeometry.length >= 2 ? routeGeometry : [origin, destination],
    steps: steps.length ? steps : [fallbackStep(origin, distanceM, durationS)],
    fetchedAtMs: Date.now(),
    traffic: { aware: true, source: 'mapbox-live', delayS: typical > 0 ? Math.max(0, durationS - typical) : null, observedAtMs: Date.now() },
  };
}

function fromGoogle(raw: GoogleRoute, origin: GeoPoint, destination: GeoPoint): NavigationRoute {
  const distanceM = Math.max(0, raw.distanceMeters ?? 0);
  const durationS = durationSeconds(raw.duration);
  const staticDuration = durationSeconds(raw.staticDuration);
  const routeGeometry = geometry(raw.polyline?.geoJsonLinestring?.coordinates);
  const steps: NavigationStep[] = (raw.legs ?? []).flatMap((leg) => leg.steps ?? []).slice(0, 120).map((step) => {
    const lat = step.startLocation?.latLng?.latitude;
    const lng = step.startLocation?.latLng?.longitude;
    return {
      instruction: (step.navigationInstruction?.instructions ?? 'Tiếp tục').trim().slice(0, 500),
      distanceM: Math.max(0, step.distanceMeters ?? 0),
      durationS: durationSeconds(step.staticDuration),
      location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat!, lng: lng! } : origin,
      roadName: null,
    };
  });
  return {
    provider: 'google-routes', origin, destination, distanceM, durationS,
    geometry: routeGeometry.length >= 2 ? routeGeometry : [origin, destination],
    steps: steps.length ? steps : [fallbackStep(origin, distanceM, durationS)],
    fetchedAtMs: Date.now(),
    traffic: { aware: true, source: 'google-live', delayS: staticDuration > 0 ? Math.max(0, durationS - staticDuration) : null, observedAtMs: Date.now() },
  };
}

function backendOrder(): Backend[] {
  const configured = (process.env.KINGMAST_TRAFFIC_ROUTING_PROVIDER?.trim() || 'auto').toLowerCase();
  const google = Boolean(process.env.GOOGLE_ROUTES_API_KEY?.trim());
  const mapbox = Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
  if (configured === 'google') return google ? ['google', 'osrm'] : ['osrm'];
  if (configured === 'mapbox') return mapbox ? ['mapbox', 'osrm'] : ['osrm'];
  if (configured === 'osrm') return ['osrm'];
  return [...(google ? ['google' as const] : []), ...(mapbox ? ['mapbox' as const] : []), 'osrm'];
}

async function requestGoogle(origin: GeoPoint, destination: GeoPoint) {
  const key = process.env.GOOGLE_ROUTES_API_KEY?.trim();
  if (!key) throw new Error('google-not-configured');
  const base = (process.env.GOOGLE_ROUTES_BASE_URL?.trim() || 'https://routes.googleapis.com').replace(/\/$/, '');
  const response = await fetch(`${base}/directions/v2:computeRoutes`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(6500),
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': key,
      'x-goog-fieldmask': 'routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.geoJsonLinestring,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.startLocation,routes.legs.steps.navigationInstruction.instructions',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE_OPTIMAL', computeAlternativeRoutes: true,
      polylineQuality: 'OVERVIEW', polylineEncoding: 'GEO_JSON_LINESTRING', languageCode: 'vi',
    }),
  });
  if (!response.ok) throw new Error(`google-${response.status}`);
  const raw = (await response.json()) as GoogleResponse;
  if (!raw.routes?.length) throw new Error('google-empty');
  return raw.routes.slice(0, 3).map((route) => fromGoogle(route, origin, destination));
}

async function requestMapbox(origin: GeoPoint, destination: GeoPoint) {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('mapbox-not-configured');
  const base = (process.env.MAPBOX_DIRECTIONS_BASE_URL?.trim() || 'https://api.mapbox.com').replace(/\/$/, '');
  const url = new URL(`${base}/directions/v5/mapbox/driving-traffic/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('language', 'vi');
  url.searchParams.set('annotations', 'congestion_numeric,closure');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6500), headers: { 'user-agent': 'KINGMAST-live-navigation/0.0.8' } });
  if (!response.ok) throw new Error(`mapbox-${response.status}`);
  const raw = (await response.json()) as MapboxResponse;
  if (raw.code !== 'Ok' || !raw.routes?.length) throw new Error('mapbox-empty');
  return raw.routes.slice(0, 3).map((route) => fromMapbox(route, origin, destination));
}

async function requestOsrm(origin: GeoPoint, destination: GeoPoint) {
  const base = (process.env.ROUTING_BASE_URL?.trim() || 'https://router.project-osrm.org').replace(/\/$/, '');
  const url = `${base}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6500), headers: { 'user-agent': 'KINGMAST-live-navigation/0.0.8' } });
  if (!response.ok) throw new Error(`osrm-${response.status}`);
  const raw = (await response.json()) as OsrmResponse;
  if (raw.code !== 'Ok' || !raw.routes?.length) throw new Error('osrm-empty');
  return raw.routes.slice(0, 3).map((route) => fromOsrm(route, origin, destination));
}

async function routes(origin: GeoPoint, destination: GeoPoint) {
  let lastError: unknown = null;
  for (const backend of backendOrder()) {
    try {
      if (backend === 'google') return await requestGoogle(origin, destination);
      if (backend === 'mapbox') return await requestMapbox(origin, destination);
      return await requestOsrm(origin, destination);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('route-unavailable');
}

function toOptions(items: NavigationRoute[]): NavigationRouteOption[] {
  const ranked = [...items].sort((a, b) => a.durationS - b.durationS);
  return ranked.map((route, index) => {
    const energyKwh = Math.max(0, route.distanceM) * 165 / 1_000_000;
    return {
      id: `route-${route.provider}-${index}-${Math.round(route.distanceM)}-${Math.round(route.durationS)}`,
      label: index === 0 ? (route.traffic?.aware ? 'Khuyến nghị · traffic live' : 'Khuyến nghị · tuyến thật') : `Tuyến ${index + 1}`,
      route,
      estimatedEnergyKwh: energyKwh,
      estimatedArrivalBatteryPct: 0,
      reserveMarginPct: 0,
      recommended: index === 0,
      score: route.durationS,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { origin?: unknown; destination?: unknown };
    const origin = point(body.origin);
    const destination = point(body.destination);
    if (!origin || !destination) return NextResponse.json({ error: 'invalid-route-request' }, { status: 400 });
    const result = toOptions(await routes(origin, destination));
    return NextResponse.json({
      routes: result,
      trafficAvailable: Boolean(result.some((item) => item.route.traffic?.aware)),
      trafficSource: result.find((item) => item.route.traffic?.aware)?.route.traffic?.source ?? 'none',
    }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'navigation-provider-unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
