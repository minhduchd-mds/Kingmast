# Architecture

```text
Radar / Camera / CAN(read-only) / GNSS-IMU
                |
        timestamp + calibration
                |
        detection / tracking
                |
          lane relevance
                |
        deterministic risk engine
                |
     alert manager + event recorder
                |
         HMI / PostgreSQL
```

## Runtime boundaries
- **HMI:** presentation only; can degrade gracefully if API is unavailable.
- **Risk Engine:** deterministic calculation, stale-data rejection, confidence gates and sensor-health gates.
- **Vehicle Adapter:** read-only in MVP. No write primitive is exposed.
- **Database:** stores bounded trip/event/sensor metadata. Raw continuous video is not stored here.
- **Autonomy Lab:** separate simulation-only R&D lifecycle.

## Target production split
`kingmast-edge`, `kingmast-hmi`, `kingmast-cloud` and `kingmast-autonomy-lab` may be split after the prototype, with independent release permissions for safety-relevant edge software.
