'use client';

import { useCallback, useEffect, useState } from 'react';

export type AlertVolume = 'low' | 'medium' | 'high';
export type AlertSensitivity = 'low' | 'medium' | 'high';

export interface HmiPreferences {
  advisoryAlerts: boolean;
  cameraAlerts: boolean;
  speedCameraWarnings: boolean;
  laneGuidance: boolean;
  alertVolume: AlertVolume;
  alertSensitivity: AlertSensitivity;
}

const STORAGE_KEY = 'kingmast:v006:hmi-preferences';
const EVENT_NAME = 'kingmast:hmi-preferences';

export const DEFAULT_HMI_PREFERENCES: HmiPreferences = {
  advisoryAlerts: true,
  cameraAlerts: true,
  speedCameraWarnings: true,
  laneGuidance: true,
  alertVolume: 'medium',
  alertSensitivity: 'medium',
};

function normalize(value: Partial<HmiPreferences> | null | undefined): HmiPreferences {
  return {
    advisoryAlerts: value?.advisoryAlerts !== false,
    cameraAlerts: value?.cameraAlerts !== false,
    speedCameraWarnings: value?.speedCameraWarnings !== false,
    laneGuidance: value?.laneGuidance !== false,
    alertVolume: value?.alertVolume === 'low' || value?.alertVolume === 'high' ? value.alertVolume : 'medium',
    alertSensitivity: value?.alertSensitivity === 'low' || value?.alertSensitivity === 'high' ? value.alertSensitivity : 'medium',
  };
}

function applyDocumentState(value: HmiPreferences) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.kingmastAdvisories = value.advisoryAlerts ? 'on' : 'off';
}

export function useHmiPreferences() {
  const [preferences, setPreferences] = useState<HmiPreferences>(DEFAULT_HMI_PREFERENCES);

  useEffect(() => {
    const apply = (value: HmiPreferences) => {
      setPreferences(value);
      applyDocumentState(value);
    };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      apply(raw ? normalize(JSON.parse(raw) as Partial<HmiPreferences>) : DEFAULT_HMI_PREFERENCES);
    } catch {
      apply(DEFAULT_HMI_PREFERENCES);
    }
    const onPreferenceEvent = (event: Event) => {
      const detail = (event as CustomEvent<Partial<HmiPreferences>>).detail;
      apply(normalize(detail));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try { apply(event.newValue ? normalize(JSON.parse(event.newValue) as Partial<HmiPreferences>) : DEFAULT_HMI_PREFERENCES); } catch {}
    };
    window.addEventListener(EVENT_NAME, onPreferenceEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onPreferenceEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<HmiPreferences>) => {
    setPreferences((current) => {
      const next = normalize({ ...current, ...patch });
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      applyDocumentState(next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
      return next;
    });
  }, []);

  return { preferences, updatePreferences };
}
