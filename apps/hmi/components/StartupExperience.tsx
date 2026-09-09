'use client';

import { CarFront, MapPin, Navigation, Radio, Route, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';

interface StartupExperienceProps {
  onComplete: () => void;
}

export default function StartupExperience({ onComplete }: StartupExperienceProps) {
  const [stage, setStage] = useState(0);
  const [clock, setClock] = useState('--:--');
  const completeRef = useRef(onComplete);
  const { isVietnamese } = useI18n();
  const tx = (en: string, vi: string) => isVietnamese ? vi : en;
  const stageCopy = [
    tx('Checking GPS and sensor readiness', 'Đang kiểm tra GPS và trạng thái cảm biến'),
    tx('Route and safety services ready', 'Dịch vụ tuyến đường và an toàn đã sẵn sàng'),
    tx('System self-check complete', 'Đã hoàn tất tự kiểm tra hệ thống'),
  ] as const;
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

      <header className="startupTopbar" aria-label={tx('Vehicle status','Trạng thái xe')}>
        <div className="startupIdentity">
          <span className="startupUser" aria-hidden="true">K</span>
          <strong>{clock}</strong>
          <span className="startupDivider" />
          <strong>D</strong>
        </div>
        <div className="startupSafety"><ShieldCheck strokeWidth={1.8} /><span><strong>{tx('Safety','An toàn')}</strong><small>{tx('Active','Đang hoạt động')}</small></span></div>
      </header>

      <section className="startupHero" aria-labelledby="startup-title">
        <div className="startupBrandMark" aria-hidden="true"><ShieldCheck strokeWidth={1.7} /></div>
        <p className="startupVersion">KINGMAST · v0.0.7</p>
        <h1 id="startup-title">KINGMAST</h1>
        <p className="startupHeadline">{tx('Safety systems active','Hệ thống an toàn đang hoạt động')}</p>
        <p className="startupStatus" role="status" aria-live="polite">{stageCopy[stage]}</p>
      </section>

      <section className="startupRoad" aria-label={tx('Driver safety visualization','Mô phỏng an toàn người lái')}>
        <div className="startupHorizon" aria-hidden="true" />
        <div className="startupRoadPlane" aria-hidden="true">
          <span className="startupLane startupLaneLeft" />
          <span className="startupLane startupLaneRight" />
          <span className="startupRouteTrace" />
        </div>
        <div className="startupVehicle" aria-hidden="true"><CarFront strokeWidth={1.55} /></div>
      </section>

      <section className="startupReadiness" aria-label={tx('System readiness','Mức sẵn sàng của hệ thống')}>
        <div className={`startupChip ${stage >= 0 ? 'isReady' : ''}`}><MapPin /><span><strong>GPS</strong><small>{tx('Ready','Sẵn sàng')}</small></span><ShieldCheck /></div>
        <div className={`startupChip ${stage >= 1 ? 'isReady' : ''}`}><Radio /><span><strong>{tx('Sensors','Cảm biến')}</strong><small>{stage >= 1 ? tx('Ready','Sẵn sàng') : tx('Checking','Đang kiểm tra')}</small></span><ShieldCheck /></div>
        <div className={`startupChip ${stage >= 1 ? 'isReady' : ''}`}><Navigation /><span><strong>{tx('Route','Tuyến đường')}</strong><small>{stage >= 1 ? tx('Ready','Sẵn sàng') : tx('Checking','Đang kiểm tra')}</small></span><ShieldCheck /></div>
        <div className={`startupChip startupReadyChip ${stage >= 2 ? 'isReady' : ''}`}><Route /><span><strong>{stage >= 2 ? tx('Ready to drive','Sẵn sàng lái xe') : tx('Preparing','Đang chuẩn bị')}</strong><small>{tx('Warning-only assistance','Hỗ trợ chỉ cảnh báo')}</small></span><ShieldCheck /></div>
      </section>

      <div className="startupProgress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
    </main>
  );
}
