'use client';

import { useSyncExternalStore } from 'react';

/* One shared 1-second ticker for every running timer on the page. */
let now = 0;
const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!interval) {
    now = Date.now();
    interval = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface ElapsedTimerProps {
  startedAt: string;
  /** Server render time, so the first paint matches hydration. */
  serverNow: number;
  /** Already-closed time to add on top (e.g. earlier entries on the same job). */
  baseMs?: number;
  className?: string;
}

export function ElapsedTimer({ startedAt, serverNow, baseMs = 0, className = '' }: ElapsedTimerProps) {
  const current = useSyncExternalStore(subscribe, () => now || serverNow, () => serverNow);
  return (
    <time className={`tabular-nums ${className}`} dateTime={startedAt}>
      {formatClock(baseMs + current - new Date(startedAt).getTime())}
    </time>
  );
}
