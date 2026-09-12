import KingmastV006 from '../../components/KingmastV006';
import NextgenIntelligenceHud from '../../components/NextgenIntelligenceHud';
import { Esp32C3BenchBridge } from '../../components/Esp32C3BenchBridge';

export default function Esp32LiveBenchPage() {
  return (
    <>
      <Esp32C3BenchBridge />
      <KingmastV006 />
      <NextgenIntelligenceHud />
    </>
  );
}
