'use client';

import { Clock3, LocateFixed, MapPin, Navigation, RefreshCw, Route, Search, TriangleAlert } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { NavigationPlace, NavigationRoute, NavigationRouteOption, VehiclePosition } from '@kingmast/contracts';
import KingmastRealCockpit, { type C3Reachability, type RealViewKey } from './KingmastRealCockpit';
import NativeNavigationMap from './NativeNavigationMap';
import styles from './KingmastLiveNavigation.module.css';

type GpsState = 'prompt' | 'requesting' | 'live' | 'denied' | 'unavailable';
type Capability = {
  realGeocoding: boolean;
  realRouting: boolean;
  liveTraffic: boolean;
  trafficSource: 'google-live' | 'mapbox-live' | 'none';
  fallbackRouting: string;
};

const C3_ENDPOINT = 'http://192.168.4.1';

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

function useGps() {
  const [state, setState] = useState<GpsState>('prompt');
  const [vehicle, setVehicle] = useState<VehiclePosition | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }
    stop();
    setState('requesting');
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const measuredSpeed = position.coords.speed == null ? null : Math.max(0, position.coords.speed * 3.6);
        const measuredHeading = position.coords.heading == null ? null : position.coords.heading;
        setSpeedKmh(measuredSpeed);
        setHeadingDeg(measuredHeading);
        setVehicle({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speedKmh: measuredSpeed ?? 0,
          headingDeg: measuredHeading ?? 0,
          accuracyM: position.coords.accuracy,
          timestampMs: position.timestamp,
          source: 'device-gps',
        });
        setState('live');
      },
      () => {
        setVehicle(null);
        setSpeedKmh(null);
        setHeadingDeg(null);
        setState('denied');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    );
  }, [stop]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }
    if (!navigator.permissions) return;
    let alive = true;
    void navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (!alive) return;
      if (permission.state === 'granted') start();
      else setState(permission.state === 'denied' ? 'denied' : 'prompt');
      permission.onchange = () => {
        if (!alive) return;
        if (permission.state === 'granted') start();
        else {
          stop();
          setVehicle(null);
          setSpeedKmh(null);
          setHeadingDeg(null);
          setState(permission.state === 'denied' ? 'denied' : 'prompt');
        }
      };
    }).catch(() => {});
    return () => {
      alive = false;
      stop();
    };
  }, [start, stop]);

  return { state, vehicle, speedKmh, headingDeg, start };
}

function useC3Reachability() {
  const [state, setState] = useState<C3Reachability>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    if (window.location.protocol === 'https:') {
      setState('blocked');
      setLatencyMs(null);
      return;
    }

    let disposed = false;
    let controller: AbortController | null = null;
    const poll = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 900);
      const started = performance.now();
      try {
        const response = await fetch(`${C3_ENDPOINT}/api/telemetry`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`c3-${response.status}`);
        await response.json();
        if (disposed) return;
        setLatencyMs(Math.max(1, Math.round(performance.now() - started)));
        setState('live');
      } catch {
        if (!disposed) {
          setLatencyMs(null);
          setState('offline');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, []);

  return { state, latencyMs };
}

