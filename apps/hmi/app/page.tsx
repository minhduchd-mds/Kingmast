'use client';

import {
  AlertTriangle,
  BatteryMedium,
  Bell,
  Bike,
  Camera,
  CarFront,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  CircleParking,
  Cpu,
  Gauge,
  LocateFixed,
  Map,
  MapPinned,
  Navigation,
  Radio,
  Route,
  Satellite,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DetectedObject,
  LocationAlert,
  SensorHealth,
  SensorState,
  Severity,
  VehiclePosition,
} from '@kingmast/contracts';
import GpsSafetyMap, { ObjectGlyph } from '../components/GpsSafetyMap';
import { MOTION, useAnimatedNumber } from '../lib/motion';
import { createSimulationFrame, withDevicePosition } from '../lib/telemetry';

type ViewKey = 'drive' | 'map' | 'objects' | 'alerts' | 'trip' | 'vehicle';
type GpsState = 'simulator' | 'requesting' | 'device' | 'denied';
type Sensitivity = 'Low' | 'Medium' | 'High';
type SoundLevel = 'Off' | 'Low' | 'Medium' | 'High';

const views: Array<{ key: ViewKey; label: string; icon: typeof CarFront }> = [
  { key: 'drive', label: 'Drive', icon: CarFront },
  { key: 'map', label: 'Map', icon: Map },
  { key: 'objects', label: 'Objects', icon: Radio },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'trip', label: 'Trip', icon: Route },
  { key: 'vehicle', label: 'Vehicle', icon: Gauge },
];

const severityRank: Record<Severity, number> = { safe: 1, caution: 2, critical: 3 };

function statusCopy(severity: Severity) {
  if (severity === 'critical') return { title: 'Slow down', subtitle: 'Immediate hazard in the safety zone.' };
  if (severity === 'caution') return { title: 'Increase awareness', subtitle: 'A nearby object requires attention.' };
  return { title: 'Clear ahead', subtitle: 'KINGMAST is monitoring the road around you.' };
}

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

function sensorLabel(state: SensorState) {
  if (state === 'ok') return 'Available';
  if (state === 'degraded') return 'Degraded';
  return 'Unavailable';
}

function SensorStatus({ label, icon: Icon, state }: { label: string; icon: typeof Radio; state: SensorState }) {
  return (
    <div className={`sensorStatus sensor-${state}`}>
      <span className="sensorGlyph"><Icon strokeWidth={1.7} /></span>
      <span>
        <strong>{label}</strong>
        <small>{sensorLabel(state)}</small>
      </span>
      <i aria-hidden="true" />
    </div>
  );
}

function SeverityPill({ severity }: { severity: Severity }) {
  return <span className={`severityPill severity-${severity}`}>{severity}</span>;
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="metricTile">
      <small>{label}</small>
      <strong>{value}{unit ? <em>{unit}</em> : null}</strong>
    </div>
  );
}

function nearestFrontObject(objects: DetectedObject[]) {
  return objects
    .filter((object) => object.zone === 'front' || object.zone === 'front-left' || object.zone === 'front-right')
    .sort((a, b) => a.distanceM - b.distanceM)[0] ?? null;
}

