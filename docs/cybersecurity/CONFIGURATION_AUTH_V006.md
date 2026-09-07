# KINGMAST v0.0.6 configuration write authority

Status: research/bench security boundary. This is not a fleet IAM, ISO/SAE 21434, UNECE R155, or homologation conformity claim.

## Purpose

Configuration writes must not reuse telemetry-publisher authority. `POST /v3/geofences` changes runtime advisory configuration, so KINGMAST now supports a scoped operator identity instead of relying only on a shared configuration token.

Preferred operator mode:

- `KINGMAST_REQUIRE_OPERATOR_AUTH=1`;
- server-side registry `KINGMAST_OPERATOR_KEYS_JSON` contains Ed25519 **public keys only**;
- the client signs a canonical request binding the scope, operator ID, key ID, timestamp, nonce, and payload digest;
- current scope is `configuration:geofences`;
- signatures are checked against key state, validity window, scope, clock skew, and replay state;
- bounded replay state and bounded configuration-write rate limiting are enforced;
- accepted mutations create an operator-attributed configuration audit record.

Migration mode may still use `KINGMAST_CONFIG_TOKEN` when `KINGMAST_REQUIRE_OPERATOR_AUTH=0`. The migration token requires at least 32 characters, uses constant-time comparison, remains server-only, and is not accepted once strict operator mode is enabled.

## Separation of authority

```text
telemetry device identity -> sensor/assist ingress only
viewer session            -> read/diagnostic access only
operator identity          -> scoped configuration writes only
migration config token     -> transitional configuration writes only
```

Operator/configuration authority does not grant telemetry identity, viewer access, provider identity, firmware signing authority, steering, braking, throttle, gear, torque, drivetrain, or CAN-write authority.

## Request identity

Strict operator requests use these headers:

- `x-kingmast-operator-id`
- `x-kingmast-operator-key-id`
- `x-kingmast-operator-timestamp-ms`
- `x-kingmast-operator-nonce`
- `x-kingmast-operator-signature`

Private Ed25519 keys must remain on the operator side in a protected keystore, HSM, or KMS. They must never be committed to this repository or placed in the server-side registry.

## Current scope

The scoped operator identity currently protects `POST /v3/geofences`. Additional configuration mutation endpoints must define their own least-privilege operator scopes and audit semantics before exposure outside bench development.

Configuration mutation audit records include actor identity, key ID where applicable, authentication mode, sequence/time, source IP, counts, and digests of previous/new values rather than relying only on free-form logs.

## Production-intent evolution

A fleet deployment should move operator authentication behind a hardened identity/policy gateway, use short-lived identity credentials and managed key lifecycle, require MFA for human operators where applicable, centralize authorization policy, export configuration audit evidence to durable integrity-protected storage, and support rotation/revocation with incident response procedures.

Configuration history and authorization services must not become dependencies that block collision-warning computation. KINGMAST remains warning-only / advisory-only Level 0 and no configuration identity path introduces actuator authority.
