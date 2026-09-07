# KINGMAST expert and public-OEM traceability — v0.0.6

Status: engineering traceability for the research line. This document is not an OEM endorsement, certification, homologation claim, or reproduction of proprietary implementation.

## Method and legal boundary

All OEM-derived input follows the controlling clean-room transformation:

`public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation`

Only public, official material may influence the benchmark. KINGMAST does not copy Tesla, BYD, VinFast code, firmware, UI assets, screenshots, warning wording, model weights, datasets, calibration values, thresholds, signing keys, bootloader logic, proprietary interfaces, or confidential documentation.

## Current platform checkpoint

Software checkpoint after the 2026 platform migration:

- Next.js 16.3.4;
- React / React DOM 19.2.8;
- TypeScript 7.0.2;
- MapLibre GL 6.7.0;
- Vitest 5.0.0;
- ESLint 10.10.0;
- warning-only SAE Level 0 authority remains unchanged.

The software stack version is not evidence of vehicle safety qualification. Physical HIL, target-computer soak, electrical qualification and closed-track validation remain separate gates.

## Traceability matrix

| Source class | Independent requirement | KINGMAST implementation/evidence | Software status | Residual validation |
|---|---|---|---|---|
| Tesla public supervision/degraded-state principles | `KM-REQ-ATTN-001` | attention arbitration in HMI; critical hazard suppresses secondary status; warning-only wording | software-evidence-implemented | measured driver comprehension and glance study pending |
| Tesla public sensor-availability principles | `KM-REQ-DEGRADE-001` | stale/future/replayed evidence rejection; explicit sensor-health degradation; no simulator substitution over established live state | software-evidence-implemented | real sensor obstruction/fault HIL pending |
| Tesla public cabin-privacy principles | `KM-REQ-PRIV-001` | DMS metadata model; no identity recognition; no continuous raw cabin-video retention in default evidence path | software-evidence-implemented | production camera/privacy hardware review pending |
| Tesla public software-evolution principles | `KM-REQ-UPD-001` | Ed25519 release manifest, SBOM/provenance, install eligibility, A/B recovery model, boot acceptance and anti-rollback model | software-evidence-implemented | secure-boot/rollback root on target hardware pending |
| BYD public limitation/governance principles | `KM-REQ-LIMIT-001` | capability registry distinguishes integrated/software-ready/requires-integration; degraded/unavailable states are first-class | software-evidence-implemented | independent scenario/human review pending |
| BYD public privacy/minimization principles | `KM-REQ-PRIV-002`, `KM-REQ-DATA-001` | local-first DMS direction; bounded metadata audit; continuous raw video excluded from default event journal | software-evidence-implemented | physical privacy control depends on production camera hardware |
| BYD public lifecycle-cybersecurity principles | `KM-REQ-CSMS-001` | TARA, device/provider/operator identity, replay defence, revocation, audit integrity, CodeQL, secret scan, SBOM and provenance | software-evidence-implemented | external CSMS process assessment/certification not claimed |
| VinFast public Vietnam-market/ADAS context | `KM-REQ-VNODD-001` | Vietnam-relevant ODD/scenario catalogue includes motorcycles, lane ambiguity, roadworks, rain and GNSS multipath | plan-and-software-evidence-implemented | physical HIL/closed-track execution pending |
| VinFast public FOTA precondition principles | `KM-REQ-FOTA-001` | KINGMAST-owned parked/power/update-health eligibility; signed package verification and rollback states | software-evidence-implemented | target-board power-loss and recovery tests pending |
| VinFast public SDV direction | `KM-REQ-SDV-001` | typed contracts separate HMI, deterministic risk engine, edge adapters and provider services; CI enforces read-only boundary | software-evidence-implemented | target vehicle integration evidence pending |
| Senior safety review | deterministic warning core and truthful degradation | deterministic `assessRisk`, SIL replay, safety scenarios, bounded runtime state | software-evidence-implemented | HIL and independent safety review pending |
| Senior cybersecurity review | identity, update, evidence and supply-chain trust | Ed25519 identity/signing paths, bounded replay, hash-chained audit, CodeQL, pinned Actions, SBOM/provenance/evidence anchor | software-evidence-implemented | hardware-backed keys, mTLS termination and external evidence timestamp/signing pending |
| Senior HMI/human-factors review | one attention owner, touch target floor, accessibility, parked progressive disclosure | UI contracts + Playwright + structural human-factors evidence | software-evidence-implemented | measured glanceability/comprehension/error study pending |
| Senior vehicle-integration review | physically and architecturally read-only vehicle path | `ReadOnlyVehiclePort`, no actuator APIs, CI architecture/safety gate | software-boundary-implemented | physical CAN isolation/harness verification pending |

## Evidence classes

`software-evidence-implemented` means the requirement is represented in repository code, tests, policy gates, or reproducible CI evidence. It does **not** mean the behavior is validated on production-intent vehicle hardware.

`plan-and-software-evidence-implemented` means scenario definitions and software checks exist, while physical execution remains pending.

`software-boundary-implemented` means architecture prevents an authority path in this repository; physical harness/electrical enforcement remains a separate claim.

## Remaining expert/OEM closure gates

The following remain intentionally open and cannot be completed by repository-only software changes:

1. physical HIL evidence for controller, sensors, harness and injected faults;
2. production-intent secure boot, hardware-backed private keys and monotonic rollback root;
3. physical read-only CAN enforcement and automotive electrical/EMC/thermal review;
4. long-duration target vehicle-computer soak with synchronized latency/resource evidence;
5. measured human-factors study for glance duration, comprehension, error rate and recovery;
6. independent safety/security review and applicable legal/regulatory approval before public-road use.

## CI honesty rule

CI may prove repository invariants, deterministic replay, structural HMI rules and evidence integrity. CI must never convert software evidence into a claim of HIL completion, target-hardware qualification, standards certification, homologation, or OEM equivalence.
