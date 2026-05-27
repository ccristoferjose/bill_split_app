import { useEffect, useState, useCallback } from 'react';

// Theme controller.
// - mode: persisted user choice ('system' | 'light' | 'dark'), default 'system'
// - effective: what's actually applied right now ('light' | 'dark')
// In 'system' mode the effective theme tracks prefers-color-scheme live.

const STORAGE_KEY = 'theme';
const MODES = ['system', 'light', 'dark'];

function readMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(v) ? v : 'system';
  } catch { return 'system'; }
}

function computeEffective(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyToDom(effective) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

export function useTheme() {
  const [mode, setModeState] = useState(readMode);
  const [effective, setEffective] = useState(() => computeEffective(readMode()));

  // Apply DOM class whenever effective theme changes
  useEffect(() => {
    applyToDom(effective);
  }, [effective]);

  // Track system changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setEffective(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    setModeState(next);
    setEffective(computeEffective(next));
  }, []);

  return { mode, effective, setMode };
}
