# KINGMAST v0.0.6 firmware release signing

Status: research release-signing contract. This is not a production firmware release, homologation evidence, or proof of secure-boot enforcement on hardware.

## Release package

`createSignedUpdateManifest()` creates an update manifest from the exact firmware artifact bytes and signs the canonical manifest payload with an Ed25519 private release key. The manifest binds:

- SHA-256 artifact digest;
- product and software version;
- target platform;
- compatible hardware list;
- configuration schema version;
- calibration compatibility statement;
- release signer key ID;
- monotonic rollback index;
- creation timestamp.

The existing `verifyUpdatePackage()` independently verifies artifact digest, target compatibility, rollback floor, future timestamp guard, and Ed25519 signature before install eligibility is evaluated.

## Key custody

Release private keys must not be stored in the repository, source examples, CI logs, browser code, firmware source, or build artifacts. Production intent is an offline/HSM-backed signing service with separation of duties, key rotation, revocation, access audit, and emergency key-compromise procedure.

The repository code accepts a private key only as an in-memory signing input. It does not persist or return the key.

## Release sequence

1. build firmware reproducibly;
2. generate SBOM/provenance for the exact build;
3. hash the firmware bytes;
4. construct canonical KINGMAST update metadata;
5. sign with approved Ed25519 release identity;
6. publish artifact + manifest + evidence bundle together;
7. verify package on the target before installation;
8. install only under parked/power/thermal/storage eligibility gates;
9. boot candidate slot;
10. commit anti-rollback floor only after accepted boot health.

## Current limitation

The repository does not yet build and sign a production ESP32 binary in CI because no physical production board/toolchain trust root or production signing secret is configured. Tests use ephemeral keys and bench payloads only. This must never be presented as a production firmware release claim.
