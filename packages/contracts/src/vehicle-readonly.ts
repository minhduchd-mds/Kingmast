import type { SensorHealth, VehiclePosition } from './index.js';

export const VEHICLE_PORT_AUTHORITY='read-only' as const;
export type VehicleReadSource='can-rx'|'gateway-rx'|'simulator';

export interface VehicleReadOnlySnapshot {
  observedAtMs:number;
  speedKmh:number|null;
  position:VehiclePosition|null;
  sensors:Pick<SensorHealth,'can'|'gnssImu'|'ecu'>;
  source:VehicleReadSource;
  provenance:string;
}

export interface ReadOnlyVehiclePort {
  readonly authority:typeof VEHICLE_PORT_AUTHORITY;
  readSnapshot(nowMs?:number):VehicleReadOnlySnapshot|Promise<VehicleReadOnlySnapshot>;
}

export function createReadOnlyVehiclePort(reader:(nowMs:number)=>VehicleReadOnlySnapshot|Promise<VehicleReadOnlySnapshot>):ReadOnlyVehiclePort {
  return Object.freeze({
    authority:VEHICLE_PORT_AUTHORITY,
    readSnapshot:(nowMs=Date.now())=>reader(nowMs),
  });
}
