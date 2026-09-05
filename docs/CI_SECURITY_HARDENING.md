# CI security hardening

This branch upgrades KINGMAST CI tooling away from GitHub Actions versions that target deprecated Node 20 runtimes and moves the project to pnpm 10.34.0. The production dependency audit is temporarily printed in detailed form on this branch so the remaining advisory can be identified precisely before the gate is tightened to moderate severity.

No vehicle-control authority, ADAS thresholds, sensor logic, or HMI runtime behavior is changed by this hardening work.
