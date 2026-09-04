'use client';

import { CarFront, MapPin, Navigation, Radio, Route, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StartupExperienceProps {
  onComplete: () => void;
}

const stageCopy = [
  'Checking GPS and sensor readiness',
  'Route and safety services ready',
  'System self-check complete',
] as const;

export default function StartupExperience({ onComplete }: StartupExperienceProps) {
  const [stage, setStage] = useState(0);
  const [clock, setClock] = useState('--:--');
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timings = reducedMotion ? [60, 140, 320] : [520, 1120, 2200];
    const stageOne = window.setTimeout(() => setStage(1), timings[0]);
    const stageTwo = window.setTimeout(() => setStage(2), timings[1]);
    const complete = window.setTimeout(() => completeRef.current(), timings[2]);
    return () => {
      window.clearTimeout(stageOne);
      window.clearTimeout(stageTwo);
      window.clearTimeout(complete);
    };
  }, []);

  const progress = stage === 0 ? 32 : stage === 1 ? 72 : 100;

  return (
    <main className={`kingmastStartup startupStage-${stage}`} data-testid="kingmast-startup">
      <div className="startupAtmosphere" aria-hidden="true">
        <span className="startupGlow" />
        <span className="startupArc" />
      </div>

      <header className="startupTopbar" aria-label="Vehicle status">
        <div className="startupIdentity">
          <span className="startupUser" aria-hidden="true">K</span>
          <strong>{clock}</strong>
          <span className="startupDivider" />
          <strong>D</strong>
        </div>
        <div className="startupSafety"><ShieldCheck strokeWidth={1.8} /><span><strong>Safety</strong><small>Active</small></span></div>
      </header>

      <section className="startupHero" aria-labelledby="startup-title">
        <div className="startupBrandMark" aria-hidden="true"><ShieldCheck strokeWidth={1.7} /></div>
        <p className="startupVersion">KINGMAST · v0.0.6</p>
        <h1 id="startup-title">KINGMAST</h1>
        <p className="startupHeadline">Safety systems active</p>
        <p className="startupStatus" role="status" aria-live="polite">{stageCopy[stage]}</p>
      </section>

      <section className="startupRoad" aria-label="Driver safety visualization">
        <div className="startupHorizon" aria-hidden="true" />
        <div className="startupRoadPlane" aria-hidden="true">
          <span className="startupLane startupLaneLeft" />
          <span className="startupLane startupLaneRight" />
          <span className="startupRouteTrace" />
        </div>
        <div className="startupVehicle" aria-hidden="true"><CarFront strokeWidth={1.55} /></div>
      </section>

      <section className="startupReadiness" aria-label="System readiness">
        <div className={`startupChip ${stage >= 0 ? 'isReady' : ''}`}><MapPin /><span><strong>GPS</strong><small>Ready</small></span><ShieldCheck /></div>
        <div className={`startupChip ${stage >= 1 ? 'isReady' : ''}`}><Radio /><span><strong>Sensors</strong><small>{stage >= 1 ? 'Ready' : 'Checking'}</small></span><ShieldCheck /></div>
        <div className={`startupChip ${stage >= 1 ? 'isReady' : ''}`}><Navigation /><span><strong>Route</strong><small>{stage >= 1 ? 'Ready' : 'Checking'}</small></span><ShieldCheck /></div>
        <div className={`startupChip startupReadyChip ${stage >= 2 ? 'isReady' : ''}`}><Route /><span><strong>{stage >= 2 ? 'Ready to drive' : 'Preparing'}</strong><small>Warning-only assistance</small></span><ShieldCheck /></div>
      </section>

      <div className="startupProgress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    </main>
  );
}
