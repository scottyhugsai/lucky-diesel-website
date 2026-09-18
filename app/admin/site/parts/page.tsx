import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Badge, EmptyState, PageHeader, TableWrap, tableClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { getCatalog } from '@/lib/store/catalog';
import { money } from '@/lib/format';
import { productKey, toProductOverride } from '@/lib/site-content/registry';
import { findStored, loadBlocks } from '../data';

export const metadata = { title: 'Parts listings | Lucky Diesel admin' };

interface PartsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SitePartsPage({ searchParams }: PartsPageProps) {
  await requireRole('admin');
  const query = ((await searchParams).q ?? '').trim().toLowerCase();
  const [{ products, ok }, blocks] = await Promise.all([getCatalog(), loadBlocks()]);

  const rows = products
    .filter((product) => !query || `${product.title} ${product.vendor}`.toLowerCase().includes(query))
    .map((product) => {
      const stored = findStored(blocks, productKey(product.handle), 'all');
      return {
        product,
        override: toProductOverride({ ...(stored?.published ?? {}) }),
        hasDraft: Boolean(stored && JSON.stringify(stored.draft) !== JSON.stringify(stored.published ?? {})),
      };
    })
    .sort((a, b) => a.product.title.localeCompare(b.product.title));

  return (
    <>
      <PageHeader
        kicker="Website"
        title="Parts listings"
        description="Change how a part reads on your site. The price, stock and checkout always come from your store."
      />

      {!ok && <p role="alert" className="mb-4 text-sm text-danger">The store catalogue could not be loaded right now.</p>}

      <form className="mb-4 flex gap-2" role="search">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search parts"
          aria-label="Search parts"
          className="w-full max-w-sm rounded-md border border-line bg-carbon px-3 py-2 text-sm"
        />
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No parts match">Try a different search.</EmptyState>
      ) : (
        <TableWrap>
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col">Part</th>
                <th scope="col">Price</th>
                <th scope="col">On the site</th>
                <th scope="col"><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ product, override, hasDraft }) => (
                <tr key={product.handle}>
                  <td>
                    <span className="font-semibold">{override.title ?? product.title}</span>
                    {product.source === 'demo' && <Badge tone="warn" className="ml-2">Sample</Badge>}
                    <p className="text-xs text-steel">{product.vendor}</p>
                  </td>
                  <td className="tabular-nums">{product.purchasable ? money(product.priceMinCents) : 'Quote'}</td>
                  <td>
                    {override.hidden ? <Badge tone="neutral">Hidden</Badge> : <Badge tone="good">Shown</Badge>}
                    {override.featuredSort && <Badge tone="good" className="ml-2">Featured {override.featuredSort}</Badge>}
                    {hasDraft && <Badge tone="warn" className="ml-2">Draft</Badge>}
                  </td>
                  <td className="text-right">
                    <Link href={`/admin/site/parts/${product.handle}`} className="text-sm text-clover hover:underline">
                      Edit <ArrowUpRight className="inline size-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
