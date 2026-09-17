import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { RelatedLinks } from '@/components/seo/RelatedLinks';
import { FaqList, SeoSections } from '@/components/seo/SeoSections';
import { faqSchema } from '@/lib/marketing/content/seo';
import { loadPost, loadRelatedLinks } from '@/lib/marketing/content/seo-public';
import { articleSchema, breadcrumbSchema } from '@/lib/marketing/content/seo-schema';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function load(slug: string) {
  return SLUG.test(slug) ? loadPost(slug) : null;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await load((await params).slug);
  if (!post) return { robots: { index: false } };
  return {
    title: `${post.title} | ${BUSINESS.name}`,
    description: post.metaDescription ?? post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.metaDescription ?? post.summary },
  };
}

export default async function BlogPostPage({ params }: PostPageProps) {
  const post = await load((await params).slug);
  if (!post) notFound();
  const base = siteUrl();
  const url = `${base}/blog/${post.slug}`;
  const related = await loadRelatedLinks(post.platform, `/blog/${post.slug}`);

  return (
    <article className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40">
      <JsonLd data={articleSchema({ title: post.title, description: post.metaDescription ?? post.summary, url, publishedAt: post.publishedAt, updatedAt: post.updatedAt, base })} />
      <JsonLd data={breadcrumbSchema([{ name: 'Shop notes', url: `${base}/blog` }, { name: post.title, url }])} />
      <JsonLd data={faqSchema(post.faq)} />
      <nav aria-label="Breadcrumb" className="text-sm text-steel">
        <Link href="/blog" className="hover:text-clover">Shop notes</Link> <span aria-hidden="true">/</span> <span className="text-chalk/80">Article</span>
      </nav>
      <h1 className="display mt-6 text-[length:var(--text-display)]">{post.title}</h1>
      <p className="mt-4 text-xl text-chalk/75">{post.summary}</p>
      <div className="mt-12"><SeoSections sections={post.body} /></div>
      {post.faq.length > 0 && (
        <section aria-labelledby="post-faq" className="mt-14">
          <h2 id="post-faq" className="display mb-4 text-3xl not-italic">Questions</h2>
          <FaqList items={post.faq} />
        </section>
      )}
      <Link href={post.platform ? `/?truck=${post.platform}#quote` : '/#quote'} className="btn-go display mt-14 inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-xl not-italic">
        Get a quote <ArrowRight className="size-5" aria-hidden="true" />
      </Link>
      <RelatedLinks links={related} />
    </article>
  );
}
