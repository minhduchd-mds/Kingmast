# KINGMAST v0.0.6 configuration write authority

Status: research/bench security boundary. This is not a fleet IAM or UN R155 conformity claim.

## Purpose

Configuration writes must not reuse telemetry-publisher authority. `POST /v3/geofences` changes runtime advisory configuration, so it uses a separate server/operator credential:

- environment variable: `KINGMAST_CONFIG_TOKEN`;
- request header: `x-kingmast-config-token`;
- minimum configured length: 32 characters;
- constant-time comparison;
- bounded fixed-window write rate limiting;
- fail-closed outside explicit loopback development when the credential is absent or invalid.

## Separation of authority

```text
telemetry device identity -> sensor/assist ingress only
viewer session            -> read/diagnostic access only
configuration credential  -> bounded configuration writes only
```

The configuration credential does not grant telemetry identity, viewer access, firmware signing authority, steering, braking, throttle, gear, torque or CAN-write authority.

## Current scope

The dedicated credential currently protects `POST /v3/geofences`. Additional configuration mutation endpoints must adopt the same or a stronger least-privilege operator/service identity before they are exposed outside bench development.

## Production-intent evolution

A fleet deployment should replace a static shared configuration token with authenticated operator/service identity, short-lived credentials, auditable authorization scopes, rotation/revocation, MFA where human access is involved, and an external policy enforcement/gateway layer.

Configuration history should be durable and integrity-protected, but configuration storage must not become a dependency that blocks collision-warning computation.
