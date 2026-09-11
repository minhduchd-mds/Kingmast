'use client';

import { AlertTriangle, CarFront, MapPin, Navigation, Radio, Route, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useDeviceHealth, type DeviceHealthRecord } from '../lib/use-device-health';

interface StartupExperienceProps {
  onComplete: () => void;
}

type ReadinessTone = 'ready' | 'attention' | 'waiting' | 'unavailable';
interface ReadinessState { tone: ReadinessTone; text: string; }

export default function StartupExperience({ onComplete }: StartupExperienceProps) {
  const [phase, setPhase] = useState(0);
  const [clock, setClock] = useState('--:--');
  const [bridgeAdvertised, setBridgeAdvertised] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const completeRef = useRef(onComplete);
  const completedRef = useRef(false);
  const { isVietnamese } = useI18n();
  const deviceHealth = useDeviceHealth();
  const tx = (en: string, vi: string) => isVietnamese ? vi : en;
  completeRef.current = onComplete;

  useEffect(() => {
    setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const native = (window as unknown as { kingmastNative?: { devices?: { getState?: unknown } } }).kingmastNative?.devices;
    setBridgeAdvertised(typeof native?.getState === 'function');
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timings = reducedMotion ? [120, 300, 700] : [650, 950, 2200];
    const timers = timings.map((delay, index) => window.setTimeout(() => setPhase(index + 1), delay));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  const hostConnected = deviceHealth.mode === 'native';
  const previewMode = bridgeAdvertised === false && phase >= 2;
  const hostTimedOut = bridgeAdvertised === true && !hostConnected && phase >= 3;

  useEffect(() => {
    if (completedRef.current || bridgeAdvertised === null) return;
    const nativeResolved = bridgeAdvertised && hostConnected && phase >= 1;
    const previewResolved = !bridgeAdvertised && phase >= 2;
    const nativeTimedOut = bridgeAdvertised && !hostConnected && phase >= 3;
    if (!nativeResolved && !previewResolved && !nativeTimedOut) return;
    completedRef.current = true;
    completeRef.current();
  }, [bridgeAdvertised, hostConnected, phase]);

  const stateForDevice = (device: DeviceHealthRecord | undefined): ReadinessState => {
    if (!hostConnected) return previewMode
      ? { tone:'unavailable', text:tx('Preview only','Chỉ xem thử') }
      : { tone:'waiting', text:tx('Waiting for host','Đang chờ host') };
    if (!device) return { tone:'unavailable', text:tx('Not reported','Chưa được báo cáo') };
    if (device.connection === 'initializing') return { tone:'waiting', text:tx('Initializing','Đang khởi tạo') };
    if (device.connection === 'disconnected' || device.connection === 'unavailable') return { tone:'unavailable', text:tx('Unavailable','Không khả dụng') };
    if (device.health === 'fault') return { tone:'attention', text:tx('Fault','Lỗi') };
    if (device.health === 'warning') return { tone:'attention', text:tx('Warning','Cảnh báo') };
    if (device.health === 'calibration-required') return { tone:'attention', text:tx('Calibration required','Cần hiệu chuẩn') };
    if (device.connection === 'connected' && device.health === 'ready') return { tone:'ready', text:tx('Ready','Sẵn sàng') };
    return { tone:'waiting', text:tx('Checking','Đang kiểm tra') };
  };

  const gps = stateForDevice(deviceHealth.devices.find((device) => device.id === 'gnss-imu'));
  const sensors = useMemo<ReadinessState>(() => {
    if (!hostConnected) return previewMode
      ? { tone:'unavailable', text:tx('Preview only','Chỉ xem thử') }
      : { tone:'waiting', text:tx('Waiting for host','Đang chờ host') };
    const ids = ['front-radar','surround-camera-set','dms-camera','read-only-can-interface'];
    const core = ids.map((id) => deviceHealth.devices.find((device) => device.id === id));
    if (core.some((device) => device?.health === 'fault')) return { tone:'attention', text:tx('Fault detected','Phát hiện lỗi') };
    if (core.some((device) => device?.connection === 'disconnected' || device?.connection === 'unavailable')) return { tone:'attention', text:tx('Connection incomplete','Kết nối chưa đầy đủ') };
    if (core.some((device) => device?.health === 'warning' || device?.health === 'calibration-required')) return { tone:'attention', text:tx('Needs attention','Cần chú ý') };
    if (core.every((device) => device?.connection === 'connected' && device?.health === 'ready')) return { tone:'ready', text:tx('Ready','Sẵn sàng') };
    return { tone:'waiting', text:tx('Checking','Đang kiểm tra') };
  }, [deviceHealth.devices, hostConnected, previewMode, isVietnamese]);

  const services: ReadinessState = online
    ? { tone:'ready', text:tx('Online','Trực tuyến') }
    : { tone:'attention', text:tx('Offline','Ngoại tuyến') };
  const hardwareAttention = hostConnected && (gps.tone !== 'ready' || sensors.tone !== 'ready');
  const finalState: ReadinessState = hostConnected
    ? hardwareAttention
      ? { tone:'attention', text:tx('Driver view available','Giao diện lái xe khả dụng') }
      : { tone:'ready', text:tx('Driver view ready','Giao diện lái xe sẵn sàng') }
    : previewMode
      ? { tone:'unavailable', text:tx('Preview mode','Chế độ xem thử') }
      : hostTimedOut
        ? { tone:'attention', text:tx('Host not ready','Host chưa sẵn sàng') }
        : { tone:'waiting', text:tx('Preparing','Đang chuẩn bị') };

  const headline = hostConnected
    ? hardwareAttention ? tx('Vehicle host connected · attention required','Đã kết nối host xe · cần chú ý') : tx('Vehicle host connected','Đã kết nối host xe')
    : previewMode ? tx('Preview mode','Chế độ xem thử') : tx('Checking vehicle host','Đang kiểm tra host xe');
  const statusCopy = deviceHealth.error
    ?? (hostConnected
      ? hardwareAttention ? tx('Readiness received. Review device status after startup.','Đã nhận trạng thái sẵn sàng. Hãy kiểm tra trạng thái thiết bị sau khi khởi động.') : tx('Vehicle-host readiness received.','Đã nhận trạng thái sẵn sàng từ host xe.')
      : previewMode ? tx('Vehicle host not detected. Hardware readiness is not claimed in browser preview.','Không phát hiện host xe. Bản xem thử trên trình duyệt không tuyên bố phần cứng đã sẵn sàng.')
      : hostTimedOut ? tx('Vehicle host did not provide readiness in time. Device status remains unresolved.','Host xe không trả trạng thái sẵn sàng đúng thời gian. Trạng thái thiết bị vẫn chưa được xác định.')
      : tx('Waiting for device and network readiness','Đang chờ trạng thái thiết bị và mạng'));
  const progress = hostConnected || previewMode || hostTimedOut ? 100 : phase === 0 ? 28 : phase === 1 ? 62 : 82;
  const chipClass = (state: ReadinessState) => `startupChip is${state.tone[0].toUpperCase()}${state.tone.slice(1)}`;
  const EndIcon = ({state}:{state:ReadinessState}) => state.tone === 'ready' ? <ShieldCheck/> : state.tone === 'attention' ? <AlertTriangle/> : <Radio/>;

  return (
    <main className={`kingmastStartup startupStage-${Math.min(2, phase)}`} data-testid="kingmast-startup" data-host-mode={hostConnected?'native':previewMode?'preview':'checking'}>
      <div className="startupAtmosphere" aria-hidden="true"><span className="startupGlow"/><span className="startupArc"/></div>

      <header className="startupTopbar" aria-label={tx('Vehicle status','Trạng thái xe')}>
        <div className="startupIdentity"><span className="startupUser" aria-hidden="true">K</span><strong>{clock}</strong><span className="startupDivider"/><strong>D</strong></div>
        <div className="startupSafety"><ShieldCheck strokeWidth={1.8}/><span><strong>{tx('Warning-only','Chỉ cảnh báo')}</strong><small>{tx('Software boundary','Biên an toàn phần mềm')}</small></span></div>
      </header>

      <section className="startupHero" aria-labelledby="startup-title">
        <div className="startupBrandMark" aria-hidden="true"><ShieldCheck strokeWidth={1.7}/></div>
        <p className="startupVersion">KINGMAST · v0.0.8</p>
        <h1 id="startup-title">KINGMAST</h1>
        <p className="startupHeadline">{headline}</p>
        <p className="startupStatus" role="status" aria-live="polite">{statusCopy}</p>
      </section>

      <section className="startupRoad" aria-label={tx('Driver safety visualization','Mô phỏng an toàn người lái')}>
        <div className="startupHorizon" aria-hidden="true"/><div className="startupRoadPlane" aria-hidden="true"><span className="startupLane startupLaneLeft"/><span className="startupLane startupLaneRight"/><span className="startupRouteTrace"/></div><div className="startupVehicle" aria-hidden="true"><CarFront strokeWidth={1.55}/></div>
      </section>

      <section className="startupReadiness" aria-label={tx('System readiness','Mức sẵn sàng của hệ thống')}>
        <div className={chipClass(gps)} data-testid="startup-gps-status"><MapPin/><span><strong>GPS / IMU</strong><small>{gps.text}</small></span><EndIcon state={gps}/></div>
        <div className={chipClass(sensors)} data-testid="startup-sensor-status"><Radio/><span><strong>{tx('Sensors','Cảm biến')}</strong><small>{sensors.text}</small></span><EndIcon state={sensors}/></div>
        <div className={chipClass(services)} data-testid="startup-service-status"><Navigation/><span><strong>{tx('Online services','Dịch vụ trực tuyến')}</strong><small>{services.text}</small></span><EndIcon state={services}/></div>
        <div className={`${chipClass(finalState)} startupReadyChip`} data-testid="startup-host-status"><Route/><span><strong>{finalState.text}</strong><small>{hostConnected?tx('Warning-only assistance','Hỗ trợ chỉ cảnh báo'):tx('No hardware readiness claim','Không tuyên bố phần cứng sẵn sàng')}</small></span><EndIcon state={finalState}/></div>
      </section>

      <div className="startupProgress" aria-hidden="true"><span style={{width:`${progress}%`}}/></div>
    </main>
  );
}
