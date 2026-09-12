import{describe,expect,it}from'vitest';
import{coarsenLocation}from'./location-coarsening-policy.js';
describe('location coarsening policy',()=>{
 it('coarsens coordinates deterministically',()=>expect(coarsenLocation({lat:21.028511,lon:105.804817},{decimalPlaces:2,allowPrecise:false})).toEqual({status:'coarsened',lat:21.03,lon:105.8,reason:'location-coarsened-for-export',preciseRetained:false}));
 it('never exports precise location through this path',()=>expect(coarsenLocation({lat:21,lon:105},{decimalPlaces:4,allowPrecise:true}).status).toBe('blocked'));
 it('rejects invalid latitude',()=>expect(coarsenLocation({lat:100,lon:105},{decimalPlaces:2,allowPrecise:false}).reason).toBe('invalid-location'));
 it('rejects overly precise policy',()=>expect(coarsenLocation({lat:21,lon:105},{decimalPlaces:6,allowPrecise:false}).status).toBe('blocked'));
});
