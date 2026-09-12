import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './hmi-design-system.css';
import './hmi-v3.css';
import './hmi-v4.css';
import './hmi-v5.css';
import './connected-road.css';
import './hmi-apple.css';
import './hmi-interactions.css';
import './hmi-motion.css';
import './hmi-connectivity.css';
import './hmi-connectivity-recovery.css';
import './hmi-road-events.css';
import './hmi-first-run.css';
import './hmi-system-management.css';
import './hmi-device-health.css';
import './hmi-resilience.css';
import './hmi-capabilities.css';
import './hmi-driver-capabilities.css';
import './hmi-attention.css';
import './hmi-theme-contrast.css';
import './hmi-control-system.css';
import './hmi-apple-density.css';
import './hmi-surround-v2.css';
import './hmi-surround-v2-compat.css';
import './hmi-surround-effects-v3.css';
import './hmi-assets-v0.0.8.css';
import './hmi-assistant.css';
import './hmi-auto-appearance-fix.css';
import './hmi-performance.css';
import './hmi-vision-scene.css';
import './hmi-profile-memory.css';
import './hmi-vehicle-access.css';
import './hmi-camera-runtime.css';
import DriverProfileRuntime from '../components/DriverProfileRuntime';
import DriverCapabilityRail from '../components/DriverCapabilityRail';
import SurroundSpatialOverlay from '../components/SurroundSpatialOverlay';
import AssistantRuntime from '../components/AssistantRuntime';
import ProfileMemoryPanel from '../components/ProfileMemoryPanel';
import VehicleAccessPanel from '../components/VehicleAccessPanel';
import CameraRuntimeDiagnosticsPanel from '../components/CameraRuntimeDiagnosticsPanel';

export const metadata={
  title:'KINGMAST Driver Safety',
  description:'KINGMAST v0.0.8 Apple-inspired warning-only automotive navigation and connected-road safety HMI',
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><DriverProfileRuntime/><DriverCapabilityRail/><SurroundSpatialOverlay/><AssistantRuntime/><ProfileMemoryPanel/><VehicleAccessPanel/><CameraRuntimeDiagnosticsPanel/>{children}</body></html>;
}
