'use client';

import { useActionState } from 'react';
import { setStaffActive } from '@/app/admin/team/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';

export function StaffActiveToggle({ profileId, active, name, isSelf }: { profileId: string; active: boolean; name: string; isSelf: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(setStaffActive, {});
  if (isSelf) return <span className="text-xs text-steel">You</span>;
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <SubmitButton size="sm" variant={active ? 'danger' : 'secondary'} pendingLabel="Saving…">
        <span className="sr-only">{name}: </span>{active ? 'Deactivate' : 'Reactivate'}
      </SubmitButton>
      <FormMessage state={state} className="max-w-[14rem] text-xs" />
    </form>
  );
}
