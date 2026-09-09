# KINGMAST v0.0.6 HIL Coverage Dashboard

This dashboard is an evidence-lifecycle view, not a qualification score.

| State | Meaning | Qualification effect |
|---|---|---|
| `BLOCKED` | Physical prerequisites incomplete | None |
| `READY` | Reviewed prerequisites permit bounded bench execution | None |
| `CAPTURED` | Source-bound package validated and awaiting independent review | None |
| `REVIEWED` | Independent registry review accepted a physical result | Evidence only |
| `FAILED` | Independent registry review retained a failed physical result | Evidence only |

Metrics are kept separate: execution readiness %, capture coverage %, and reviewed evidence coverage %. None imply target-hardware qualification, homologation, controlled-track approval, or public-road authorization.

The dashboard merges runner state, the bounded ingestion index, and the HIL evidence registry. The registry remains authoritative for reviewed pass/fail status. Ingestion can only move lifecycle visibility to `CAPTURED`; automation cannot promote the registry.

The committed baseline is deliberately fail-closed: 12 `BLOCKED`, 0 `READY`, 0 `CAPTURED`, 0 `REVIEWED`, 0 `FAILED`, and 0% reviewed physical evidence coverage.
