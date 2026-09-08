import { runServiceFaultPreflight } from './service-fault-preflight.js';

const report=runServiceFaultPreflight();
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
if(!report.allPassed)process.exitCode=1;
