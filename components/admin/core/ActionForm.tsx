'use client';

import { LoaderCircle } from 'lucide-react';
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from 'react';
import { buttonClass } from '@/components/app/ui';
import type { ActionState } from './parse';

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

interface ActionFormProps {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
  /** Clear inputs after a successful submit (add forms). */
  resetOnSuccess?: boolean;
  /** Ask before submitting (destructive actions). */
  confirm?: string;
  onSuccess?: () => void;
  /** Where the error/notice line renders. `none` hides it (caller shows state elsewhere). */
  feedback?: 'below' | 'none';
  'aria-label'?: string;
}

/**
 * Form bound to a server action through useActionState. Submits via a transition
 * (not the form `action` prop) so React doesn't wipe the inputs when validation fails.
 */
export function ActionForm({ action, children, className = '', resetOnSuccess = false, confirm, onSuccess, feedback = 'below', ...rest }: ActionFormProps) {
  const [state, dispatch, isPending] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.error) return;
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.();
  }, [state, resetOnSuccess, onSuccess]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className} aria-busy={isPending} aria-label={rest['aria-label']}>
      <PendingContext.Provider value={isPending}>{children}</PendingContext.Provider>
      {feedback === 'below' && <ActionFeedback state={state} />}
    </form>
  );
}

export function ActionFeedback({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="col-span-full mt-2 basis-full text-sm font-semibold text-danger">{state.error}</p>;
  if (state.notice) return <p role="status" className="col-span-full mt-2 basis-full text-sm font-semibold text-clover">{state.notice}</p>;
  return null;
}

interface PendingButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
}

export function PendingButton({ children, variant = 'primary', size = 'md', className = '', disabled, ...rest }: PendingButtonProps) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending || disabled} className={`${buttonClass(variant, size)} ${className}`} {...rest}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
