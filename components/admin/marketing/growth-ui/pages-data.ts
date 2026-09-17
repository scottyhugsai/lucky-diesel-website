import 'server-only';
import type { Tables } from '@/lib/db/database.types';
import { validateBlocks, type LandingBlock } from '@/lib/marketing/content/landing-blocks';
import { createAdminClient } from '@/lib/supabase/admin';

export interface LandingRow {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  isSample: boolean;
  views: number;
  leads: number;
  updatedAt: string;
  magnet: string | null;
  offerTag: string | null;
}

function offerTagOf(blocks: unknown): string | null {
  const parsed = validateBlocks(blocks);
  if (!parsed.ok) return null;
  const form = parsed.blocks.find((b) => b.type === 'form');
  return form && form.type === 'form' ? form.offerTag : null;
}

async function countLeads(tag: string | null): Promise<number> {
  if (!tag) return 0;
  const { count } = await createAdminClient().from('leads').select('id', { count: 'exact', head: true }).ilike('details', `%offer:${tag}%`);
  return count ?? 0;
}

async function countViews(slug: string): Promise<number> {
  const { count } = await createAdminClient().from('attribution_touches').select('id', { count: 'exact', head: true }).like('landing_path', `/l/${slug}%`);
  return count ?? 0;
}

export async function loadLandingPages(): Promise<LandingRow[]> {
  const { data, error } = await createAdminClient().from('landing_pages').select('*, lead_magnets(title)').order('updated_at', { ascending: false });
  if (error) throw new Error(`Could not load landing pages: ${error.message}`);
  return Promise.all((data ?? []).map(async (p) => {
    const tag = offerTagOf(p.blocks);
    const [views, leads] = await Promise.all([countViews(p.slug), countLeads(tag)]);
    return { id: p.id, slug: p.slug, title: p.title, published: p.published, isSample: p.is_sample, views, leads, updatedAt: p.updated_at, magnet: p.lead_magnets?.title ?? null, offerTag: tag };
  }));
}

export interface MagnetRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  published: boolean;
  isSample: boolean;
  downloads: number;
  sent30d: number;
  pages: number;
  items: number;
}

export async function loadMagnets(): Promise<MagnetRow[]> {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data, error }, { data: pages }, { count: sent }] = await Promise.all([
    db.from('lead_magnets').select('*').order('created_at', { ascending: false }),
    db.from('landing_pages').select('lead_magnet_id'),
    db.from('messages').select('id', { count: 'exact', head: true }).eq('automation_key', 'content_lead_magnet_delivery').gte('created_at', since),
  ]);
  if (error) throw new Error(`Could not load lead magnets: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id, slug: m.slug, title: m.title, description: m.description, published: m.published, isSample: m.is_sample, downloads: m.downloads,
    sent30d: sent ?? 0, pages: (pages ?? []).filter((p) => p.lead_magnet_id === m.id).length,
    items: Array.isArray(m.sections) ? (m.sections as { items?: unknown }[]).reduce((t, s) => t + (Array.isArray(s.items) ? s.items.length : 0), 0) : 0,
  }));
}

export interface LandingDetail {
  page: Tables<'landing_pages'>;
  blocks: LandingBlock[];
  invalid: string[];
  magnets: { id: string; title: string }[];
  row: LandingRow;
}

export async function loadLandingDetail(id: string): Promise<LandingDetail | null> {
  const db = createAdminClient();
  const [{ data: page }, { data: magnets }] = await Promise.all([
    db.from('landing_pages').select('*').eq('id', id).maybeSingle(),
    db.from('lead_magnets').select('id, title').order('title'),
  ]);
  if (!page) return null;
  const parsed = validateBlocks(page.blocks);
  const tag = offerTagOf(page.blocks);
  const [views, leads] = await Promise.all([countViews(page.slug), countLeads(tag)]);
  return {
    page, blocks: parsed.ok ? parsed.blocks : [], invalid: parsed.ok ? [] : parsed.errors, magnets: magnets ?? [],
    row: { id: page.id, slug: page.slug, title: page.title, published: page.published, isSample: page.is_sample, views, leads, updatedAt: page.updated_at, magnet: null, offerTag: tag },
  };
}
