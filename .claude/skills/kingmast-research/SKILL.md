---
name: kingmast-research
description: Evidence-based research workflow for KINGMAST. This skill should be used for current automotive HMI, ADAS, edge AI, safety, standards, hardware, open-source technology, competitor, and product research that informs implementation decisions.
user-invocable: true
---

# KINGMAST research

## Goal

Turn external research into original, implementable KINGMAST decisions with clear evidence and no proprietary copying.

## Workflow

1. Define the decision the research must support before collecting sources.
2. Prefer primary/current sources: standards bodies, official vendor docs, platform documentation, peer-reviewed papers and original repositories.
3. Record source date/version when freshness matters.
4. Separate verified facts, measured results, community opinion and inference.
5. For open-source references, inspect license and architecture before borrowing patterns. Reimplement ideas in KINGMAST style rather than copying substantial source.
6. Never use leaked/confidential OEM material or claim access to proprietary ADAS algorithms.
7. Evaluate relevance against KINGMAST constraints: warning-only Level 0, ESP32/edge prototype reality, HMI safety hierarchy, privacy and deployment cost.
8. Translate findings into a prioritized implementation plan with dependencies and validation criteria.
9. Mark hardware/provider requirements explicitly so research does not silently promote capability status.
10. Update repository docs when the decision becomes an engineering rule.

## Output standard

Include what changed in the recommendation, why the evidence supports it, implementation impact, risks and what still needs real-world validation.
