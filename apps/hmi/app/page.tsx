'use client';

import {
  AlertTriangle,
  BatteryMedium,
  Bell,
  Camera,
  CarFront,
  ChevronRight,
  CircleParking,
  Cpu,
  Gauge,
  Map,
  Moon,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MOTION, useAnimatedNumber } from '../lib/motion';

type Severity = 'safe' | 'caution' | 'critical';
type SensorState = 'ok' | 'degraded' | 'offline';
type ViewKey = 'drive' | 'surround' | 'trip' | 'vehicle';
type ThemeMode = 'auto' | 'night' | 'day';
type Sensitivity = 'Low' | 'Medium' | 'High';
type VolumeLevel = 'Off' | 'Low' | 'Medium' | 'High';

type Scenario = {
  speed: number;
  leadSpeed: number;
  front: number;
  rear: number;
  left: number;
  right: number;
};

const scenarios: Scenario[] = [
  { speed: 68, leadSpeed: 55, front: 42, rear: 18, left: 26, right: 32 },
  { speed: 70, leadSpeed: 52, front: 34, rear: 17, left: 24, right: 29 },
  { speed: 72, leadSpeed: 48, front: 25, rear: 16, left: 20, right: 25 },
  { speed: 71, leadSpeed: 38, front: 14, rear: 15, left: 17, right: 21 },
  { speed: 64, leadSpeed: 47, front: 20, rear: 18, left: 19, right: 24 },
  { speed: 66, leadSpeed: 56, front: 38, rear: 20, left: 27, right: 31 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function severityFor(frontGap: number, ttc: number): Severity {
  if (frontGap < 15 || ttc < 1.8) return 'critical';
  if (frontGap < 30 || ttc < 3.5) return 'caution';
  return 'safe';
}

function SensorRow({ name, state }: { name: string; state: SensorState }) {
  const status = state === 'ok' ? 'Ready' : state === 'degraded' ? 'Limited' : 'Offline';
  return (
    <div className={`sensorRow sensor-${state}`}>
      <span className="sensorIndicator" aria-hidden="true" />
      <div><strong>{name}</strong><small>{status}</small></div>
      {state === 'ok' ? <ShieldCheck /> : <AlertTriangle />}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  values,
  onChange,
  label,
}: {
  value: T;
  values: readonly T[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {values.map((item) => (
        <button
          type="button"
          key={item}
          className={value === item ? 'selected' : ''}
          aria-pressed={value === item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>('drive');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ambientTheme, setAmbientTheme] = useState<'night' | 'day'>('night');
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [sensitivity, setSensitivity] = useState<Sensitivity>('Medium');
  const [volume, setVolume] = useState<VolumeLevel>('Medium');
  const [privacy, setPrivacy] = useState(true);

  const scenario = scenarios[scenarioIndex];

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setBooted(true), 900);
    const scenarioTimer = window.setInterval(
      () => setScenarioIndex((index) => (index + 1) % scenarios.length),
      2800,
    );
    const syncAmbient = () => {
      const hour = new Date().getHours();
      setAmbientTheme(hour >= 7 && hour < 18 ? 'day' : 'night');
    };
    syncAmbient();
    return () => {
      window.clearTimeout(bootTimer);
      window.clearInterval(scenarioTimer);
    };
  }, []);

  const closingSpeed = Math.max(0, (scenario.speed - scenario.leadSpeed) / 3.6);
  const ttcTarget = closingSpeed > 0.1 ? scenario.front / closingSpeed : 99;
  const severity = severityFor(scenario.front, ttcTarget);
  const theme = themeMode === 'auto' ? ambientTheme : themeMode;

  const speed = useAnimatedNumber(scenario.speed, MOTION.ms.emphasized);
  const frontGap = useAnimatedNumber(scenario.front, MOTION.ms.emphasized);
  const rearGap = useAnimatedNumber(scenario.rear, MOTION.ms.standard);
  const leftGap = useAnimatedNumber(scenario.left, MOTION.ms.standard);
  const rightGap = useAnimatedNumber(scenario.right, MOTION.ms.standard);
  const ttc = useAnimatedNumber(Math.min(ttcTarget, 9.9), MOTION.ms.standard);
  const headway = frontGap / Math.max(1, speed / 3.6);

  const cameraState: SensorState = scenarioIndex === 2 || scenarioIndex === 3 ? 'degraded' : 'ok';
  const canState: SensorState = scenarioIndex === 4 ? 'degraded' : 'ok';
  const sensorDegraded = cameraState !== 'ok' || canState !== 'ok';

  const sensors = useMemo(
    () => [
      { name: 'Front radar', state: 'ok' as SensorState },
      { name: 'Rear radar', state: 'ok' as SensorState },
      { name: 'Camera', state: cameraState },
      { name: 'Vehicle bus', state: canState },
      { name: 'GNSS / IMU', state: 'ok' as SensorState },
      { name: 'Safety ECU', state: 'ok' as SensorState },
    ],
    [cameraState, canState],
  );

  const leadTop = clamp(45 - frontGap * 0.72, 10, 36);
  const leadScale = clamp(1.28 - frontGap / 95, 0.82, 1.14);
  const statusCopy = severity === 'critical'
    ? { eyebrow: 'Collision risk', title: 'Slow down', detail: 'Increase following distance now.' }
    : severity === 'caution'
      ? { eyebrow: 'Following distance', title: 'Increase gap', detail: 'The vehicle ahead is getting closer.' }
      : { eyebrow: 'Driver assistance', title: 'Clear ahead', detail: 'Following distance is stable.' };

  const navItems: Array<{ key: ViewKey; label: string; icon: typeof Gauge }> = [
    { key: 'drive', label: 'Drive', icon: Gauge },
    { key: 'surround', label: 'Around', icon: Radio },
    { key: 'trip', label: 'Trip', icon: Map },
    { key: 'vehicle', label: 'Vehicle', icon: CarFront },
  ];

  return (
    <main className={`systemApp theme-${theme} severity-${severity}`}>
      <div className={`bootScreen ${booted ? 'bootComplete' : ''}`} aria-hidden={booted}>
        <div className="bootMark">K</div>
        <strong>KINGMAST</strong>
        <span>Safety systems ready</span>
      </div>

      <header className="systemHeader">
        <div className="brandLockup">
          <span className="appMark">K</span>
          <div><strong>KINGMAST</strong><small>Driver Assistance</small></div>
        </div>
        <div className="headerStatus">
          <span className={`systemPill ${sensorDegraded ? 'limited' : ''}`}>
            {sensorDegraded ? <WifiOff /> : <Wifi />}
            {sensorDegraded ? 'Limited sensing' : 'Systems ready'}
          </span>
          <span className="batteryPill"><BatteryMedium /> 76%</span>
        </div>
      </header>

      <div className="appBody">
        <nav className="sideRail" aria-label="KINGMAST sections">
          <div className="navGroup">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                className={activeView === key ? 'active' : ''}
                aria-current={activeView === key ? 'page' : undefined}
                onClick={() => setActiveView(key)}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button type="button" className={`settingsButton ${settingsOpen ? 'active' : ''}`} onClick={() => setSettingsOpen(true)}>
            <SlidersHorizontal />
            <span>Settings</span>
          </button>
        </nav>

        <section className="workspace">
          {activeView === 'drive' && (
            <div className="driveView viewEnter">
              <section className="roadStage" aria-label="Driving situation">
                <div className="stageTop">
                  <div className="speedCluster">
                    <span className="eyebrow">Speed</span>
                    <div><strong>{Math.round(speed)}</strong><small>km/h</small></div>
                  </div>
                  <div className="speedLimit" aria-label="Speed limit 80 kilometers per hour"><span>80</span><small>LIMIT</small></div>
                  <div className={`stageState state-${severity}`}>
                    {severity === 'critical' ? <AlertTriangle /> : <ShieldCheck />}
                    <span>{severity === 'safe' ? 'Safe distance' : severity === 'caution' ? 'Watch distance' : 'Slow down'}</span>
                  </div>
                </div>

                <div className="roadScene">
                  <div className="horizonGlow" aria-hidden="true" />
                  <div className="roadSurface" aria-hidden="true" />
                  <div className="lane laneLeft" aria-hidden="true" />
                  <div className="lane laneRight" aria-hidden="true" />
                  <div className="laneCenterFlow" aria-hidden="true" />
                  <div className={`leadVehicle lead-${severity}`} style={{ top: `${leadTop}%`, transform: `translateX(-50%) scale(${leadScale})` }}>
                    <CarFront />
                    <span>{frontGap.toFixed(0)} m</span>
                  </div>
                  <div className="distanceArc arcOne" aria-hidden="true" />
                  <div className="distanceArc arcTwo" aria-hidden="true" />
                  <div className="egoVehicle"><CarFront /></div>
                  <div className="sideTarget leftTarget"><CarFront /><span>{leftGap.toFixed(0)} m</span></div>
                  <div className="sideTarget rightTarget"><CarFront /><span>{rightGap.toFixed(0)} m</span></div>
                </div>

                <div className="glanceStrip">
                  <div><span>Front gap</span><strong>{frontGap.toFixed(0)} m</strong></div>
                  <div><span>Headway</span><strong>{headway.toFixed(1)} s</strong></div>
                  <div><span>TTC</span><strong>{ttc.toFixed(1)} s</strong></div>
                  <div><span>Rear gap</span><strong>{rearGap.toFixed(0)} m</strong></div>
                </div>
              </section>

              <aside className="contextColumn">
                <section className={`safetyCard safety-${severity}`} aria-live={severity === 'critical' ? 'assertive' : 'polite'}>
                  <div className="safetyIcon">{severity === 'critical' ? <AlertTriangle /> : <ShieldCheck />}</div>
                  <span className="eyebrow">{statusCopy.eyebrow}</span>
                  <h1 key={statusCopy.title}>{statusCopy.title}</h1>
                  <p>{statusCopy.detail}</p>
                  <div className="safetyNumbers">
                    <div><span>Distance</span><strong>{frontGap.toFixed(0)} m</strong></div>
                    <div><span>Time to collision</span><strong>{ttc.toFixed(1)} s</strong></div>
                  </div>
                </section>

                <section className="compactCard">
                  <div className="sectionTitle"><div><span className="eyebrow">Vehicle sensing</span><h2>System status</h2></div><button type="button" onClick={() => setActiveView('vehicle')}>Details <ChevronRight /></button></div>
                  <SensorRow name="Front radar" state="ok" />
                  <SensorRow name="Camera" state={cameraState} />
                  <SensorRow name="Vehicle bus" state={canState} />
                </section>
              </aside>
            </div>
          )}

          {activeView === 'surround' && (
            <div className="detailView viewEnter">
              <div className="viewHeading"><div><span className="eyebrow">Live sensing</span><h1>Around the vehicle</h1><p>Only nearby objects relevant to the current driving path are emphasized.</p></div><span className={`systemPill ${severity}`}>{severity === 'safe' ? <ShieldCheck /> : <AlertTriangle />}{severity}</span></div>
              <div className="surroundStage">
                <div className="spatialGrid"><span className="orbit o1"/><span className="orbit o2"/><span className="orbit o3"/><span className="sweep"/>
                  <div className="centerVehicle"><CarFront /></div>
                  <div className={`object frontObject ${severity}`}><CarFront /><strong>{frontGap.toFixed(0)} m</strong><small>Ahead</small></div>
                  <div className="object leftObject caution"><CarFront /><strong>{leftGap.toFixed(0)} m</strong><small>Left</small></div>
                  <div className="object rightObject caution"><CarFront /><strong>{rightGap.toFixed(0)} m</strong><small>Right</small></div>
                  <div className="object rearObject safe"><CarFront /><strong>{rearGap.toFixed(0)} m</strong><small>Rear</small></div>
                </div>
                <div className="distanceKey"><div><span className="keyDot critical"/><strong>0–15 m</strong><small>Critical</small></div><div><span className="keyDot caution"/><strong>15–30 m</strong><small>Caution</small></div><div><span className="keyDot safe"/><strong>&gt; 30 m</strong><small>Clear</small></div></div>
              </div>
            </div>
          )}

          {activeView === 'trip' && (
            <div className="detailView viewEnter">
              <div className="viewHeading"><div><span className="eyebrow">Current session</span><h1>Trip summary</h1><p>A quiet review of safety events, intended for use while parked.</p></div><span className="parkedBadge"><CircleParking /> Parked</span></div>
              <div className="tripCards"><div className="scoreCard"><span className="eyebrow">Safety score</span><strong>92</strong><small>/ 100</small><div className="scoreTrack"><i /></div></div><div className="metricCard"><Map /><span>Distance</span><strong>36.4 km</strong></div><div className="metricCard"><Bell /><span>Alerts</span><strong>3</strong></div><div className="metricCard"><Gauge /><span>Following time</span><strong>48 s</strong></div></div>
              <section className="timelineCard"><div className="sectionTitle"><div><span className="eyebrow">Timeline</span><h2>Safety events</h2></div><span>36.4 km</span></div><div className="eventRail"><span/><i className="safeNode"/><i className="safeNode"/><i className="criticalNode"><AlertTriangle /></i><i className="cautionNode"><AlertTriangle /></i><i className="cautionNode"><AlertTriangle /></i></div><div className="timelineLabels"><span>Start</span><span>12 km</span><span>24 km</span><span>36.4 km</span></div></section>
            </div>
          )}

          {activeView === 'vehicle' && (
            <div className="detailView viewEnter">
              <div className="viewHeading"><div><span className="eyebrow">Electric SUV</span><h1>Vehicle systems</h1><p>Read-only sensing and connection health. KINGMAST does not command steering, braking, or throttle.</p></div><span className="parkedBadge"><CircleParking /> Parked</span></div>
              <div className="vehicleGrid"><section className="systemList"><div className="sectionTitle"><div><span className="eyebrow">Sensors</span><h2>Connection health</h2></div><span>{sensorDegraded ? 'Attention needed' : 'All ready'}</span></div>{sensors.map((sensor) => <SensorRow key={sensor.name} {...sensor} />)}</section><section className="vehicleInfo"><div className="infoIcon"><Cpu /></div><span className="eyebrow">Safety ECU</span><h2>Read-only vehicle integration</h2><p>Radar, camera, GNSS/IMU, and CAN telemetry are fused for warnings only.</p><div className="capabilityList"><span><ShieldCheck /> Brake commands disabled</span><span><ShieldCheck /> Steering commands disabled</span><span><ShieldCheck /> Throttle commands disabled</span></div></section></div>
            </div>
          )}
        </section>
      </div>

      {settingsOpen && (
        <div className="sheetBackdrop" role="presentation" onMouseDown={() => setSettingsOpen(false)}>
          <aside className="settingsSheet" role="dialog" aria-modal="true" aria-label="Parked settings" onMouseDown={(event) => event.stopPropagation()}>
            <div className="sheetHandle" aria-hidden="true" />
            <div className="sheetHeader"><div><span className="eyebrow">Vehicle parked</span><h2>Settings</h2></div><button type="button" className="doneButton" onClick={() => setSettingsOpen(false)}>Done</button></div>
            <div className="settingGroup"><div className="settingRow"><span><Bell /> Alert sensitivity</span><Segmented value={sensitivity} values={['Low', 'Medium', 'High'] as const} onChange={setSensitivity} label="Alert sensitivity" /></div><div className="settingRow"><span><Volume2 /> Alert sound</span><Segmented value={volume} values={['Off', 'Low', 'Medium', 'High'] as const} onChange={setVolume} label="Alert volume" /></div><div className="settingRow"><span><ShieldCheck /> Privacy</span><button type="button" className={`toggle ${privacy ? 'on' : ''}`} aria-pressed={privacy} onClick={() => setPrivacy((value) => !value)}><i /></button></div></div>
            <div className="settingGroup"><div className="settingRow"><span>{theme === 'night' ? <Moon /> : <Sun />} Appearance</span><Segmented value={themeMode} values={['auto', 'night', 'day'] as const} onChange={setThemeMode} label="Appearance" /></div><div className="settingRow readOnly"><span><Camera /> Camera diagnostics</span><strong>{cameraState === 'ok' ? 'Ready' : 'Check'}</strong></div><div className="settingRow readOnly"><span><Radio /> Radar diagnostics</span><strong>Ready</strong></div></div>
            <p className="sheetNote"><CircleParking /> Configuration is available only while the vehicle is parked.</p>
          </aside>
        </div>
      )}
    </main>
  );
}
