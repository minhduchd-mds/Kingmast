export type EvidenceNode={id:string;parentId:string|null;createdAtMs:number;sha256:string};
export type EvidenceChainAssessment={status:'valid'|'invalid';reason:string;headId:string|null};
const sha256=/^[a-f0-9]{64}$/i;

export function validateEvidenceChain(nodes:EvidenceNode[]):EvidenceChainAssessment{
 if(nodes.length===0)return{status:'invalid',reason:'empty-chain',headId:null};
 const seen=new Set<string>();
 for(let index=0;index<nodes.length;index++){
  const node=nodes[index]!;
  if(node.id.length===0||seen.has(node.id))return{status:'invalid',reason:'duplicate-or-empty-id',headId:null};
  if(!Number.isFinite(node.createdAtMs)||!sha256.test(node.sha256))return{status:'invalid',reason:'invalid-node-evidence',headId:null};
  if(index===0&&node.parentId!==null)return{status:'invalid',reason:'root-parent-must-be-null',headId:null};
  if(index>0){
   const previous=nodes[index-1]!;
   if(node.parentId!==previous.id)return{status:'invalid',reason:'broken-parent-link',headId:null};
   if(node.createdAtMs<previous.createdAtMs)return{status:'invalid',reason:'timestamp-regression',headId:null};
  }
  seen.add(node.id);
 }
 return{status:'valid',reason:'ordered-linked-evidence-chain',headId:nodes.at(-1)!.id};
}
