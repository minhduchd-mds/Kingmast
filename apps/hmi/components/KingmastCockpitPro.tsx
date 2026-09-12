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
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DetectedObject, TelemetryFrame } from '@kingmast/contracts';
import { esp32C3BenchToTelemetryFrame, type Esp32C3BenchPayload } from '../lib/esp32-c3-bench';
import type { KingmastTelemetryEventDetail } from '../lib/realtime';
import styles from './KingmastCockpitPro.module.css';

type LinkState = 'connecting' | 'live' | 'offline';
type ContextTab = 'objects' | 'device' | 'alerts' | 'energy';
type BenchMode = 'safe' | 'watch' | 'warning' | 'danger' | 'sensor_lost' | 'uplink_lost';

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

const navItems = [
  ['drive', 'Lái xe', CarFront],
  ['navigate', 'Dẫn đường', Navigation],
  ['alerts', 'Cảnh báo', Bell],
  ['camera', 'Camera', Camera],
  ['objects', 'Vật thể', Radio],
  ['trip', 'Hành trình', Route],
  ['energy', 'Năng lượng', BatteryCharging],
  ['vehicle', 'Hệ thống xe', Gauge],
  ['settings', 'Cài đặt', Settings],
] as const;

function riskTone(risk?: string) {
  if (risk === 'DANGER') return 'danger';
  if (risk === 'WARNING') return 'warning';
  if (risk === 'WATCH') return 'watch';
  if (risk === 'SENSOR_LOST') return 'lost';
  return 'safe';
}

function objectLabel(object: DetectedObject) {
  switch (object.kind) {
    case 'car': return 'Xe con';
    case 'truck': return 'Xe tải';
    case 'motorcycle': return 'Xe máy';
    case 'bicycle': return 'Xe đạp';
    case 'person': return 'Người đi bộ';
    case 'bus': return 'Xe buýt';
    default: return 'Vật thể';
  }
}

