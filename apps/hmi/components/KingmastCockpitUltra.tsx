'use client';

import {
  AlertTriangle,
  BatteryCharging,
  Bell,
  Camera,
  CarFront,
  ChevronDown,
  ChevronUp,
  Cloud,
  Eye,
  Gauge,
  LocateFixed,
  MapPinned,
  Mic,
  Moon,
  MoreHorizontal,
  Navigation,
  Pin,
  Radio,
  Route,
  Settings,
  ShieldCheck,
  Siren,
  Sparkles,
  Video,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DetectedObject, TelemetryFrame } from '@kingmast/contracts';
import { esp32C3BenchToTelemetryFrame, type Esp32C3BenchPayload } from '../lib/esp32-c3-bench';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';
import KingmastDriveScene from './KingmastDriveScene';
import styles from './KingmastCockpitUltra.module.css';

type LinkState = 'connecting' | 'live' | 'offline';
type ContextTab = 'objects' | 'device' | 'alerts' | 'energy';
type BenchMode = 'safe' | 'watch' | 'warning' | 'danger' | 'sensor_lost' | 'uplink_lost';
type NavKey = 'drive' | 'navigate' | 'alerts' | 'camera' | 'objects' | 'trip' | 'energy' | 'vehicle' | 'settings';
type DockKey = 'voice' | 'camera' | 'record' | 'capture' | 'night';

type CockpitSnapshot = {
  payload: Esp32C3BenchPayload | null;
  frame: TelemetryFrame | null;
  link: LinkState;
  latencyMs: number | null;
  receivedAtMs: number | null;
};

const ENDPOINT = 'http://192.168.4.1';
const MODE_LABELS: Array<{ value: BenchMode; label: string }> = [
  { value: 'safe', label: 'SAFE' },
  { value: 'watch', label: 'WATCH' },
  { value: 'warning', label: 'WARNING' },
  { value: 'danger', label: 'DANGER' },
  { value: 'sensor_lost', label: 'SENSOR LOST' },
];

const NAV_ITEMS: Array<{ key: NavKey; label: string; icon: typeof CarFront }> = [
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

function toneFor(risk?: string) {
  if (risk === 'DANGER') return 'danger';
  if (risk === 'WARNING') return 'warning';
  if (risk === 'WATCH') return 'watch';
  if (risk === 'SENSOR_LOST') return 'lost';
  return 'safe';
}

function useC3Bench(endpoint = ENDPOINT): CockpitSnapshot & { setMode: (mode: BenchMode) => Promise<void> } {
  const [snapshot, setSnapshot] = useState<CockpitSnapshot>({
    payload: null,
    frame: null,
    link: 'connecting',
    latencyMs: null,
    receivedAtMs: null,
  });
  const sequenceRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;

    const poll = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 900);
      const started = performance.now();
      try {
        const response = await fetch(`${endpoint}/api/telemetry`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`ESP32 ${response.status}`);
        const payload = (await response.json()) as Esp32C3BenchPayload;
        if (disposed) return;
        sequenceRef.current += 1;
        const frame = esp32C3BenchToTelemetryFrame(payload, sequenceRef.current);
        const latencyMs = Math.max(1, Math.round(performance.now() - started));
        const receivedAtMs = Date.now();
        const detail: KingmastTelemetryEventDetail = { frame, receivedAtMs, diagnostics: null };
        window.dispatchEvent(new CustomEvent<KingmastTelemetryEventDetail>('kingmast:telemetry', { detail }));
        setSnapshot({ payload, frame, link: 'live', latencyMs, receivedAtMs });
      } catch {
        if (!disposed) setSnapshot((current) => ({ ...current, link: 'offline' }));
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 500);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [endpoint]);

  const setMode = async (mode: BenchMode) => {
    await fetch(`${endpoint}/api/mode?state=${mode}`, { cache: 'no-store' });
  };

  return { ...snapshot, setMode };
}

