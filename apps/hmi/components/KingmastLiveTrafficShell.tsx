'use client';

import { Clock3, LocateFixed, MapPin, Navigation, RefreshCw, Route, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigationPlace, NavigationRoute, NavigationRouteOption, VehiclePosition } from '@kingmast/contracts';
import KingmastCockpitUltra from './KingmastCockpitUltra';
import NativeNavigationMap from './NativeNavigationMap';
import styles from './KingmastLiveTrafficShell.module.css';

type GpsState = 'checking' | 'prompt' | 'requesting' | 'live' | 'denied' | 'unavailable';
type ViewKey = 'drive' | 'navigate' | 'alerts' | 'camera' | 'objects' | 'trip' | 'energy' | 'vehicle' | 'settings';

type TrafficInfo = {
  label: string;
  detail: string;
  tone: 'clear' | 'moderate' | 'heavy' | 'severe' | 'unknown';
  live: boolean;
};

function apiBase() {
  const explicit = process.env.NEXT_PUBLIC_KINGMAST_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) return 'http://localhost:4000';
  return null;
}

function providerLabel(route: NavigationRoute) {
  if (route.traffic?.source === 'google-live') return 'Google live traffic';
  if (route.traffic?.source === 'mapbox-live') return 'Mapbox live traffic';
  if (route.provider === 'osrm') return 'OSRM · không có traffic live';
  return route.provider;
}

function trafficInfo(route: NavigationRoute | null): TrafficInfo {
  if (!route) return { label: 'Chưa có tuyến', detail: 'Chọn điểm đến để kiểm tra giao thông thật.', tone: 'unknown', live: false };
  if (!route.traffic?.aware) return { label: 'Không có traffic live', detail: 'Tuyến thật nhưng nhà cung cấp hiện tại không có dữ liệu ùn tắc trực tiếp.', tone: 'unknown', live: false };
  const delay = route.traffic.delayS;
  if (delay === null) return { label: 'Traffic live', detail: providerLabel(route), tone: 'clear', live: true };
  const minutes = Math.max(0, Math.round(delay / 60));
  if (delay <= 60) return { label: 'Thông thoáng', detail: `${providerLabel(route)} · chậm dưới 1 phút`, tone: 'clear', live: true };
  if (delay <= 300) return { label: 'Đông nhẹ', detail: `${providerLabel(route)} · chậm khoảng ${minutes} phút`, tone: 'moderate', live: true };
  if (delay <= 900) return { label: 'Ùn chậm', detail: `${providerLabel(route)} · chậm khoảng ${minutes} phút`, tone: 'heavy', live: true };
  return { label: 'Tắc nặng', detail: `${providerLabel(route)} · chậm khoảng ${minutes} phút`, tone: 'severe', live: true };
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function useObservedCockpitView() {
  const [view, setView] = useState<ViewKey>('drive');
  useEffect(() => {
    const node = document.querySelector<HTMLElement>('[data-testid="kingmast-cockpit-ultra"]');
    if (!node) return;
    const sync = () => setView((node.dataset.view as ViewKey | undefined) ?? 'drive');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, { attributes: true, attributeFilter: ['data-view'] });
    return () => observer.disconnect();
  }, []);
  return view;
}

function useRealGps() {
  const [state, setState] = useState<GpsState>('checking');
  const [vehicle, setVehicle] = useState<VehiclePosition | null>(null);
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
        setVehicle({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speedKmh: position.coords.speed === null ? 0 : Math.max(0, position.coords.speed * 3.6),
          headingDeg: position.coords.heading ?? 0,
          accuracyM: position.coords.accuracy,
          timestampMs: position.timestamp,
          source: 'device-gps',
        });
        setState('live');
      },
      () => {
        setVehicle(null);
        setState('denied');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12_000 },
    );
  }, [stop]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState('unavailable');
      return;
    }
    if (!navigator.permissions) {
      setState('prompt');
      return;
    }
    let active = true;
    void navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (!active) return;
      if (permission.state === 'granted') start();
      else setState(permission.state === 'denied' ? 'denied' : 'prompt');
      permission.onchange = () => {
        if (!active) return;
        if (permission.state === 'granted') start();
        else {
          stop();
          setVehicle(null);
          setState(permission.state === 'denied' ? 'denied' : 'prompt');
        }
      };
    }).catch(() => setState('prompt'));
    return () => {
      active = false;
      stop();
    };
  }, [start, stop]);

  return { state, vehicle, start };
}

