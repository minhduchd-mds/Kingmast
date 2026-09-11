export interface NextgenPersistenceRecord<T> {
  version:1;
  updatedAtMs:number;
  value:T;
}

export interface NextgenPersistenceAdapter {
  get<T>(key:string):Promise<NextgenPersistenceRecord<T>|null>;
  set<T>(key:string,record:NextgenPersistenceRecord<T>):Promise<void>;
  delete(key:string):Promise<void>;
  list(prefix:string):Promise<string[]>;
}

const MAX_MEMORY_KEYS=2_048;
const MAX_KEY_LENGTH=240;

function validKey(key:string){return key.length>0&&key.length<=MAX_KEY_LENGTH&&!key.includes('\0');}

export class InMemoryNextgenPersistence implements NextgenPersistenceAdapter{
  private readonly records=new Map<string,NextgenPersistenceRecord<unknown>>();

  async get<T>(key:string):Promise<NextgenPersistenceRecord<T>|null>{
    if(!validKey(key))return null;
    const record=this.records.get(key);
    return record?structuredClone(record) as NextgenPersistenceRecord<T>:null;
  }

  async set<T>(key:string,record:NextgenPersistenceRecord<T>):Promise<void>{
    if(!validKey(key))throw new Error('invalid-persistence-key');
    if(record.version!==1||!Number.isFinite(record.updatedAtMs))throw new Error('invalid-persistence-record');
    if(!this.records.has(key)&&this.records.size>=MAX_MEMORY_KEYS){
      const oldest=[...this.records.entries()].sort((a,b)=>a[1].updatedAtMs-b[1].updatedAtMs)[0];
      if(oldest)this.records.delete(oldest[0]);
    }
    this.records.set(key,structuredClone(record) as NextgenPersistenceRecord<unknown>);
  }

  async delete(key:string):Promise<void>{this.records.delete(key);}
  async list(prefix:string):Promise<string[]>{return[...this.records.keys()].filter((key)=>key.startsWith(prefix)).sort();}
  get size(){return this.records.size;}
}

export function persistenceRecord<T>(value:T,updatedAtMs=Date.now()):NextgenPersistenceRecord<T>{return{version:1,updatedAtMs,value};}
