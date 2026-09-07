# KINGMAST v0.0.6 A/B recovery software model

Status: deterministic software model for research/SIL. It is not evidence that an ESP32 bootloader, partition table or physical power-loss recovery has been implemented.

## Safety intent

The previous known-good image remains authoritative until a verified candidate has actually booted and passed health acceptance.

The model enforces these invariants:

1. a candidate is staged only to the inactive slot;
2. staging a candidate does not change the active or known-good slot;
3. beginning a candidate boot changes only the boot target;
4. the candidate becomes known-good only after explicit boot-health acceptance;
5. boot failure selects the previous known-good slot and requires rollback;
6. power loss before acceptance selects the previous known-good slot and requires rollback;
7. candidate acceptance cannot be skipped or inferred;
8. rollback-index commitment remains a separate anti-rollback concern and must occur only after healthy boot acceptance.

## Model

`services/risk-engine/src/update-recovery.ts` implements `ABRecoveryModel` with phases:

```text
idle
  -> candidate-written
  -> booting-candidate
  -> accepted

candidate-written --power loss--> rollback-required
booting-candidate --boot failure/power loss--> rollback-required
rollback-required -> idle after recovery
```

The model deliberately retains both `knownGoodSlot` and `bootTarget`. This prevents a candidate from becoming trusted merely because the system attempted to boot it.

## Evidence boundary

Unit/SIL tests demonstrate state-machine semantics only. They do not prove:

- actual dual partitions exist on the target board;
- a bootloader verifies the selected image;
- eFuse/secure-boot state is correct;
- flash writes are atomic under brownout;
- hardware anti-rollback is enabled;
- a watchdog can restore the known-good image;
- repeated physical power interruption is survivable.

Those remain `pending` in `V006_FIRMWARE_TRUST_EVIDENCE.json` and require physical HIL/board evidence.

## Clean-room boundary

This model is an independent fail-safe update design. It does not use Tesla, BYD, VinFast firmware, bootloader code, partition layouts, signing keys, update packages or proprietary recovery procedures.
