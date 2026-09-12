'use client';

import { useEffect } from 'react';

type HmiTheme = 'light' | 'dark';

const STORAGE_KEY = 'kingmast:hmi-theme';
const THEME_EVENT = 'kingmast:hmi-theme-change';

function applyTheme(theme: HmiTheme) {
  document.documentElement.dataset.kingmastTheme = theme;
  document.body.dataset.kingmastTheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

function resolveInitialTheme(): HmiTheme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function isThemeControl(button: HTMLButtonElement) {
  const className = button.className || '';
  const text = button.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
  return className.includes('nightButton') || text.includes('night hmi') || text.includes('chế độ đêm');
}

function syncControls(theme: HmiTheme) {
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (!isThemeControl(button)) return;
    button.dataset.themeState = theme;
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.setAttribute('aria-label', theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    button.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
  });
}

export default function HmiThemeRuntime() {
  useEffect(() => {
    let theme = resolveInitialTheme();
    applyTheme(theme);
    syncControls(theme);

    const toggle = () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme(theme);
      syncControls(theme);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest('button');
      if (!(button instanceof HTMLButtonElement) || !isThemeControl(button)) return;
      toggle();
    };

    const observer = new MutationObserver(() => syncControls(theme));
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', onClick);
    };
  }, []);

  return null;
}
