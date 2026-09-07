# KINGMAST v0.0.6 device provisioning lifecycle

Status: research security architecture. This is not fleet PKI, certificate automation, secure-element provisioning evidence, or a production identity-management service.

## Purpose

KINGMAST now models the server-side lifecycle needed to move from manually configured device keys toward hardware-backed asymmetric device identity. The model is deliberately independent from Tesla, BYD, VinFast, or any other OEM implementation. It is derived from general cybersecurity requirements and implemented as a clean-room KINGMAST design.

## Trust boundary

The provisioning service accepts **Ed25519 public keys only**. A device private key must be generated and retained on the device or in a hardware-protected key store. Private key material must never be uploaded to the KINGMAST server, committed to Git, written to logs, or returned by diagnostics.

Lifecycle:

1. device identity is created outside the server;
2. public key is enrolled as `pending`;
3. an authorized provisioning process validates device/hardware identity;
4. the public key becomes `active`;
5. a replacement key may overlap during controlled rotation;
6. compromised/retired keys become `revoked` and cannot be reactivated.

## Runtime compatibility

`DeviceProvisioningRegistry.exportServerRegistry()` emits only active/revoked Ed25519 public-key records in the same shape consumed by `KINGMAST_DEVICE_KEYS_JSON`. Pending credentials are intentionally excluded from runtime authentication.

The in-repo registry is bounded by device count and keys per device so malformed or hostile provisioning input cannot create unbounded memory growth.

## What this does not prove

This model does not prove:

- a private key is non-exportable in hardware;
- device manufacturing identity is genuine;
- mutual TLS is deployed;
- a certificate authority or OCSP/CRL service exists;
- secure boot binds the running firmware to the provisioned identity;
- provisioning occurred on a physical vehicle controller.

Production intent requires hardware-backed non-exportable keys, secure provisioning, certificate issuance/renewal, revocation distribution, secure boot linkage, audit, operator authorization, and physical validation.
