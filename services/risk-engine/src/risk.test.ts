import {describe,expect,it} from 'vitest';
import {assessRisk} from './risk.js';
const base={timestampMs:1_000,egoSpeedMps:20,targetSpeedMps:10,rangeM:12,confidence:.95,canHealthy:true,radarHealthy:true,cameraHealthy:true};
describe('assessRisk',()=>{it('raises critical on high-confidence closing gap',()=>expect(assessRisk(base,1_050).severity).toBe('critical'));it('rejects stale frames',()=>expect(assessRisk(base,2_000).reasons).toContain('stale-data-rejected'));it('fails safe when radar is unavailable',()=>expect(assessRisk({...base,radarHealthy:false},1_050).severity).toBe('safe'));});
