begin;

create table if not exists gps_positions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  heading_deg numeric(6,2) check (heading_deg between 0 and 360),
  speed_kmh numeric(7,2) check (speed_kmh >= 0),
  accuracy_m numeric(8,2) check (accuracy_m >= 0),
  source text not null check (source in ('gnss', 'device-gps', 'simulator')),
  recorded_at timestamptz not null default now()
);

create index if not exists gps_positions_trip_time_idx
  on gps_positions (trip_id, recorded_at desc);

create table if not exists detected_objects (
  id uuid primary key default gen_random_uuid(),
  external_object_id text not null,
  trip_id uuid not null references trips(id) on delete cascade,
  object_type text not null check (object_type in ('person', 'car', 'motorcycle', 'bicycle', 'truck', 'bus', 'obstacle', 'unknown')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  distance_m numeric(8,2) not null check (distance_m >= 0),
  bearing_deg numeric(6,2) check (bearing_deg between 0 and 360),
  relative_zone text not null check (relative_zone in ('front', 'front-left', 'front-right', 'left', 'right', 'rear')),
  relative_speed_mps numeric(8,3),
  severity text not null check (severity in ('safe', 'caution', 'critical')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  recorded_at timestamptz not null default now()
);

create index if not exists detected_objects_trip_time_idx
  on detected_objects (trip_id, recorded_at desc);
create index if not exists detected_objects_severity_idx
  on detected_objects (severity, recorded_at desc);
create index if not exists detected_objects_type_idx
  on detected_objects (object_type, recorded_at desc);

create table if not exists geofences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  radius_m numeric(10,2) not null check (radius_m > 0),
  severity text not null check (severity in ('caution', 'critical')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists location_alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  alert_type text not null check (alert_type in ('pedestrian-ahead', 'vehicle-too-close', 'vulnerable-road-user', 'object-in-danger-zone', 'geofence-entry', 'sensor-degraded')),
  title text not null,
  message text not null,
  severity text not null check (severity in ('safe', 'caution', 'critical')),
  detected_object_id uuid references detected_objects(id) on delete set null,
  distance_m numeric(8,2) check (distance_m is null or distance_m >= 0),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists location_alerts_trip_time_idx
  on location_alerts (trip_id, created_at desc);
create index if not exists location_alerts_severity_idx
  on location_alerts (severity, created_at desc);

comment on table gps_positions is 'Vehicle GNSS/device GPS samples used for trip reconstruction and alert location context.';
comment on table detected_objects is 'Camera/radar-fused road objects with projected GPS coordinates. Warning-only; no vehicle control authority.';
comment on table location_alerts is 'Location-aware KINGMAST safety notifications generated from object, sensor, and geofence conditions.';

commit;
