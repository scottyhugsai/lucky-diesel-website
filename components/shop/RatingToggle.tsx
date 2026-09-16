'use client';

import { Check } from 'lucide-react';
import { RATINGS, RATING_META, type Rating } from '@/app/shop/_lib/inspection';

const STYLES: Record<Rating, { on: string; off: string; dot: string }> = {
  green: { on: 'border-clover bg-clover text-carbon', off: 'hover:border-clover/60 hover:text-clover', dot: 'bg-clover' },
  yellow: { on: 'border-amber-300 bg-amber-300 text-carbon', off: 'hover:border-amber-300/60 hover:text-amber-300', dot: 'bg-amber-300' },
  red: { on: 'border-danger bg-danger text-carbon', off: 'hover:border-danger/60 hover:text-danger', dot: 'bg-danger' },
};

interface RatingToggleProps {
  value: Rating | 'na' | null;
  onChange: (rating: Rating) => void;
  label: string;
  disabled?: boolean;
  size?: 'lg' | 'md';
}

/** Three-way green / yellow / red switch sized for gloved thumbs. */
export function RatingToggle({ value, onChange, label, disabled = false, size = 'lg' }: RatingToggleProps) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-1.5">
      {RATINGS.map((rating) => {
        const pressed = value === rating;
        const style = STYLES[rating];
        return (
          <button
            key={rating}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(rating)}
            className={`flex items-center justify-center gap-2 rounded-sm border-2 font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              size === 'lg' ? 'h-14 text-base' : 'h-12 text-sm'
            } ${pressed ? style.on : `border-line bg-carbon text-chalk/80 ${disabled ? '' : style.off}`}`}
          >
            {pressed ? <Check className="size-5" aria-hidden="true" /> : <span className={`size-3 rounded-full ${style.dot}`} aria-hidden="true" />}
            {RATING_META[rating].short}
            <span className="sr-only"> — {RATING_META[rating].label}</span>
          </button>
        );
      })}
    </div>
  );
}
