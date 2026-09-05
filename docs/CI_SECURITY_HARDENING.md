# CI security hardening

KINGMAST CI now uses `actions/checkout@v7`, `actions/setup-node@v7`, and `pnpm/action-setup@v6.1.0`, removing the previous GitHub Actions Node 20 deprecation warning. The project package manager is pinned to pnpm 10.34.0 and reproducible installs remain enforced with `--frozen-lockfile`.

The remaining production advisory was identified as PostCSS GHSA-fxqj-rqcc-2cmp through `apps/hmi > next > postcss`. The repository override and lockfile are pinned to PostCSS 8.5.23, the first patched release for that advisory. CI now fails on production vulnerabilities at `moderate` severity or higher instead of allowing Moderate findings through.

No vehicle-control authority, ADAS thresholds, sensor logic, or HMI runtime behavior is changed by this hardening work.
