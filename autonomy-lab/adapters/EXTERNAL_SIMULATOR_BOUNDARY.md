# External simulator execution boundary

CARLA and esmini execute only in the guarded `External Simulator Evidence` workflow on the dedicated `[self-hosted, linux, kingmast-simulator]` runner. The workflow is manual-only, uses the protected `simulator-evidence` environment and calls fixed reviewed wrapper paths from `autonomy-lab/digital-twin/runner-contract.json`.

Every genuine result envelope must bind to the exact 40-character source commit, dispatched campaign scope and SHA-256 of the reviewed campaign file. The envelope also carries the simulator version and a SHA-256 identity for the runner-native result artifact. KINGMAST validates each envelope before cross-simulator comparison, then hashes the two envelopes and parity report into `kingmast-external-simulator-evidence-manifest/v1`.

The manifest status is `captured-awaiting-independent-review`. External simulator evidence is virtual evidence only: it cannot write production thresholds, satisfy HIL, qualify vehicle-computer hardware, satisfy controlled-track evidence, create homologation/compliance claims or authorize public-road use.
