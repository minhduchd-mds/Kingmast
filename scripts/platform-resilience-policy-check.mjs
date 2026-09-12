import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}

const boot=read('edge/pi-resilience/boot_guard.py');
const agent=read('edge/pi-resilience/resilience_agent.py');
const executor=read('edge/pi-resilience/recovery_executor.py');
const standby=read('edge/pi-resilience/standby_failover.py');
const service=read('edge/pi-resilience/kingmast-resilience.service');
const recovery=read('edge/pi-resilience/kingmast-recovery.service');
const watchdog=read('edge/pi-resilience/99-kingmast-watchdog.conf');
const docs=read('edge/pi-resilience/README.md');

if(!boot.includes('RaspberryPiTrybootConfig')||!boot.includes('candidate-booting')||!boot.includes('rollback-required'))failures.push('persistent A/B boot guard contract missing');
if(!boot.includes("'0 tryboot'")||!boot.includes('known_good_partition'))failures.push('tryboot must retain an explicit known-good partition');
if(!boot.includes('os.replace')||!boot.includes('os.fsync'))failures.push('boot state/config writes must be atomic and fsync-backed');
if(!agent.includes('WATCHDOG=1')||!agent.includes('failure_threshold')||!agent.includes('candidateReadyForAcceptance'))failures.push('runtime watchdog/health-window contract missing');
if(!executor.includes("ALLOWED_ACTIONS = {'reboot-known-good', 'rollback-reboot-known-good'}"))failures.push('root recovery executor action whitelist changed');
if(executor.includes('shell=True'))failures.push('root recovery executor must not invoke a shell');
if(!executor.includes('cooldown-active')||!executor.includes('already-processed'))failures.push('recovery executor must prevent reboot storms and duplicate generations');
if(!standby.includes('witness_lease_valid')||!standby.includes('primary-stale-but-no-independent-witness'))failures.push('warm standby must be witness-gated');
if(!service.includes('Type=notify')||!service.includes('WatchdogSec=20s')||!service.includes('Restart=always'))failures.push('systemd service watchdog policy missing');
if(!recovery.includes('CapabilityBoundingSet=CAP_SYS_BOOT CAP_DAC_OVERRIDE')||!recovery.includes('ProtectSystem=strict'))failures.push('privileged recovery service hardening missing');
if(!watchdog.includes('RuntimeWatchdogSec=20s'))failures.push('host hardware watchdog manager policy missing');
for(const text of [boot,agent,executor,standby,docs])if(!text.includes('controlAuthority'))failures.push('resilience layer must preserve explicit controlAuthority boundary');
if(!docs.includes('A single Raspberry Pi cannot survive its own permanent hardware failure'))failures.push('hardware single-point-of-failure evidence boundary missing');

if(failures.length){console.error('KINGMAST platform resilience policy failed:\n'+failures.map(item=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST platform resilience policy passed.');