export default function Page() {
  const [view, setView] = useState<ViewKey>('drive');
  const [sequence, setSequence] = useState(0);
  const [gpsState, setGpsState] = useState<GpsState>('simulator');
  const [devicePosition, setDevicePosition] = useState<VehiclePosition | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('Medium');
  const [sound, setSound] = useState<SoundLevel>('Medium');
  const [privacy, setPrivacy] = useState(true);
  const gpsWatchId = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setSequence((current) => current + 1), 2800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (gpsWatchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchId.current);
      }
    };
  }, []);

  const simulatedFrame = useMemo(() => createSimulationFrame(sequence), [sequence]);
  const frame = useMemo(
    () => (devicePosition ? withDevicePosition(simulatedFrame, devicePosition) : simulatedFrame),
    [devicePosition, simulatedFrame],
  );

  const sortedAlerts = useMemo(
    () => [...frame.alerts].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]),
    [frame.alerts],
  );
  const primaryAlert = sortedAlerts[0] ?? null;
  const overallSeverity: Severity = primaryAlert?.severity ?? 'safe';
  const frontObject = nearestFrontObject(frame.objects);
  const closingMps = frontObject ? Math.max(0, -frontObject.relativeSpeedMps) : 0;
  const ttcTarget = frontObject && closingMps > 0.1 ? frontObject.distanceM / closingMps : 9.9;
  const speed = useAnimatedNumber(frame.vehicle.speedKmh, MOTION.ms.emphasized);
  const gap = useAnimatedNumber(frontObject?.distanceM ?? 50, MOTION.ms.emphasized);
  const ttc = useAnimatedNumber(Math.min(9.9, ttcTarget), MOTION.ms.standard);
  const status = statusCopy(overallSeverity);

  const sensorRows: Array<{ label: string; icon: typeof Radio; state: SensorState }> = [
    { label: 'Front radar', icon: Radio, state: frame.sensors.radarFront },
    { label: 'Rear radar', icon: Radio, state: frame.sensors.radarRear },
    { label: 'Camera', icon: Camera, state: frame.sensors.camera },
    { label: 'Vehicle CAN', icon: Wifi, state: frame.sensors.can },
    { label: 'GNSS / IMU', icon: Satellite, state: frame.sensors.gnssImu },
    { label: 'Safety ECU', icon: Cpu, state: frame.sensors.ecu },
  ];

  function useDeviceGps() {
    if (!navigator.geolocation) {
      setGpsState('denied');
      return;
    }
    if (gpsWatchId.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchId.current);
      gpsWatchId.current = null;
    }
    setGpsState('requesting');
    gpsWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setDevicePosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speedKmh: position.coords.speed !== null ? Math.max(0, position.coords.speed * 3.6) : simulatedFrame.vehicle.speedKmh,
          headingDeg: position.coords.heading ?? simulatedFrame.vehicle.headingDeg,
          accuracyM: position.coords.accuracy,
          timestampMs: position.timestamp,
          source: 'device-gps',
        });
        setGpsState('device');
      },
      () => {
        setGpsState('denied');
        setDevicePosition(null);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12_000 },
    );
  }

  function useSimulator() {
    if (gpsWatchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchId.current);
      gpsWatchId.current = null;
    }
    setDevicePosition(null);
    setGpsState('simulator');
  }

  return (
    <main className={`appShell severity-${overallSeverity}`}>
      <aside className="sidebar" aria-label="KINGMAST navigation">
        <div className="appBrand" aria-label="KINGMAST">
          <span className="brandMark"><CarFront strokeWidth={1.8} /></span>
          <span><strong>KINGMAST</strong><small>Safety system</small></span>
        </div>

        <nav className="navList">
          {views.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              className={view === key ? 'navItem selected' : 'navItem'}
              onClick={() => setView(key)}
              aria-current={view === key ? 'page' : undefined}
            >
              <Icon strokeWidth={1.7} />
              <span>{label}</span>
              {key === 'alerts' && frame.alerts.length > 0 ? <b>{frame.alerts.length}</b> : null}
            </button>
          ))}
        </nav>

        <div className="sidebarFooter">
          <button type="button" className="navItem" onClick={() => setSettingsOpen(true)}>
            <Settings strokeWidth={1.7} />
            <span>Settings</span>
          </button>
          <div className="parkedState"><CircleParking strokeWidth={1.7} /><span>Parked settings enabled</span></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">WARNING-ONLY ADAS</span>
            <h1>{views.find((item) => item.key === view)?.label}</h1>
          </div>
          <div className="topbarStatus">
            <span className="systemReady"><ShieldCheck strokeWidth={1.7} /> System ready</span>
            <button
              type="button"
              className={`gpsControl gps-${gpsState}`}
              onClick={gpsState === 'device' ? useSimulator : useDeviceGps}
            >
              <LocateFixed strokeWidth={1.7} />
              {gpsState === 'requesting' ? 'Requesting GPS…' : gpsState === 'device' ? 'Device GPS' : gpsState === 'denied' ? 'GPS unavailable' : 'Use device GPS'}
            </button>
            <span className="battery"><BatteryMedium strokeWidth={1.7} /> 76%</span>
          </div>
        </header>

        {view === 'drive' ? (
          <div className="driveLayout viewEnter">
            <section className="driveHero surface">
              <div className="driveHeader">
                <span className="liveState"><i /> LIVE SAFETY VIEW</span>
                <span className="locationLine"><MapPinned strokeWidth={1.6} /> {formatCoordinate(frame.vehicle.lat)}, {formatCoordinate(frame.vehicle.lng)}</span>
              </div>

              <div className="driveStage">
                <div className="speedCluster">
                  <span className="speedValue">{Math.round(speed)}</span>
                  <span className="speedUnit">km/h</span>
                  <span className="speedLimit">80</span>
                </div>

                <div className="roadScene" aria-label="Forward vehicle safety visualization">
                  <div className="roadPerspective" />
                  <div className="lane leftLane" />
                  <div className="lane rightLane" />
                  <div className="rangeArc arcOne" />
                  <div className="rangeArc arcTwo" />
                  {frontObject ? (
                    <div
                      className={`leadVehicle severity-${frontObject.severity}`}
                      style={{
                        top: `${Math.max(11, Math.min(35, 40 - frontObject.distanceM * 0.65))}%`,
                        transform: `translateX(-50%) scale(${Math.max(0.84, Math.min(1.16, 1.24 - frontObject.distanceM / 88))})`,
                      }}
                    >
                      <ObjectGlyph kind={frontObject.kind} />
                      <span>{Math.round(frontObject.distanceM)} m</span>
                    </div>
                  ) : null}
                  <div className="egoVehicle"><CarFront strokeWidth={1.6} /><i /></div>
                  <div className={`driveStatus severity-${overallSeverity}`}>
                    {overallSeverity === 'critical' ? <AlertTriangle strokeWidth={1.8} /> : <ShieldCheck strokeWidth={1.8} />}
                    <span><strong>{status.title}</strong><small>{status.subtitle}</small></span>
                  </div>
                </div>

                <div className="driveMetrics">
                  <Metric label="Front gap" value={gap.toFixed(0)} unit="m" />
                  <Metric label="TTC" value={ttc.toFixed(1)} unit="s" />
                  <Metric label="Heading" value={Math.round(frame.vehicle.headingDeg).toString()} unit="°" />
                </div>
              </div>
            </section>

            <aside className="driveSide">
              <section className={`attentionCard surface severity-${overallSeverity}`}>
                <div className="attentionIcon">
                  {overallSeverity === 'critical' ? <AlertTriangle strokeWidth={1.7} /> : <ShieldCheck strokeWidth={1.7} />}
                </div>
                <div>
                  <span className="eyebrow">CURRENT STATUS</span>
                  <h2>{status.title}</h2>
                  <p>{primaryAlert?.message ?? status.subtitle}</p>
                </div>
                {primaryAlert ? <button type="button" onClick={() => setView('map')}>View location <ChevronRight /></button> : null}
              </section>

              <section className="miniMapCard surface">
                <div className="sectionTitle"><span><Navigation strokeWidth={1.7} /> Nearby</span><button type="button" onClick={() => setView('map')}>Open map</button></div>
                <GpsSafetyMap vehicle={frame.vehicle} objects={frame.objects} compact />
              </section>

              <section className="nearbyCard surface">
                <div className="sectionTitle"><span><Radio strokeWidth={1.7} /> Detected objects</span><b>{frame.objects.length}</b></div>
                <div className="nearbyList">
                  {frame.objects.slice(0, 3).map((object) => (
                    <button type="button" key={object.id} onClick={() => setView('objects')} className="nearbyRow">
                      <span className={`objectGlyph severity-${object.severity}`}><ObjectGlyph kind={object.kind} /></span>
                      <span><strong>{object.kind}</strong><small>{object.zone.replace('-', ' ')} · {Math.round(object.confidence * 100)}%</small></span>
                      <b>{object.distanceM.toFixed(0)} m</b>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        {view === 'map' ? (
          <div className="mapLayout viewEnter">
            <section className="mapMain surface">
              <div className="sectionTitle large">
                <span><MapPinned strokeWidth={1.7} /> Live position</span>
                <div className="mapMeta"><span>{formatCoordinate(frame.vehicle.lat)}</span><span>{formatCoordinate(frame.vehicle.lng)}</span><span>{Math.round(frame.vehicle.headingDeg)}°</span></div>
              </div>
              <GpsSafetyMap vehicle={frame.vehicle} objects={frame.objects} />
            </section>
            <aside className="mapSide">
              <section className="positionCard surface">
                <span className="eyebrow">POSITION SOURCE</span>
                <div className="positionSource"><LocateFixed strokeWidth={1.7} /><span><strong>{frame.vehicle.source === 'device-gps' ? 'Device GPS' : 'GNSS simulator'}</strong><small>Accuracy ±{frame.vehicle.accuracyM.toFixed(1)} m</small></span></div>
                <div className="positionGrid">
                  <Metric label="Latitude" value={formatCoordinate(frame.vehicle.lat)} />
                  <Metric label="Longitude" value={formatCoordinate(frame.vehicle.lng)} />
                  <Metric label="Heading" value={Math.round(frame.vehicle.headingDeg).toString()} unit="°" />
                  <Metric label="Speed" value={Math.round(frame.vehicle.speedKmh).toString()} unit="km/h" />
                </div>
              </section>
              <section className="mapAlerts surface">
                <div className="sectionTitle"><span><Bell strokeWidth={1.7} /> Location alerts</span><b>{frame.alerts.length}</b></div>
                <div className="alertStack compactAlerts">
                  {sortedAlerts.length === 0 ? <div className="emptyState"><ShieldCheck /> No active location alerts</div> : sortedAlerts.slice(0, 4).map((alert) => <AlertRow key={alert.id} alert={alert} onMap={() => undefined} />)}
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        {view === 'objects' ? (
          <div className="objectView viewEnter">
            <section className="objectSummary surface">
              <div><span className="eyebrow">PERCEPTION</span><h2>{frame.objects.length} objects tracked</h2><p>Camera and radar fusion with GPS-projected positions.</p></div>
              <div className="summaryStats">
                <span><strong>{frame.objects.filter((item) => item.severity === 'critical').length}</strong>critical</span>
                <span><strong>{frame.objects.filter((item) => item.severity === 'caution').length}</strong>caution</span>
                <span><strong>{frame.objects.filter((item) => item.severity === 'safe').length}</strong>safe</span>
              </div>
            </section>
            <section className="objectGrid">
              {frame.objects.map((object) => (
                <article key={object.id} className={`objectCard surface severity-${object.severity}`}>
                  <div className="objectCardTop">
                    <span className={`objectGlyph large severity-${object.severity}`}><ObjectGlyph kind={object.kind} /></span>
                    <div><span className="eyebrow">{object.zone.replace('-', ' ')}</span><h3>{object.kind}</h3></div>
                    <SeverityPill severity={object.severity} />
                  </div>
                  <div className="objectMetrics">
                    <Metric label="Distance" value={object.distanceM.toFixed(1)} unit="m" />
                    <Metric label="Confidence" value={Math.round(object.confidence * 100).toString()} unit="%" />
                    <Metric label="Bearing" value={Math.round(object.bearingDeg).toString()} unit="°" />
                  </div>
                  <div className="objectLocation"><MapPinned strokeWidth={1.6} /><span>{formatCoordinate(object.position.lat)}, {formatCoordinate(object.position.lng)}</span></div>
                  <button type="button" className="secondaryButton" onClick={() => setView('map')}>Show on map <ChevronRight /></button>
                </article>
              ))}
            </section>
          </div>
        ) : null}

        {view === 'alerts' ? (
          <div className="alertsView viewEnter">
            <section className="alertsHero surface">
              <span className={`alertHeroIcon severity-${overallSeverity}`}><Bell strokeWidth={1.7} /></span>
              <div><span className="eyebrow">ALERT CENTER</span><h2>{frame.alerts.length === 0 ? 'No active alerts' : `${frame.alerts.length} active alert${frame.alerts.length > 1 ? 's' : ''}`}</h2><p>Every warning includes the detected object and its projected GPS position.</p></div>
            </section>
            <section className="alertList surface">
              {sortedAlerts.length === 0 ? (
                <div className="emptyState large"><ShieldCheck strokeWidth={1.6} /><span><strong>Road environment clear</strong><small>No active location or object warnings.</small></span></div>
              ) : (
                sortedAlerts.map((alert) => <AlertRow key={alert.id} alert={alert} onMap={() => setView('map')} />)
              )}
            </section>
          </div>
        ) : null}

        {view === 'trip' ? (
          <div className="tripView viewEnter">
            <section className="tripSummary surface">
              <div className="scoreRing"><strong>92</strong><small>Safety</small></div>
              <div><span className="eyebrow">CURRENT SESSION</span><h2>36.4 km monitored</h2><p>Location-aware safety events are stored with object type, severity and GPS coordinates.</p></div>
              <div className="tripMetrics">
                <Metric label="Alerts" value="3" />
                <Metric label="Critical" value="1" />
                <Metric label="Follow time" value="48" unit="s" />
              </div>
            </section>
            <div className="tripGrid">
              <section className="surface tripMap"><div className="sectionTitle"><span><Route strokeWidth={1.7} /> Route and incidents</span></div><GpsSafetyMap vehicle={frame.vehicle} objects={frame.objects} /></section>
              <section className="surface eventTimeline"><div className="sectionTitle"><span><ChartNoAxesColumnIncreasing strokeWidth={1.7} /> Event timeline</span></div><div className="timelineRail"><i /><i /><i className="criticalNode" /><i className="cautionNode" /><i /></div><div className="eventRows"><p><span className="severityDot critical" /> Critical following distance <b>14:32</b></p><p><span className="severityDot caution" /> Pedestrian proximity <b>14:41</b></p><p><span className="severityDot safe" /> Sensor recovery <b>14:44</b></p></div></section>
            </div>
          </div>
        ) : null}

        {view === 'vehicle' ? (
          <div className="vehicleView viewEnter">
            <section className="vehicleHero surface">
              <span className="vehicleIcon"><CarFront strokeWidth={1.5} /></span>
              <div><span className="eyebrow">ELECTRIC SUV PROFILE</span><h2>Vehicle safety interface</h2><p>Read-only CAN integration. KINGMAST does not command braking, steering or throttle.</p></div>
              <span className="warningOnly"><ShieldCheck /> Warning only</span>
            </section>
            <section className="sensorPanel surface">
              <div className="sectionTitle large"><span><SlidersHorizontal strokeWidth={1.7} /> Sensor health</span><span className="nominalText">{Object.values(frame.sensors).every((state) => state === 'ok') ? 'All systems nominal' : 'Reduced confidence'}</span></div>
              <div className="sensorGrid">{sensorRows.map((sensor) => <SensorStatus key={sensor.label} {...sensor} />)}</div>
            </section>
            <section className="capabilityGrid">
              <article className="surface capability"><CarFront /><span><strong>CAN read-only</strong><small>Vehicle telemetry input only</small></span></article>
              <article className="surface capability"><Navigation /><span><strong>GPS positioning</strong><small>GNSS or device GPS</small></span></article>
              <article className="surface capability"><Radio /><span><strong>Object detection</strong><small>Camera + radar fusion</small></span></article>
              <article className="surface capability"><AlertTriangle /><span><strong>No control authority</strong><small>No brake, steer or throttle output</small></span></article>
            </section>
          </div>
        ) : null}
      </section>

      {settingsOpen ? (
        <div className="sheetBackdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settingsSheet" role="dialog" aria-modal="true" aria-label="Parked settings" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">VEHICLE PARKED</span><h2>Settings</h2></div><button type="button" className="iconButton" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X /></button></header>
            <p className="settingsNotice"><CircleParking /> Configuration is available only while parked. Driving alerts remain visible without interaction.</p>
            <SettingRow icon={Bell} label="Alert sensitivity"><Segmented values={['Low', 'Medium', 'High'] as const} value={sensitivity} onChange={setSensitivity} /></SettingRow>
            <SettingRow icon={Volume2} label="Alert sound"><Segmented values={['Off', 'Low', 'Medium', 'High'] as const} value={sound} onChange={setSound} /></SettingRow>
            <SettingRow icon={ShieldCheck} label="Local privacy"><button type="button" className={`toggle ${privacy ? 'on' : ''}`} aria-pressed={privacy} onClick={() => setPrivacy((value) => !value)}><i /></button></SettingRow>
            <SettingRow icon={LocateFixed} label="Position source"><button type="button" className="secondaryButton" onClick={gpsState === 'device' ? useSimulator : useDeviceGps}>{gpsState === 'device' ? 'Use simulator' : 'Use device GPS'}</button></SettingRow>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function AlertRow({ alert, onMap }: { alert: LocationAlert; onMap: () => void }) {
  return (
    <article className={`alertRow severity-${alert.severity}`}>
      <span className={`alertRowIcon severity-${alert.severity}`}><AlertTriangle strokeWidth={1.7} /></span>
      <div className="alertCopy"><div><strong>{alert.title}</strong><SeverityPill severity={alert.severity} /></div><p>{alert.message}</p><small><MapPinned strokeWidth={1.5} /> {formatCoordinate(alert.position.lat)}, {formatCoordinate(alert.position.lng)}</small></div>
      <button type="button" className="iconButton mapButton" onClick={onMap} aria-label={`Show ${alert.title} on map`}><MapPinned /></button>
    </article>
  );
}

function SettingRow({ icon: Icon, label, children }: { icon: typeof Bell; label: string; children: React.ReactNode }) {
  return <div className="settingRow"><span><Icon strokeWidth={1.7} />{label}</span>{children}</div>;
}

function Segmented<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return <div className="segmented">{values.map((item) => <button type="button" key={item} className={value === item ? 'selected' : ''} aria-pressed={value === item} onClick={() => onChange(item)}>{item}</button>)}</div>;
}
