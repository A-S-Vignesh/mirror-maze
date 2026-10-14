import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber/native';

const MIN_DPR = 1.1;

export function AdaptiveResolution({ maxDpr }: { maxDpr: number }) {
  const { setDpr, viewport } = useThree();
  const dpr = useRef(viewport.dpr);
  const elapsed = useRef(0);
  const frames = useRef(0);
  const slowWindows = useRef(0);
  const fastSeconds = useRef(0);

  useEffect(() => {
    const next = Math.min(maxDpr, Math.max(MIN_DPR, dpr.current));
    if (Math.abs(next - dpr.current) > .01) {
      dpr.current = next;
      setDpr(next);
    }
  }, [maxDpr, setDpr]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    frames.current++;
    if (elapsed.current < 1.5) return;

    const fps = frames.current / elapsed.current;
    if (fps < 36) {
      slowWindows.current++;
      fastSeconds.current = 0;
      if (slowWindows.current >= 2 && dpr.current > MIN_DPR) {
        const next = Math.max(MIN_DPR, Math.round((dpr.current - .1) * 100) / 100);
        if (next < dpr.current) { dpr.current = next; setDpr(next); }
        slowWindows.current = 0;
      }
    } else {
      slowWindows.current = 0;
      if (fps >= 54 && dpr.current < maxDpr) {
        fastSeconds.current += elapsed.current;
        if (fastSeconds.current >= 8) {
          const next = Math.min(maxDpr, Math.round((dpr.current + .05) * 100) / 100);
          if (next > dpr.current) { dpr.current = next; setDpr(next); }
          fastSeconds.current = 0;
        }
      } else fastSeconds.current = 0;
    }
    elapsed.current = 0;
    frames.current = 0;
  });

  return null;
}
