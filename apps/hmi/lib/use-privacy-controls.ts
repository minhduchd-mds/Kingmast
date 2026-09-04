'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface PrivacyPreferences {
  retainTripSummaries: boolean;
  locationHistory: boolean;
  diagnosticUpload: boolean;
  updatedAtMs: number;
}

export const PRIVACY_STORAGE_KEY = 'kingmast:v006:privacy';
const EVENT_NAME = 'kingmast:privacy';
const NAVIGATION_KEYS = ['kingmast:v25:recent-places','kingmast:v25:route','kingmast:v006:route'];

function defaults(): PrivacyPreferences {
  return { retainTripSummaries: false, locationHistory: false, diagnosticUpload: false, updatedAtMs: Date.now() };
}

function readStored() {
  try {
    const raw = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<PrivacyPreferences>;
    return {
      retainTripSummaries: Boolean(parsed.retainTripSummaries),
      locationHistory: Boolean(parsed.locationHistory),
      diagnosticUpload: Boolean(parsed.diagnosticUpload),
      updatedAtMs: typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : Date.now(),
    } satisfies PrivacyPreferences;
  } catch {
    return defaults();
  }
}

export function usePrivacyControls() {
  const [preferences, setPreferences] = useState<PrivacyPreferences>(() => defaults());
  const [historyClearedAtMs, setHistoryClearedAtMs] = useState<number | null>(null);

  useEffect(() => {
    setPreferences(readStored());
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<PrivacyPreferences>).detail;
      if (detail) setPreferences(detail);
    };
    window.addEventListener(EVENT_NAME, sync);
    return () => window.removeEventListener(EVENT_NAME, sync);
  }, []);

  const updatePreferences = useCallback((patch: Partial<PrivacyPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch, updatedAtMs: Date.now() };
      try { window.localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(next)); } catch {}
      window.dispatchEvent(new CustomEvent<PrivacyPreferences>(EVENT_NAME, { detail: next }));
      return next;
    });
  }, []);

  const clearNavigationHistory = useCallback(() => {
    for (const key of NAVIGATION_KEYS) {
      try { window.localStorage.removeItem(key); } catch {}
    }
    const now = Date.now();
    setHistoryClearedAtMs(now);
    window.dispatchEvent(new CustomEvent('kingmast:navigation-history-cleared', { detail: { atMs: now } }));
  }, []);

  return useMemo(() => ({ preferences, updatePreferences, clearNavigationHistory, historyClearedAtMs }), [clearNavigationHistory, historyClearedAtMs, preferences, updatePreferences]);
}
