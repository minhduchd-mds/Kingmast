import {readFileSync} from 'node:fs';

const source=readFileSync('.github/workflows/external-simulator-evidence.yml','utf8');
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};
expect(/\bon:\s*\n\s*workflow_dispatch:/m.test(source),'external simulator workflow must be manual workflow_dispatch only');
expect(!/^\s*(push|pull_request|schedule):/m.test(source),'external simulator workflow must not run from push, PR or schedule');
expect(source.includes('runs-on: [self-hosted, linux, kingmast-simulator]'),'external simulator workflow requires dedicated kingmast-simulator runner');
expect(source.includes('environment: simulator-evidence'),'external simulator workflow requires protected simulator-evidence environment');
expect(source.includes('evidence_only_acknowledgement'),'external simulator workflow requires explicit virtual-evidence acknowledgement');
expect(source.includes('/opt/kingmast/bin/run-esmini-campaign'),'esmini must run through fixed reviewed runner-local wrapper path');
expect(source.includes('/opt/kingmast/bin/run-carla-campaign'),'CARLA must run through fixed reviewed runner-local wrapper path');
expect(source.includes('compare-simulator-results.mjs'),'external simulator outputs must pass cross-simulator comparator');
expect(source.includes('fixtureMode!==false'),'external workflow must reject fixture-mode parity reports');
for(const token of ['physicalHilExecuted!==false','closedTrackExecuted!==false','targetHardwareQualified!==false','publicRoadApproved!==false'])expect(source.includes(token),`external workflow must assert ${token}`);
expect(!/\bcurl\b|\bwget\b|git\s+clone/i.test(source),'external simulator evidence workflow must not download unpinned runtime code');
expect(!/runs-on:\s*ubuntu-latest/.test(source),'external simulation must not pretend GitHub-hosted CI executes the simulator stack');
if(failures.length){console.error('KINGMAST external simulator workflow policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST external simulator workflow policy passed: manual dedicated runner, protected environment, fixed wrappers, virtual-evidence-only boundary.');
