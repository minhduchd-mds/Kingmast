import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './hmi-v3.css';
import './hmi-v4.css';
import './hmi-v5.css';
import './connected-road.css';
import './hmi-apple.css';
import './hmi-interactions.css';
import './hmi-motion.css';
import './hmi-connectivity.css';
import './hmi-road-events.css';
import './hmi-first-run.css';
export const metadata={title:'KINGMAST Driver Safety',description:'KINGMAST v0.0.6 Apple-inspired warning-only automotive navigation and connected-road safety HMI'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
