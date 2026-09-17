'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { GalleryPhoto } from './constants';
import { Lightbox } from './Lightbox';

interface LightboxApi {
  open: (index: number, trigger: HTMLElement) => void;
}

const LightboxContext = createContext<LightboxApi | null>(null);

/**
 * Owns which photo is open. The grid stays a Server Component; only the tile
 * buttons and the dialog itself are client code.
 */
export function LightboxProvider({ photos, children }: { photos: GalleryPhoto[]; children: React.ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((next: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setIndex(next);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    // Return focus to the tile that opened the dialog.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {index !== null && photos.length > 0 && (
        <Lightbox photos={photos} index={Math.min(index, photos.length - 1)} onIndexChange={setIndex} onClose={close} />
      )}
    </LightboxContext.Provider>
  );
}

interface TileButtonProps {
  index: number;
  label: string;
  className?: string;
  children: React.ReactNode;
}

export function TileButton({ index, label, className = '', children }: TileButtonProps) {
  const api = useContext(LightboxContext);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      className={className}
      onClick={(event) => api?.open(index, event.currentTarget)}
    >
      {children}
    </button>
  );
}
