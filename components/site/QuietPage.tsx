import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

export interface Onward {
  href: string;
  label: string;
  /** One short line saying what is actually there, so the choice is informed. */
  line: string;
  /** Set for tel:/sms: and anything else off-site. */
  external?: boolean;
}

interface QuietPageProps {
  eyebrow: string;
  title: string;
  /** The page's own promise, said whether or not there is anything on it yet. */
  line: string;
  /** What is true right now. Plain, unhedged, and never dressed up as content. */
  status: string;
  onward: readonly Onward[];
}

/**
 * The deliberate one-screen page.
 *
 * Several pages are waiting on the owner — FAQ answers, posts, events, a Google
 * review URL — and until then each one was an eyebrow, a headline, one bordered
 * rectangle and a footer that took half the document, at five different content
 * widths. A page with nothing on it yet cannot be made long honestly, so it is
 * made to be exactly one screen instead: the promise, the true status, and the
 * pages that do have something on them. Empty is fine; a dead end is not.
 */
export function QuietPage({ eyebrow, title, line, status, onward }: QuietPageProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100svh-6rem)] max-w-3xl flex-col justify-center px-4 pb-16 pt-28 sm:px-6">
      <p className="kicker">{eyebrow}</p>
      <h1 className="display mt-4 text-[length:var(--text-display)]">{title}</h1>
      <p className="mt-4 text-lg text-chalk/70">{line}</p>

      {/* A rule, not a card: this is the page's state, not something to read. */}
      <p className="mt-8 border-l-2 border-clover pl-4 text-steel">{status}</p>

      <nav aria-label="Where to go instead" className="mt-10 divide-y divide-line border-y border-line">
        {onward.map((item) =>
          item.external ? (
            <a key={item.href} href={item.href} className="group flex min-h-14 items-center justify-between gap-4 py-4">
              <OnwardBody label={item.label} line={item.line} />
              <ArrowUpRight className="size-5 shrink-0 text-steel transition-colors group-hover:text-clover" aria-hidden="true" />
            </a>
          ) : (
            <Link key={item.href} href={item.href} className="group flex min-h-14 items-center justify-between gap-4 py-4">
              <OnwardBody label={item.label} line={item.line} />
              <ArrowRight className="size-5 shrink-0 text-steel transition-transform duration-300 group-hover:translate-x-1 group-hover:text-clover" aria-hidden="true" />
            </Link>
          ),
        )}
      </nav>
    </section>
  );
}

function OnwardBody({ label, line }: { label: string; line: string }) {
  return (
    <span className="min-w-0">
      <span className="display block text-2xl not-italic group-hover:text-clover">{label}</span>
      <span className="mt-0.5 block text-sm text-steel">{line}</span>
    </span>
  );
}
