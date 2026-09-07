import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const failures=[];
function read(path){const full=resolve(root,path);if(!existsSync(full)){failures.push(`${path}: missing`);return'';}return readFileSync(full,'utf8');}
const journal=read('services/risk-engine/src/audit-journal.ts');
const tests=read('services/risk-engine/src/audit-journal.test.ts');
const buffer=read('services/risk-engine/src/event-buffer.ts');
const doc=read('docs/observability/AUDIT_JOURNAL_V006.md');

if(!journal.includes("schema:'kingmast-audit-event/v2'")||!journal.includes('previousHash')||!journal.includes('entryHash'))failures.push('audit v2 hash-chain envelope missing');
if(!journal.includes("createHash('sha256')")||!journal.includes('verifyAuditJournalText'))failures.push('audit hash-chain verification missing');
if(!journal.includes("reason:'entry-hash-mismatch'")||!journal.includes("reason:'chain-link-mismatch'"))failures.push('audit tamper/link failure detection missing');
if(!journal.includes("schema==='kingmast-audit-event/v1'")||!journal.includes("reason:'legacy-entry-after-v2'"))failures.push('explicit v1-to-v2 migration boundary missing');
if(!journal.includes('integrityErrors')||!journal.includes('integrityHead'))failures.push('audit integrity diagnostics missing');
if(!buffer.includes('integrityErrors:0')||!buffer.includes('integrityHead:null'))failures.push('disabled audit status must preserve integrity diagnostic shape');
if(!tests.includes("entry-hash-mismatch")||!tests.includes("chain-link-mismatch")||!tests.includes('legacy v1 prefix'))failures.push('audit integrity/migration tests missing');
if(!doc.includes('tamper-evidence, not cryptographic authenticity')||!doc.includes('protected keys/storage')||!doc.includes('does not block deterministic risk calculation'))failures.push('audit documentation must preserve honest integrity and safety-operation boundaries');

if(failures.length){console.error('KINGMAST audit integrity policy failed:\n'+failures.map((item)=>`- ${item}`).join('\n'));process.exit(1);}
console.log('KINGMAST audit integrity policy passed.');
