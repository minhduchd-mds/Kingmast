'use client';

import { Bell, Camera, Check, ChevronRight, Map, Mic, Route, Settings2, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Severity } from '@kingmast/contracts';

interface CameraActionContext {
  label: string;
  distanceM: number;
  speedLimit: number | null;
}

interface DriverInteractionLayerProps {
  visible: boolean;
  parked: boolean;
  severity: Severity;
  title: string;
  message: string;
  routeActive: boolean;
  routeLoading: boolean;
  camera: CameraActionContext | null;
  voiceEnabled: boolean;
  onVoiceChange: (enabled: boolean) => void;
  onNavigate: () => void;
  onAlerts: () => void;
  onSettings: () => void;
  onReroute: () => Promise<unknown>;
  onAlternatives: () => void;
}

type SheetKind = 'hazard' | 'camera' | null;

function distanceLabel(distanceM: number) {
  if (distanceM < 1000) return `${Math.max(1, Math.round(distanceM))} m`;
  return `${(distanceM / 1000).toFixed(distanceM >= 10_000 ? 0 : 1)} km`;
}

export default function DriverInteractionLayer(props: DriverInteractionLayerProps) {
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [rerouting, setRerouting] = useState(false);
  const muteTimer = useRef<number | null>(null);
  const restoreVoice = useRef(false);

  useEffect(() => () => {
    if (muteTimer.current !== null) window.clearTimeout(muteTimer.current);
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  if (!props.visible) return null;

  function muteFiveMinutes() {
    if (muteTimer.current !== null) window.clearTimeout(muteTimer.current);
    restoreVoice.current = props.voiceEnabled;
    props.onVoiceChange(false);
    muteTimer.current = window.setTimeout(() => {
      if (restoreVoice.current) props.onVoiceChange(true);
      muteTimer.current = null;
    }, 5 * 60_000);
    setSheet(null);
  }

  async function reroute() {
    if (!props.routeActive || rerouting) return;
    setRerouting(true);
    try {
      await props.onReroute();
      setSheet(null);
    } finally {
      setRerouting(false);
    }
  }

  function openAlerts() {
    if (props.severity === 'safe') props.onAlerts();
    else setSheet('hazard');
  }

  return (
    <>
      <nav className="driverActionDock" aria-label="Driver quick actions" data-testid="driver-action-dock">
        <button type="button" className={props.voiceEnabled ? 'isActive' : ''} onClick={() => props.onVoiceChange(!props.voiceEnabled)} aria-pressed={props.voiceEnabled}>
          {props.voiceEnabled ? <Volume2 /> : <VolumeX />}<span>Voice</span>
        </button>
        <button type="button" disabled={!props.camera} onClick={() => props.camera && setSheet('camera')} aria-label={props.camera ? `Camera warning, ${props.camera.label}` : 'No route camera warning'}>
          <Camera /><span>Camera</span>{props.camera ? <i /> : null}
        </button>
        <button type="button" onClick={props.onNavigate}>
          <Route /><span>Route</span>
        </button>
        <button type="button" className={props.severity !== 'safe' ? `hasAlert severity-${props.severity}` : ''} onClick={openAlerts}>
          <Bell /><span>Alerts</span>{props.severity !== 'safe' ? <i /> : null}
        </button>
        <button type="button" disabled={!props.parked} onClick={props.onSettings} aria-label={props.parked ? 'Open settings' : 'Settings available while parked'}>
          <Settings2 /><span>More</span>
        </button>
      </nav>

      {sheet ? <div className="driverSheetBackdrop" role="presentation" onClick={() => setSheet(null)}>
        <section className={`driverActionSheet sheet-${sheet} severity-${sheet === 'hazard' ? props.severity : 'caution'}`} role="dialog" aria-modal="false" aria-labelledby="driver-sheet-title" data-testid="driver-action-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="driverSheetHandle" aria-hidden="true" />
          <header>
            <span className="driverSheetIcon">{sheet === 'camera' ? <Camera /> : <Bell />}</span>
            <span>
              <small>{sheet === 'camera' ? 'ROUTE CAMERA' : 'DRIVER ALERT'}</small>
              <strong id="driver-sheet-title">{sheet === 'camera' ? props.camera?.label : props.title}</strong>
              <em>{sheet === 'camera' && props.camera ? `${distanceLabel(props.camera.distanceM)} ahead${props.camera.speedLimit !== null ? ` · limit ${props.camera.speedLimit} km/h` : ''}` : props.message}</em>
            </span>
            <button type="button" className="driverSheetClose" onClick={() => setSheet(null)} aria-label="Close action sheet"><X /></button>
          </header>

          {sheet === 'hazard' ? <div className="driverSheetActions hazardActions">
            <button type="button" className="sheetPrimary" onClick={() => setSheet(null)}><Check /><span><strong>Keep current route</strong><small>Continue with current guidance</small></span></button>
            <button type="button" onClick={() => void reroute()} disabled={!props.routeActive || rerouting}><Route /><span><strong>{rerouting ? 'Rerouting…' : 'Reroute'}</strong><small>{props.routeActive ? 'Recalculate around the issue' : 'No active route'}</small></span></button>
            <button type="button" onClick={() => { props.onAlternatives(); setSheet(null); }}><Map /><span><strong>View alternatives</strong><small>Compare route options</small></span></button>
            <button type="button" onClick={muteFiveMinutes}><VolumeX /><span><strong>Mute voice</strong><small>5 minutes</small></span></button>
          </div> : <div className="driverSheetActions cameraActions">
            <button type="button" className="sheetPrimary" onClick={() => setSheet(null)}><Check /><span><strong>Acknowledge</strong><small>Keep visual warning active</small></span></button>
            <button type="button" onClick={muteFiveMinutes}><VolumeX /><span><strong>Mute voice</strong><small>5 minutes</small></span></button>
            <button type="button" onClick={() => { props.onNavigate(); setSheet(null); }}><Map /><span><strong>Open map</strong><small>Show route context</small></span></button>
          </div>}

          <footer>
            <Mic /><span>Critical collision and vulnerable-road-user warnings remain active regardless of advisory preferences.</span><ChevronRight aria-hidden="true" />
          </footer>
        </section>
      </div> : null}
    </>
  );
}
