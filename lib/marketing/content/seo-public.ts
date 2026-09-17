import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FaqItem, SeoSection } from './seo';
import { bannerClosure, relatedLinks, shopToday, type Closure, type RelatedLink } from './seo-local';

/**
 * Public reads of approved content. Only rows that went through approval and
 * publish (status = published) and are not sample data ever reach the site.
 * Explicit column lists: compliance notes and sources never leave the server.
 */

export interface PublicSeoPage {
  slug: string;
  title: string;
  summary: string;
  metaDescription: string | null;
  body: SeoSection[];
  faq: FaqItem[];
  area: string | null;
  platform: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

const COLUMNS = 'slug, title, summary, meta_description, body, faq, area, platform, published_at, updated_at';

type Row = { slug: string; title: string; summary: string; meta_description: string | null; body: unknown; faq: unknown; area: string | null; platform: string | null; published_at: string | null; updated_at: string };

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toPage(r: Row): PublicSeoPage {
  return {
    slug: r.slug, title: r.title, summary: r.summary, metaDescription: r.meta_description, body: list<SeoSection>(r.body), faq: list<FaqItem>(r.faq),
    area: r.area, platform: r.platform, publishedAt: r.published_at, updatedAt: r.updated_at,
  };
}

function live(kind: 'blog_post' | 'faq' | 'area_page') {
  return createAdminClient().from('seo_content').select(COLUMNS).eq('kind', kind).eq('status', 'published').eq('is_sample', false);
}

export const loadPosts = cache(async (): Promise<PublicSeoPage[]> => {
  const { data, error } = await live('blog_post').order('published_at', { ascending: false, nullsFirst: false }).limit(100);
  if (error) console.error(`[seo-public] posts: ${error.message}`);
  return (data ?? []).map(toPage);
});

export const loadPost = cache(async (slug: string): Promise<PublicSeoPage | null> => {
  const { data } = await live('blog_post').eq('slug', slug).maybeSingle();
  return data ? toPage(data) : null;
});

export const loadAreaPages = cache(async (): Promise<PublicSeoPage[]> => {
  const { data, error } = await live('area_page').not('area', 'is', null).limit(50);
  if (error) console.error(`[seo-public] areas: ${error.message}`);
  return (data ?? []).map(toPage);
});

/** Every published FAQ question, de-duplicated by question text. */
export const loadFaqItems = cache(async (): Promise<FaqItem[]> => {
  const { data, error } = await live('faq').order('published_at', { ascending: true });
  if (error) console.error(`[seo-public] faq: ${error.message}`);
  const seen = new Set<string>();
  return (data ?? []).flatMap((r) => list<FaqItem>(r.faq)).filter((f) => {
    const key = f.q.trim().toLowerCase();
    if (!f.q || !f.a || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

/** Related links for a public page from real published builds and posts. */
export async function loadRelatedLinks(platform: string | null, selfHref: string): Promise<RelatedLink[]> {
  const db = createAdminClient();
  const [{ data: builds }, posts] = await Promise.all([
    db.from('builds').select('slug, title, platform').eq('published', true).eq('is_sample', false).order('created_at', { ascending: false }).limit(12),
    loadPosts(),
  ]);
  return relatedLinks({ platform, selfHref, builds: builds ?? [], posts: posts.slice(0, 12).map((p) => ({ slug: p.slug, title: p.title, platform: p.platform })) });
}

/** The closure the site banner should announce right now, if any. */
export const loadBannerClosure = cache(async (): Promise<Closure | null> => {
  const today = shopToday();
  const { data, error } = await createAdminClient().from('shop_closures').select('id, label, message, starts_on, ends_on, closed').gte('ends_on', today).order('starts_on').limit(10);
  if (error) return null;
  return bannerClosure((data ?? []).map((c) => ({ id: c.id, label: c.label, message: c.message, startsOn: c.starts_on, endsOn: c.ends_on, closed: c.closed })), today);
});
