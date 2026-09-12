# KINGMAST Security Envelope

KINGMAST is designed as a warning-only, advisory-only system. The Security Envelope is the outer trust boundary that contains every network-connected or extensible component and prevents compromise of one module from becoming vehicle control authority.

## Non-negotiable safety invariant

Internet/API compromise must not create a path to steering, braking, throttle, gear, torque, arbitrary CAN writes, shell execution, firmware installation, or OEM ECU control.

KINGMAST remains:

`Observe -> Analyze -> Warn`

and never becomes:

`Observe -> Analyze -> Control vehicle`

## Layered boundary

```text
Internet
  |
  v
[Security Envelope]
  |- identity / request admission
  |- rate limits / quotas / kill switches
  |- outbound allowlist
  |- signed update verification
  |- integrity / audit / lockdown
  |
  +--> Cloud / Map / AI        (no CAN, no device nodes)
  +--> HMI                     (display + user interaction only)
  +--> Risk engine             (analysis only)
  +--> Sensor gateway          (telemetry normalization)
  |
  v
[Hardware read-only vehicle gateway]
  |
  v
OEM CAN / ECU
```

The software envelope is not a substitute for the hardware boundary. Production vehicle integration should use a physically read-only/listen-only gateway so that even root compromise of the Linux/HMI host cannot transmit arbitrary CAN frames to the vehicle.

## Runtime states

- `normal`: all explicitly enabled non-control features may operate.
- `degraded`: optional cloud services are disabled; local warning paths remain available.
- `isolated`: external network integrations are disabled; local read-only telemetry may remain available.
- `lockdown`: paid providers, OTA, external integrations and remote services are disabled. No additional vehicle authority is granted.

A transition toward a safer state must never require an Internet connection.

## Paid API protection

Official hosted deployments must not expose Google/Mapbox credentials to clients and must not act as an unauthenticated public proxy.

Default community behavior:

- paid routing disabled;
- OSRM/Nominatim or another community provider used when configured;
- users bring their own Google/Mapbox key when they explicitly opt in;
- credentials remain server-side and are never committed;
- hosted paid routing requires authenticated capability, rate limiting, quota, and an emergency kill switch.

Recommended environment controls:

```env
KINGMAST_SECURITY_ENVELOPE_ENABLED=true
KINGMAST_RUNTIME_MODE=normal
KINGMAST_PAID_ROUTING_ENABLED=false
KINGMAST_NAV_AUTH_REQUIRED=true
KINGMAST_NAV_RATE_LIMIT_PER_MINUTE=5
KINGMAST_NAV_RATE_LIMIT_PER_HOUR=60
KINGMAST_NAV_DAILY_PAID_LIMIT=500
KINGMAST_NAV_KILL_SWITCH=false
KINGMAST_EMERGENCY_LOCKDOWN=false
KINGMAST_REMOTE_EXEC_ENABLED=false
KINGMAST_PUBLIC_PROXY_ENABLED=false
KINGMAST_UNSIGNED_UPDATE_ALLOWED=false
KINGMAST_EXTERNAL_BINARY_DOWNLOAD=false
```

## Module isolation requirements

Each long-running service should run under a dedicated OS identity and receive only the capabilities/devices it needs. HMI, map, AI and cloud-facing services must not receive `/dev/can*`, arbitrary serial devices, shell execution, privileged Docker sockets, or write access to firmware/update locations.

Preferred IPC is a bounded local interface (for example Unix domain sockets) with explicit schemas and OS-level peer permissions. Do not treat `localhost` as a trust boundary.

## Network rules

- no public SSH/remote shell in production;
- no generic URL-fetch/proxy API;
- no generic command execution API;
- no remote CAN bridge;
- outbound destinations use an allowlist;
- unexpected external destinations should trigger isolation/lockdown;
- cloud responses are data, never actuator commands.

## Update trust chain

Production releases should be signed and verified before installation. Unsigned or invalidly signed updates are rejected. Update code must not execute arbitrary downloaded files. Prefer staged/A-B updates with rollback to a known-good image.

## Fail-safe behavior

Missing, stale, invalid, unauthenticated, replayed, or untrusted data degrades to `unknown`/unavailable. It must never be promoted to healthy data and must never enable extra authority.

## Security review gate

Any change introducing one of the following requires explicit security review:

- CAN transmit/write access;
- brake/steering/throttle/gear/torque control;
- privileged/root service;
- remote command execution;
- dynamic executable/plugin download;
- public proxy/fetch endpoint;
- new credential/token flow;
- OTA/update path;
- new device-node access;
- bypass of the Security Envelope.
