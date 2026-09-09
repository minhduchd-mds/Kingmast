# KINGMAST v0.0.6 Controlled-Track Lifecycle Dashboard

KINGMAST tracks each bounded `CT-001` through `CT-008` scenario independently.

| State | Meaning | Qualification meaning |
| --- | --- | --- |
| `BLOCKED` | One or more physical Gate-3 entry prerequisites are incomplete | No execution |
| `READY` | Entry prerequisites are reviewed for the bounded facility/run | Not a pass |
| `CAPTURED` | A source-bound package passed ingestion validation and awaits independent review | Not a pass |
| `REVIEWED` | Independent registry review retained a passing result | Evidence only |
| `FAILED` | Independent registry review retained a failed result | Evidence only |

The dashboard keeps execution readiness, capture coverage and reviewed evidence coverage separate. None of these percentages grants target-hardware qualification, controlled-track approval, homologation or public-road authorization.

The source-controlled runner bundle and ingestion index are intentionally fail-closed: all eight scenarios start `BLOCKED`, and the ingestion index starts empty.
