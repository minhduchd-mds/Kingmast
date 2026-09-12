'use client';

import {
  BatteryCharging,
  Bell,
  Camera,
  CarFront,
  Gauge,
  LocateFixed,
  MapPinned,
  Moon,
  Navigation,
  Radio,
  Route,
  Settings,
  ShieldCheck,
  Signal,
  Sparkles,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './KingmastRealCockpit.module.css';

export type RealViewKey = 'drive' | 'navigate' | 'alerts' | 'camera' | 'objects' | 'trip' | 'energy' | 'vehicle' | 'settings';
export type C3Reachability = 'checking' | 'live' | 'offline' | 'blocked';

export type RealCockpitProps = {
  view: RealViewKey;
  onViewChange: (view: RealViewKey) => void;
  gpsState: 'prompt' | 'requesting' | 'live' | 'denied' | 'unavailable';
  latitude: number | null;
  longitude: number | null;
  gpsAccuracyM: number | null;
  gpsSpeedKmh: number | null;
  headingDeg: number | null;
  online: boolean;
  trafficLive: boolean;
  trafficSource: string;
  routeProvider: string | null;
  routeDistanceLabel: string | null;
  routeDurationLabel: string | null;
  destinationName: string | null;
  c3State: C3Reachability;
  c3LatencyMs: number | null;
  mapSlot?: ReactNode;
  navigationSlot?: ReactNode;
};

const NAV_ITEMS: Array<{ key: RealViewKey; label: string; icon: typeof CarFront }> = [
  { key: 'drive', label: 'Lái xe', icon: CarFront },
  { key: 'navigate', label: 'Dẫn đường', icon: Navigation },
  { key: 'alerts', label: 'Cảnh báo', icon: Bell },
  { key: 'camera', label: 'Camera', icon: Camera },
  { key: 'objects', label: 'Vật thể', icon: Radio },
  { key: 'trip', label: 'Hành trình', icon: Route },
  { key: 'energy', label: 'Năng lượng', icon: BatteryCharging },
  { key: 'vehicle', label: 'Hệ thống xe', icon: Gauge },
  { key: 'settings', label: 'Cài đặt', icon: Settings },
];

function StatusDot({ good, pending = false }: { good: boolean; pending?: boolean }) {
  return <i className={pending ? styles.dotPending : good ? styles.dotGood : styles.dotBad} />;
}

function gpsLabel(state: RealCockpitProps['gpsState']) {
  if (state === 'live') return 'LIVE';
  if (state === 'requesting') return 'ĐANG LẤY';
  if (state === 'denied') return 'BỊ TỪ CHỐI';
  if (state === 'unavailable') return 'KHÔNG HỖ TRỢ';
  return 'CHƯA CẤP QUYỀN';
}

function c3Label(state: C3Reachability) {
  if (state === 'live') return 'LIVE';
  if (state === 'checking') return 'ĐANG KIỂM TRA';
  if (state === 'blocked') return 'BỊ CHẶN HTTPS';
  return 'OFFLINE';
}

function UnsupportedWorkspace({ view }: { view: RealViewKey }) {
  const copy: Record<Exclude<RealViewKey, 'drive' | 'navigate' | 'vehicle' | 'settings'>, { title: string; body: string; source: string }> = {
    alerts: {
      title: 'Chưa có cảnh báo cảm biến thật',
      body: 'Radar/camera vật lý chưa được nối vào runtime. KINGMAST không dựng cảnh báo khoảng cách, TTC hoặc vật thể mô phỏng ở chế độ này.',
      source: 'Cần radar/camera thật',
    },
    camera: {
      title: 'Camera chưa kết nối',
      body: 'Không có nguồn video thật nên màn hình không hiển thị video, lane detection hoặc object detection giả.',
      source: 'Camera runtime unavailable',
    },
    objects: {
      title: 'Không có nguồn phát hiện vật thể thật',
      body: 'Danh sách vật thể chỉ xuất hiện khi radar/camera thật cung cấp detection hợp lệ và có timestamp.',
      source: 'Detection unavailable',
    },
    trip: {
      title: 'Chưa ghi hành trình',
      body: 'KINGMAST chưa có session recorder thật trong màn này nên không hiển thị quãng đường, thời gian hay mức tiêu thụ ước lượng.',
      source: 'Trip recorder unavailable',
    },
    energy: {
      title: 'BMS chưa kết nối',
      body: 'Không hiển thị SOC, công suất, điện áp pin hoặc tầm hoạt động khi chưa nhận dữ liệu BMS/CAN thật.',
      source: 'BMS unavailable',
    },
  };
  if (view === 'drive' || view === 'navigate' || view === 'vehicle' || view === 'settings') return null;
  const item = copy[view];
  return (
    <section className={styles.unavailableWorkspace}>
      <div className={styles.unavailableIcon}><TriangleAlert size={28} /></div>
      <span className={styles.eyebrow}>REAL DATA ONLY</span>
      <h2>{item.title}</h2>
      <p>{item.body}</p>
      <div className={styles.sourceBadge}><Signal size={15} />{item.source}</div>
    </section>
  );
}

function VehicleWorkspace(props: RealCockpitProps) {
  return (
    <section className={styles.workspace}>
      <header><span><b>HARDWARE STATUS</b><h2>Hệ thống xe</h2><p>Chỉ hiển thị trạng thái kết nối đo được trong runtime hiện tại.</p></span><ShieldCheck size={24} /></header>
      <div className={styles.workspaceGrid}>
        <article><span>ESP32-C3 bench</span><strong>{c3Label(props.c3State)}</strong><small>{props.c3LatencyMs == null ? 'Latency --' : `${props.c3LatencyMs} ms`}</small></article>
        <article><span>GNSS / browser GPS</span><strong>{gpsLabel(props.gpsState)}</strong><small>{props.gpsAccuracyM == null ? 'Accuracy --' : `±${Math.round(props.gpsAccuracyM)} m`}</small></article>
        <article><span>Internet</span><strong>{props.online ? 'ONLINE' : 'OFFLINE'}</strong><small>navigator.onLine</small></article>
        <article><span>Radar trước</span><strong>UNAVAILABLE</strong><small>Chưa nối phần cứng thật</small></article>
        <article><span>Camera</span><strong>UNAVAILABLE</strong><small>Chưa có stream thật</small></article>
        <article><span>LiDAR / BMS / CAN</span><strong>UNAVAILABLE</strong><small>Không suy diễn dữ liệu</small></article>
      </div>
    </section>
  );
}

function SettingsWorkspace() {
  return (
    <section className={styles.workspace}>
      <header><span><b>DISPLAY</b><h2>Cài đặt</h2><p>Các thiết lập giao diện không có quyền điều khiển xe.</p></span><Settings size={24} /></header>
      <div className={styles.settingsCard}>
        <span><Moon size={18} /><span><strong>Chế độ sáng / tối</strong><small>Lưu cục bộ trên trình duyệt</small></span></span>
        <button type="button" className="nightButton">Chuyển giao diện</button>
      </div>
      <div className={styles.truthPolicy}>
        <ShieldCheck size={19} />
        <span><strong>Truth policy</strong><small>Không có nguồn dữ liệu thật → hiển thị unavailable/--. Không sinh giá trị thay thế.</small></span>
      </div>
    </section>
  );
}

function DriveWorkspace(props: RealCockpitProps) {
  const gpsLive = props.gpsState === 'live';
  const c3Live = props.c3State === 'live';
  return (
    <>
      <section className={styles.driveScene} aria-label="KINGMAST real-data-only drive visualization">
        <div className={styles.horizon} aria-hidden="true" />
        <div className={styles.road} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.scan} aria-hidden="true" />
        <div className={styles.sceneTruth}><ShieldCheck size={16} /><span>REAL DATA ONLY</span></div>
        <div className={styles.sceneSource}><span><StatusDot good={gpsLive} pending={props.gpsState === 'requesting'} />GNSS {gpsLabel(props.gpsState)}</span><span><StatusDot good={c3Live} pending={props.c3State === 'checking'} />C3 {c3Label(props.c3State)}</span></div>
        <div className={styles.egoVehicle} aria-hidden="true"><img src="/assets/kingmast/vehicle/kingmast-front-520.png" alt="" /></div>
        <div className={styles.noDetection}><Radio size={18} /><span><strong>Không có detection vật lý</strong><small>Radar / camera chưa nối · không dựng xe hoặc khoảng cách giả</small></span></div>
        <div className={styles.gpsMetrics}>
          <div><span>Tốc độ GPS</span><strong>{props.gpsSpeedKmh == null ? '--' : Math.round(props.gpsSpeedKmh)}</strong><small>km/h</small></div>
          <div><span>Heading</span><strong>{props.headingDeg == null ? '--' : Math.round(props.headingDeg)}</strong><small>°</small></div>
          <div><span>Độ chính xác</span><strong>{props.gpsAccuracyM == null ? '--' : Math.round(props.gpsAccuracyM)}</strong><small>m</small></div>
        </div>
      </section>
      <aside className={styles.rightFacts}>
        <section>
          <header><MapPinned size={17} /><strong>Dữ liệu vị trí</strong></header>
          <dl><div><dt>Latitude</dt><dd>{props.latitude == null ? '--' : props.latitude.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{props.longitude == null ? '--' : props.longitude.toFixed(6)}</dd></div><div><dt>GPS</dt><dd>{gpsLabel(props.gpsState)}</dd></div></dl>
        </section>
        <section>
          <header><Navigation size={17} /><strong>Tuyến hiện tại</strong></header>
          <dl><div><dt>Điểm đến</dt><dd>{props.destinationName ?? '--'}</dd></div><div><dt>Nhà cung cấp</dt><dd>{props.routeProvider ?? '--'}</dd></div><div><dt>Quãng đường</dt><dd>{props.routeDistanceLabel ?? '--'}</dd></div><div><dt>Thời gian</dt><dd>{props.routeDurationLabel ?? '--'}</dd></div></dl>
        </section>
        <section>
          <header><Signal size={17} /><strong>Giao thông</strong></header>
          <div className={props.trafficLive ? styles.liveTraffic : styles.noTraffic}><StatusDot good={props.trafficLive} /><span><strong>{props.trafficLive ? 'LIVE' : 'UNAVAILABLE'}</strong><small>{props.trafficLive ? props.trafficSource : 'Chưa có provider traffic live'}</small></span></div>
        </section>
      </aside>
    </>
  );
}

export default function KingmastRealCockpit(props: RealCockpitProps) {
  const gpsLive = props.gpsState === 'live';
  const c3Live = props.c3State === 'live';
  return (
    <main className={styles.shell} data-testid="kingmast-real-cockpit" data-view={props.view}>
      <header className={styles.topbar}>
        <div className={styles.brand}><strong>KINGMAST</strong><small>REAL-TIME DRIVER SAFETY · WARNING ONLY</small></div>
        <div className={styles.topStatus}>
          <span className={gpsLive ? styles.statusGood : styles.statusWarn}><LocateFixed size={14} />GPS {gpsLabel(props.gpsState)}</span>
          <span className={props.online ? styles.statusGood : styles.statusBad}>{props.online ? <Wifi size={14} /> : <WifiOff size={14} />}{props.online ? 'INTERNET' : 'OFFLINE'}</span>
          <span className={props.trafficLive ? styles.statusGood : styles.statusWarn}><Signal size={14} />TRAFFIC {props.trafficLive ? 'LIVE' : 'N/A'}</span>
          <span className={c3Live ? styles.statusGood : styles.statusWarn}><Radio size={14} />C3 {c3Label(props.c3State)}</span>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav aria-label="KINGMAST real navigation">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={props.view === key ? 'page' : undefined} className={props.view === key ? styles.navActive : ''} onClick={() => props.onViewChange(key)}><Icon size={19} strokeWidth={1.8} /><span>{label}</span></button>)}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.ai}><Sparkles size={18} /><span><strong>KINGMAST</strong><small>Prototype · warning only</small></span></div>
          <div className={styles.truth}><ShieldCheck size={16} /><span>Không dữ liệu giả</span></div>
          <button type="button" className="nightButton"><Moon size={17} />Giao diện</button>
        </div>
      </aside>

      <aside className={styles.leftFacts}>
        <section className={styles.speedCard}>
          <span>TỐC ĐỘ GPS</span>
          <strong>{props.gpsSpeedKmh == null ? '--' : Math.round(props.gpsSpeedKmh)}</strong>
          <small>km/h</small>
          <div><LocateFixed size={14} />{gpsLive ? `±${Math.round(props.gpsAccuracyM ?? 0)} m` : 'GPS chưa sẵn sàng'}</div>
        </section>
        <section className={styles.sensorCard}>
          <h3>Nguồn dữ liệu</h3>
          <div><span><StatusDot good={gpsLive} pending={props.gpsState === 'requesting'} />GPS</span><b>{gpsLabel(props.gpsState)}</b></div>
          <div><span><StatusDot good={c3Live} pending={props.c3State === 'checking'} />ESP32-C3</span><b>{c3Label(props.c3State)}</b></div>
          <div><span><StatusDot good={false} />Radar</span><b>CHƯA NỐI</b></div>
          <div><span><StatusDot good={false} />Camera</span><b>CHƯA NỐI</b></div>
          <div><span><StatusDot good={false} />BMS / CAN</span><b>CHƯA NỐI</b></div>
        </section>
        <section className={styles.policyCard}><ShieldCheck size={18} /><span><strong>Data integrity</strong><small>Thiếu nguồn → -- / unavailable</small></span></section>
      </aside>

      <div className={styles.center}>
        {props.view === 'drive' ? <DriveWorkspace {...props} /> : null}
        {props.view === 'navigate' ? props.navigationSlot : null}
        {props.view === 'vehicle' ? <VehicleWorkspace {...props} /> : null}
        {props.view === 'settings' ? <SettingsWorkspace /> : null}
        <UnsupportedWorkspace view={props.view} />
      </div>

      <div className={styles.mapHost}>{props.mapSlot}</div>
    </main>
  );
}
