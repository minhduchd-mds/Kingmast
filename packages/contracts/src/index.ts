export type Severity = 'safe' | 'caution' | 'critical';
export type SensorState = 'ok' | 'degraded' | 'unavailable';
export interface VehicleSample { timestampMs:number; egoSpeedMps:number; targetSpeedMps:number; rangeM:number; confidence:number; canHealthy:boolean; radarHealthy:boolean; cameraHealthy:boolean; }
export interface RiskAssessment { severity:Severity; ttcS:number|null; thwS:number|null; closingSpeedMps:number; confidence:number; reasons:string[]; }
export interface SensorHealth { radarFront:SensorState; radarRear:SensorState; camera:SensorState; can:SensorState; gnssImu:SensorState; ecu:SensorState; }
