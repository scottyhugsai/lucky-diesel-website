'use client';

import { useActionState, useEffect, useRef } from 'react';
import { inviteEmployee } from '@/app/admin/team/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import { fieldClass, labelClass } from '@/components/app/ui';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';

export function InviteForm() {
  const [state, action] = useActionState<ActionState, FormData>(inviteEmployee, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.notice) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <div>
        <label htmlFor="invite-name" className={labelClass}>Full name</label>
        <input id="invite-name" name="full_name" required minLength={2} maxLength={80} autoComplete="off" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="invite-email" className={labelClass}>Email</label>
        <input id="invite-email" name="email" type="email" required autoComplete="off" className={fieldClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-phone" className={labelClass}>Mobile <span className="font-normal text-steel">(optional)</span></label>
          <input id="invite-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" className={fieldClass} />
        </div>
        <div>
          <label htmlFor="invite-title" className={labelClass}>Title</label>
          <input id="invite-title" name="title" maxLength={60} placeholder="Diesel Tech" className={fieldClass} />
        </div>
      </div>
      <SubmitButton pendingLabel="Sending invite…">Send invite</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