function TopBar({ link, latency }: { link: LinkState; latency: number | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}><strong>KINGMAST</strong><small>DRIVE SAFER · GO FURTHER</small></div>
      <div className={styles.location}><MapPinned size={18} /><span>Route simulation · KINGMAST LAB</span></div>
      <div className={styles.weather}><span>☁</span><strong>32°C</strong><small>Demo environment</small></div>
      <div className={styles.networks}>
        <span><Wifi size={15} />GPS</span>
        <span><Radio size={15} />4G</span>
        <span><Cloud size={15} />Cloud</span>
        <span className={link === 'live' ? styles.linkLive : styles.linkOffline}><i />C3</span>
      </div>
      <div className={styles.clock}>
        <strong>{now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>
        <small>{latency === null ? 'Latency --' : `${latency} ms`}</small>
      </div>
    </header>
  );
}

function Sidebar({ active, onChange, alertCount, link }: { active: NavKey; onChange: (key: NavKey) => void; alertCount: number; link: LinkState }) {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav} aria-label="KINGMAST navigation">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" className={active === key ? styles.navActive : styles.navItem} onClick={() => onChange(key)}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
            {key === 'alerts' && alertCount > 0 ? <b>{alertCount}</b> : null}
          </button>
        ))}
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.aiIdentity}><span className={styles.aiOrb}><Sparkles size={20} /></span><span><strong>KINGMAST AI</strong><small>Prototype assistant</small></span></div>
        <div className={link === 'live' ? styles.systemLive : styles.systemLost}><i />{link === 'live' ? 'C3 bench connected' : 'C3 bench offline'}</div>
        <button type="button" className={styles.nightButton}><Moon size={17} /> Night HMI</button>
      </div>
    </aside>
  );
}

function VehicleStatus({ payload, link }: { payload: Esp32C3BenchPayload | null; link: LinkState }) {
  const speed = Math.round(payload?.speedKph ?? 0);
  const sensorOnline = payload?.sensorOnline ?? false;
  const percent = Math.min(92, Math.max(7, speed / 1.1));
  return (
    <aside className={styles.vehicleStatus}>
      <section className={styles.speedCard}>
        <div className={styles.speedGauge} style={{ '--speed-fill': `${percent}%` } as React.CSSProperties}>
          <div><strong>{speed}</strong><span>km/h</span></div>
        </div>
        <div className={styles.speedLimit}><b>50</b><span>Giới hạn tốc độ</span></div>
        <div className={styles.prnd}><span>P</span><span>R</span><span>N</span><b>D</b></div>
        <div className={styles.driveModes}><span><Zap size={16} />READY</span><span>◒ ECO</span></div>
      </section>
      <section className={styles.infoCard}>
        <h3>Thông tin hành trình <small>DEMO</small></h3>
        <dl>
          <div><dt>Quãng đường</dt><dd>12.4 km</dd></div>
          <div><dt>Thời gian</dt><dd>00:18 h</dd></div>
          <div><dt>Tiêu thụ TB</dt><dd>6.1 L/100km</dd></div>
          <div><dt>Phạm vi ước tính</dt><dd>320 km</dd></div>
        </dl>
      </section>
      <section className={styles.sensorCard}>
        <h3>Trạng thái cảm biến</h3>
        <div><span><i className={sensorOnline ? styles.dotOk : styles.dotBad} />Radar trước</span><b>{sensorOnline ? 'Hoạt động' : 'Unavailable'}</b></div>
        <div><span><i className={styles.dotMuted} />Camera</span><b>Chưa nối</b></div>
        <div><span><i className={styles.dotMuted} />LiDAR</span><b>Chưa nối</b></div>
        <div><span><i className={link === 'live' ? styles.dotOk : styles.dotBad} />ESP32-C3</span><b>{link === 'live' ? 'LIVE' : 'OFFLINE'}</b></div>
      </section>
    </aside>
  );
}

