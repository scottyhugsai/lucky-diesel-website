import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { loadPosts } from '@/lib/marketing/content/seo-public';
import { QuietPage } from '@/components/site/QuietPage';
import { BUSINESS, PLATFORMS } from '@/lib/site';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const posts = await loadPosts();
  return {
    title: `Diesel Tips & Shop Notes | ${BUSINESS.name} ${BUSINESS.city}`,
    description: `Straight answers on Duramax, Powerstroke and Cummins repair and performance from our ${BUSINESS.city} shop.`,
    alternates: { canonical: '/blog' },
    // An empty index is thin content; keep it out of search until something is published.
    ...(posts.length ? {} : { robots: { index: false, follow: true } }),
  };
}

const dateLabel = (iso: string | null) => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : null);

export default async function BlogIndexPage() {
  const posts = await loadPosts();
  if (posts.length === 0) {
    return (
      <QuietPage
        eyebrow="From the shop"
        title="Shop notes"
        line="What we find on real trucks, and how to keep yours out of the bay."
        status="Nothing published yet. The shop writes these between jobs, so they arrive when they arrive."
        onward={[
          { href: '/builds', label: 'Builds', line: 'Trucks, parts and dyno numbers.' },
          { href: '/gallery', label: 'Gallery', line: 'Work from the bay.' },
          { href: BUSINESS.phoneHref, label: `Call ${BUSINESS.phoneDisplay}`, line: 'Ask the question directly.', external: true },
        ]}
      />
    );
  }
  return (
    <div className="pb-24 pt-32 sm:pt-40">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <p className="kicker">From the shop</p>
        <h1 className="display mt-4 text-[length:var(--text-display)]">Shop notes</h1>
        <p className="mt-4 max-w-xl text-lg text-chalk/70">What we find on real trucks, and how to keep yours out of the bay.</p>

        <ul className="mt-14 divide-y divide-line border-y border-line">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group grid gap-2 py-6 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
                <span className="text-sm text-steel tabular-nums">{dateLabel(post.publishedAt)}</span>
                <span className="min-w-0">
                  <span className="display block text-3xl not-italic group-hover:text-clover">{post.title}</span>
                  <span className="mt-1 block text-chalk/65">{post.summary}</span>
                  {post.platform && <span className="mt-2 inline-block text-xs font-semibold uppercase tracking-widest text-steel">{PLATFORMS.find((p) => p.id === post.platform)?.name}</span>}
                </span>
                <ArrowUpRight className="hidden size-5 text-steel group-hover:text-clover sm:block" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
