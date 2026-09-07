# KINGMAST public OEM benchmark and clean-room policy — 2026

Status: engineering research input. This document is not a certification claim and does not reproduce proprietary OEM implementation.

## Purpose

KINGMAST may study public, official material from Tesla, BYD, VinFast, standards bodies and safety-assessment organizations to understand market expectations and safety principles. The research path is strictly:

`public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation`

Never use leaked/confidential material, reverse-engineered firmware, proprietary datasets, copied source code, copied HMI layouts, copied icons, copied wording or copied calibration values.

## Current KINGMAST boundary

KINGMAST remains SAE Level 0, warning-only and advisory-only. It has no steering, braking, throttle, gear, torque, generic CAN-write or actuator authority. Autonomous-driving work remains simulation-only under `autonomy-lab/`.

## Public benchmark observations

### Tesla — supervision, degraded state, privacy and software evolution

Public Tesla owner documentation shows several reusable *principles*: driver-assistance functions require continuing driver attention; sensor/camera obstruction can make features unavailable; software behavior changes through OTA updates; and cabin-camera data is primarily processed locally unless the user enables relevant data sharing. KINGMAST does not copy Tesla UI, alerts, neural-network design, control logic or feature names.

Independent KINGMAST requirements derived from those principles:

- KM-REQ-ATTN-001: driver-facing alerts SHALL preserve a clear attention hierarchy and SHALL NOT imply autonomous authority.
- KM-REQ-DEGRADE-001: stale, blocked, replayed, low-confidence or unavailable sensing SHALL degrade or disable dependent assistance instead of inventing healthy state.
- KM-REQ-PRIV-001: DMS SHALL operate without identity recognition and without continuous raw cabin-video retention.
- KM-REQ-UPD-001: software updates SHALL have signed provenance, explicit installation preconditions, rollback strategy and auditable version state before vehicle deployment.

Official public references:
- https://www.tesla.com/ownersmanual/model3/en_nl/GUID-59736DF1-31FA-4F67-8A3F-6111778939D9.html
- https://www.tesla.com/ownersmanual/model3/en_eu/GUID-682FF4A7-D083-4C95-925A-5EE3752F4865.html
- https://www.tesla.com/ownersmanual/model3/en_nz/Owners_Manual.pdf

### BYD — explicit limitations, privacy-by-design and governance

Public BYD material emphasizes privacy controls, local processing/minimization concepts, physical privacy controls for some DMS implementations, and public claims of R155 CSMS/R156 SUMS certification. KINGMAST does not copy DiPilot/God's Eye branding, UI, algorithms, DMS mechanics or vendor-specific system architecture.

Independent KINGMAST requirements:

- KM-REQ-LIMIT-001: every assistance capability SHALL document purpose, inputs, activation conditions, operating limitations, degraded behavior and unavailable behavior.
- KM-REQ-PRIV-002: cabin sensing SHALL expose a clear privacy state; hardware privacy controls are preferred when a future production DMS camera supports them.
- KM-REQ-DATA-001: collect only data required for the active function; raw continuous video is out of scope for the default event store.
- KM-REQ-CSMS-001: cybersecurity work SHALL be managed as a lifecycle process, not only a set of endpoint protections.

Official public reference:
- https://www.byd.com/vn/data-privacy.html

### VinFast — Vietnam-relevant ADAS expectations, SDV direction and FOTA preconditions

Public VinFast material lists a broad ADAS set on VF 8 and describes software-defined vehicle direction and FOTA installation preconditions. This is useful for identifying Vietnam-market expectations and mixed-traffic validation needs. KINGMAST does not copy VinFast UI, CVC architecture, firmware, wording, calibration or proprietary ADAS implementation.

Independent KINGMAST requirements:

- KM-REQ-VNODD-001: validation SHALL include Vietnam-relevant mixed traffic such as motorcycles, lane ambiguity, dense cut-ins, roadworks, heavy rain and GNSS urban multipath.
- KM-REQ-FOTA-001: install eligibility SHALL be evaluated by KINGMAST-owned safety policy using verified parked/power/update-health state; thresholds SHALL be independently justified and validated.
- KM-REQ-SDV-001: software modules SHALL use explicit contracts and release evidence so HMI, risk engine, edge firmware and future native services can evolve independently.

Official public references:
- https://vinfastauto.com/vn_vi/vf-8
- https://vinfastauto.com/vn_vi/dat-coc-xe-vf8-the-all-new-2026
- https://vinfastauto.com/vn_vi/node/6196
- https://vinfastauto.com/vn_vi/node/6483

## Standards and assessment references

These sources define engineering/process targets; they do not make KINGMAST compliant or certified by citation alone.

- ISO 26262 road-vehicle functional safety family: https://www.iso.org/publication/PUB200262.html
- ISO 21448:2022 SOTIF: https://www.iso.org/standard/77490.html
- UNECE cybersecurity/software-update reference documents including UN R155/R156: https://unece.org/transport/road-transport/reference-documents
- UN R156 source page: https://unece.org/transport/documents/2021/03/standards/un-regulation-no-156-software-update-and-software-update
- Euro NCAP 2026 protocols: https://www.euroncap.com/protocols/
- Euro NCAP 2026 Safe Driving: https://www.euroncap.com/safe-driving/

## Clean-room rules

1. Record the public source and access date/version when a benchmark changes an engineering decision.
2. Write the observation in generic safety/product language before proposing a KINGMAST requirement.
3. Do not reuse OEM screenshots, icons, textual warnings, animations, code, firmware, secret interfaces, model weights or datasets.
4. Do not copy vendor-specific timing, distance or confidence thresholds unless the same value is independently required by an open regulation/test protocol and its origin is documented.
5. Do not claim access to Tesla, BYD or VinFast proprietary algorithms.
6. Do not name KINGMAST features with protected OEM branding.
7. Keep every implementation reviewable from KINGMAST requirements and tests without needing the OEM source to understand the code.
8. Before commercialization, perform independent intellectual-property/FTO review; clean-room implementation reduces copying risk but does not by itself resolve patent questions.

## Evidence record template

```text
Research ID:
Decision:
Public source:
Verified observation:
What is intentionally NOT copied:
Independent KINGMAST requirement:
Independent design:
Test/evidence:
Open validation risk:
```

This file is the controlling policy for competitor/OEM research in KINGMAST.