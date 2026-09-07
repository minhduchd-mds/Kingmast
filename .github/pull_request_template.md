## Change summary

Describe what changes and why.

## Safety authority

- [ ] This change preserves KINGMAST warning-only / advisory-only Level-0 authority.
- [ ] No steering, braking, throttle, gear, torque, drivetrain or CAN-write capability is added.
- [ ] Simulation/autonomy-lab code is not imported into production HMI/risk/edge paths.

## Safety / SOTIF evidence

- [ ] Relevant ODD/HARA/SOTIF assumptions were reviewed.
- [ ] New or changed safety behavior has deterministic tests/scenarios where applicable.
- [ ] Sensor freshness, confidence, degradation and unavailable states fail closed.
- [ ] DMS/360 changes expose uncertainty rather than false precision.

## Cybersecurity / privacy

- [ ] No secrets, credentials, private keys or production tokens are committed.
- [ ] New ingress is authenticated, bounded and replay/abuse-aware where applicable.
- [ ] No raw continuous cabin/video data is retained by default.
- [ ] Security-sensitive changes include rotation/revocation/failure behavior where applicable.

## Supply chain / release evidence

- [ ] Dependency changes are reflected in the lockfile and pass production audit.
- [ ] CI remains pinned to reviewed immutable Action SHAs.
- [ ] SBOM/provenance generation remains valid for production build outputs.

## OEM clean-room boundary

- [ ] External OEM research used only public official evidence.
- [ ] No Tesla/BYD/VinFast code, firmware, UI assets, screenshots, wording, proprietary algorithms, datasets or calibration values were copied.
- [ ] Any benchmark was transformed through `public evidence -> abstract requirement -> independent KINGMAST design -> independent implementation -> independent validation`.

## Validation

List commands/scenarios run and attach evidence when relevant.

## Production claim

- [ ] This PR does **not** claim ISO 26262, ISO 21448, UNECE R155/R156 compliance, homologation or public-road approval unless a separate qualified certification/regulatory program explicitly supports that claim.
