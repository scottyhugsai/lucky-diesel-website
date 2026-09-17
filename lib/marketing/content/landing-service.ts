import 'server-only';
import { getViewer } from '@/lib/auth';
import type { Tables } from '@/lib/db/database.types';
import { createClient } from '@/lib/supabase/server';
import { sendContentMessage } from './alerts';
import { offerFromLanding } from './creative-service';
import { adminDb, type Db, type Result } from './db';
import { validateBlocks, type LandingBlock } from './landing-blocks';
import { getReviewWidget } from './reputation-service';
import type { OfferRef } from './types';

export interface LandingPageView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  blocks: LandingBlock[];
  offer: OfferRef | null;
  offerExpired: boolean;
  /** Unpublished preview for staff: must not be indexed. */
  isPreview: boolean;
  isSample: boolean;
  leadMagnet: { slug: string; title: string } | null;
}

export function isOfferActive(offer: OfferRef | null, now = new Date()): boolean {
  return Boolean(offer) && (!offer!.endsAt || new Date(offer!.endsAt).getTime() >= now.getTime());
}

function toView(page: Tables<'landing_pages'> & { lead_magnets?: { slug: string; title: string } | null }, isPreview: boolean): LandingPageView | null {
  const blocks = validateBlocks(page.blocks);
  if (!blocks.ok) {
    console.error(`[marketing/landing] ${page.slug} has invalid blocks: ${blocks.errors.join('; ')}`);
    return null;
  }
  const offer = offerFromLanding(page);
  return {
    id: page.id, slug: page.slug, title: page.title, description: page.seo_description, blocks: blocks.blocks, offer,
    offerExpired: Boolean(offer) && !isOfferActive(offer), isPreview, isSample: page.is_sample, leadMagnet: page.lead_magnets ?? null,
  };
}

/** A published page for anyone (RLS enforces `published`); staff may preview drafts with `preview`. */
export async function getLandingPage(slug: string, preview = false): Promise<LandingPageView | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('landing_pages').select('*, lead_magnets(slug, title)').eq('slug', slug).eq('published', true).maybeSingle();
  if (data) return toView(data, false);
  if (!preview) return null;
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role === 'client') return null;
  const { data: draft } = await adminDb().from('landing_pages').select('*, lead_magnets(slug, title)').eq('slug', slug).maybeSingle();
  return draft ? toView(draft, true) : null;
}

/** Offers that can be claimed right now. Honours part A's `offers` table when the code exists there. */
export async function listActiveOffers(now = new Date()): Promise<LandingPageView[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('landing_pages').select('*, lead_magnets(slug, title)').eq('published', true).not('offer', 'is', null).order('published_at', { ascending: false });
  const views = (data ?? []).map((p) => toView(p, false)).filter((v): v is LandingPageView => v !== null && isOfferActive(v.offer, now));
  const codes = views.map((v) => v.offer?.code).filter((c): c is string => Boolean(c));
  if (!codes.length) return views;
  const { data: offers, error } = await adminDb().from('offers').select('code, active, starts_at, ends_at').in('code', codes);
  if (error) return views; // Part A's table missing or unreadable: landing-page dates still apply.
  const inactive = new Set((offers ?? []).filter((o) => !o.active || (o.ends_at && new Date(o.ends_at) < now) || (o.starts_at && new Date(o.starts_at) > now)).map((o) => o.code));
  return views.filter((v) => !v.offer?.code || !inactive.has(v.offer.code));
}

export interface ProofItem {
  title: string;
  subtitle: string;
  href: string | null;
  metric: string | null;
  image: string | null;
}

/** Proof block data: published builds, or real reviews only. */
export async function getProof(source: 'builds' | 'reviews', limit: number): Promise<ProofItem[]> {
  if (source === 'reviews') {
    const widget = await getReviewWidget(limit);
    return widget.reviews.map((r) => ({ title: `“${r.body}”`, subtitle: `${r.author} · ${r.source === 'manual' ? 'customer' : r.source} review`, href: null, metric: `${r.rating}/5`, image: null }));
  }
  const supabase = await createClient();
  const { data } = await supabase.from('builds').select('slug, title, vehicle_label, before_hp, after_hp, hero_image').eq('published', true).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []).map((b) => ({ title: b.title, subtitle: b.vehicle_label, href: `/builds/${b.slug}`, metric: b.before_hp && b.after_hp ? `+${b.after_hp - b.before_hp} HP` : null, image: b.hero_image }));
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_WINDOW_MS = 24 * 3_600_000;

export interface LeadMagnetRequest {
  slug: string;
  name: string;
  email: string;
  landingSlug?: string | null;
}

/** Emails a published lead magnet via sendMessage. One copy per address per day. */
export async function deliverLeadMagnet(input: LeadMagnetRequest, db: Db = adminDb()): Promise<Result<{ delivered: boolean }>> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 80);
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, error: 'Enter a valid email.' };
  if (name.length < 2) return { ok: false, error: 'Enter your name.' };
  const { data: magnet } = await db.from('lead_magnets').select('*').eq('slug', input.slug).eq('published', true).maybeSingle();
  if (!magnet) return { ok: false, error: 'That download isn’t available.' };

  const { data: recent } = await db.from('messages').select('id').eq('to_address', email).eq('automation_key', 'content_lead_magnet_delivery').gte('created_at', new Date(Date.now() - RESEND_WINDOW_MS).toISOString()).limit(1);
  if (recent?.length) return { ok: true, data: { delivered: true } };

  const sections = Array.isArray(magnet.sections) ? (magnet.sections as { heading?: unknown; items?: unknown }[]) : [];
  const body = sections.map((s) => `${String(s.heading ?? '').toUpperCase()}\n${(Array.isArray(s.items) ? s.items : []).map((i) => `☐ ${String(i)}`).join('\n')}`).join('\n\n');
  const outcome = await sendContentMessage(db, 'content_lead_magnet_delivery', { email, phone: null, customerId: null, isCustomer: true }, {
    first_name: name.split(/\s+/)[0], magnet_title: magnet.title, magnet_body: body,
  });
  if (!outcome.sent) {
    console.error(`[marketing/lead-magnet] ${magnet.slug} to ${email} not sent: ${outcome.skipped.join(', ')}`);
    return { ok: false, error: 'We couldn’t send that right now. Call us and we’ll email it.' };
  }
  await db.from('lead_magnets').update({ downloads: magnet.downloads + 1 }).eq('id', magnet.id);
  return { ok: true, data: { delivered: true } };
}

