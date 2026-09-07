import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSilRiskReplaySuite,type SilRiskReplayCase } from './sil-replay.js';

const replayPath=fileURLToPath(new URL('../../../docs/validation/replays/V006_RISK_REPLAY.json',import.meta.url));
const replayCases=JSON.parse(readFileSync(replayPath,'utf8')) as SilRiskReplayCase[];
const report=runSilRiskReplaySuite(replayCases);
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
if(!report.allPassed)process.exitCode=1;
