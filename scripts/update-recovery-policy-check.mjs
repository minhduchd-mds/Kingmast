import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
const model=read('services/risk-engine/src/update-recovery.ts');
const tests=read('services/risk-engine/src/update-recovery.test.ts');
const doc=read('docs/updates/AB_RECOVERY_MODEL_V006.md');
const firmwareEvidence=read('docs/updates/V006_FIRMWARE_TRUST_EVIDENCE.json');
const bootGuard=read('edge/pi-resilience/boot_guard.py');
const resilienceAgent=read('edge/pi-resilience/resilience_agent.py');
const recoveryExecutor=read('edge/pi-resilience/recovery_executor.py');
const standby=read('edge/pi-resilience/standby_failover.py');
const resilienceService=read('edge/pi-resilience/kingmast-resilience.service');
const resilienceDoc=read('edge/pi-resilience/README.md');

if(!model.includes('class ABRecoveryModel')||!model.includes("'candidate-written'")||!model.includes("'booting-candidate'")||!model.includes("'rollback-required'"))failures.push('A/B recovery state model missing');
if(!model.includes('candidate must be written to the inactive slot'))failures.push('candidate must never overwrite current known-good slot');
if(!model.includes('reportBootHealthy')||!model.includes('reportBootFailure')||!model.includes('recoverAfterPowerLoss'))failures.push('boot-health and power-loss recovery transitions missing');
if(!model.includes('knownGoodSlot')||!model.includes('bootTarget'))failures.push('known-good and boot-target authority must remain separate');
if(!tests.includes('power is lost before candidate acceptance')||!tests.includes('rejects writing a candidate over the current known-good slot')||!tests.includes('does not permit candidate acceptance before a candidate boot'))failures.push('A/B fail-safe tests missing');
if(!doc.includes('previous known-good image remains authoritative')||!doc.includes('Unit/SIL tests demonstrate state-machine semantics only'))failures.push('A/B recovery evidence boundary documentation missing');
if(!firmwareEvidence.includes('"controlId":"FW-006"')||!firmwareEvidence.includes('"name":"a-b-known-good-recovery"')||!firmwareEvidence.includes('"status":"pending"'))failures.push('physical A/B recovery must remain pending until hardware evidence exists');

if(!bootGuard.includes('RaspberryPiTrybootConfig')||!bootGuard.includes("'0 tryboot'")||!bootGuard.includes('known_good_partition'))failures.push('deployable Raspberry Pi A/B tryboot guard missing');
if(!bootGuard.includes('os.replace')||!bootGuard.includes('os.fsync'))failures.push('deployable boot state/config must use atomic fsync-backed writes');
if(!resilienceAgent.includes('WATCHDOG=1')||!resilienceAgent.includes('failure_threshold')||!resilienceAgent.includes('rollback-reboot-known-good'))failures.push('runtime watchdog and candidate rollback health policy missing');
if(!recoveryExecutor.includes("ALLOWED_ACTIONS = {'reboot-known-good', 'rollback-reboot-known-good'}")||recoveryExecutor.includes('shell=True'))failures.push('privileged recovery executor must stay strictly whitelisted and shell-free');
if(!recoveryExecutor.includes('cooldown-active')||!recoveryExecutor.includes('already-processed'))failures.push('recovery executor reboot-storm protections missing');
if(!standby.includes('witness_lease_valid')||!standby.includes('primary-stale-but-no-independent-witness'))failures.push('physical host standby promotion must remain witness-gated');
if(!resilienceService.includes('Type=notify')||!resilienceService.includes('WatchdogSec=20s')||!resilienceService.includes('Restart=always'))failures.push('systemd userspace watchdog service missing');
if(!resilienceDoc.includes('True host failover requires a physically separate compute node.')||!resilienceDoc.includes('controlAuthority` remains `none`'))failures.push('host hardware failover evidence/safety boundary missing');

if(failures.length){console.error('KINGMAST A/B recovery policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST A/B recovery policy passed: software invariants, host watchdog/rollback contracts and evidence boundaries are present.');
