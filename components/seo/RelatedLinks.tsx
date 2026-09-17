import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { RelatedLink } from '@/lib/marketing/content/seo-local';

const KIND_LABEL: Record<RelatedLink['kind'], string> = { platform: 'Service', store: 'Parts', build: 'Build', post: 'Article', area: 'Area' };

/** Automatic internal links: platform page, parts, sibling builds and articles. */
export function RelatedLinks({ links, title = 'Related' }: { links: readonly RelatedLink[]; title?: string }) {
  if (!links.length) return null;
  return (
    <nav aria-label={title} className="mt-16 border-t border-line pt-8">
      <p className="kicker">{title}</p>
      <ul className="mt-4 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.href} className="bg-carbon">
            <Link href={link.href} className="group flex h-full items-center justify-between gap-3 p-4 transition-colors hover:bg-gunmetal">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-widest text-steel">{KIND_LABEL[link.kind]}</span>
                <span className="mt-0.5 block truncate font-semibold text-chalk/90 group-hover:text-clover">{link.label}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-steel group-hover:text-clover" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
