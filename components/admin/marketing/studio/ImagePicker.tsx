'use client';

import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export interface PickerOption {
  value: string;
  title: string;
  url: string | null;
  group: string;
}

/** Radio grid of images for a post: current, auto-designed templates, or owner photos. */
export function ImagePicker({ options, initial }: { options: readonly PickerOption[]; initial: string }) {
  const [choice, setChoice] = useState(initial);
  const groups = [...new Set(options.map((o) => o.group))];
  const isPhoto = /^(gallery|build|media):/.test(choice);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-chalk/85">Image</legend>
      {groups.map((group) => (
        <div key={group} className="mb-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-steel">{group}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {options.filter((o) => o.group === group).map((o) => (
              <label key={o.value} className={`group relative block cursor-pointer overflow-hidden rounded-sm border-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-clover/50 ${choice === o.value ? 'border-clover' : 'border-transparent hover:border-chalk/30'}`}>
                <input type="radio" name="image" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="sr-only" />
                {o.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- owner photos from storage (some signed, short-lived) and our dynamic image route; next/image can't optimize these.
                  <img src={o.url} alt="" loading="lazy" className="aspect-square w-full bg-gunmetal object-cover" />
                ) : (
                  <span className={`display grid aspect-square w-full place-items-center text-lg not-italic ${o.value === 'none' ? 'bg-gunmetal text-chalk/50' : 'bg-carbon-2 text-clover'}`}>{o.value === 'none' ? 'None' : 'Auto'}</span>
                )}
                <span className="block truncate bg-carbon px-1.5 py-1 text-xs">{o.title}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {isPhoto && (
        <p role="note" className="flex items-start gap-2 rounded-sm border border-amber-400/30 bg-amber-400/5 p-2 text-sm text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Owner photo: check plates, VINs and faces before approving.
        </p>
      )}
    </fieldset>
  );
}
