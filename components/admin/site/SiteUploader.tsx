'use client';

import { ImagePlus, LoaderCircle } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { addSiteMedia, type UploadedSiteMedia } from '@/app/admin/site/media/actions';
import { GALLERY_BUCKET, GALLERY_MIME_EXT } from '@/components/gallery/constants';
import { readDimensions, rejectReason, titleFromName, uploadWithProgress } from '@/components/gallery/admin/upload';
import { createClient } from '@/lib/supabase/browser';

const MAX_BATCH = 20;

/** Site photos share the gallery's public bucket, under their own `site/` prefix. */
function sitePathFor(file: File): string {
  return `site/${crypto.randomUUID()}.${GALLERY_MIME_EXT[file.type]}`;
}

export function SiteUploader() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list?.length || busy) return;
    const files = Array.from(list).slice(0, MAX_BATCH);
    const rejected = files.filter((file) => rejectReason(file));
    const accepted = files.filter((file) => !rejectReason(file));
    if (!accepted.length) {
      setSummary({ tone: 'bad', text: rejectReason(files[0] as File) ?? 'Those files are not images.' });
      return;
    }

    setBusy(true);
    setSummary(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      setSummary({ tone: 'bad', text: 'Your session expired. Sign in again to upload.' });
      return;
    }

    const uploaded: UploadedSiteMedia[] = [];
    for (const [index, file] of accepted.entries()) {
      try {
        setProgress(`Uploading ${index + 1} of ${accepted.length}…`);
        const dimensions = await readDimensions(file);
        const path = sitePathFor(file);
        await uploadWithProgress(path, file, token, () => undefined);
        uploaded.push({ path, title: titleFromName(file.name), bytes: file.size, ...dimensions });
      } catch (caught) {
        setSummary({ tone: 'bad', text: caught instanceof Error ? caught.message : 'Upload failed.' });
      }
    }
    setProgress(null);

    if (uploaded.length) {
      const result = await addSiteMedia(uploaded).catch(() => ({ error: 'Could not save the photos.' }));
      if (result.error) {
        await supabase.storage.from(GALLERY_BUCKET).remove(uploaded.map((item) => item.path));
        setSummary({ tone: 'bad', text: result.error });
      } else {
        setSummary({ tone: 'good', text: `${uploaded.length} photo${uploaded.length === 1 ? '' : 's'} added.${rejected.length ? ` ${rejected.length} skipped.` : ''}` });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
    setBusy(false);
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line bg-carbon px-4 py-8 text-center transition-colors hover:border-clover"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void handleFiles(event.dataTransfer.files); }}
      >
        {busy ? <LoaderCircle className="size-6 animate-spin text-clover" aria-hidden="true" /> : <ImagePlus className="size-6 text-steel" aria-hidden="true" />}
        <span className="text-sm font-semibold">{busy ? (progress ?? 'Uploading…') : 'Drop photos here, or choose files'}</span>
        <span className="text-xs text-steel">JPG, PNG or WebP · up to 20 MB each</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>
      {summary && (
        <p role="status" className={`mt-3 text-sm font-semibold ${summary.tone === 'good' ? 'text-clover' : 'text-danger'}`}>{summary.text}</p>
      )}
    </div>
  );
}
