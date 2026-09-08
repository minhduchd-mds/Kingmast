# KINGMAST Independent Safety Research

Snapshot: 2026-09-08

This module captures public-source research without copying proprietary algorithms or paid standards text. It is intentionally separate from the production risk engine.

## Research families

- United States: NHTSA Level-0/ADAS guidance, ADS safety elements, crash-avoidance scenario research (simulation/XIL/closed track) and FMVSS 127 as a forward-sensing comparator.
- European Union: General Safety Regulation, DDAW and ISA regulations, plus Euro NCAP 2026 Safe Driving/virtual-testing structure.
- International: UNECE cybersecurity/software-update references, ISO functional-safety/SOTIF/scenario-framework abstracts and ASAM OpenDRIVE/OpenSCENARIO interfaces.
- Vietnam: Law 36/2024/QH15 and QCVN 09:2024/BGTVT.
- OEM observations: Tesla, Toyota, BYD and VinFast public documentation.

The machine-readable registry is `source-registry.json`. `validate-safety-research.mjs` fails closed if regional diversity, source provenance, clean-room policy or production-separation rules are weakened.

## Self-research model

"Self research" means the research system can continuously **discover candidates, compare concepts, detect gaps and propose scenarios**. It does not mean autonomous online learning is allowed to alter vehicle safety behavior.

The safe research loop is:

1. collect an authoritative public source outside deterministic CI;
2. store only metadata and original paraphrases;
3. classify the source as regulation, guidance, standard reference, assessment or OEM observation;
4. map a principle to one or more simulation scenario tags;
5. require human review before the source becomes accepted research;
6. run the independent simulator and parameter sweep;
7. map relevant findings to HIL/target/controlled-track evidence IDs;
8. create a production-change proposal only when there is a clear engineering rationale;
9. require normal software review plus SIL/HIL/target/track evidence before promotion.

## Copyright and legal boundary

ISO paid standards are referenced only by public title/abstract-level concepts. OEM sources are treated as behavioral/feature observations, not as implementation specifications. KINGMAST derives its own code and test logic.
