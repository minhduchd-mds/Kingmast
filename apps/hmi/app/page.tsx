'use client';

import {
  AlertTriangle,
  BatteryMedium,
  Bell,
  Camera,
  CarFront,
  CircleParking,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Map,
  Radio,
  RotateCcw,
  ShieldCheck,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MOTION, useAnimatedNumber } from '../lib/motion';

type Severity = 'safe' | 'caution' | 'critical';
type SensorState = 'ok' | 'degraded' | 'offline';
type ThemeMode = 'auto' | 'night' | 'day';
type Sensitivity = 'Low' | 'Medium' | 'High';
type VolumeLevel = 'Off' | 'Low' | 'Medium' | 'High';
type Retention = 7 | 30 | 90;

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

function SensorCard({
  icon: Icon,
  name,
  state,
}: {
  icon: typeof Radio;
  name: string;
  state: SensorState;
}) {
  const label = state === 'ok' ? 'OK' : state === 'degraded' ? 'CHECK' : 'OFFLINE';
  return (
    <div className={`sensor sensor-${state}`}>
      <span className="sensorIcon" aria-hidden="true">
        <Icon />
      </span>
      <span>{name}</span>
      <strong>{label}</strong>
      <i className="sensorDot" aria-hidden="true" />
    </div>
  );
}

function Segmented<T extends string | number>({
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
          {typeof item === 'number' ? ' days' : ''}
        </button>
      ))}
    </div>
  );
}

