'use client';

import { CheckCircle2, ImagePlus, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { addGalleryUploads, type UploadedPhoto } from '@/app/admin/gallery/actions';
import { fieldClass, labelClass } from '@/components/app/ui';
import { createClient } from '@/lib/supabase/browser';
import { GALLERY_BUCKET, GALLERY_CATEGORIES, LIMITS } from '../constants';
import { readDimensions, rejectReason, storagePathFor, titleFromName, uploadWithProgress } from './upload';

type FileStatus = { kind: 'queued' } | { kind: 'uploading'; percent: number } | { kind: 'done' } | { kind: 'error'; message: string };
interface Row { key: string; name: string; status: FileStatus }

export function Uploader() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [category, setCategory] = useState<string>('builds');
  const [publish, setPublish] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const setStatus = (key: string, status: FileStatus) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, status } : r)));

  async function handleFiles(list: FileList | null) {
    if (!list?.length || busy) return;
    const files = Array.from(list).slice(0, LIMITS.batch);
    const queued = files.map((file, i) => ({ file, key: `${Date.now()}-${i}`, reason: rejectReason(file) }));
    setRows(queued.map(({ file, key, reason }) => ({ key, name: file.name, status: reason ? { kind: 'error', message: reason } : { kind: 'queued' } })));
    setSummary(list.length > LIMITS.batch ? { tone: 'bad', text: `Only the first ${LIMITS.batch} files were taken.` } : null);
    const accepted = queued.filter((q) => !q.reason);
    if (!accepted.length) return;

    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      setSummary({ tone: 'bad', text: 'Your session expired. Sign in again to upload.' });
      return;
    }

    const uploaded: UploadedPhoto[] = [];
    for (const { file, key } of accepted) {
      try {
        setStatus(key, { kind: 'uploading', percent: 0 });
        const dims = await readDimensions(file);
        const path = storagePathFor(file);
        await uploadWithProgress(path, file, token, (percent) => setStatus(key, { kind: 'uploading', percent }));
        uploaded.push({ path, title: titleFromName(file.name), ...dims });
        setStatus(key, { kind: 'done' });
      } catch (caught) {
        setStatus(key, { kind: 'error', message: caught instanceof Error ? caught.message : 'Upload failed.' });
      }
    }

    if (uploaded.length) {
      const result = await addGalleryUploads(uploaded, category, publish).catch(() => ({ error: 'Could not save the photos.', notice: undefined }));
      if (result.error) {
        await supabase.storage.from(GALLERY_BUCKET).remove(uploaded.map((u) => u.path));
        setSummary({ tone: 'bad', text: result.error });
      } else {
        setSummary({ tone: 'good', text: result.notice ?? 'Photos added.' });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
    setBusy(false);
  }

  return (
    <section aria-labelledby={`${inputId}-h`} className="rounded-md border border-line bg-carbon-2 p-4 sm:p-5">
      <h2 id={`${inputId}-h`} className="display text-xl not-italic">Add photos</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={`${inputId}-cat`} className={labelClass}>Category for this batch</label>
          <select id={`${inputId}-cat`} className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
            {GALLERY_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <label className="flex h-11 items-center gap-2 self-end text-sm font-semibold text-chalk/85">
          <input type="checkbox" className="size-5" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={busy} />
          Publish right away
        </label>
      </div>

      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
        className={`mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-clover ${dragging ? 'border-clover bg-clover/10' : 'border-line hover:border-chalk/30'} ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {busy ? <LoaderCircle className="size-7 animate-spin text-clover" aria-hidden="true" /> : <ImagePlus className="size-7 text-clover" aria-hidden="true" />}
        <span className="font-semibold">{busy ? 'Uploading…' : 'Drop photos here or tap to choose'}</span>
        <span className="text-sm text-chalk/55">JPG, PNG or WebP · up to 20 MB each</span>
        <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => void handleFiles(e.target.files)} disabled={busy} />
      </label>

      {rows.length > 0 && (
        <ul className="mt-4 grid gap-2" aria-live="polite">
          {rows.map((row) => <FileRow key={row.key} row={row} />)}
        </ul>
      )}
      {summary && (
        <p role={summary.tone === 'bad' ? 'alert' : 'status'} className={`mt-3 text-sm font-semibold ${summary.tone === 'bad' ? 'text-danger' : 'text-clover'}`}>
          {summary.text}
        </p>
      )}
    </section>
  );
}

function FileRow({ row }: { row: Row }) {
  const { status } = row;
  const percent = status.kind === 'uploading' ? status.percent : status.kind === 'done' ? 100 : 0;
  return (
    <li className="grid gap-1.5 rounded-sm border border-line bg-carbon px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate">{row.name}</span>
        {status.kind === 'done' && <CheckCircle2 className="size-4 shrink-0 text-clover" aria-label="Uploaded" />}
        {status.kind === 'error' && <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />}
        {status.kind === 'uploading' && <span className="shrink-0 tabular-nums text-chalk/60">{status.percent}%</span>}
      </div>
      {status.kind === 'error' ? (
        <p className="text-danger">{status.message}</p>
      ) : (
        <div className="h-1 overflow-hidden rounded-full bg-gunmetal" role="progressbar" aria-label={`${row.name} upload`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="h-full origin-left bg-clover transition-transform" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
      )}
    </li>
  );
}