function AlertBanner({ payload }: { payload: Esp32C3BenchPayload | null }) {
  if (!payload || payload.risk === 'SAFE') return null;
  const sensorLost = payload.risk === 'SENSOR_LOST';
  const danger = payload.risk === 'DANGER';
  const warning = payload.risk === 'WARNING';
  return (
    <div className={`${styles.alertBanner} ${danger ? styles.alertDanger : sensorLost ? styles.alertLost : warning ? styles.alertWarning : styles.alertWatch}`} role="alert">
      <AlertTriangle size={36} />
      <span>
        <strong>{sensorLost ? 'CẢM BIẾN PHÍA TRƯỚC MẤT' : danger ? 'XE PHÍA TRƯỚC · NGUY CƠ CAO' : warning ? 'CẢNH BÁO XE PHÍA TRƯỚC' : 'THEO DÕI XE PHÍA TRƯỚC'}</strong>
        <b>{sensorLost ? 'Degraded sensing' : `Khoảng cách ${payload.distanceM.toFixed(1)} m  ·  TTC ${payload.ttc > 0 ? `${payload.ttc.toFixed(2)} s` : '--'}`}</b>
        <small>{sensorLost ? 'Không dùng số đo khoảng cách/TTC cho đến khi radar phục hồi.' : 'Warning-only · người lái tiếp tục toàn quyền điều khiển.'}</small>
      </span>
    </div>
  );
}

function MapPanel({ danger }: { danger: boolean }) {
  return (
    <section className={`${styles.mapPanel} ${danger ? styles.mapDim : ''}`} aria-label="Bản đồ demo">
      <span className={styles.demoLabel}>ROUTE DEMO</span>
      <div className={styles.mapGrid} />
      <div className={styles.routeLine}><i /><i /><i /></div>
      <div className={styles.mapInstruction}><Navigation size={25} /><span><strong>500 m</strong><small>Rẽ phải · tuyến mô phỏng</small></span></div>
      <div className={styles.mapEta}><strong>12:01</strong><small>23 km · 23 phút</small></div>
      <div className={styles.mapDelay}>+3 phút</div>
      <div className={styles.mapVehicle}><LocateFixed size={22} /></div>
      <div className={styles.mapTools}><button type="button">🔊</button><button type="button"><Camera size={16} /></button><button type="button"><Navigation size={16} /></button></div>
    </section>
  );
}

function objectName(object: DetectedObject) {
  if (object.kind === 'truck') return 'Xe tải';
  if (object.kind === 'motorcycle') return 'Xe máy';
  if (object.kind === 'bicycle') return 'Xe đạp';
  if (object.kind === 'person') return 'Người đi bộ';
  if (object.kind === 'bus') return 'Xe buýt';
  return 'Xe con';
}

function ObjectPanel({ objects }: { objects: DetectedObject[] }) {
  if (objects.length === 0) return <div className={styles.empty}><Radio size={26} /><strong>Không có vật thể hợp lệ</strong><span>Radar trước chưa cung cấp mục tiêu.</span></div>;
  return (
    <div className={styles.objectTable}>
      <div className={styles.objectHead}><span>#</span><span>Đối tượng</span><span>Khoảng cách</span><span>V tương đối</span><span>Trạng thái</span></div>
      {objects.slice(0, 5).map((object, index) => (
        <div className={styles.objectRow} key={object.id}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span><CarFront size={17} /><strong>{objectName(object)}</strong></span>
          <span>{object.distanceM.toFixed(1)} m</span>
          <span>{object.relativeSpeedMps > 0 ? '+' : ''}{object.relativeSpeedMps.toFixed(1)} m/s</span>
          <b className={object.severity === 'critical' ? styles.badgeDanger : object.severity === 'caution' ? styles.badgeWarning : styles.badgeSafe}>{object.severity === 'critical' ? 'Nguy hiểm' : object.severity === 'caution' ? 'Theo dõi' : 'An toàn'}</b>
        </div>
      ))}
    </div>
  );
}

