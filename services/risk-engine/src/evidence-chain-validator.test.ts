import{describe,expect,it}from'vitest';
import{validateEvidenceChain}from'./evidence-chain-validator.js';
const h='a'.repeat(64);
const n=(id:string,parentId:string|null,createdAtMs:number)=>({id,parentId,createdAtMs,sha256:h});
describe('evidence chain validator',()=>{
 it('accepts ordered linked evidence',()=>expect(validateEvidenceChain([n('a',null,1),n('b','a',2),n('c','b',3)])).toMatchObject({status:'valid',headId:'c'}));
 it('rejects broken parent link',()=>expect(validateEvidenceChain([n('a',null,1),n('b','x',2)]).reason).toBe('broken-parent-link'));
 it('rejects timestamp regression',()=>expect(validateEvidenceChain([n('a',null,2),n('b','a',1)]).reason).toBe('timestamp-regression'));
 it('rejects malformed digest',()=>expect(validateEvidenceChain([{...n('a',null,1),sha256:'bad'}]).reason).toBe('invalid-node-evidence'));
});
