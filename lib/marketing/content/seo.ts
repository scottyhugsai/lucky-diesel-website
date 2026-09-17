import { BUSINESS, PLATFORMS } from '@/lib/site';
import { checkContent, type ComplianceReport } from './compliance';
import type { BuildRef, PlatformId } from './types';

/** SEO drafts from real job data, local listing audits and JSON-LD helpers. */

export interface SeoSection {
  heading: string;
  text: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export type SeoKind = 'build_page' | 'blog_post' | 'faq' | 'area_page';

export interface SeoDraft {
  kind: SeoKind;
  title: string;
  slug: string;
  summary: string;
  metaDescription: string;
  body: SeoSection[];
  faq: FaqItem[];
  /** Service-area slug (area pages only). */
  area?: string | null;
  platform?: PlatformId | null;
  compliance: ComplianceReport;
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'draft';
}

function platformName(id: string): string {
  return PLATFORMS.find((p) => p.id === (id as PlatformId))?.name ?? 'diesel';
}

/** Runs the claims check and trims the snippet. */
export function finish(draft: Omit<SeoDraft, 'compliance'>): SeoDraft {
  const compliance = checkContent([draft.title, draft.summary, draft.metaDescription, ...draft.body.flatMap((s) => [s.heading, s.text]), ...draft.faq.flatMap((f) => [f.q, f.a])]);
  return { ...draft, metaDescription: draft.metaDescription.slice(0, 160), compliance };
}

/** Build page draft: the work, the parts and the real dyno numbers, plus local FAQ. */
export function draftBuildPage(build: BuildRef, story: string | null): SeoDraft {
  const name = platformName(build.platform);
  const hp = build.beforeHp && build.afterHp ? `${build.beforeHp} → ${build.afterHp} hp` : null;
  const tq = build.beforeTorque && build.afterTorque ? `${build.beforeTorque} → ${build.afterTorque} lb-ft` : null;
  const numbers = [hp, tq].filter(Boolean).join(' and ');
  return finish({
    kind: 'build_page',
    platform: PLATFORMS.some((p) => p.id === build.platform) ? (build.platform as PlatformId) : null,
    title: `${build.title}: ${build.vehicleLabel} in ${BUSINESS.city}, ${BUSINESS.region}`,
    slug: slugify(`${build.title} ${build.vehicleLabel}`),
    summary: story ?? `${build.title} on a ${build.vehicleLabel}, done at our ${BUSINESS.city} diesel shop.`,
    metaDescription: `${build.title} (${build.vehicleLabel}) at ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.${numbers ? ` ${numbers} on our dyno.` : ''} Results vary.`,
    body: [
      { heading: 'The truck', text: `${build.vehicleLabel}, a ${name} platform truck.` },
      ...(build.parts.length ? [{ heading: 'The work', text: build.parts.join(', ') }] : []),
      ...(numbers ? [{ heading: 'The numbers', text: `${numbers} on our dyno. Results vary by truck, fuel and conditions.` }] : []),
      { heading: 'Want something similar?', text: `Tell us about your ${name} and what you use it for. We’ll recommend parts and quote the install before any work starts.` },
    ],
    faq: [
      { q: `Do you work on ${name} trucks in ${BUSINESS.city}?`, a: `Yes. We work on ${name} trucks across ${BUSINESS.areaServed.slice(0, 4).join(', ')} and nearby.` },
      { q: 'Are your performance upgrades street-legal?', a: 'We only sell and install work intended to keep your truck emissions-compliant. Ask which parts carry a CARB EO number or EPA-compliant status for your truck.' },
    ],
  });
}

/** Blog draft from a finished job: symptom → diagnosis → fix, with no customer details. */
export function draftJobBlogPost(job: { title: string; platform: string; vehicleLabel: string; lines: string[]; complaint: string | null }): SeoDraft {
  const name = platformName(job.platform);
  const title = `${job.title} on a ${name}: what we found and fixed`;
  return finish({
    kind: 'blog_post',
    platform: PLATFORMS.some((p) => p.id === job.platform) ? (job.platform as PlatformId) : null,
    title,
    slug: slugify(title),
    summary: `A recent ${job.title.toLowerCase()} on a ${job.vehicleLabel} at our ${BUSINESS.city} shop.`,
    metaDescription: `${job.title} on a ${name} in ${BUSINESS.city}, SC: symptoms, diagnosis and the repair.`,
    body: [
      { heading: 'The symptom', text: job.complaint ? job.complaint.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone removed]') : `The owner brought the ${name} in for ${job.title.toLowerCase()}.` },
      { heading: 'What we did', text: job.lines.slice(0, 8).join(', ') || job.title },
      { heading: 'Avoiding it on your truck', text: 'Follow your service intervals, scan codes early and don’t ignore warning lights.' },
    ],
    faq: [{ q: `How long does ${job.title.toLowerCase()} take?`, a: 'It depends on the truck and parts availability. We give a time estimate with the quote.' }],
  });
}

export function draftServiceFaq(): SeoDraft {
  return finish({
    kind: 'faq',
    title: 'Diesel service FAQ',
    slug: 'diesel-service-faq',
    summary: 'Straight answers to the questions we hear every week.',
    metaDescription: `Diesel repair and performance FAQ from ${BUSINESS.name} in ${BUSINESS.city}, SC.`,
    body: [],
    faq: [
      { q: 'Which trucks do you work on?', a: 'Duramax, Powerstroke and Cummins pickups.' },
      { q: 'Can I bring my own parts?', a: 'Yes. We install parts you bought and quote the labor up front.' },
      { q: 'Do you remove or disable emissions equipment?', a: 'No. We only do work that keeps your truck street-legal.' },
      { q: 'How do I get a quote?', a: `Send a request online or call ${BUSINESS.phoneDisplay}.` },
    ],
  });
}

/** Blog outline from a topic. The [Add …] notes must be replaced before the guard lets it publish. */
export function draftTopicBlogPost(topic: string, platform: PlatformId | null): SeoDraft {
  const name = platform ? platformName(platform) : 'diesel';
  const title = topic.trim().slice(0, 110);
  return finish({
    kind: 'blog_post',
    platform,
    title,
    slug: slugify(title),
    summary: `${title}: what ${name} owners in ${BUSINESS.city} should know.`,
    metaDescription: `${title}. Straight answers for ${name} owners from ${BUSINESS.name} in ${BUSINESS.city}, ${BUSINESS.region}.`,
    body: [
      { heading: 'The short answer', text: '[Add the answer you give customers at the counter.]' },
      { heading: 'What we see in the shop', text: '[Add a real example from a recent truck, without customer details.]' },
      { heading: 'What it costs to fix', text: 'Every truck is different. We quote parts and labor before any work starts.' },
      { heading: 'When to bring it in', text: `If you are unsure, call ${BUSINESS.phoneDisplay} or request a quote online.` },
    ],
    faq: [],
  });
}

/** Service-area page draft. Only facts we know; local detail must come from the owner. */
export function draftAreaPage(area: { slug: string; name: string }): SeoDraft {
  const title = `Diesel repair and performance for ${area.name} trucks`;
  return finish({
    kind: 'area_page',
    area: area.slug,
    platform: null,
    title,
    slug: `area-${area.slug}`,
    summary: `${BUSINESS.name} works on Duramax, Powerstroke and Cummins trucks from ${area.name}.`,
    metaDescription: `Diesel repair, tuning and parts for ${area.name}, ${BUSINESS.region} truck owners. ${BUSINESS.name}, ${BUSINESS.city}. Call ${BUSINESS.phoneDisplay}.`,
    body: [
      { heading: `Trucks we see from ${area.name}`, text: `[Add the kinds of trucks and jobs you get from ${area.name}.]` },
      { heading: 'Getting your truck to us', text: `[Add drop-off or pickup details for ${area.name}.]` },
      { heading: 'What we work on', text: 'Duramax, Powerstroke and Cummins: diagnostics, repair, parts install and emissions-compliant performance work.' },
    ],
    faq: [],
  });
}

// ── Plain-text format shared by the editor and the AI writer ──

/** "## Heading" blocks → sections. */
export function parseSections(raw: string): SeoSection[] {
  return raw.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean).map((block) => {
    const [heading, ...rest] = block.split('\n');
    return { heading: heading!.trim().replace(/^#+\s*/, '').slice(0, 120), text: rest.join('\n').trim() };
  }).filter((s) => s.heading && s.text);
}

/** "Q: …" / "A: …" pairs → FAQ. */
export function parseFaq(raw: string): FaqItem[] {
  return raw.split(/^Q:\s*/m).map((b) => b.trim()).filter(Boolean).map((block) => {
    const [q, a = ''] = block.split(/^A:\s*/m);
    return { q: q!.trim().slice(0, 300), a: a.trim().slice(0, 1200) };
  }).filter((f) => f.q && f.a);
}

export function sectionsToText(body: readonly SeoSection[]): string {
  return body.map((s) => `## ${s.heading}\n${s.text}`).join('\n\n');
}

export function faqToText(faq: readonly FaqItem[]): string {
  return faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n');
}

/** All readable text of a draft, for word counts and duplicate checks. */
export function draftText(d: { title: string; summary: string; body: readonly SeoSection[]; faq: readonly FaqItem[] }): string {
  return [d.summary, ...d.body.flatMap((s) => [s.heading, s.text]), ...d.faq.flatMap((f) => [f.q, f.a])].join('\n');
}

// ── Local SEO ──

export interface Nap {
  name: string;
  phone: string;
  website: string;
  address: string | null;
}

export const CANONICAL_NAP: Nap = { name: BUSINESS.name, phone: BUSINESS.phoneDisplay, website: 'https://luckydiesel.com', address: null };

function digits(value: string): string {
  return value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
}

/** Compares a listing's name/address/phone to the canonical NAP. Missing address on both sides is not a mismatch. */
export function auditNap(listing: Partial<Nap>, canonical: Nap = CANONICAL_NAP): { consistent: boolean; mismatches: (keyof Nap)[] } {
  const mismatches: (keyof Nap)[] = [];
  if (!listing.name || listing.name.trim().toLowerCase() !== canonical.name.toLowerCase()) mismatches.push('name');
  if (!listing.phone || digits(listing.phone) !== digits(canonical.phone)) mismatches.push('phone');
  const host = (url: string | undefined) => url?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
  if (!listing.website || host(listing.website) !== host(canonical.website)) mismatches.push('website');
  if (canonical.address && (!listing.address || listing.address.replace(/\W/g, '').toLowerCase() !== canonical.address.replace(/\W/g, '').toLowerCase())) mismatches.push('address');
  return { consistent: mismatches.length === 0, mismatches };
}

export const LOCAL_SEO_CHECKLIST: readonly { key: string; label: string; done: (facts: { hasAddress: boolean; hasHours: boolean; gbpVerified: boolean; reviews: number; postsLast30: number }) => boolean }[] = [
  { key: 'gbp_verified', label: 'Google Business Profile verified', done: (f) => f.gbpVerified },
  { key: 'address', label: 'Street address published (site, GBP, schema)', done: (f) => f.hasAddress },
  { key: 'hours', label: 'Opening hours published everywhere', done: (f) => f.hasHours },
  { key: 'reviews', label: 'At least 10 real Google reviews', done: (f) => f.reviews >= 10 },
  { key: 'posts', label: 'A GBP or social post in the last 30 days', done: (f) => f.postsLast30 > 0 },
];

// ── JSON-LD ──

export function faqSchema(items: readonly FaqItem[]): Record<string, unknown> | null {
  if (!items.length) return null;
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) };
}

/**
 * Review schema only for real reviews shown on the page, attached to the
 * business (Google ignores self-serving LocalBusiness star markup, so this is
 * for accuracy, not stars). Returns null when there is nothing real to mark up.
 */
export function reviewSchema(reviews: readonly { author: string; rating: number; body: string; source: string; reviewedAt: string }[]): Record<string, unknown> | null {
  const real = reviews.filter((r) => ['google', 'facebook', 'manual'].includes(r.source));
  if (!real.length) return null;
  return {
    '@context': 'https://schema.org', '@type': 'AutoRepair', name: BUSINESS.name, telephone: BUSINESS.phoneDisplay,
    review: real.map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.author }, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 }, reviewBody: r.body, datePublished: r.reviewedAt.slice(0, 10) })),
  };
}

/** Safe for <script type="application/ld+json">: escapes `<` so content can't close the tag. */
export function jsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