export default function Page() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [booted, setBooted] = useState(false);
  const [ambientTheme, setAmbientTheme] = useState<'night' | 'day'>('night');
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [sensitivity, setSensitivity] = useState<Sensitivity>('Medium');
  const [volume, setVolume] = useState<VolumeLevel>('Medium');
  const [privacy, setPrivacy] = useState(true);
  const [retention, setRetention] = useState<Retention>(30);

  const scenario = scenarios[scenarioIndex];

  useEffect(() => {
    const bootTimer = window.setTimeout(() => setBooted(true), 1050);
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

  const sensors = useMemo(
    () => [
      { name: 'Front radar', icon: Radio, state: 'ok' as SensorState },
      { name: 'Rear radar', icon: Radio, state: 'ok' as SensorState },
      { name: 'Camera', icon: Camera, state: cameraState },
      { name: 'CAN', icon: Gauge, state: canState },
      { name: 'GNSS / IMU', icon: Map, state: 'ok' as SensorState },
      { name: 'ECU', icon: Cpu, state: 'ok' as SensorState },
    ],
    [cameraState, canState],
  );

  const warningCopy =
    severity === 'critical'
      ? { title: 'SLOW DOWN', hint: 'Increase following distance now' }
      : severity === 'caution'
        ? { title: 'INCREASE GAP', hint: 'Following distance is reducing' }
        : { title: 'MONITORING', hint: 'Following distance is stable' };

  const leadTop = clamp(44 - frontGap * 0.72, 10, 36);
  const leadScale = clamp(1.28 - frontGap / 95, 0.82, 1.14);
  const frontRadarTop = clamp(8 + (40 - frontGap) * 0.34, 7, 18);
  const parked = true;

  return (
    <main className={`shell severity-${severity} theme-${theme}`}>
      <div className={`startup ${booted ? 'startup-complete' : ''}`} aria-hidden={booted}>
        <div className="startupBrand"><span className="mark">K</span><strong>KINGMAST</strong></div>
        <div className="startupTrack"><i /></div>
        <small>SAFETY SYSTEM SELF-CHECK</small>
      </div>

      <header>
        <div className="brand"><span className="mark">K</span><strong>KINGMAST</strong></div>
        <div className="systemHealth"><i className="healthDot" /> SYSTEM READY</div>
        <div className="legend" aria-label="Safety severity legend">
          <span className="safe">● SAFE</span>
          <span className="caution">● CAUTION</span>
          <span className="critical">● CRITICAL</span>
        </div>
      </header>

      <section className="grid">
        <article className="panel drive">
          <h2><b>1</b> DRIVE <em><BatteryMedium /> 76%</em></h2>
          <div className="driveRow">
            <div className="speedColumn">
              <div className="speed numberTransition">{Math.round(speed)}</div>
              <div className="unit">km/h</div>
              <div className="limit">80</div>
              <small>SPEED LIMIT</small>
            </div>

            <div className="road">
              <div className="roadFlow" aria-hidden="true" />
              <div className="laneGlow" aria-hidden="true" />
              <div className="distanceWave wave1" aria-hidden="true" />
              <div className="distanceWave wave2" aria-hidden="true" />
              <CarFront
                className={`lead lead-${severity}`}
                style={{ top: `${leadTop}%`, transform: `translateX(-50%) scale(${leadScale})` }}
              />
              <CarFront className="ego" />
              <div className={`status status-${severity}`}>
                {severity === 'critical' ? <AlertTriangle /> : <ShieldCheck />}
                {severity === 'safe' ? 'SAFE' : severity === 'caution' ? 'CAUTION' : 'SLOW DOWN'}
              </div>
            </div>

            <div className="metrics">
              <span><CarFront /> FRONT GAP <strong>{frontGap.toFixed(0)} m</strong></span>
              <span><Gauge /> HEADWAY <strong>{headway.toFixed(1)} s</strong></span>
              <span><CarFront /> REAR GAP <strong>{rearGap.toFixed(0)} m</strong></span>
            </div>
          </div>
        </article>

        <article className={`panel warning warning-${severity}`} aria-live={severity === 'critical' ? 'assertive' : 'polite'}>
          <h2><b>2</b> WARNING <em className={`severityPill ${severity}`}>{severity.toUpperCase()}</em></h2>
          <div className="warningTitle">
            <AlertTriangle />
            <strong key={warningCopy.title}>{warningCopy.title}</strong>
            <AlertTriangle />
          </div>
          <p className="warningHint">{warningCopy.hint}</p>
          <div className="warningBody">
            <div><small>DISTANCE</small><strong>{frontGap.toFixed(0)}<i> m</i></strong></div>
            <div className="hazardVehicle">
              <CarFront className="dangerCar" />
              <span className="hazardHalo" aria-hidden="true" />
            </div>
            <div><small>TTC</small><strong>{ttc.toFixed(1)}<i> s</i></strong></div>
          </div>
          <div className="chevrons" aria-hidden="true"><i>⌃</i><i>⌃</i><i>⌃</i></div>
        </article>

        <article className="panel surround">
          <h2><b>3</b> SURROUND <em><Radio /> LIVE</em></h2>
          <div className="surroundLayout">
            <div className={`radar radar-${severity}`}>
              <div className="radarSweep" aria-hidden="true" />
              <div className="ring r1" /><div className="ring r2" /><div className="ring r3" /><div className="ring r4" />
              <CarFront className="centerCar" />
              <div className={`radarTarget target-front ${severity}`} style={{ top: `${frontRadarTop}%` }}><CarFront /><strong>{frontGap.toFixed(0)} m</strong></div>
              <div className="radarTarget target-left caution"><CarFront /><strong>{leftGap.toFixed(0)} m</strong></div>
              <div className="radarTarget target-right caution"><CarFront /><strong>{rightGap.toFixed(0)} m</strong></div>
              <div className="radarTarget target-rear safe"><CarFront /><strong>{rearGap.toFixed(0)} m</strong></div>
            </div>
            <div className="distanceLegend">
              <span><i className="criticalRing" /> 0–15 m <small>CRITICAL</small></span>
              <span><i className="cautionRing" /> 15–30 m <small>CAUTION</small></span>
              <span><i className="safeRing" /> &gt; 30 m <small>SAFE</small></span>
            </div>
          </div>
        </article>

        <article className="panel sensorsPanel">
          <h2><b>4</b> SENSORS <em>{cameraState === 'degraded' || canState === 'degraded' ? 'DEGRADED MODE' : 'ALL SYSTEMS NOMINAL'}</em></h2>
          <div className="sensorGrid">
            {sensors.map((sensor) => <SensorCard key={sensor.name} {...sensor} />)}
          </div>
          <div className={`degradedBanner ${cameraState === 'degraded' || canState === 'degraded' ? 'visible' : ''}`}>
            <WifiOff /> Reduced confidence — unavailable inputs are excluded from safety decisions.
          </div>
        </article>

        <article className="panel tripPanel">
          <h2><b>5</b> TRIP REPORT <em>36.4 km SESSION</em></h2>
          <div className="stats">
            <span className="scoreStat">
              <i className="scoreRing"><strong>92</strong></i>
              <label>SAFETY SCORE <small>/100</small></label>
            </span>
            <span><Map /> DISTANCE<strong>36.4<small> km</small></strong></span>
            <span><Bell /> ALERTS<strong>3</strong></span>
            <span><Gauge /> FOLLOW TIME<strong>48<small> s</small></strong></span>
          </div>
          <div className="timeline" aria-label="Alert timeline">
            <span className="timelineRail" />
            <i className="safeNode" /><i className="safeNode" /><i className="dangerNode"><AlertTriangle /></i><i className="warnNode"><AlertTriangle /></i><i className="warnNode"><AlertTriangle /></i>
          </div>
          <div className="reportBottom">
            <div className="alertSplit">
              <div className="donut" aria-label="33 percent critical, 67 percent caution"><span /></div>
              <div><p><i className="criticalDot" /> Critical <strong>1</strong></p><p><i className="cautionDot" /> Caution <strong>2</strong></p><p><i className="safeDot" /> Safe <strong>0</strong></p></div>
            </div>
            <div className="bars" aria-label="Safety score by distance segment">
              {[68, 79, 74, 81, 72].map((height, index) => <i key={index} style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }} />)}
            </div>
          </div>
        </article>

        <article className="panel settings">
          <h2><b>6</b> PARKED SETTINGS <em><CircleParking /> VEHICLE PARKED</em></h2>
          <p className="notice"><ShieldCheck /> Changes are available only while the vehicle is parked.</p>

          <div className="settingRow">
            <span><Bell /> Alert sensitivity</span>
            <Segmented value={sensitivity} values={['Low', 'Medium', 'High'] as const} onChange={setSensitivity} label="Alert sensitivity" />
          </div>
          <div className="settingRow">
            <span><Volume2 /> Alert sound</span>
            <Segmented value={volume} values={['Off', 'Low', 'Medium', 'High'] as const} onChange={setVolume} label="Alert sound" />
          </div>
          <div className="settingRow">
            <span><ShieldCheck /> Privacy</span>
            <button type="button" className={`toggle ${privacy ? 'on' : ''}`} aria-pressed={privacy} onClick={() => setPrivacy((value) => !value)} disabled={!parked}><i /></button>
          </div>
          <div className="settingRow">
            <span><Database /> Data retention</span>
            <Segmented value={retention} values={[7, 30, 90] as const} onChange={setRetention} label="Data retention" />
          </div>
          <div className="settingRow">
            <span><HardDrive /> Display mode</span>
            <Segmented value={themeMode} values={['auto', 'night', 'day'] as const} onChange={setThemeMode} label="Display mode" />
          </div>
          <button type="button" className="vehicleProfile"><CarFront /> Vehicle profile <span>Electric SUV <RotateCcw /></span></button>
        </article>
      </section>
    </main>
  );
}
