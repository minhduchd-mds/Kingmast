# KINGMAST v0.0.6 Physical Evidence Store Contract

## Purpose

KINGMAST keeps physical HIL, controlled-track, target-soak, calibration and other qualification evidence out of source control. The repository contains only a fail-closed metadata contract. Raw evidence must live in an externally protected store with reviewed access control and immutability.

The committed baseline deliberately reports `backendConfigured=false`. This is not a missing software feature; it is an honesty boundary until a real protected evidence backend is provisioned.

## Registration flow

1. Execute an already authorized physical activity on an approved isolated bench or controlled track.
2. Build a source-bound package with exact 40-character software commit identity.
3. Validate every referenced evidence artifact with SHA-256.
4. Validate the package and calculate the exact package SHA-256.
5. Register bounded metadata in a protected-store index. The repository index remains a template and is not the production evidence database.
6. Place the package and raw artifacts in an external store configured for encryption at rest, access control and immutability.
7. Submit the package to the independent review queue.
8. Only after independent review may a human-controlled process update the HIL or controlled-track registry.

## Metadata boundary

Allowed metadata includes opaque evidence references, package hashes, source commit, timestamps, evidence class, retention class and review state.

The metadata index must not contain raw hardware serials, credentials, private keys, precise coordinates, raw cabin video or raw camera frames. Object references must not embed credentials.

## Integrity

Every registered record binds the exact package SHA-256, source commit and per-evidence SHA-256 digests. Duplicate package digests are rejected. Long-term physical evidence must be immutable or write-once according to the program's approved store policy.

## Safety boundary

Evidence registration is bookkeeping. It cannot grant target-hardware qualification, closed-track approval, homologation, public-road authorization, actuator authority or CAN write capability.
