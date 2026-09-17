'use client';

import { Save, Wand2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { buttonClass, fieldClass, labelClass } from '@/components/app/ui';
import { SOCIAL_LIMITS } from '@/lib/marketing/content/brand';
import { checkContent } from '@/lib/marketing/content/compliance';
import type { SocialPlatform } from '@/lib/marketing/content/types';
import { ImagePicker, type PickerOption } from './ImagePicker';
import { SOCIAL_LABEL, SOCIAL_PLATFORMS } from './labels';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;
type Writer = (prompt: string) => Promise<{ text?: string; error?: string; status?: string; generator?: string }>;

export interface PostDraft {
  id: string | null;
  title: string;
  caption: string;
  hashtags: string;
  networks: SocialPlatform[];
  scheduledFor: string;
  image: string;
}

export interface Suggestion {
  label: string;
  value: string;
}

/** Create or edit a social post: caption with live compliance, networks, image and time. */
export function PostEditor({ draft, images, suggestions, save, write }: { draft: PostDraft; images: readonly PickerOption[]; suggestions: readonly Suggestion[]; save: Action; write: Writer }) {
  const [caption, setCaption] = useState(draft.caption);
  const [title, setTitle] = useState(draft.title);
  const [networks, setNetworks] = useState<SocialPlatform[]>(draft.networks);
  const [when, setWhen] = useState(draft.scheduledFor);
  const [prompt, setPrompt] = useState('');
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [writing, startWriting] = useTransition();
  const report = useMemo(() => checkContent([title, caption]), [title, caption]);
  const over = networks.filter((n) => caption.length > SOCIAL_LIMITS[n].caption);

  function toggle(platform: SocialPlatform) {
    setNetworks((current) => (current.includes(platform) ? current.filter((p) => p !== platform) : [...current, platform]));
  }

  function runWriter() {
    startWriting(async () => {
      const result = await write(prompt);
      if (result.error || !result.text) return setAiNote(result.error ?? 'No caption came back.');
      setCaption(result.text);
      setAiNote(`${result.generator === 'ai' ? 'AI' : 'Demo'} caption added. Check it before saving.`);
    });
  }

  return (
    <ActionForm action={save} className="grid gap-5" aria-label="Post editor">
      {draft.id && <input type="hidden" name="postId" value={draft.id} />}
      <div>
        <label className={labelClass} htmlFor="p-title">Title (internal)</label>
        <input id="p-title" name="title" className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
      </div>

      <div className="rounded-sm border border-line bg-carbon p-3">
        <label className={labelClass} htmlFor="p-prompt">Write it for me</label>
        <div className="flex flex-wrap gap-2">
          <input id="p-prompt" className={`${fieldClass} min-w-0 flex-1 basis-56`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Fuel filter reminder before tow season" maxLength={300} />
          <button type="button" className={buttonClass('secondary')} onClick={runWriter} disabled={writing || prompt.trim().length < 3}>
            <Wand2 className="size-4" aria-hidden="true" />{writing ? 'Writing…' : 'Write caption'}
          </button>
        </div>
        {aiNote && <p role="status" className="mt-2 text-sm text-chalk/70">{aiNote}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="p-caption">Caption <span className="font-normal text-steel">({caption.length})</span></label>
        <textarea id="p-caption" name="caption" rows={7} className={`${fieldClass} h-auto py-2`} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} required />
        <p role="status" className={`mt-1.5 text-sm font-semibold ${report.status === 'block' ? 'text-danger' : report.status === 'warn' ? 'text-amber-300' : 'text-clover'}`}>
          {report.status === 'pass' ? 'Wording looks clear.' : report.issues.map((i) => `${i.term}: ${i.reason}`).join(' ')}
        </p>
        {over.length > 0 && <p className="text-sm text-amber-300">Too long for {over.map((n) => SOCIAL_LABEL[n]).join(', ')}.</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="p-tags">Hashtags</label>
        <input id="p-tags" name="hashtags" className={fieldClass} defaultValue={draft.hashtags} placeholder="#LuckyDiesel #Charleston" maxLength={600} />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-chalk/85">Post to</legend>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_PLATFORMS.map((p) => (
            <label key={p} className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm font-semibold ${networks.includes(p) ? 'border-clover bg-clover/10' : 'border-line'}`}>
              <input type="checkbox" name="network" value={p} checked={networks.includes(p)} onChange={() => toggle(p)} className="size-4" />
              {SOCIAL_LABEL[p]}
            </label>
          ))}
        </div>
        {networks.includes('tiktok') && <p className="mt-2 text-sm text-chalk/60">TikTok: posts stay private until the app is audited. We send a draft to your TikTok inbox.</p>}
      </fieldset>

      <ImagePicker options={images} initial={draft.image} />

      <div>
        <label className={labelClass} htmlFor="p-when">Post time (shop time)</label>
        <input id="p-when" name="scheduledFor" type="datetime-local" className={`${fieldClass} max-w-xs`} value={when} onChange={(e) => setWhen(e.target.value)} required />
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-steel">Suggested:</span>
            {suggestions.map((s) => (
              <button key={s.value} type="button" onClick={() => setWhen(s.value)} className={`rounded-sm border px-2 py-1 text-xs font-semibold ${when === s.value ? 'border-clover text-clover' : 'border-line text-chalk/75 hover:border-chalk/30'}`}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <PendingButton><Save className="size-4" aria-hidden="true" />{draft.id ? 'Save and send for approval' : 'Create and send for approval'}</PendingButton>
        <p className="text-sm text-chalk/55">Edits need a fresh approval.</p>
      </div>
    </ActionForm>
  );
}
