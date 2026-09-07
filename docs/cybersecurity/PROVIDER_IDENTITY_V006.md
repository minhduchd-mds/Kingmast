# KINGMAST provider identity v0.0.6

## Purpose

External traffic-camera, connected-road and V2X feeds are a different trust domain from vehicle telemetry publishers. A provider credential must not inherit vehicle-edge publication authority.

## Runtime signature model

`KINGMAST_PROVIDER_KEYS_JSON` is a bounded provider registry. Each provider has 1..8 credentials with:

- `keyId`
- algorithm: transitional `hmac-sha256` or preferred `ed25519`
- explicit scopes: `road-context:cameras`, `connected-road:provider`, `connected-road:v2x`
- active/revoked state
- optional not-before / not-after window

Provider requests bind the scope, provider ID, key ID, timestamp and canonical payload. The service rejects altered payloads, wrong scope, revoked/expired/future keys and requests outside the replay window.

Set `KINGMAST_REQUIRE_PROVIDER_AUTH=1` to remove shared `KINGMAST_EDGE_TOKEN` fallback from provider-owned routes. Migration fallback exists only so research publishers can be converted without an unsafe flag day; it is not the production target.

Legacy `KINGMAST_V2X_PROVIDER_KEYS_JSON` is migration-only. In strict provider mode, V2X must use provider-scoped identity and the legacy V2X HMAC path is not authoritative.

## mTLS lifecycle scaffold

`KINGMAST_PROVIDER_CERTIFICATES_JSON` stores **certificate metadata only**: certificate ID, SHA-256 fingerprint, scopes, validity window, issuer label and active/revoked state. It supports bounded overlap during rotation and explicit revocation.

The risk-engine application does **not** infer mTLS success from arbitrary HTTP headers. Production mTLS must terminate in a trusted gateway, service mesh or direct TLS stack whose client-certificate verification cannot be spoofed by an untrusted upstream. Any identity forwarded from that termination point must travel over an authenticated protected channel with a documented trust boundary.

The in-repo certificate registry is therefore a lifecycle and policy scaffold, not proof that mTLS is deployed.

## Production intent

1. Provider key/certificate enrollment is approved independently of vehicle-device enrollment.
2. Prefer asymmetric credentials; provider private keys never enter the KINGMAST repository or runtime configuration store.
3. Use short overlap for rotation, then revoke the previous identity.
4. Distribute revocation state to all provider ingress nodes before accepting a replacement feed as trusted.
5. Require mTLS or equivalent mutually authenticated transport at the gateway, plus request-level signing for high-integrity V2X where appropriate.
6. Keep map/provider data advisory-only; external context cannot override collision-critical on-vehicle perception.

## Claim boundary

This document does not claim UNECE R155 compliance, production PKI, an accredited CA, deployed mTLS, certificate pinning at a production gateway or homologation evidence.