function severityLabel(object: DetectedObject) {
  if (object.severity === 'critical') return 'Nguy hiểm';
  if (object.severity === 'caution') return 'Theo dõi';
  return 'An toàn';
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

function TopBar({ live, latency }: { live: boolean; latency: number | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <strong>KINGMAST</strong>
        <small>DRIVE SAFER · GO FURTHER</small>
      </div>
      <div className={styles.locationChip}><MapPinned size={17} /><span>Tuyến mô phỏng · KINGMAST LAB</span></div>
      <div className={styles.weather}><span>☁️</span><strong>32°C</strong><small>Điều kiện demo</small></div>
      <div className={styles.connectivity}>
        <span><Wifi size={16} />GPS</span>
        <span><Radio size={16} />4G</span>
        <span><Cloud size={16} />Cloud</span>
        <span className={live ? styles.liveChip : styles.offlineChip}><i />C3 {live ? 'LIVE' : 'OFFLINE'}</span>
      </div>
      <div className={styles.clock}>
        <strong>{now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>
        <small>{latency === null ? 'Latency --' : `${latency} ms`}</small>
      </div>
    </header>
  );
}

function Sidebar({ alertCount }: { alertCount: number }) {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {navItems.map(([key, label, Icon], index) => (
          <button key={key} type="button" className={index === 0 ? styles.navActive : styles.navItem}>
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
            {key === 'alerts' && alertCount > 0 ? <b>{alertCount}</b> : null}
          </button>
        ))}
      </nav>
      <div className={styles.aiIdentity}>
        <div className={styles.aiOrb}><Sparkles size={22} /></div>
        <div><strong>KINGMAST AI</strong><small>v0.1.0-test</small></div>
      </div>
      <div className={styles.systemOnline}><i /> Hệ thống bench</div>
      <div className={styles.sideTime}>11:38<small>Prototype HMI</small></div>
      <button type="button" className={styles.nightToggle}><Moon size={18} /><span>Night</span></button>
    </aside>
  );
}

function VehicleStatusPanel({ payload, link }: { payload: Esp32C3BenchPayload | null; link: LinkState }) {
  const speed = Math.round(payload?.speedKph ?? 0);
  const sensorOnline = payload?.sensorOnline ?? false;
  const speedPercent = Math.min(100, Math.max(8, speed / 1.2));
  return (
    <section className={styles.vehicleStatus}>
      <div className={styles.speedCard}>
        <div className={styles.speedGauge} style={{ background: `conic-gradient(#4fe4ff 0 ${speedPercent}%, #1e7fff ${speedPercent}% ${Math.min(100, speedPercent + 15)}%, rgba(95,139,181,.18) 0)` }}>
          <div><strong>{speed}</strong><span>km/h</span></div>
        </div>
        <div className={styles.speedLimit}><b>50</b><span>Giới hạn tốc độ</span></div>
        <div className={styles.prnd}><span>P</span><span>R</span><span>N</span><b>D</b></div>
        <div className={styles.driveStates}><span><Zap size={16} />READY</span><span>🌿 ECO</span></div>
      </div>

      <div className={styles.tripCard}>
        <h3>Thông tin hành trình</h3>
        <dl>
          <div><dt>Quãng đường</dt><dd>12.4 km</dd></div>
          <div><dt>Thời gian</dt><dd>00:18 h</dd></div>
          <div><dt>Tiêu thụ TB</dt><dd>6.1 L/100km</dd></div>
          <div><dt>Phạm vi ước tính</dt><dd>320 km</dd></div>
        </dl>
      </div>

      <div className={styles.sensorCard}>
        <h3>Trạng thái cảm biến</h3>
        <div><span><i className={sensorOnline ? styles.dotOk : styles.dotBad} />Radar trước</span><b>{sensorOnline ? 'Hoạt động' : 'Mất tín hiệu'}</b></div>
        <div><span><i className={styles.dotMuted} />Camera</span><b>Chưa nối</b></div>
        <div><span><i className={styles.dotMuted} />LiDAR</span><b>Chưa nối</b></div>
        <div><span><i className={link === 'live' ? styles.dotOk : styles.dotBad} />C3 link</span><b>{link === 'live' ? 'Hoạt động' : 'Offline'}</b></div>
      </div>
    </section>
  );
}

function AlertBanner({ payload }: { payload: Esp32C3BenchPayload | null }) {
  if (!payload || payload.risk === 'SAFE') return null;
  const sensorLost = payload.risk === 'SENSOR_LOST';
  const danger = payload.risk === 'DANGER';
  return (
    <div className={`${styles.alertBanner} ${danger ? styles.alertDanger : sensorLost ? styles.alertLost : styles.alertWarning}`} role="alert">
      <AlertTriangle size={38} />
      <div>
        <strong>{sensorLost ? 'CẢM BIẾN PHÍA TRƯỚC MẤT' : danger ? 'XE PHÍA TRƯỚC · NGUY CƠ CAO' : 'XE PHÍA TRƯỚC'}</strong>
        <span>{sensorLost ? 'Radar data unavailable · chuyển sang degraded sensing' : `Khoảng cách: ${payload.distanceM.toFixed(1)} m  |  TTC: ${payload.ttc > 0 ? `${payload.ttc.toFixed(2)} s` : '--'}`}</span>
        <small>{sensorLost ? 'Không sử dụng dữ liệu khoảng cách/TTC cho tới khi cảm biến phục hồi.' : 'Hệ thống chỉ cảnh báo · người lái tiếp tục kiểm soát phương tiện.'}</small>
      </div>
    </div>
  );
}

function DriveCanvas({ payload, frame }: { payload: Esp32C3BenchPayload | null; frame: TelemetryFrame | null }) {
  const tone = riskTone(payload?.risk);
  const distance = payload?.sensorOnline && payload.distanceM >= 0 ? payload.distanceM : null;
  const critical = payload?.risk === 'DANGER';
  return (
    <section className={`${styles.driveCanvas} ${styles[`tone_${tone}`]}`}>
      <div className={styles.cityGlow} />
      <div className={styles.road}>
        <i className={styles.laneLeft} /><i className={styles.laneCenter} /><i className={styles.laneRight} />
      </div>
      <AlertBanner payload={payload} />

      {distance !== null ? (
        <div className={`${styles.targetVehicle} ${critical ? styles.targetCritical : ''}`}>
          <CarFront size={34} />
          <b>{distance.toFixed(1)} m</b>
        </div>
      ) : null}

      <div className={styles.sensorFan}><span /><span /><span /></div>
      <div className={styles.radarRing}><i /><i /><i /></div>
      <div className={styles.egoVehicle}>
        <img src="/assets/kingmast/vehicle/kingmast-front-520.png" alt="KINGMAST vehicle" draggable={false} />
      </div>

      <div className={`${styles.zoneCard} ${styles.zoneLeft}`}><CarFront size={17} /><span>Trái</span><strong>--</strong></div>
      <div className={`${styles.zoneCard} ${styles.zoneRight}`}><CarFront size={17} /><span>Phải</span><strong>--</strong></div>
      <div className={`${styles.zoneCard} ${styles.zoneRear}`}><CarFront size={17} /><span>Phía sau</span><strong>--</strong></div>

      <div className={styles.canvasFooter}>
        <div className={styles.viewMode}><span>Chế độ hiển thị</span><button type="button">2D</button><button type="button" className={styles.modeActive}>3D</button></div>
        <div className={styles.laneState}><ShieldCheck size={18} /><span>Giữ làn</span><b>ADVISORY</b></div>
      </div>

      <div className={styles.canvasTruth}>Nguồn: {frame?.vehicle.source === 'simulator' ? 'ESP32 bench simulator' : 'runtime'} · warning-only</div>
    </section>
  );
}

function MapPanel({ danger }: { danger: boolean }) {
  return (
    <section className={`${styles.mapPanel} ${danger ? styles.mapDimmed : ''}`}>
      <div className={styles.mapGrid} />
      <div className={styles.routeLine}><i /><i /><i /></div>
      <div className={styles.mapInstruction}><Navigation size={28} /><div><strong>500 m</strong><span>Rẽ phải · tuyến mô phỏng</span></div></div>
      <div className={styles.mapEta}><strong>12:01</strong><span>23 km · 23 phút</span></div>
      <div className={styles.mapDelay}>+3 phút</div>
      <div className={styles.mapCar}><LocateFixed size={24} /></div>
      <div className={styles.mapTools}><button type="button">🔊</button><button type="button"><Camera size={17} /></button><button type="button"><Navigation size={17} /></button></div>
    </section>
  );
}

function ObjectPanel({ objects }: { objects: DetectedObject[] }) {
  if (objects.length === 0) return <div className={styles.emptyPanel}><Radio size={26} /><strong>Không có vật thể hợp lệ</strong><span>Dữ liệu sẽ xuất hiện khi cảm biến trước online.</span></div>;
  return (
    <div className={styles.objectTable}>
      {objects.slice(0, 5).map((object, index) => (
        <div key={object.id} className={styles.objectRow}>
          <span className={styles.objectIndex}>{String(index + 1).padStart(2, '0')}</span>
          <CarFront size={19} />
          <strong>{objectLabel(object)}</strong>
          <span>{object.distanceM.toFixed(1)} m</span>
          <span>{object.relativeSpeedMps > 0 ? '+' : ''}{object.relativeSpeedMps.toFixed(1)} m/s</span>
          <b className={object.severity === 'critical' ? styles.badgeDanger : object.severity === 'caution' ? styles.badgeWarning : styles.badgeSafe}>{severityLabel(object)}</b>
        </div>
      ))}
    </div>
  );
}

function DevicePanel({ payload, link, latency, setMode }: { payload: Esp32C3BenchPayload | null; link: LinkState; latency: number | null; setMode: (mode: BenchMode) => Promise<void> }) {
  return (
    <div className={styles.devicePanel}>
      <div className={styles.deviceHero}>
        <div className={styles.chipArt}><span>ESP</span><i /><i /><i /></div>
        <div><strong>ESP32-C3 Super Mini</strong><span>192.168.4.1 · {latency === null ? '-- ms' : `${latency} ms`}</span></div>
        <b className={link === 'live' ? styles.badgeSafe : styles.badgeDanger}>C3 {link === 'live' ? 'LIVE' : 'OFFLINE'}</b>
      </div>
      <div className={styles.deviceStats}>
        <div><span>Mode</span><strong>{payload?.mode ?? '--'}</strong></div>
        <div><span>Sensor</span><strong>{payload?.sensorOnline ? 'ONLINE' : 'LOST'}</strong></div>
        <div><span>Uplink</span><strong>{payload?.uplinkOnline ? 'ONLINE' : 'LOST'}</strong></div>
        <div><span>Clients</span><strong>{payload?.clients ?? '--'}</strong></div>
      </div>
      <div className={styles.benchModes}>
        <span>BENCH SCENARIO</span>
        <div>{MODE_LABELS.map((mode) => <button key={mode.value} type="button" onClick={() => void setMode(mode.value)}>{mode.label}</button>)}</div>
      </div>
    </div>
  );
}

function RightContext({ payload, frame, link, latency, setMode }: { payload: Esp32C3BenchPayload | null; frame: TelemetryFrame | null; link: LinkState; latency: number | null; setMode: (mode: BenchMode) => Promise<void> }) {
  const [tab, setTab] = useState<ContextTab>('objects');
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (pinned || !payload) return;
    if (payload.risk === 'SENSOR_LOST' || link === 'offline') setTab('device');
    else if (payload.risk === 'DANGER' || payload.risk === 'WARNING' || payload.risk === 'WATCH') setTab('objects');
  }, [link, payload, pinned]);

  const alertCount = frame?.alerts.length ?? 0;
  const danger = payload?.risk === 'DANGER';

  if (hidden) {
    return <aside className={styles.contextHidden}><button type="button" onClick={() => setHidden(false)}><Eye size={18} />Mở thông tin nhanh</button></aside>;
  }

  return (
    <aside className={styles.contextPanel}>
      <MapPanel danger={danger} />
      <div className={styles.quickHeader}>
        <div><strong>Thông tin nhanh</strong><span>{pinned ? 'Đã ghim panel' : 'Tự đổi theo ngữ cảnh'}</span></div>
        <div className={styles.quickActions}><button type="button" onClick={() => setHidden(true)} title="Ẩn"><X size={16} /></button><button type="button" onClick={() => setPinned((value) => !value)} className={pinned ? styles.actionActive : ''} title="Ghim"><Pin size={16} /></button></div>
      </div>
      <div className={styles.quickTabs}>
        <button type="button" className={tab === 'objects' ? styles.tabActive : ''} onClick={() => setTab('objects')}>Vật thể</button>
        <button type="button" className={tab === 'device' ? styles.tabActive : ''} onClick={() => setTab('device')}>Thiết bị</button>
        <button type="button" className={tab === 'alerts' ? styles.tabActive : ''} onClick={() => setTab('alerts')}>Cảnh báo {alertCount > 0 ? `(${alertCount})` : ''}</button>
        <button type="button" className={tab === 'energy' ? styles.tabActive : ''} onClick={() => setTab('energy')}>Năng lượng</button>
      </div>

      <section className={`${styles.contextCard} ${collapsed ? styles.contextCollapsed : ''}`}>
        <header>
          <strong>{tab === 'objects' ? `Vật thể xung quanh (${frame?.objects.length ?? 0})` : tab === 'device' ? 'Thiết bị KINGMAST' : tab === 'alerts' ? 'Cảnh báo hệ thống' : 'Năng lượng'}</strong>
          <div><button type="button" title="Ghim" onClick={() => setPinned((value) => !value)}><Pin size={16} /></button><button type="button" title={collapsed ? 'Mở rộng' : 'Thu gọn'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}</button><button type="button"><MoreHorizontal size={18} /></button></div>
        </header>
        {!collapsed ? (
          <div className={styles.contextBody}>
            {tab === 'objects' ? <ObjectPanel objects={frame?.objects ?? []} /> : null}
            {tab === 'device' ? <DevicePanel payload={payload} link={link} latency={latency} setMode={setMode} /> : null}
            {tab === 'alerts' ? <div className={styles.alertList}>{frame?.alerts.length ? frame.alerts.map((alert) => <div key={alert.id}><AlertTriangle size={18} /><span><strong>{alert.title}</strong><small>{alert.message}</small></span></div>) : <div className={styles.emptyPanel}><ShieldCheck size={24} /><strong>Không có cảnh báo</strong><span>Hệ thống đang ở trạng thái ổn định.</span></div>}</div> : null}
            {tab === 'energy' ? <div className={styles.energyPanel}><BatteryCharging size={30} /><strong>Bench power</strong><span>ESP32-C3 đang cấp nguồn USB. Chưa có BMS/vehicle energy runtime.</span><div><b>5V</b><small>USB test source</small></div></div> : null}
          </div>
        ) : <div className={styles.collapsedSummary}>{tab === 'device' ? `${link === 'live' ? 'C3 LIVE' : 'C3 OFFLINE'} · ${latency ?? '--'} ms` : tab === 'objects' ? `${frame?.objects.length ?? 0} đối tượng · ${payload?.risk ?? 'SAFE'}` : tab === 'alerts' ? `${alertCount} cảnh báo` : 'Bench energy'}</div>}
      </section>
    </aside>
  );
}

