import { describe,expect,it } from 'vitest';
import type { NavigationRoute } from '@kingmast/contracts';
import { estimateRouteEnergyKwh } from './navigation.js';
import { buildRouteIntelligence } from './route-intelligence.js';

const route:NavigationRoute={provider:'osrm',origin:{lat:21,lng:105.8},destination:{lat:21,lng:105.82},distanceM:2100,durationS:180,geometry:[{lat:21,lng:105.8},{lat:21,lng:105.805},{lat:21,lng:105.81},{lat:21,lng:105.815},{lat:21,lng:105.82}],steps:[],fetchedAtMs:1};

describe('V2.5 route intelligence',()=>{
  it('estimates EV energy deterministically',()=>{expect(estimateRouteEnergyKwh(100_000,{batteryPct:80,usableBatteryKwh:60,rangeKm:350,consumptionWhPerKm:165,reservePct:15})).toBeCloseTo(16.5,3);});
  it('extracts speed zones, junctions and route chargers',()=>{const elements=[{type:'way',id:1,center:{lat:21,lon:105.805},tags:{highway:'primary',maxspeed:'50',name:'Road A'}},{type:'way',id:2,center:{lat:21,lon:105.81},tags:{highway:'primary',maxspeed:'30',name:'Road B'}},{type:'node',id:3,lat:21,lon:105.81,tags:{highway:'traffic_signals'}},{type:'node',id:4,lat:21,lon:105.815,tags:{amenity:'charging_station',name:'Charge One','socket:type2':'2','socket:type2:output':'22 kW'}}] as any;const value=buildRouteIntelligence(elements,route,route.origin);expect(value.speedZones.map((zone)=>zone.limitKmh)).toEqual([50,30]);expect(value.junctions[0]?.kind).toBe('traffic-signal');expect(value.chargingStations[0]?.name).toBe('Charge One');expect(value.chargingStations[0]?.powerKw).toBe(22);});
  it('filters unrelated map elements away from route corridor',()=>{const value=buildRouteIntelligence([{type:'way',id:9,center:{lat:21.2,lon:105.8},tags:{highway:'primary',maxspeed:'40'}}] as any,route,route.origin);expect(value.speedZones).toHaveLength(0);});
});
