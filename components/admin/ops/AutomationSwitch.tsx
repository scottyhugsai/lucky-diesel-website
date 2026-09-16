'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { toggleAutomation } from '@/app/admin/automations/actions';

/** On/off switch for one automation. Optimistic, rolls back with a message if the save fails. */
export function AutomationSwitch({ automationKey, name, enabled }: { automationKey: string; name: string; enabled: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  function toggle() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleAutomation(automationKey, next);
      setMessage(result.error ?? result.notice ?? '');
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold uppercase tracking-widest ${optimistic ? 'text-clover' : 'text-steel'}`} aria-hidden="true">
        {optimistic ? 'On' : 'Off'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={`${name}: ${optimistic ? 'on' : 'off'}`}
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-70 ${
          optimistic ? 'border-clover bg-clover/90 shadow-[0_0_18px_-4px_var(--clover-glow)]' : 'border-line bg-gunmetal'
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-chalk shadow transition-transform duration-200 ${optimistic ? 'translate-x-6' : 'translate-x-1'}`}
          aria-hidden="true"
        />
      </button>
      <span className="sr-only" aria-live="polite">{message}</span>
    </div>
  );
}