function DevicePanel({ payload, link, latency, setMode }: { payload: Esp32C3BenchPayload | null; link: LinkState; latency: number | null; setMode: (mode: BenchMode) => Promise<void> }) {
  return (
    <div className={styles.devicePanel}>
      <div className={styles.deviceHero}>
        <div className={styles.chipArt}><span>C3</span><i /><i /><i /><i /></div>
        <span><strong>ESP32-C3 Super Mini</strong><small>192.168.4.1 · {latency === null ? '-- ms' : `${latency} ms`}</small></span>
        <b className={link === 'live' ? styles.badgeSafe : styles.badgeDanger}>C3 {link === 'live' ? 'LIVE' : 'OFFLINE'}</b>
      </div>
      <div className={styles.deviceStats}>
        <div><span>Mode</span><strong>{payload?.mode ?? '--'}</strong></div>
        <div><span>Sensor</span><strong>{payload?.sensorOnline ? 'ONLINE' : 'LOST'}</strong></div>
        <div><span>Uplink</span><strong>{payload?.uplinkOnline ? 'ONLINE' : 'LOST'}</strong></div>
        <div><span>Clients</span><strong>{payload?.clients ?? '--'}</strong></div>
      </div>
      <div className={styles.benchControl}>
        <span>BENCH SCENARIOS · chỉ thay dữ liệu mô phỏng</span>
        <div>{MODE_LABELS.map((mode) => <button key={mode.value} type="button" className={payload?.mode?.toLowerCase() === mode.value ? styles.scenarioActive : ''} onClick={() => void setMode(mode.value)}>{mode.label}</button>)}</div>
      </div>
    </div>
  );
}

function ContextPanel({ payload, frame, link, latency, setMode }: { payload: Esp32C3BenchPayload | null; frame: TelemetryFrame | null; link: LinkState; latency: number | null; setMode: (mode: BenchMode) => Promise<void> }) {
  const [tab, setTab] = useState<ContextTab>('objects');
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pinned, setPinned] = useState(false);
  const alerts = frame?.alerts ?? [];

  useEffect(() => {
    if (pinned || !payload) return;
    if (payload.risk === 'SENSOR_LOST' || link === 'offline') setTab('device');
    else if (payload.risk === 'DANGER' || payload.risk === 'WARNING' || payload.risk === 'WATCH') setTab('objects');
  }, [link, payload, pinned]);

  if (hidden) return <aside className={styles.contextHidden}><button type="button" onClick={() => setHidden(false)}><Eye size={18} />Mở thông tin nhanh</button></aside>;

  const title = tab === 'objects' ? `Vật thể xung quanh (${frame?.objects.length ?? 0})` : tab === 'device' ? 'Thiết bị KINGMAST' : tab === 'alerts' ? `Cảnh báo hệ thống (${alerts.length})` : 'Năng lượng';

  return (
    <aside className={styles.context}>
      <MapPanel danger={payload?.risk === 'DANGER'} />
      <div className={styles.quickHeader}>
        <span><strong>Thông tin nhanh</strong><small>{pinned ? 'Đã ghim' : 'Tự đổi theo ngữ cảnh'}</small></span>
        <div><button type="button" onClick={() => setHidden(true)} title="Ẩn"><X size={16} /></button><button type="button" className={pinned ? styles.actionActive : ''} onClick={() => setPinned((value) => !value)} title="Ghim"><Pin size={16} /></button></div>
      </div>
      <div className={styles.tabs}>
        <button type="button" className={tab === 'objects' ? styles.tabActive : ''} onClick={() => setTab('objects')}>Vật thể</button>
        <button type="button" className={tab === 'device' ? styles.tabActive : ''} onClick={() => setTab('device')}>Thiết bị</button>
        <button type="button" className={tab === 'alerts' ? styles.tabActive : ''} onClick={() => setTab('alerts')}>Cảnh báo</button>
        <button type="button" className={tab === 'energy' ? styles.tabActive : ''} onClick={() => setTab('energy')}>Năng lượng</button>
      </div>
      <section className={`${styles.contextCard} ${collapsed ? styles.collapsed : ''}`}>
        <header><strong>{title}</strong><div><button type="button" onClick={() => setPinned((value) => !value)}><Pin size={15} /></button><button type="button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button><button type="button"><MoreHorizontal size={18} /></button></div></header>
        {collapsed ? <div className={styles.summary}>{tab === 'device' ? `${link === 'live' ? 'C3 LIVE' : 'C3 OFFLINE'} · ${latency ?? '--'} ms` : tab === 'objects' ? `${frame?.objects.length ?? 0} đối tượng · ${payload?.risk ?? 'SAFE'}` : tab === 'alerts' ? `${alerts.length} cảnh báo` : 'USB bench power'}</div> : (
          <div className={styles.contextBody}>
            {tab === 'objects' ? <ObjectPanel objects={frame?.objects ?? []} /> : null}
            {tab === 'device' ? <DevicePanel payload={payload} link={link} latency={latency} setMode={setMode} /> : null}
            {tab === 'alerts' ? <div className={styles.alertList}>{alerts.length ? alerts.map((alert) => <div key={alert.id}><AlertTriangle size={17} /><span><strong>{alert.title}</strong><small>{alert.message}</small></span></div>) : <div className={styles.empty}><ShieldCheck size={25} /><strong>Không có cảnh báo</strong><span>Không có alert hợp lệ trong telemetry hiện tại.</span></div>}</div> : null}
            {tab === 'energy' ? <div className={styles.energyPanel}><BatteryCharging size={30} /><strong>Bench power</strong><span>ESP32-C3 đang cấp nguồn USB; chưa có BMS runtime.</span><div><b>5 V</b><small>USB source</small></div></div> : null}
          </div>
        )}
      </section>
    </aside>
  );
}

