'use client';

import { useEffect, useRef, useState } from 'react';

export const MOTION = {
  ms: {
    instant: 80,
    quick: 160,
    standard: 280,
    emphasized: 420,
    ambient: 1200,
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
    linear: 'linear',
  },
} as const;

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/**
 * Driver values follow telemetry samples instead of interpolating React state on
 * every animation frame. The previous implementation could re-render the whole
 * cockpit 20-30 times for one speed/gap/TTC sample. Visual motion belongs on
 * compositor-friendly transforms; safety-relevant numbers should stay current.
 */
export function useAnimatedNumber(target: number, duration: number = MOTION.ms.standard) {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    if (Object.is(valueRef.current, target)) return;
    valueRef.current = target;

    if (reducedMotion || duration <= MOTION.ms.instant) {
      setValue(target);
      return;
    }

    let frame = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(frame);
  }, [duration, reducedMotion, target]);

  return value;
}
