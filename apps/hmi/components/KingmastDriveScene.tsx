'use client';

import { AlertTriangle, CarFront, Gauge, Navigation, Radio, ShieldCheck } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { TelemetryFrame } from '@kingmast/contracts';
import type { Esp32C3BenchPayload } from '../lib/esp32-c3-bench';
import styles from './KingmastDriveScene.module.css';

type ViewMode = '2d' | '3d';
type Tone = 'safe' | 'watch' | 'warning' | 'danger' | 'lost';

type Props = {
  payload: Esp32C3BenchPayload | null;
  frame: TelemetryFrame | null;
  alert: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toneFor(payload: Esp32C3BenchPayload | null): Tone {
  if (payload?.risk === 'DANGER') return 'danger';
  if (payload?.risk === 'WARNING') return 'warning';
  if (payload?.risk === 'WATCH') return 'watch';
  if (payload?.risk === 'SENSOR_LOST') return 'lost';
  return 'safe';
}

function toneLabel(tone: Tone) {
  if (tone === 'danger') return 'DANGER';
  if (tone === 'warning') return 'WARNING';
  if (tone === 'watch') return 'WATCH';
  if (tone === 'lost') return 'SENSOR LOST';
  return 'SAFE';
}

export default function KingmastDriveScene({ payload, frame, alert }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const tone = toneFor(payload);
  const sensorOnline = payload?.sensorOnline ?? false;
  const distance = sensorOnline && payload && payload.distanceM >= 0 ? payload.distanceM : null;
  const ttc = sensorOnline && payload && payload.ttc > 0 ? payload.ttc : null;
  const speed = Math.max(0, payload?.speedKph ?? 0);
  const relativeSpeed = payload?.relativeSpeedMps ?? 0;
  const closingSpeed = Math.max(0, -relativeSpeed);

  const sceneMetrics = useMemo(() => {
    const proximity = distance === null ? 0 : 1 - clamp(distance / 60, 0, 1);
    const targetY = 29 + proximity * 24;
    const targetScale = 0.72 + proximity * 0.58;
    const laneDuration = clamp(2.8 - speed / 42, 0.65, 2.8);
    const closingShift = clamp(closingSpeed * 1.8, 0, 16);
    return { proximity, targetY, targetScale, laneDuration, closingShift };
  }, [closingSpeed, distance, speed]);

  const sceneStyle = {
    '--target-y': `${sceneMetrics.targetY}%`,
    '--target-scale': String(sceneMetrics.targetScale),
    '--lane-duration': `${sceneMetrics.laneDuration}s`,
    '--closing-shift': `${sceneMetrics.closingShift}px`,
  } as CSSProperties;

  return (
    <section
      className={`${styles.scene} ${styles[`tone_${tone}`]} ${viewMode === '2d' ? styles.mode2d : styles.mode3d}`}
      style={sceneStyle}
      data-risk={toneLabel(tone)}
      data-testid="kingmast-drive-scene"
      aria-label="KINGMAST driving visualization"
    >
      <div className={styles.ambientSky} aria-hidden="true">
        <span className={styles.starField} />
        <span className={styles.horizonGlow} />
        <span className={`${styles.tower} ${styles.towerA}`} />
        <span className={`${styles.tower} ${styles.towerB}`} />
        <span className={`${styles.tower} ${styles.towerC}`} />
        <span className={`${styles.tower} ${styles.towerD}`} />
      </div>

      <div className={styles.roadWorld} aria-hidden="true">
        <span className={styles.roadEdgeLeft} />
        <span className={styles.roadEdgeRight} />
        <span className={`${styles.laneFlow} ${styles.laneFlowLeft}`} />
        <span className={`${styles.laneFlow} ${styles.laneFlowCenter}`} />
        <span className={`${styles.laneFlow} ${styles.laneFlowRight}`} />
        <span className={`${styles.demoTraffic} ${styles.demoTrafficA}`}><CarFront /></span>
        <span className={`${styles.demoTraffic} ${styles.demoTrafficB}`}><CarFront /></span>
        <span className={`${styles.demoTraffic} ${styles.demoTrafficC}`}><CarFront /></span>
      </div>

      <div className={styles.topOverlay}>{alert}</div>

      <div className={styles.sceneTelemetry}>
        <div><Gauge size={16} /><span>Speed</span><strong>{Math.round(speed)} km/h</strong></div>
        <div><Radio size={16} /><span>Front</span><strong>{distance === null ? '--' : `${distance.toFixed(1)} m`}</strong></div>
        <div><AlertTriangle size={16} /><span>TTC</span><strong>{ttc === null ? '--' : `${ttc.toFixed(2)} s`}</strong></div>
      </div>

      <div className={styles.assistRail}>
        <span className={styles.assistTitle}>DRIVER ASSIST</span>
        <span><i className={styles.statusDot} /> Advisory only</span>
        <span><Navigation size={15} /> Lane context</span>
        <span><ShieldCheck size={15} /> Human in control</span>
      </div>

      {distance !== null ? (
        <div className={styles.targetTrack} data-critical={tone === 'danger'}>
          <div className={styles.targetDistance}>{distance.toFixed(1)} m</div>
          <div className={styles.targetBox}>
            <CarFront size={35} />
            <span className={styles.targetCorners} aria-hidden="true" />
          </div>
          <div className={styles.targetMeta}>
            <span>{relativeSpeed > 0 ? '+' : ''}{relativeSpeed.toFixed(1)} m/s</span>
            <b>{toneLabel(tone)}</b>
          </div>
        </div>
      ) : null}

      <div className={styles.sensorField} aria-hidden="true">
        <span className={`${styles.sensorSector} ${styles.sectorLeft}`} />
        <span className={`${styles.sensorSector} ${styles.sectorFront}`} />
        <span className={`${styles.sensorSector} ${styles.sectorRight}`} />
        <span className={`${styles.radarPulse} ${styles.radar1}`} />
        <span className={`${styles.radarPulse} ${styles.radar2}`} />
        <span className={`${styles.radarPulse} ${styles.radar3}`} />
        <span className={styles.radarSweep} />
      </div>

      <div className={styles.egoVehicle}>
        <span className={styles.egoAura} aria-hidden="true" />
        <img src="/assets/kingmast/vehicle/kingmast-front-520.png" alt="KINGMAST vehicle visualization" draggable={false} />
        <span className={styles.egoCaption}>KINGMAST</span>
      </div>

      <div className={`${styles.zoneChip} ${styles.zoneLeft}`}>
        <CarFront size={16} /><span>Trái</span><strong>--</strong><small>chưa nối</small>
      </div>
      <div className={`${styles.zoneChip} ${styles.zoneRight}`}>
        <CarFront size={16} /><span>Phải</span><strong>--</strong><small>chưa nối</small>
      </div>
      <div className={`${styles.zoneChip} ${styles.zoneRear}`}>
        <CarFront size={16} /><span>Phía sau</span><strong>--</strong><small>chưa nối</small>
      </div>

      {!sensorOnline ? (
        <div className={styles.degradedOverlay} role="status">
          <AlertTriangle size={22} />
          <span><strong>FRONT SENSOR UNAVAILABLE</strong><small>Không hiển thị khoảng cách hoặc TTC giả khi cảm biến mất.</small></span>
        </div>
      ) : null}

      <div className={styles.sceneFooter}>
        <div className={styles.truthBadge}>
          <i className={sensorOnline ? styles.truthLive : styles.truthLost} />
          <span>{frame?.vehicle.source === 'simulator' ? 'ESP32 BENCH TELEMETRY' : 'RUNTIME TELEMETRY'}</span>
        </div>
        <div className={styles.viewToggle} aria-label="Chế độ hiển thị">
          <span>VIEW</span>
          <button type="button" className={viewMode === '2d' ? styles.viewActive : ''} onClick={() => setViewMode('2d')}>2D</button>
          <button type="button" className={viewMode === '3d' ? styles.viewActive : ''} onClick={() => setViewMode('3d')}>3D</button>
        </div>
      </div>
    </section>
  );
}
