'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { type ActionState, InputError, checkbox, dollarsToCents, guard, number, oneOf, requiredText, text } from '@/components/admin/core/parse';
import { requireRole } from '@/lib/auth';
import { checkContent } from '@/lib/marketing/content/compliance';
import { toJson } from '@/lib/marketing/content/db';
import { ENGAGE_CACHE_TAG } from '@/lib/marketing/engage/data';
import { isSitePath, parsePriceRanges, upsertRange, type PriceRange } from '@/lib/marketing/engage/rules';
import { SERVICES } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';

const PATH = '/admin/marketing/pages';
const TRIGGERS = ['time', 'scroll'] as const;
const UUID = /^[0-9a-f-]{36}$/i;

function refresh(): void {
  updateTag(ENGAGE_CACHE_TAG);
  revalidatePath(PATH);
}

function blocked(...fields: (string | null)[]): string | null {
  const report = checkContent(fields);
  return report.status === 'block' ? report.issues.map((issue) => issue.reason).join(' ') : null;
}

function requiredId(form: FormData, field: string): string {
  const value = (form.get(field) ?? '').toString();
  if (!UUID.test(value)) throw new InputError('Pick a row first.');
  return value;
}

/** The bar under the header. Empty text clears it. */
export async function saveAnnouncementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const body = text(form, 'text', { max: 140, label: 'Message' });
    const db = createAdminClient();
    if (!body) {
      const { error } = await db.from('site_engagement').upsert({ id: 1, announcement: null, updated_at: new Date().toISOString() });
      if (error) return { error: 'Couldn’t clear the bar.' };
      refresh();
      return { notice: 'Bar cleared.' };
    }
    const href = text(form, 'href', { max: 200, label: 'Link' });
    if (href && !isSitePath(href)) return { error: 'The link must be a path on this site, like /offers.' };
    const problem = blocked(body, text(form, 'link_label', { max: 40, label: 'Link label' }));
    if (problem) return { error: problem };
    const { error } = await db.from('site_engagement').upsert({
      id: 1,
      announcement: toJson({
        text: body,
        href: href ?? null,
        linkLabel: text(form, 'link_label', { max: 40, label: 'Link label' }),
        startsAt: text(form, 'starts_at', { max: 30, label: 'Start' }) || null,
        endsAt: text(form, 'ends_at', { max: 30, label: 'End' }) || null,
        countdown: checkbox(form, 'countdown'),
      }),
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: 'Couldn’t save the bar.' };
    refresh();
    return { notice: 'Bar saved.' };
  });
}

/** Social-proof toast and the financing partner link. */
export async function saveSiteOptionsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const financing = text(form, 'financing_url', { max: 300, label: 'Financing link' });
    if (financing && !financing.startsWith('https://')) return { error: 'The financing link must start with https://.' };
    const { error } = await createAdminClient().from('site_engagement').upsert({
      id: 1,
      social_proof: checkbox(form, 'social_proof'),
      financing_url: financing,
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: 'Couldn’t save that.' };
    refresh();
    return { notice: 'Saved.' };
  });
}

/** A "starting at" range for one service (and optionally one platform). */
export async function savePriceRangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const service = oneOf(form, 'service', SERVICES.map((s) => s.id), 'service');
    const platform = requiredText(form, 'platform', 'Truck', 20);
    const low = dollarsToCents(form, 'low', { required: true, label: 'Low', max: 100_000 }) as number;
    const high = dollarsToCents(form, 'high', { required: true, label: 'High', max: 100_000 }) as number;
    if (high < low) return { error: 'The high end must be at least the low end.' };
    const db = createAdminClient();
    const { data } = await db.from('site_engagement').select('price_ranges').eq('id', 1).maybeSingle();
    const next: PriceRange[] = upsertRange(parsePriceRanges(data?.price_ranges), { service, platform, lowCents: low, highCents: high });
    const { error } = await db.from('site_engagement').upsert({ id: 1, price_ranges: toJson(next), updated_at: new Date().toISOString() });
    if (error) return { error: 'Couldn’t save the range.' };
    refresh();
    return { notice: 'Range saved. The quote form shows it right away.' };
  });
}

/** Removes one service × truck range. */
export async function deletePriceRangeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const service = requiredText(form, 'service', 'Service', 40);
    const platform = requiredText(form, 'platform', 'Truck', 20);
    const db = createAdminClient();
    const { data } = await db.from('site_engagement').select('price_ranges').eq('id', 1).maybeSingle();
    const next = parsePriceRanges(data?.price_ranges).filter((r) => !(r.service === service && r.platform === platform));
    const { error } = await db.from('site_engagement').upsert({ id: 1, price_ranges: toJson(next), updated_at: new Date().toISOString() });
    if (error) return { error: 'Couldn’t remove it.' };
    refresh();
    return { notice: 'Removed.' };
  });
}

/** A page-specific popup, fired by time on page or scroll depth. */
export async function savePopupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const headline = requiredText(form, 'headline', 'Headline', 90);
    const body = text(form, 'body', { max: 240, label: 'Body' });
    const ctaHref = requiredText(form, 'cta_href', 'Button link', 200);
    if (!isSitePath(ctaHref)) return { error: 'The button link must be a path on this site.' };
    const problem = blocked(headline, body, text(form, 'cta_label', { max: 30, label: 'Button' }));
    if (problem) return { error: problem };
    const { error } = await createAdminClient().from('site_popups').insert({
      name: requiredText(form, 'name', 'Name', 80),
      path_prefix: requiredText(form, 'path_prefix', 'Pages', 100),
      trigger: oneOf(form, 'trigger', TRIGGERS, 'trigger'),
      trigger_value: number(form, 'trigger_value', { min: 1, max: 600, integer: true, required: true, label: 'Trigger value' }) as number,
      headline,
      body,
      cta_label: text(form, 'cta_label', { max: 30, label: 'Button' }) ?? 'See details',
      cta_href: ctaHref,
      active: checkbox(form, 'active'),
    });
    if (error) return { error: 'Couldn’t save the popup.' };
    refresh();
    return { notice: 'Popup saved.' };
  });
}

/** Switches a popup on or off. */
export async function togglePopupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredId(form, 'id');
    const { error } = await createAdminClient().from('site_popups').update({ active: checkbox(form, 'active') }).eq('id', id);
    if (error) return { error: 'Couldn’t save that.' };
    refresh();
    return { notice: 'Saved.' };
  });
}

/** Two to four wordings for one slot. Visitors are bucketed on their anonymous id. */
export async function saveAbTestAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const slot = requiredText(form, 'slot', 'Slot', 40);
    const lines = requiredText(form, 'variants', 'Wordings', 400).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4);
    if (lines.length < 2) return { error: 'Give at least two wordings, one per line.' };
    const problem = blocked(...lines);
    if (problem) return { error: problem };
    const variants = lines.map((textLine, index) => ({ key: String.fromCharCode(97 + index), text: textLine.slice(0, 80) }));
    const { error } = await createAdminClient().from('ab_tests').insert({
      name: requiredText(form, 'name', 'Name', 80),
      slot,
      variants: toJson(variants),
      active: checkbox(form, 'active'),
    });
    if (error) return { error: 'Couldn’t save the test.' };
    refresh();
    return { notice: 'Test saved.' };
  });
}

/** Ends a test (the winner becomes whatever you hard-code as the default wording). */
export async function endAbTestAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  return guard(async () => {
    const id = requiredId(form, 'id');
    const { error } = await createAdminClient().from('ab_tests').update({ active: false, ended_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: 'Couldn’t end it.' };
    refresh();
    return { notice: 'Test ended.' };
  });
}
