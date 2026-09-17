import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, createThrottle } from '@/lib/marketing/core/requests';
import { createAdminClient } from '@/lib/supabase/admin';

const throttled = createThrottle(10 * 60_000, 4);
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png']);
const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;

function field(form: FormData, name: string, max: number): string {
  return (form.get(name) ?? '').toString().trim().slice(0, max);
}

/**
 * "Send us your truck" from the gallery page. The photo goes to a private
 * bucket and the row stays `pending` — nothing reaches the site until the owner
 * approves it, which is also when the release is recorded.
 */
export async function POST(request: NextRequest) {
  if (throttled(clientIp(request) ?? 'unknown')) {
    return NextResponse.json({ ok: false, message: 'Give it a few minutes and try again.' }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, message: 'That didn’t go through.' }, { status: 400 });

  const name = field(form, 'name', 80);
  const email = field(form, 'email', 200);
  const photo = form.get('photo');
  const rights = form.get('rights') !== null;
  if (name.length < 2) return NextResponse.json({ ok: false, message: 'Add your name.' }, { status: 422 });
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, message: 'Check the email address.' }, { status: 422 });
  if (!rights) return NextResponse.json({ ok: false, message: 'Confirm the photo is yours to share.' }, { status: 422 });
  if (!(photo instanceof File) || photo.size === 0) return NextResponse.json({ ok: false, message: 'Pick a photo.' }, { status: 422 });
  if (photo.size > MAX_BYTES) return NextResponse.json({ ok: false, message: 'Photos must be under 8 MB.' }, { status: 422 });
  if (!TYPES.has(photo.type)) return NextResponse.json({ ok: false, message: 'JPEG or PNG only.' }, { status: 422 });

  const db = createAdminClient();
  const path = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${photo.type === 'image/png' ? 'png' : 'jpg'}`;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const { error: uploadError } = await db.storage.from('ugc').upload(path, bytes, { contentType: photo.type, upsert: false });
  if (uploadError) {
    console.error(`[marketing] ugc upload failed: ${uploadError.message}`);
    return NextResponse.json({ ok: false, message: 'Upload failed. Try again.' }, { status: 500 });
  }

  const { error } = await db.from('ugc_submissions').insert({
    name,
    email,
    handle: field(form, 'handle', 60) || null,
    truck: field(form, 'truck', 80) || null,
    caption: field(form, 'caption', 500) || null,
    storage_path: path,
    mime: photo.type,
    bytes: photo.size,
    credit_ok: form.get('credit') !== null,
    rights_confirmed: true,
  });
  if (error) {
    await db.storage.from('ugc').remove([path]);
    console.error(`[marketing] ugc insert failed: ${error.message}`);
    return NextResponse.json({ ok: false, message: 'Couldn’t save that. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: 'Got it. We’ll take a look before anything goes up.' });
}