function duration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}`;
}

function distance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function provider(route: NavigationRoute | null) {
  if (!route) return 'Chưa có tuyến';
  if (route.traffic?.source === 'google-live') return 'Google Traffic';
  if (route.traffic?.source === 'mapbox-live') return 'Mapbox Traffic';
  return 'OSRM · tuyến thật, không traffic live';
}

function traffic(route: NavigationRoute | null) {
  if (!route) return { label: 'Chưa có dữ liệu', detail: 'Tìm điểm đến để kiểm tra.', tone: 'unknown' } as const;
  if (!route.traffic?.aware) return { label: 'Không có traffic live', detail: provider(route), tone: 'unknown' } as const;
  const delay = route.traffic.delayS;
  if (delay == null) return { label: 'Traffic live', detail: provider(route), tone: 'clear' } as const;
  const minutes = Math.max(0, Math.round(delay / 60));
  if (delay <= 60) return { label: 'Thông thoáng', detail: `${provider(route)} · +<1 phút`, tone: 'clear' } as const;
  if (delay <= 300) return { label: 'Đông nhẹ', detail: `${provider(route)} · +${minutes} phút`, tone: 'moderate' } as const;
  if (delay <= 900) return { label: 'Ùn chậm', detail: `${provider(route)} · +${minutes} phút`, tone: 'heavy' } as const;
  return { label: 'Tắc nặng', detail: `${provider(route)} · +${minutes} phút`, tone: 'severe' } as const;
}

export default function KingmastLiveNavigation() {
  const [view, setView] = useState<RealViewKey>('drive');
  const online = useOnline();
  const { state: gpsState, vehicle, speedKmh, headingDeg, start: startGps } = useGps();
  const { state: c3State, latencyMs: c3LatencyMs } = useC3Reachability();
  const vehicleRef = useRef<VehiclePosition | null>(null);
  const selectedRef = useRef(0);
  const optionsRef = useRef<NavigationRouteOption[]>([]);
  const [capability, setCapability] = useState<Capability | null>(null);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<NavigationPlace[]>([]);
  const [destination, setDestination] = useState<NavigationPlace | null>(null);
  const [options, setOptions] = useState<NavigationRouteOption[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const raw = new URLSearchParams(window.location.search).get('view');
      const allowed: RealViewKey[] = ['drive', 'navigate', 'alerts', 'camera', 'objects', 'trip', 'energy', 'vehicle', 'settings'];
      setView(allowed.includes(raw as RealViewKey) ? raw as RealViewKey : 'drive');
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const changeView = useCallback((next: RealViewKey) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'drive') url.searchParams.delete('view');
    else url.searchParams.set('view', next);
    window.history.pushState({}, '', url);
  }, []);

  useEffect(() => { vehicleRef.current = vehicle; }, [vehicle]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => {
    void fetch('/api/kingmast/live-navigation/capabilities', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value: Capability) => setCapability(value))
      .catch(() => setCapability(null));
  }, []);

  const route = options[selected]?.route ?? null;
  const trafficState = traffic(route);

  const loadRoutes = useCallback(async (place: NavigationPlace, preserve: boolean) => {
    const origin = vehicleRef.current;
    if (!origin) {
      setError('Cần GPS thật trước khi tính tuyến.');
      return;
    }
    setRouting(true);
    setError(null);
    try {
      const response = await fetch('/api/kingmast/live-navigation/alternatives', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ origin: { lat: origin.lat, lng: origin.lng }, destination: place.position }),
      });
      if (!response.ok) throw new Error('route');
      const payload = await response.json() as { routes?: NavigationRouteOption[] };
      const next = Array.isArray(payload.routes) ? payload.routes : [];
      if (!next.length) throw new Error('empty');
      let nextSelected = Math.max(0, next.findIndex((item) => item.recommended));
      if (preserve) {
        const previous = optionsRef.current[selectedRef.current]?.route;
        if (previous) {
          let best = Number.POSITIVE_INFINITY;
          next.forEach((item, index) => {
            const score = (item.route.provider === previous.provider ? 0 : 1_000_000) + Math.abs(item.route.distanceM - previous.distanceM);
            if (score < best) {
              best = score;
              nextSelected = index;
            }
          });
        }
      }
      setDestination(place);
      setOptions(next);
      setSelected(nextSelected);
      setUpdated(Date.now());
    } catch {
      setOptions([]);
      setError('Không lấy được tuyến thật. Không dùng dữ liệu mô phỏng thay thế.');
    } finally {
      setRouting(false);
    }
  }, []);

  const search = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const origin = vehicleRef.current;
    const value = query.trim();
    if (!origin || value.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/kingmast/live-navigation/search?q=${encodeURIComponent(value)}&lat=${origin.lat}&lng=${origin.lng}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('search');
      const payload = await response.json() as { places?: NavigationPlace[] };
      setPlaces(Array.isArray(payload.places) ? payload.places : []);
    } catch {
      setPlaces([]);
      setError('Không tìm được địa điểm từ nguồn thật.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const choose = (place: NavigationPlace) => {
    setQuery(place.name);
    setPlaces([]);
    void loadRoutes(place, false);
  };
  const refresh = useCallback(() => {
    if (destination) void loadRoutes(destination, true);
  }, [destination, loadRoutes]);

  useEffect(() => {
    if (!destination) return;
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [destination, refresh]);

  const mapSlot = (
    <section className={styles.mapSlot} aria-label="Bản đồ thật KINGMAST">
      {vehicle ? <>
        <NativeNavigationMap vehicle={vehicle} objects={[]} cameras={[]} route={route} headingUp compact />
        <div className={styles.liveChip}><i />GPS THẬT</div>
        <div className={`${styles.trafficChip} ${styles[`tone_${trafficState.tone}`]}`}><strong>{trafficState.label}</strong><small>{trafficState.detail}</small></div>
        {destination ? <div className={styles.destChip}><MapPin size={13} />{destination.name}</div> : null}
      </> : <div className={styles.gpsGate}>
        <LocateFixed size={27} />
        <strong>Cần vị trí thật</strong>
        <span>Không sử dụng tọa độ demo cho bản đồ hoặc giao thông.</span>
        <button type="button" onClick={startGps} disabled={gpsState === 'requesting'}>{gpsState === 'requesting' ? 'Đang lấy GPS…' : 'Cho phép vị trí'}</button>
      </div>}
    </section>
  );

  const navigationSlot = (
    <section className={styles.navWorkspace} aria-label="Dẫn đường thật KINGMAST">
      <header>
        <div><b>LIVE NAVIGATION</b><h2>Dẫn đường & giao thông</h2><p>GPS thật · địa điểm thật · tuyến thật. Traffic chỉ được gắn nhãn LIVE khi nhà cung cấp traffic thực sự phản hồi.</p></div>
        <span className={vehicle ? styles.gpsLive : styles.gpsOff}><LocateFixed size={17} />{vehicle ? `GPS ±${Math.round(vehicle.accuracyM)} m` : 'Chưa có GPS'}</span>
      </header>

      <form className={styles.search} onSubmit={search}>
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập điểm đến…" disabled={!vehicle || searching} />
        <button disabled={!vehicle || searching || query.trim().length < 2}>{searching ? 'Đang tìm' : 'Tìm đường'}</button>
      </form>
      {places.length ? <div className={styles.results}>{places.map((place) => <button type="button" key={place.id} onClick={() => choose(place)}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.subtitle ?? 'Địa điểm'}</small></span></button>)}</div> : null}
      {error ? <div className={styles.error}><TriangleAlert size={17} />{error}</div> : null}

      <div className={styles.summary}>
        <div className={`${styles.trafficStatus} ${styles[`tone_${trafficState.tone}`]}`}><i /><span><strong>{trafficState.label}</strong><small>{trafficState.detail}</small></span></div>
        <div><Route size={17} /><span><small>Quãng đường</small><strong>{route ? distance(route.distanceM) : '--'}</strong></span></div>
        <div><Clock3 size={17} /><span><small>Thời gian</small><strong>{route ? duration(route.durationS) : '--'}</strong></span></div>
        <button type="button" onClick={refresh} disabled={!destination || routing}><RefreshCw size={15} className={routing ? styles.spin : ''} />{routing ? 'Đang cập nhật' : 'Cập nhật traffic'}</button>
      </div>

      <div className={styles.routesHead}>
        <span><strong>Tuyến thay thế</strong><small>{updated ? `Cập nhật ${new Date(updated).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa tính tuyến'}</small></span>
        <b className={capability?.liveTraffic ? styles.liveProvider : styles.noProvider}>{capability?.liveTraffic ? `LIVE · ${capability.trafficSource}` : 'REAL ROUTE · NO LIVE TRAFFIC'}</b>
      </div>
      <div className={styles.routes}>{options.length ? options.map((option, index) => {
        const info = traffic(option.route);
        return <button type="button" key={option.id} className={index === selected ? styles.routeActive : ''} onClick={() => setSelected(index)}><i className={`${styles.routeStripe} ${styles[`tone_${info.tone}`]}`} /><span><strong>{option.recommended ? 'Khuyến nghị' : `Tuyến ${index + 1}`}</strong><small>{provider(option.route)}</small></span><span><strong>{duration(option.route.durationS)}</strong><small>{distance(option.route.distanceM)}</small></span><em className={styles[`tone_${info.tone}`]}>{info.label}</em></button>;
      }) : <div className={styles.empty}><Navigation size={28} /><strong>Chưa có tuyến</strong><span>Cho phép GPS và tìm điểm đến để bắt đầu.</span></div>}</div>

      {!capability?.liveTraffic ? <div className={styles.providerWarning}><TriangleAlert size={17} /><span><strong>Chưa có nhà cung cấp traffic live</strong><small>Định tuyến vẫn dùng đường thật qua OSRM. KINGMAST không suy diễn tình trạng ùn tắc. Khi cấu hình Google Routes hoặc Mapbox Traffic ở server, nhãn LIVE mới được bật.</small></span></div> : null}
    </section>
  );

  return (
    <div className={styles.root}>
      <KingmastRealCockpit
        view={view}
        onViewChange={changeView}
        gpsState={gpsState}
        latitude={vehicle?.lat ?? null}
        longitude={vehicle?.lng ?? null}
        gpsAccuracyM={vehicle?.accuracyM ?? null}
        gpsSpeedKmh={speedKmh}
        headingDeg={headingDeg}
        online={online}
        trafficLive={Boolean(capability?.liveTraffic)}
        trafficSource={capability?.trafficSource ?? 'none'}
        routeProvider={route ? provider(route) : null}
        routeDistanceLabel={route ? distance(route.distanceM) : null}
        routeDurationLabel={route ? duration(route.durationS) : null}
        destinationName={destination?.name ?? null}
        c3State={c3State}
        c3LatencyMs={c3LatencyMs}
        mapSlot={mapSlot}
        navigationSlot={navigationSlot}
      />
    </div>
  );
}
