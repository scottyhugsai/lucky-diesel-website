'use client';

import { LoaderCircle } from 'lucide-react';
import { startTransition, useActionState, type FormEvent } from 'react';
import type { ActionState } from '@/app/shop/_lib/form';
import { buttonClass } from '@/components/app/ui';

type ShopAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Like `<form action>`, but keeps typed values when validation fails (React resets
 * action forms either way). Remount fields with `key={state.savedAt}` to clear on success.
 */
export function useShopForm(action: ShopAction) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(action, {});
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  return { state, pending, onSubmit };
}

interface PendingButtonProps {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function PendingButton({ pending, pendingLabel, children, className = '', variant = 'primary' }: PendingButtonProps) {
  return (
    <button type="submit" disabled={pending} className={`${buttonClass(variant)} ${className}`}>
      {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
