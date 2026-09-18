import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlockForm } from '@/components/admin/site/BlockForm';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { Badge, Card, PageHeader, buttonClass } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { money } from '@/lib/format';
import { productBlockDef, productKey } from '@/lib/site-content/registry';
import { getProduct } from '@/lib/store/catalog';
import { revertBlockAction } from '../../actions';
import { editorValues, findStored, loadBlocks, loadLibrary, statusOf } from '../../data';

interface PartPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PartPageProps) {
  const { handle } = await params;
  return { title: `${handle} | Lucky Diesel admin` };
}

export default async function SitePartPage({ params }: PartPageProps) {
  await requireRole('admin');
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const def = productBlockDef(handle);
  const [blocks, library] = await Promise.all([loadBlocks(), loadLibrary()]);
  const stored = findStored(blocks, productKey(handle), 'all');

  return (
    <>
      <Link href="/admin/site/parts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-steel hover:text-chalk">
        <ArrowLeft className="size-4" aria-hidden="true" /> All parts
      </Link>
      <PageHeader
        kicker="Parts listing"
        title={product.title}
        description={product.source === 'demo'
          ? 'A sample catalogue entry. It is labelled on the site and cannot be bought — it sends people to a quote instead.'
          : 'From your store. Price, stock and checkout stay with the store; everything below is yours to change.'}
        actions={
          <a href={`/store/products/${handle}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
            View on site <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <BlockForm def={def} design="all" values={editorValues(def, stored)} status={statusOf(def, stored)} library={library} />

        <Card title="From the store">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-steel">Price</dt>
              <dd className="tabular-nums">{product.purchasable ? money(product.priceMinCents) : 'Quote only'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-steel">Source</dt>
              <dd>{product.source === 'demo' ? <Badge tone="warn">Sample listing</Badge> : product.vendor}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-steel">Category</dt>
              <dd>{product.category}</dd>
            </div>
            {product.fitmentLabels.length > 0 && (
              <div>
                <dt className="text-steel">Fits</dt>
                <dd><ul className="mt-1 space-y-1">{product.fitmentLabels.map((line) => <li key={line}>{line}</li>)}</ul></dd>
              </div>
            )}
            <div>
              <dt className="text-steel">Store description</dt>
              <dd className="mt-1 text-steel">{product.summary || '—'}</dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-line pt-3">
            <ActionForm action={revertBlockAction} confirm="Remove every change you have made to this listing?">
              <input type="hidden" name="key" value={productKey(handle)} />
              <input type="hidden" name="design" value="all" />
              <PendingButton variant="ghost" size="sm">Reset this listing</PendingButton>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
