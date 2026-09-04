begin;

create table if not exists traffic_camera_sources (
  id uuid primary key default gen_random_uuid(),
  provider_key text unique not null,
  display_name text not null,
  source_kind text not null check (source_kind in ('osm','authorized-provider','runtime-provider')),
  authorized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists traffic_cameras (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references traffic_camera_sources(id) on delete cascade,
  external_id text not null,
  camera_kind text not null check (camera_kind in ('traffic-monitoring','speed-enforcement','red-light','average-speed','unknown')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  direction_deg numeric(6,2),
  speed_limit_kmh smallint,
  operator_name text,
  provider_ref text,
  viewer_url text,
  public_data boolean not null default false,
  last_verified_at timestamptz,
  unique(source_id, external_id)
);
create index if not exists traffic_cameras_location_idx on traffic_cameras(lat,lng);

create table if not exists speed_limit_observations (
  id bigserial primary key,
  trip_id uuid references trips(id) on delete cascade,
  source text not null check (source in ('map','sign-vision','authorized-provider')),
  speed_limit_kmh smallint not null check (speed_limit_kmh between 5 and 250),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  road_name text,
  observed_at timestamptz not null default now()
);
create index if not exists speed_limit_observations_trip_time_idx on speed_limit_observations(trip_id,observed_at desc);

create table if not exists navigation_routes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete set null,
  origin jsonb not null,
  destination jsonb not null,
  provider text not null,
  distance_m numeric(12,2),
  duration_s numeric(12,2),
  geometry jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table traffic_cameras is 'Metadata from public or explicitly authorized road-camera providers. Do not store credentials or bypass protected camera systems.';
comment on table speed_limit_observations is 'Map/provider/sign observations used for advisory speed-limit awareness; not a vehicle-control input.';
commit;
