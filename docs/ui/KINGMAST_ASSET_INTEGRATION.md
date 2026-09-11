# KINGMAST HMI asset integration — v0.0.8 branch

This branch transplants the approved v0.0.8 visual asset pack onto the current Next.js HMI architecture at base commit `8f12849222cdd80a6773fc4a7920c4115aa17682`.

- Host vehicle: `apps/hmi/public/assets/kingmast/vehicle/kingmast-front-520.png`
- Individual transparent HMI glyphs: `apps/hmi/public/assets/kingmast/icons/`
- Ten approved source clusters: `apps/hmi/public/assets/kingmast/ui/`
- Asset registry: `apps/hmi/lib/kingmast-assets.ts`
- Asset-specific visual overrides: `apps/hmi/app/hmi-assets-v0.0.8.css`

The existing spatial overlay, range semantics, object detection markers, telemetry and risk logic are unchanged. The vehicle bitmap and navigation glyphs are visual-only. The existing `.egoVehicle` host element is retained so the surround-visualization positioning contract remains intact. Reduced-motion and increased-contrast preferences are preserved.

This transplant intentionally does not restore the retired `apps/web` frontend and does not merge or overwrite `main`.
