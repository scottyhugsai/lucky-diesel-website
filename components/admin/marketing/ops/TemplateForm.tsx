import { saveTemplateAction } from '@/app/admin/marketing/content/templates/actions';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { fieldClass, labelClass } from '@/components/app/ui';
import { TEMPLATE_CHANNELS, TEMPLATE_CHANNEL_LABEL } from '@/lib/marketing/content/templates';

interface TemplateValues {
  template_key: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  tags: string[];
}

/** New template, or a new version of `initial`. */
export function TemplateForm({ initial, idPrefix }: { initial?: TemplateValues; idPrefix: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <ActionForm action={saveTemplateAction} resetOnSuccess={!initial} className="grid gap-3">
      {initial && <input type="hidden" name="template_key" value={initial.template_key} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={id('name')}><span className={labelClass}>Name</span>
          <input id={id('name')} name="name" required maxLength={80} defaultValue={initial?.name} className={fieldClass} />
        </label>
        <label htmlFor={id('channel')}><span className={labelClass}>Channel</span>
          {initial ? (
            <>
              <input type="hidden" name="channel" value={initial.channel} />
              <input id={id('channel')} disabled value={TEMPLATE_CHANNEL_LABEL[initial.channel as keyof typeof TEMPLATE_CHANNEL_LABEL] ?? initial.channel} className={fieldClass} />
            </>
          ) : (
            <select id={id('channel')} name="channel" className={fieldClass} defaultValue="sms">
              {TEMPLATE_CHANNELS.map((c) => <option key={c} value={c}>{TEMPLATE_CHANNEL_LABEL[c]}</option>)}
            </select>
          )}
        </label>
      </div>
      <label htmlFor={id('subject')}><span className={labelClass}>Subject <span className="font-normal text-steel">(email)</span></span>
        <input id={id('subject')} name="subject" maxLength={200} defaultValue={initial?.subject ?? ''} className={fieldClass} />
      </label>
      <label htmlFor={id('body')}><span className={labelClass}>Message</span>
        <textarea id={id('body')} name="body" required rows={5} maxLength={5000} defaultValue={initial?.body} className={`${fieldClass} h-auto py-2`} />
      </label>
      <label htmlFor={id('tags')}><span className={labelClass}>Tags</span>
        <input id={id('tags')} name="tags" defaultValue={initial?.tags.join(', ')} placeholder="reviews, towing" className={fieldClass} />
      </label>
      <p className="text-xs text-steel">Use {'{{first_name}}'} style tokens. Checked for compliance on save.</p>
      <PendingButton size="sm" className="justify-self-start">{initial ? 'Save new version' : 'Save template'}</PendingButton>
    </ActionForm>
  );
}
