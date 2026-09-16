import Link from 'next/link';
import { ArrowRight, CreditCard, FileSignature, ClipboardCheck } from 'lucide-react';

export interface ActionItem {
  key: string;
  kind: 'approve' | 'pay' | 'sign';
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const ICONS = { approve: ClipboardCheck, pay: CreditCard, sign: FileSignature } as const;

/** The loudest thing on the page: whatever is waiting on the customer. */
export function ActionBand({ items }: { items: ActionItem[] }) {
  if (!items.length) return null;
  const [first, ...rest] = items;
  return (
    <section aria-labelledby="action-needed" className="relative overflow-hidden rounded-md border border-clover/40 bg-clover/[0.07]">
      <div className="speed-stripes pointer-events-none absolute -right-10 top-0 h-full w-40 opacity-[0.08]" aria-hidden="true" />
      <div className="relative p-4 sm:p-6">
        <p id="action-needed" className="kicker flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-clover opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-clover" />
          </span>
          Action needed · {items.length}
        </p>
        {first && <PrimaryAction item={first} />}
        {rest.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {rest.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.key}>
                  <Link href={item.href} className="group flex min-h-14 items-center gap-3 py-3 hover:text-clover">
                    <Icon className="size-5 shrink-0 text-clover" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.title}</span>
                      <span className="block truncate text-sm text-chalk/60">{item.detail}</span>
                    </span>
                    <span className="hidden text-sm font-semibold text-clover sm:inline">{item.cta}</span>
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function PrimaryAction({ item }: { item: ActionItem }) {
  const Icon = ICONS[item.kind];
  return (
    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="display text-3xl sm:text-5xl">{item.title}</h2>
        <p className="mt-2 max-w-xl text-chalk/75">{item.detail}</p>
      </div>
      <Link href={item.href} className="btn-go inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-sm px-6 text-base font-bold">
        <Icon className="size-5" aria-hidden="true" />
        {item.cta}
      </Link>
    </div>
  );
}
