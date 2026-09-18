import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { PILL, WRAP } from '@/components/store/styles';
import { BUSINESS } from '@/lib/site';
import { getStorefrontCatalog } from '@/lib/store/catalog';
import { loadComplianceMap } from '@/lib/store/compliance-service';
import { applyOverrides } from '@/lib/store/overrides';
import { getSiteContent } from '@/lib/site-content/read';
import { MAX_COMPARE, compareRows, parseCompare } from '@/lib/store/specs';

export const metadata: Metadata = {
  title: `Compare parts | ${BUSINESS.name}`,
  description: 'Put parts that fit your truck side by side, with what each spec actually means.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/store/products' },
};

interface ComparePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const handles = parseCompare(params.c);
  const [{ products, ok }, content, compliance] = await Promise.all([
    getStorefrontCatalog(),
    getSiteContent(),
    loadComplianceMap(),
  ]);
  const visible = ok ? applyOverrides(products, (handle) => content.product(handle)) : [];
  const chosen = handles.map((handle) => visible.find((product) => product.handle === handle)).filter((product) => product !== undefined);
  const rows = compareRows(chosen, compliance);

  return (
    <div className={`${WRAP} pb-24 pt-24 sm:pt-32`}>
      <Link href="/store/products" className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-clover">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to parts
      </Link>
      <h1 className="display mt-4 text-[length:var(--text-display)]">Side by side</h1>
      <p className="mt-3 max-w-xl text-chalk/70">
        Every row says what the spec actually means, so you are not expected to already know.
      </p>

      {chosen.length < 2 ? (
        <p className="mt-10 rounded-sm border border-dashed border-line p-6 text-steel">
          Pick two to {MAX_COMPARE} parts on the parts page and press Compare.
        </p>
      ) : (
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <caption className="sr-only">Parts compared side by side</caption>
            <thead>
              <tr>
                <th scope="col" className="w-56 border-b border-line py-4 pr-4 align-bottom">
                  <span className="kicker">Spec</span>
                </th>
                {chosen.map((product) => (
                  <th key={product.handle} scope="col" className="border-b border-line p-4 align-bottom">
                    <span className="relative block aspect-square w-24 overflow-hidden bg-white">
                      {product.images[0] ? (
                        <Image src={product.images[0].src} alt="" fill sizes="96px" className="object-contain p-2" />
                      ) : (
                        <span className="grid h-full place-items-center px-1 text-center text-[0.625rem] text-steel">No photo</span>
                      )}
                    </span>
                    <Link href={`/store/products/${product.handle}`} className="mt-3 block max-w-[14rem] text-[0.9375rem] font-semibold leading-snug hover:text-clover">
                      {product.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="align-top">
                  <th scope="row" className="border-b border-line py-4 pr-4 font-semibold">
                    {row.label}
                    <span className="mt-1 block text-[0.75rem] font-normal leading-snug text-steel">{row.meaning}</span>
                  </th>
                  {row.values.map((value, index) => (
                    <td key={`${row.key}-${chosen[index]?.handle ?? index}`} className="border-b border-line p-4 tabular-nums">
                      {value ?? <span className="text-steel">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-5 pr-4" />
                {chosen.map((product) => (
                  <td key={`cta-${product.handle}`} className="p-4">
                    <Link href={`/store/products/${product.handle}`} className={`inline-flex min-h-11 items-center gap-2 border border-line px-4 font-semibold transition-colors hover:border-clover hover:text-clover ${PILL}`}>
                      View <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
