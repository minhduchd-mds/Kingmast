# KINGMAST v0.0.6 runtime observability model

Status: research engineering instrumentation. Metrics are diagnostic evidence only and never vehicle-control inputs.

## Safety rule

Observability must not change deterministic warning decisions. Metrics are written after a risk result is computed and are kept as fixed-size counters/buckets rather than unbounded per-request histories.

## Risk metrics

`BoundedRiskMetrics` records:

- total risk assessments;
- safe/caution/critical outcome counts;
- stale-data rejection count;
- future-data rejection count;
- radar-unavailable rejection count;
- last/max computation latency;
- fixed latency buckets (`<=1`, `<=5`, `<=10`, `<=25`, `>25 ms`).

No raw sensor frames, cabin images, vehicle identifiers, routes or user content are retained by this metrics structure.

## Bounded runtime abuse/replay state

The risk-engine process also keeps bounded fixed-cardinality guard state:

- public deterministic compute endpoints use `BoundedFixedWindowRateLimiter` with a hard cap on active client/route keys;
- legacy camera/radar/GNSS/assist replay tracking uses `BoundedMonotonicTimestampStore` instead of an unbounded map;
- expired replay entries are pruned by TTL;
- capacity exhaustion fails closed rather than allocating unlimited attacker-controlled keys;
- rate-limit/replay state is diagnostic only and cannot increase warning authority or create actuation.

The local process guard is defense in depth. Internet-facing production intent still requires a trusted gateway/WAF or distributed rate limiter because a per-process limiter is not a fleet-wide quota or DDoS control.

## Authenticated diagnostics

Viewer-authenticated diagnostics expose the bounded aggregate metrics together with edge health, audit-journal status and runtime-guard counters:

- `GET /v3/diagnostics` — edge diagnostics plus `risk`, `audit` and `runtimeGuards` summaries;
- `GET /v3/audit/status` — bounded journal health only;
- `GET /v3/health/details` — consolidated authenticated health/evidence summary.

`runtimeGuards` exposes only aggregate active-key/rejection/capacity counts and configured bounds. It does not expose request payloads, device secrets or per-client histories.

The public `/health` endpoint remains intentionally minimal and does not disclose device/audit detail.

## Evidence durability

Event evidence is separate from metrics. `EdgeEventBuffer` remains bounded memory state; the optional bounded audit journal can retain deduplicated event metadata across restarts. Neither metrics nor journal availability is allowed to block warning computation.

## Next integration stage

Before fleet/production intent:

1. add ingress-to-publish and sensor-age distributions;
2. add provider/device trust and signature-failure counters without high-cardinality labels;
3. add process memory/CPU/event-loop delay with bounded cardinality;
4. define warning-latency budgets by ODD and platform;
5. alert externally on audit-persistence degradation and sustained abuse rejection;
6. move Internet quotas to a trusted edge/distributed control plane;
7. export aggregate telemetry only under an explicit privacy/retention policy.

Metrics must never become a hidden feedback path that changes safety thresholds at runtime.
