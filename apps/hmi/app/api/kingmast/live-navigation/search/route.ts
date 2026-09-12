import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Place = {
  id: string;
  name: string;
  subtitle: string | null;
  position: { lat: number; lng: number };
  source: 'geocoder';
};

type NominatimItem = {
  place_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
};

function finiteCoordinate(value: string | null, min: number, max: number) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ error: 'invalid-query' }, { status: 400 });
  }

  const lat = finiteCoordinate(request.nextUrl.searchParams.get('lat'), -90, 90);
  const lng = finiteCoordinate(request.nextUrl.searchParams.get('lng'), -180, 180);
  const base = (process.env.GEOCODING_BASE_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  const url = new URL(`${base}/search`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '6');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('accept-language', 'vi,en');

  if (lat !== null && lng !== null) {
    const delta = 0.28;
    url.searchParams.set('viewbox', `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`);
    url.searchParams.set('bounded', '0');
  }

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'user-agent': 'KINGMAST-live-navigation/0.0.8 (+https://hmi-sooty.vercel.app)',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`geocoding-${response.status}`);
    const raw = (await response.json()) as NominatimItem[];
    const places: Place[] = (Array.isArray(raw) ? raw : []).slice(0, 6).flatMap((item, index) => {
      const placeLat = Number(item.lat);
      const placeLng = Number(item.lon);
      if (!Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return [];
      const display = (item.display_name ?? '').trim();
      const name = (item.name ?? display.split(',')[0] ?? 'Điểm đến').trim() || 'Điểm đến';
      return [{
        id: String(item.place_id ?? `${placeLat}:${placeLng}:${index}`),
        name,
        subtitle: display && display !== name ? display : null,
        position: { lat: placeLat, lng: placeLng },
        source: 'geocoder' as const,
      }];
    });
    return NextResponse.json({ places, source: 'nominatim' }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'geocoding-provider-unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
