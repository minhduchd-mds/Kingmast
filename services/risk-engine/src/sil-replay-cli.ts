import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSilRiskReplaySuite,type SilRiskReplayCase } from './sil-replay.js';

const EXPECTED_SCHEMA='kingmast-sil-replay-report/v1';
const replayPath=fileURLToPath(new URL('../../../docs/validation/replays/V008_RISK_REPLAY.json',import.meta.url));
const replayCases=JSON.parse(readFileSync(replayPath,'utf8')) as SilRiskReplayCase[];
const report=runSilRiskReplaySuite(replayCases);
if(report.schema!==EXPECTED_SCHEMA)throw new Error(`unexpected SIL replay schema: ${report.schema}`);
process.stdout.write(`${JSON.stringify({...report,productVersion:'0.0.8',replayCorpus:'V008_RISK_REPLAY.json'},null,2)}\n`);
if(!report.allPassed)process.exitCode=1;
