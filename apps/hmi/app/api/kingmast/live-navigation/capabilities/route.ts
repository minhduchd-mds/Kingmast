import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const google = Boolean(process.env.GOOGLE_ROUTES_API_KEY?.trim());
  const mapbox = Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
  const configured = (process.env.KINGMAST_TRAFFIC_ROUTING_PROVIDER ?? 'auto').trim().toLowerCase();
  const selected = configured === 'google' && google ? 'google-live'
    : configured === 'mapbox' && mapbox ? 'mapbox-live'
      : configured === 'osrm' ? 'none'
        : google ? 'google-live'
          : mapbox ? 'mapbox-live'
            : 'none';

  return NextResponse.json({
    realGeocoding: true,
    realRouting: true,
    liveTraffic: selected !== 'none',
    trafficSource: selected,
    fallbackRouting: 'osrm',
  }, { headers: { 'cache-control': 'no-store' } });
}
