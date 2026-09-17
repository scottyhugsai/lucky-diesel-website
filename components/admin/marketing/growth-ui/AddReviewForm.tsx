'use client';

import { addReview } from '@/app/admin/marketing/reviews/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { fieldClass } from '@/components/app/ui';
import { Field, areaClass } from './kit';

export function AddReviewForm() {
  return (
    <ActionForm action={addReview} resetOnSuccess className="grid gap-3 sm:grid-cols-2" aria-label="Add a review">
      <Field label="Name" htmlFor="rv-author">
        <input id="rv-author" name="author" required maxLength={120} className={fieldClass} />
      </Field>
      <Field label="Stars" htmlFor="rv-rating">
        <select id="rv-rating" name="rating" defaultValue="5" className={fieldClass}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>
      <Field label="Where" htmlFor="rv-source">
        <select id="rv-source" name="source" defaultValue="manual" className={fieldClass}>
          <option value="manual">In person / other</option>
          <option value="facebook">Facebook</option>
          <option value="internal">Private note</option>
        </select>
      </Field>
      <Field label="Date" htmlFor="rv-date">
        <input id="rv-date" name="date" type="date" className={fieldClass} />
      </Field>
      <Field label="What they said" htmlFor="rv-body" className="sm:col-span-2">
        <textarea id="rv-body" name="body" rows={3} maxLength={4000} className={areaClass} />
      </Field>
      <div className="sm:col-span-2">
        <PendingButton size="sm">Add review</PendingButton>
      </div>
    </ActionForm>
  );
}
