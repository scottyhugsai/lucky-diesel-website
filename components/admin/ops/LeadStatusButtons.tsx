'use client';

import { useActionState } from 'react';
import { updateLeadStatus } from '@/app/admin/leads/actions';
import { SubmitButton } from '@/components/app/SubmitButton';
import type { Enums } from '@/lib/db/database.types';
import type { ActionState } from './form';
import { FormMessage } from './FormMessage';

const OPTIONS: { status: Enums<'lead_status'>; label: string }[] = [
  { status: 'new', label: 'New' },
  { status: 'contacted', label: 'Contacted' },
  { status: 'booked', label: 'Booked' },
  { status: 'won', label: 'Won' },
  { status: 'lost', label: 'Lost' },
];

export function LeadStatusButtons({ leadId, status }: { leadId: string; status: Enums<'lead_status'> }) {
  const [state, action] = useActionState<ActionState, FormData>(updateLeadStatus, {});
  return (
    <form action={action}>
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Set lead status">
        {OPTIONS.map((option) => (
          <SubmitButton
            key={option.status}
            name="status"
            value={option.status}
            size="sm"
            variant={option.status === status ? 'primary' : option.status === 'lost' ? 'danger' : 'secondary'}
            className={option.status === status ? 'pointer-events-none' : ''}
          >
            {option.label}
          </SubmitButton>
        ))}
      </div>
      <FormMessage state={state} className="mt-2" />
    </form>
  );
}
