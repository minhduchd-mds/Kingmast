# Safety Policy

KINGMAST main is warning-only. Hazardous control functions are prohibited.

## Mandatory gates
- Define ODD and item boundary before road testing.
- Maintain hazard -> requirement -> code -> test -> evidence traceability.
- Reject stale/frozen/misaligned frames.
- Never infer range from old radar data after radar loss.
- On CAN loss, reduce confidence; do not escalate to Critical from uncertain speed alone.
- Camera loss may preserve radar ranging but reduces classification/lane confidence.
- Safety changes require scenario tests and independent review before real-vehicle trials.

Standards roadmap: ISO 26262, ISO 21448 SOTIF, ISO/SAE 21434, ISO 24089, UNECE R155/R156; additional vehicle/electrical regulations apply by market.