function LiveTrafficOverlay() {
  const view = useObservedCockpitView();
  const { state: gpsState, vehicle, start: requestGps } = useRealGps();
  const base = useMemo(() => apiBase(), []);
  const vehicleRef = useRef<VehiclePosition | null>(null);
  const optionsRef = useRef<NavigationRouteOption[]>([]);
  const selectedIndexRef = useRef(0);
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<NavigationPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [routing, setRouting] = useState(false);
  const [destination, setDestination] = useState<NavigationPlace | null>(null);
  const [options, setOptions] = useState<NavigationRouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => { vehicleRef.current = vehicle; }, [vehicle]);
  useEffect(() => { optionsRef.current = options; }, [options]);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);

  const selectedOption = options[selectedIndex] ?? null;
  const route = selectedOption?.route ?? null;
  const traffic = trafficInfo(route);

  const loadRoutes = useCallback(async (place: NavigationPlace, preserveSelection: boolean) => {
    const origin = vehicleRef.current;
    if (!origin) {
      setError('Cần vị trí GPS thật trước khi tính tuyến.');
      return;
    }
    if (!base) {
      setError('Dịch vụ định tuyến KINGMAST chưa được cấu hình trên môi trường production.');
      return;
    }
    setRouting(true);
    setError(null);
    try {
      const response = await fetch(`${base}/v5/navigation/alternatives`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ origin: { lat: origin.lat, lng: origin.lng }, destination: place.position }),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`navigation-${response.status}`);
      const payload = await response.json() as { routes?: NavigationRouteOption[] };
      const next = Array.isArray(payload.routes) ? payload.routes : [];
      if (!next.length) throw new Error('navigation-empty');
      let nextIndex = next.findIndex((item) => item.recommended);
      if (nextIndex < 0) nextIndex = 0;
      if (preserveSelection) {
        const previous = optionsRef.current[selectedIndexRef.current]?.route;
        if (previous) {
          let bestIndex = -1;
          let bestScore = Number.POSITIVE_INFINITY;
          next.forEach((item, index) => {
            const providerPenalty = item.route.provider === previous.provider ? 0 : 1_000_000;
            const distancePenalty = Math.abs(item.route.distanceM - previous.distanceM);
            const score = providerPenalty + distancePenalty;
            if (score < bestScore) { bestScore = score; bestIndex = index; }
          });
          if (bestIndex >= 0) nextIndex = bestIndex;
        }
      }
      setDestination(place);
      setOptions(next);
      setSelectedIndex(nextIndex);
      setUpdatedAt(Date.now());
    } catch {
      setError('Không lấy được tuyến thật. KINGMAST không thay bằng dữ liệu mô phỏng.');
      setOptions([]);
      setUpdatedAt(null);
    } finally {
      setRouting(false);
    }
  }, [base]);

  const searchPlaces = useCallback(async (event?: FormEvent) => {
    event?.preventDefault();
    const origin = vehicleRef.current;
    const value = query.trim();
    if (!origin || value.length < 2) return;
    if (!base) {
      setError('Dịch vụ tìm kiếm địa điểm chưa được cấu hình trên production.');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const url = `${base}/v4/navigation/search?q=${encodeURIComponent(value)}&lat=${encodeURIComponent(origin.lat)}&lng=${encodeURIComponent(origin.lng)}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`search-${response.status}`);
      const payload = await response.json() as { places?: NavigationPlace[] };
      setPlaces(Array.isArray(payload.places) ? payload.places : []);
    } catch {
      setPlaces([]);
      setError('Không tìm được địa điểm từ dịch vụ thật.');
    } finally {
      setSearching(false);
    }
  }, [base, query]);

  const choosePlace = useCallback((place: NavigationPlace) => {
    setQuery(place.name);
    setPlaces([]);
    void loadRoutes(place, false);
  }, [loadRoutes]);

  const refreshTraffic = useCallback(() => {
    if (destination) void loadRoutes(destination, true);
  }, [destination, loadRoutes]);

  useEffect(() => {
    if (!destination) return;
    const timer = window.setInterval(() => void loadRoutes(destination, true), 60_000);
    return () => window.clearInterval(timer);
  }, [destination, loadRoutes]);

  return (
    <>
      <section className={styles.compactMap} aria-label="Bản đồ giao thông trực tiếp">
        {vehicle ? (
          <>
            <NativeNavigationMap vehicle={vehicle} objects={[]} cameras={[]} route={route} headingUp compact />
            <div className={styles.liveBadge}><i />GPS THẬT</div>
            <div className={`${styles.trafficPill} ${styles[`tone_${traffic.tone}`]}`}>
              <strong>{traffic.label}</strong><small>{traffic.detail}</small>
            </div>
            {destination ? <div className={styles.destinationBadge}><MapPin size={14} /><span>{destination.name}</span></div> : null}
          </>
        ) : (
          <div className={styles.locationGate}>
            <LocateFixed size={28} />
            <strong>Cần vị trí thật</strong>
            <span>KINGMAST sẽ không dùng tọa độ mô phỏng cho giao thông.</span>
            {gpsState === 'requesting' ? <b>Đang lấy GPS…</b> : <button type="button" onClick={requestGps}>Cho phép vị trí</button>}
          </div>
        )}
      </section>

      {view === 'navigate' ? (
        <section className={styles.navigationWorkspace} aria-label="Dẫn đường và giao thông trực tiếp">
          <header className={styles.navHeader}>
            <div><span className={styles.navEyebrow}>LIVE NAVIGATION</span><h2>Dẫn đường & giao thông</h2><p>Chỉ hiển thị vị trí, tuyến và traffic lấy từ nguồn thật. Không fallback sang dữ liệu demo.</p></div>
            <div className={styles.gpsSummary}><LocateFixed size={18} /><span><strong>{vehicle ? 'GPS đang hoạt động' : 'Chưa có GPS'}</strong><small>{vehicle ? `±${Math.round(vehicle.accuracyM)} m` : 'Cho phép vị trí để bắt đầu'}</small></span></div>
          </header>

          <form className={styles.searchBar} onSubmit={searchPlaces}>
            <Search size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập điểm đến thật…" disabled={!vehicle || searching} />
            <button type="submit" disabled={!vehicle || searching || query.trim().length < 2}>{searching ? 'Đang tìm…' : 'Tìm đường'}</button>
          </form>

          {places.length ? <div className={styles.placeResults}>{places.map((place) => <button type="button" key={place.id} onClick={() => choosePlace(place)}><MapPin size={17} /><span><strong>{place.name}</strong><small>{place.subtitle ?? 'Địa điểm'}</small></span></button>)}</div> : null}

          {error ? <div className={styles.errorBanner}><TriangleAlert size={18} /><span>{error}</span></div> : null}

          <div className={styles.trafficSummary}>
            <div className={`${styles.trafficStatus} ${styles[`tone_${traffic.tone}`]}`}><span className={styles.trafficDot} /><span><strong>{traffic.label}</strong><small>{traffic.detail}</small></span></div>
            <div className={styles.summaryMetric}><Route size={17} /><span><small>Quãng đường</small><strong>{route ? formatDistance(route.distanceM) : '--'}</strong></span></div>
            <div className={styles.summaryMetric}><Clock3 size={17} /><span><small>Thời gian</small><strong>{route ? formatDuration(route.durationS) : '--'}</strong></span></div>
            <button type="button" className={styles.refreshButton} disabled={!destination || routing} onClick={refreshTraffic}><RefreshCw size={16} className={routing ? styles.spinning : ''} />{routing ? 'Đang cập nhật' : 'Làm mới traffic'}</button>
          </div>

          <div className={styles.routeSection}>
            <div className={styles.sectionHeading}><span><strong>Các tuyến khả dụng</strong><small>{updatedAt ? `Cập nhật ${new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Chưa có dữ liệu tuyến'}</small></span>{traffic.live ? <b className={styles.liveTrafficTag}><ShieldCheck size={14} />TRAFFIC LIVE</b> : null}</div>
            <div className={styles.routeCards}>
              {options.length ? options.map((option, index) => {
                const info = trafficInfo(option.route);
                const active = index === selectedIndex;
                return <button type="button" key={option.id} className={`${styles.routeCard} ${active ? styles.routeActive : ''}`} onClick={() => setSelectedIndex(index)}>
                  <span className={`${styles.routeTone} ${styles[`tone_${info.tone}`]}`} />
                  <span className={styles.routeMain}><strong>{option.recommended ? 'Khuyến nghị' : `Tuyến ${index + 1}`}</strong><small>{providerLabel(option.route)}</small></span>
                  <span className={styles.routeMetric}><strong>{formatDuration(option.route.durationS)}</strong><small>{formatDistance(option.route.distanceM)}</small></span>
                  <span className={`${styles.routeTraffic} ${styles[`tone_${info.tone}`]}`}><strong>{info.label}</strong><small>{option.route.traffic?.delayS !== null && option.route.traffic?.delayS !== undefined ? `+${Math.max(0, Math.round(option.route.traffic.delayS / 60))} phút` : info.live ? 'live' : 'no live data'}</small></span>
                </button>;
              }) : <div className={styles.emptyRoutes}><Navigation size={28} /><strong>Chưa có tuyến</strong><span>Cho phép GPS và tìm điểm đến để kiểm tra giao thông thật.</span></div>}
            </div>
          </div>

          {!base ? <div className={styles.providerNotice}><TriangleAlert size={18} /><span><strong>Backend production chưa cấu hình</strong><small>Cần NEXT_PUBLIC_KINGMAST_API_URL trỏ tới risk-engine đang chạy để dùng tìm kiếm và traffic thật.</small></span></div> : null}
        </section>
      ) : null}
    </>
  );
}

export default function KingmastLiveTrafficShell() {
  return (
    <div className={styles.shell}>
      <KingmastCockpitUltra />
      <LiveTrafficOverlay />
    </div>
  );
}
