# KINGMAST physical boot-security evidence v0.0.6

`V006_BOOT_SECURITY_EVIDENCE_REGISTRY.json` is an honesty gate for physical security claims. Its baseline intentionally keeps every scenario `pending`.

A result may move to `passed` or `failed` only when the registry includes:

- the exact 40-character source commit
- hardware/board identity
- bootloader version
- toolchain used for the test
- RFC3339 test time
- operator
- independent reviewer
- retained artifact references (serial logs, power traces, debugger output, signed image metadata, CAN capture or equivalent)

Required scenarios cover unsigned-image rejection, unauthorized/revoked signer rejection, hardware anti-rollback, power loss during inactive-slot write, failed candidate boot recovery, non-exportable device-key behavior and physical CAN transmit restriction.

Passing software unit tests, SIL replay or the in-repo A/B state model **does not** satisfy this registry. These scenarios require a real controller/board and bench/HIL evidence.

The physical CAN scenario is specifically about preventing actuator-control transmission at the hardware/interface boundary. It does not authorize KINGMAST to implement steering, braking, throttle, gear or torque control.

This registry is engineering evidence bookkeeping, not ISO 26262, ISO/SAE 21434, UNECE R155/R156 certification or homologation.