function BottomDock() {
  const [active, setActive] = useState<DockKey>('voice');
  const items: Array<{ key: DockKey; label: string; icon: typeof Mic }> = [
    { key: 'voice', label: 'Giọng nói', icon: Mic },
    { key: 'camera', label: 'Camera', icon: Camera },
    { key: 'record', label: 'Ghi hình', icon: Video },
    { key: 'capture', label: 'Chụp ảnh', icon: Camera },
    { key: 'night', label: 'Chế độ đêm', icon: Moon },
  ];
  return (
    <footer className={styles.bottomDock}>
      <div className={styles.dockGroup}>{items.map(({ key, label, icon: Icon }) => <button type="button" key={key} className={active === key ? styles.dockActive : ''} onClick={() => setActive(key)}><Icon size={19} /><span>{label}</span></button>)}</div>
      <button type="button" className={styles.sos} title="UI demo only"><Siren size={21} />SOS</button>
      <button type="button" className={styles.aiButton}><Sparkles size={20} />Trợ lý AI</button>
    </footer>
  );
}

export default function KingmastCockpitUltra() {
  const { payload, frame, link, latencyMs, setMode } = useC3Bench();
  const [nav, setNav] = useState<NavKey>('drive');
  const tone = toneFor(payload?.risk);
  const alertCount = frame?.alerts.length ?? 0;

  return (
    <main className={`${styles.shell} ${styles[`tone_${tone}`]}`} data-testid="kingmast-cockpit-ultra">
      <TopBar link={link} latency={latencyMs} />
      <Sidebar active={nav} onChange={setNav} alertCount={alertCount} link={link} />
      <VehicleStatus payload={payload} link={link} />
      <div className={styles.centerStage}>
        {nav !== 'drive' ? <div className={styles.viewHint}><span>{NAV_ITEMS.find((item) => item.key === nav)?.label}</span><small>Workspace preview · vùng lái vẫn duy trì để không che thông tin an toàn.</small></div> : null}
        <KingmastDriveScene payload={payload} frame={frame} alert={<AlertBanner payload={payload} />} />
      </div>
      <ContextPanel payload={payload} frame={frame} link={link} latency={latencyMs} setMode={setMode} />
      <BottomDock />
    </main>
  );
}
