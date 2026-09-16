import { useId } from 'react';
import { fieldClass, labelClass } from '@/components/app/ui';

/* Shop-floor inputs: one size up from the office forms for thumbs and gloves. */

export const shopField = `${fieldClass} h-12 text-base`;
export const shopTextarea = `${fieldClass} h-auto min-h-24 py-3 text-base leading-relaxed`;

interface FieldProps {
  label: string;
  hint?: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}

/** Label + control + hint, wired by id. Children receive the id to put on the control. */
export function Field({ label, hint, className = '', children }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-steel">{hint}</p>}
    </div>
  );
}

interface CheckRowProps {
  name: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/** A full-width tappable checkbox row. */
export function CheckRow({ name, label, description, defaultChecked, checked, onChange }: CheckRowProps) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-line bg-carbon px-3 py-2 transition-colors has-checked:border-clover/60 has-focus-visible:border-clover">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange ? (event) => onChange(event.currentTarget.checked) : undefined}
        className="size-6 shrink-0 accent-[var(--clover)]"
      />
      <span className="min-w-0">
        <span className="block font-semibold text-chalk">{label}</span>
        {description && <span className="block text-xs text-steel">{description}</span>}
      </span>
    </label>
  );
}
