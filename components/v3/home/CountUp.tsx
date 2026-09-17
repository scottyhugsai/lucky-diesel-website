'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  durationMs?: number;
}

const format = new Intl.NumberFormat('en-US');

/**
 * Counts from 0 to `value` when scrolled into view. Server HTML carries the
 * final value, so it reads correctly before hydration, without JS, and
 * instantly under prefers-reduced-motion.
 */
export function CountUp({ value, prefix = '', suffix = '', className = '', durationMs = 1400 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || value <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 4);
        setShown(Math.round(value * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      setShown(0);
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${format.format(value)}${suffix}`}>
      {prefix}{format.format(shown)}{suffix}
    </span>
  );
}
