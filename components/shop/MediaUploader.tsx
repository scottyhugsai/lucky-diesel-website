'use client';

import { Camera, LoaderCircle } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { MAX_UPLOAD_BYTES, MEDIA_EXTENSIONS } from '@/app/shop/_lib/inspection';
import { attachMedia } from '@/app/shop/jobs/[id]/_inspection/actions';
import { createClient } from '@/lib/supabase/browser';

type Phase = { kind: 'idle' } | { kind: 'uploading'; name: string; percent: number } | { kind: 'saving' } | { kind: 'done'; message: string } | { kind: 'error'; message: string };

function mimeOf(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return '';
}

/**
 * Streams the file straight to Supabase Storage (server actions cap bodies at 1 MB)
 * as the signed-in user, reporting real progress, then records the media row.
 */
function uploadWithProgress(path: string, file: File, contentType: string, token: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/media/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network dropped during upload'));
    xhr.send(file);
  });
}

export function MediaUploader({ workOrderId, itemId }: { workOrderId: string; itemId: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const busy = phase.kind === 'uploading' || phase.kind === 'saving';

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setPhase({ kind: 'error', message: 'Your session expired. Log in again to upload.' });
      return;
    }

    let attached = 0;
    for (const file of Array.from(files)) {
      const type = mimeOf(file);
      const meta = MEDIA_EXTENSIONS[type];
      if (!meta) {
        setPhase({ kind: 'error', message: `${file.name}: only JPG, PNG, WEBP, HEIC, MP4 or MOV.` });
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setPhase({ kind: 'error', message: `${file.name} is over 100 MB. Trim the video and try again.` });
        continue;
      }
      const path = `work-orders/${workOrderId}/${crypto.randomUUID()}.${meta.ext}`;
      try {
        setPhase({ kind: 'uploading', name: file.name, percent: 0 });
        await uploadWithProgress(path, file, type, token, (percent) => setPhase({ kind: 'uploading', name: file.name, percent }));
        setPhase({ kind: 'saving' });
        const result = await attachMedia({ workOrderId, itemId, path, kind: meta.kind });
        if (result.error) {
          setPhase({ kind: 'error', message: result.error });
          continue;
        }
        attached += 1;
      } catch (error) {
        setPhase({ kind: 'error', message: error instanceof Error ? `${error.message}. Try again.` : 'Upload failed. Try again.' });
      }
    }
    if (attached) setPhase({ kind: 'done', message: `${attached} file${attached === 1 ? '' : 's'} attached.` });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="peer sr-only"
        disabled={busy}
        onChange={(event) => void handleFiles(event.currentTarget.files)}
      />
      <label
        htmlFor={inputId}
        className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-sm border-2 border-dashed border-chalk/25 font-semibold text-chalk transition-colors hover:border-clover hover:text-clover peer-focus-visible:border-clover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-clover ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
        {busy ? 'Uploading…' : 'Add photo or video'}
      </label>

      <div aria-live="polite" className="text-sm">
        {phase.kind === 'uploading' && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <div className="flex justify-between gap-2 text-chalk/70">
              <span className="truncate">{phase.name}</span>
              <span className="font-mono tabular-nums">{phase.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gunmetal" role="progressbar" aria-valuenow={phase.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="h-full origin-left bg-clover transition-transform duration-150" style={{ transform: `scaleX(${phase.percent / 100})` }} />
            </div>
          </div>
        )}
        {phase.kind === 'saving' && <p className="text-chalk/70">Attaching to item…</p>}
        {phase.kind === 'done' && <p className="font-semibold text-clover">{phase.message}</p>}
        {phase.kind === 'error' && <p className="font-semibold text-danger">{phase.message}</p>}
      </div>
    </div>
  );
}
