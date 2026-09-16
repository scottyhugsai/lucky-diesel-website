'use client';

import { LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { buttonClass } from './ui';

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  name?: string;
  value?: string;
}

/** Submit button that disables itself and shows a spinner while its form's action runs. */
export function SubmitButton({ children, pendingLabel, variant = 'primary', size = 'md', className = '', name, value }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${buttonClass(variant, size)} ${className}`}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