function BottomDock() {
  const items = [
    ['Giọng nói', Mic],
    ['Camera', Camera],
    ['Ghi hình', Video],
    ['Chụp ảnh', Camera],
    ['Chế độ đêm', Moon],
  ] as const;
  return (
    <footer className={styles.bottomDock}>
      <div className={styles.dockMain}>{items.map(([label, Icon], index) => <button key={label} type="button" className={index === 0 ? styles.dockActive : ''}><Icon size={20} /><span>{label}</span></button>)}</div>
      <button type="button" className={styles.sos}><Siren size={22} />SOS</button>
      <button type="button" className={styles.aiButton}><Sparkles size={21} />Trợ lý AI</button>
    </footer>
  );
}

export default function KingmastCockpitPro() {
  const { payload, frame, link, latencyMs, setMode } = useC3Bench();
  const alertCount = frame?.alerts.length ?? 0;
  const tone = riskTone(payload?.risk);

  return (
    <main className={`${styles.shell} ${styles[`shell_${tone}`]}`} data-testid="kingmast-cockpit-pro">
      <TopBar live={link === 'live'} latency={latencyMs} />
      <Sidebar alertCount={alertCount} />
      <VehicleStatusPanel payload={payload} link={link} />
      <DriveCanvas payload={payload} frame={frame} />
      <RightContext payload={payload} frame={frame} link={link} latency={latencyMs} setMode={setMode} />
      <BottomDock />
    </main>
  );
}
