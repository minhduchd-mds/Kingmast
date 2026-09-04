'use client';

import { useCallback, useEffect, useState } from 'react';

export type AlertVolume = 'low' | 'medium' | 'high';
export type AlertSensitivity = 'low' | 'medium' | 'high';

export interface HmiPreferences {
  cameraAlerts: boolean;
  speedCameraWarnings: boolean;
  laneGuidance: boolean;
  alertVolume: AlertVolume;
  alertSensitivity: AlertSensitivity;
}

const STORAGE_KEY = 'kingmast:v006:hmi-preferences';

export const DEFAULT_HMI_PREFERENCES: HmiPreferences = {
  cameraAlerts: true,
  speedCameraWarnings: true,
  laneGuidance: true,
  alertVolume: 'medium',
  alertSensitivity: 'medium',
};

function normalize(value: Partial<HmiPreferences> | null | undefined): HmiPreferences {
  return {
    cameraAlerts: value?.cameraAlerts !== false,
    speedCameraWarnings: value?.speedCameraWarnings !== false,
    laneGuidance: value?.laneGuidance !== false,
    alertVolume: value?.alertVolume === 'low' || value?.alertVolume === 'high' ? value.alertVolume : 'medium',
    alertSensitivity: value?.alertSensitivity === 'low' || value?.alertSensitivity === 'high' ? value.alertSensitivity : 'medium',
  };
}

export function useHmiPreferences() {
  const [preferences, setPreferences] = useState<HmiPreferences>(DEFAULT_HMI_PREFERENCES);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPreferences(normalize(JSON.parse(raw) as Partial<HmiPreferences>));
    } catch {}
  }, []);

  const updatePreferences = useCallback((patch: Partial<HmiPreferences>) => {
    setPreferences((current) => {
      const next = normalize({ ...current, ...patch });
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { preferences, updatePreferences };
}
