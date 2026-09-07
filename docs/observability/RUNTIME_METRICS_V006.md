# KINGMAST v0.0.6 runtime observability model

Status: research engineering instrumentation. Metrics are diagnostic evidence only and never vehicle-control inputs.

## Safety rule

Observability must not change deterministic warning decisions. Metrics are written after a risk result is computed and are kept as fixed-size counters/buckets rather than unbounded per-request histories.

## Risk metrics

`BoundedRiskMetrics` records:

- total risk assessments;
- safe/caution/critical outcome counts;
- stale-data rejection count;
- radar-unavailable rejection count;
- last/max computation latency;
- fixed latency buckets (`<=1`, `<=5`, `<=10`, `<=25`, `>25 ms`).

No raw sensor frames, cabin images, vehicle identifiers, routes or user content are retained by this metrics structure.

## Authenticated diagnostics

Viewer-authenticated diagnostics expose the bounded aggregate metrics together with edge health and audit-journal status:

- `GET /v3/diagnostics` — edge diagnostics plus `risk` and `audit` summaries;
- `GET /v3/audit/status` — bounded journal health only;
- `GET /v3/health/details` — consolidated authenticated health/evidence summary.

The public `/health` endpoint remains intentionally minimal and does not disclose device/audit detail.

## Evidence durability

Event evidence is separate from metrics. `EdgeEventBuffer` remains bounded memory state; the optional bounded audit journal can retain deduplicated event metadata across restarts. Neither metrics nor journal availability is allowed to block warning computation.

## Next integration stage

Before fleet/production intent:

1. add ingress-to-publish and sensor-age distributions;
2. add provider trust/signature failure counters;
3. add process memory/CPU/event-loop delay with bounded cardinality;
4. define warning-latency budgets by ODD and platform;
5. alert externally on audit-persistence degradation;
6. export aggregate telemetry only under an explicit privacy/retention policy.

Metrics must never become a hidden feedback path that changes safety thresholds at runtime.
