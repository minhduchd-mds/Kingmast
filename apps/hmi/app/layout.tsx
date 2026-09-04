import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './hmi-v3.css';
import './hmi-v4.css';
import './hmi-v5.css';
export const metadata={title:'KINGMAST Driver Safety',description:'Apple-inspired warning-only automotive navigation and safety HMI'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
