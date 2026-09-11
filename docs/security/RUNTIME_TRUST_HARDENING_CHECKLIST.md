# Runtime trust hardening checklist

No product-version bump is included in this batch.

- [x] Full-origin viewer-session validation
- [x] Same-origin/no-sniff session response headers
- [x] Realtime payload-size and collection bounds
- [x] Realtime provenance validation
- [x] Stale/offline telemetry invalidation
- [x] Duplicate sequence replay rejection
- [x] Device-GPS isolation from simulator perception
- [x] Edge boot replay rejection
- [x] Edge boot-ID churn limiting with bounded history
- [ ] CI/security gates green on pull request
