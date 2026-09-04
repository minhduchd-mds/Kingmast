'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type UnitSystem = 'metric' | 'imperial';
export type TextScale = 'standard' | 'large';
export type ContrastPreference = 'system' | 'high';
export type MotionPreference = 'system' | 'reduced';

export interface DriverProfilePreferences {
  id: 'primary';
  name: string;
  locale: 'en-US' | 'vi-VN';
  units: UnitSystem;
  textScale: TextScale;
  contrast: ContrastPreference;
  motion: MotionPreference;
  updatedAtMs: number;
}

export const DRIVER_PROFILE_STORAGE_KEY = 'kingmast:v006:driver-profile';
const EVENT_NAME = 'kingmast:driver-profile';

function defaultProfile(): DriverProfilePreferences {
  return {
    id: 'primary',
    name: 'Driver',
    locale: 'en-US',
    units: 'metric',
    textScale: 'standard',
    contrast: 'system',
    motion: 'system',
    updatedAtMs: Date.now(),
  };
}

function normalize(value: Partial<DriverProfilePreferences> | null | undefined): DriverProfilePreferences {
  const fallback = defaultProfile();
  const name = typeof value?.name === 'string' ? value.name.trim().slice(0, 32) : fallback.name;
  return {
    id: 'primary',
    name: name || fallback.name,
    locale: value?.locale === 'vi-VN' ? 'vi-VN' : 'en-US',
    units: value?.units === 'imperial' ? 'imperial' : 'metric',
    textScale: value?.textScale === 'large' ? 'large' : 'standard',
    contrast: value?.contrast === 'high' ? 'high' : 'system',
    motion: value?.motion === 'reduced' ? 'reduced' : 'system',
    updatedAtMs: typeof value?.updatedAtMs === 'number' ? value.updatedAtMs : Date.now(),
  };
}

function applyToDocument(profile: DriverProfilePreferences) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.kingmastUnits = profile.units;
  root.dataset.kingmastTextScale = profile.textScale;
  root.dataset.kingmastContrast = profile.contrast;
  root.dataset.kingmastMotion = profile.motion;
  root.dataset.kingmastLocale = profile.locale;
}

function readStoredProfile() {
  if (typeof window === 'undefined') return defaultProfile();
  try {
    const raw = window.localStorage.getItem(DRIVER_PROFILE_STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw) as Partial<DriverProfilePreferences>) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

function persist(profile: DriverProfilePreferences) {
  try { window.localStorage.setItem(DRIVER_PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch {}
  applyToDocument(profile);
  window.dispatchEvent(new CustomEvent<DriverProfilePreferences>(EVENT_NAME, { detail: profile }));
}

export function useDriverProfile() {
  const [profile, setProfile] = useState<DriverProfilePreferences>(() => defaultProfile());

  useEffect(() => {
    const stored = readStoredProfile();
    setProfile(stored);
    applyToDocument(stored);
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<DriverProfilePreferences>).detail;
      if (!detail) return;
      const next = normalize(detail);
      setProfile(next);
      applyToDocument(next);
    };
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, []);

  const updateProfile = useCallback((patch: Partial<DriverProfilePreferences>) => {
    setProfile((current) => {
      const next = normalize({ ...current, ...patch, updatedAtMs: Date.now() });
      persist(next);
      return next;
    });
  }, []);

  const restoreDefaults = useCallback(() => {
    const next = defaultProfile();
    persist(next);
    setProfile(next);
  }, []);

  return useMemo(() => ({ profile, updateProfile, restoreDefaults }), [profile, restoreDefaults, updateProfile]);
}
