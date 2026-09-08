# Safety simulation interoperability bridge

KINGMAST keeps simulator-neutral scenario intent in `autonomy-lab/safety-sim/scenario-library.json` and exports a bounded bridge manifest rather than making a false claim that generated files are automatically ASAM-conformant.

The current target interface versions are ASAM OpenDRIVE 1.9.0 for static road-network description and ASAM OpenSCENARIO XML 1.4.0 for dynamic scenario description. External CARLA/esmini execution remains a future adapter step and must validate generated artifacts against the chosen simulator/schema before results are accepted.

The bridge preserves source traceability, warning-only control authority, synthetic geometry and explicit `asamSchemaValidated=false`, `carlaExecuted=false`, `esminiExecuted=false` fields until those steps actually occur.
