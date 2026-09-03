'use client';

import {
  Bike,
  BusFront,
  CarFront,
  CircleDotDashed,
  LocateFixed,
  Navigation,
  TriangleAlert,
  Truck,
  UserRound,
} from 'lucide-react';
import type { DetectedObject, ObjectKind, VehiclePosition } from '@kingmast/contracts';

const ICONS = {
  person: UserRound,
  car: CarFront,
  motorcycle: Bike,
  bicycle: Bike,
  truck: Truck,
  bus: BusFront,
  obstacle: TriangleAlert,
  unknown: CircleDotDashed,
} satisfies Record<ObjectKind, typeof CarFront>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function markerPosition(object: DetectedObject, vehicle: VehiclePosition) {
  const relative = ((object.bearingDeg - vehicle.headingDeg + 540) % 360) - 180;
  const angle = (relative * Math.PI) / 180;
  const radius = clamp(object.distanceM / 62, 0.13, 0.42);
  return {
    left: `${50 + Math.sin(angle) * radius * 100}%`,
    top: `${50 - Math.cos(angle) * radius * 100}%`,
  };
}

export function ObjectGlyph({ kind }: { kind: ObjectKind }) {
  const Icon = ICONS[kind];
  return <Icon aria-hidden="true" strokeWidth={1.8} />;
}

export default function GpsSafetyMap({
  vehicle,
  objects,
  compact = false,
}: {
  vehicle: VehiclePosition;
  objects: DetectedObject[];
  compact?: boolean;
}) {
  const mapLat = Number(vehicle.lat.toFixed(3));
  const mapLng = Number(vehicle.lng.toFixed(3));
  const span = compact ? 0.0045 : 0.0065;
  const bbox = `${mapLng - span},${mapLat - span},${mapLng + span},${mapLat + span}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${mapLat},${mapLng}`)}`;

  return (
    <div className={`gpsMap ${compact ? 'gpsMapCompact' : ''}`}>
      <iframe
        className="osmMap"
        src={mapSrc}
        title="OpenStreetMap live vehicle position"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="mapShade" aria-hidden="true" />
      <div className="mapHeadingLine" style={{ transform: `translate(-50%, -100%) rotate(${vehicle.headingDeg}deg)` }} />
      <div className="egoMapMarker" aria-label="Vehicle position">
        <CarFront strokeWidth={1.8} />
        <i className="headingArrow" style={{ transform: `translateX(-50%) rotate(${vehicle.headingDeg}deg)` }}>
          <Navigation strokeWidth={2} />
        </i>
      </div>

      {objects.map((object) => (
        <div
          key={object.id}
          className={`objectMapMarker severity-${object.severity}`}
          style={markerPosition(object, vehicle)}
          title={`${object.kind}, ${object.distanceM.toFixed(1)} m, ${Math.round(object.confidence * 100)}%`}
        >
          <ObjectGlyph kind={object.kind} />
          <span>{Math.round(object.distanceM)} m</span>
        </div>
      ))}

      <div className="gpsBadge">
        <LocateFixed strokeWidth={1.8} />
        <span>
          <strong>{vehicle.source === 'device-gps' ? 'DEVICE GPS' : 'GNSS SIM'}</strong>
          {vehicle.accuracyM.toFixed(1)} m accuracy
        </span>
      </div>
    </div>
  );
}
