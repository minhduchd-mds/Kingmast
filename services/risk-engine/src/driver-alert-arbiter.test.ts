import{describe,expect,it}from'vitest';
import{arbitrateDriverAlerts}from'./driver-alert-arbiter.js';
const make=(id:string,severity:'info'|'watch'|'warning'|'critical',createdAtMs=900)=>({id,severity,createdAtMs,expiresAtMs:2000,message:id});
describe('driver alert arbiter',()=>{
  it('prioritizes critical and warning alerts deterministically',()=>{
    const result=arbitrateDriverAlerts([make('i','info'),make('w','warning'),make('c','critical')],1000,2);
    expect(result.visible.map((alert)=>alert.id)).toEqual(['c','w']);
    expect(result.dropped).toContain('i');
  });
  it('drops expired and future alerts',()=>{
    const expired={...make('expired','warning'),expiresAtMs:999};
    const future={...make('future','critical'),createdAtMs:1100,expiresAtMs:2100};
    expect(arbitrateDriverAlerts([expired,future],1000).visible).toHaveLength(0);
  });
  it('keeps the stronger duplicate id',()=>{
    expect(arbitrateDriverAlerts([make('same','watch'),make('same','critical')],1000).visible[0]?.severity).toBe('critical');
  });
});
