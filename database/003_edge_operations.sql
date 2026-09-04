begin;

create table if not exists edge_devices (
  device_id text primary key,
  boot_id text not null,
  protocol_version smallint not null default 1 check (protocol_version = 1),
  last_sequence bigint not null default 0,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists edge_ingest_events (
  id bigserial primary key,
  device_id text,
  boot_id text,
  sequence bigint,
  accepted boolean not null,
  reject_reason text,
  received_at timestamptz not null default now(),
  diagnostics jsonb not null default '{}'::jsonb
);
create index if not exists edge_ingest_events_device_time_idx on edge_ingest_events(device_id,received_at desc);

create table if not exists edge_alert_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete set null,
  device_id text,
  sequence bigint,
  alert_key text not null,
  severity severity not null,
  event_type text not null,
  title text not null,
  message text not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists edge_alert_events_time_idx on edge_alert_events(occurred_at desc);
create index if not exists edge_alert_events_severity_idx on edge_alert_events(severity,occurred_at desc);

comment on table edge_devices is 'Known KINGMAST edge sessions and monotonic sequence checkpoints.';
comment on table edge_ingest_events is 'Accepted/rejected edge ingress audit evidence for replay, clock and protocol diagnostics.';
comment on table edge_alert_events is 'Stable warning-only alert transitions emitted by the edge safety pipeline.';

commit;
