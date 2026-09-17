import { SegmentBuilder } from '@/components/admin/marketing/core-ui/SegmentBuilder';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';

export const metadata = { title: 'New segment | Marketing' };

export default async function NewSegmentPage() {
  await requireRole('admin');
  return (
    <>
      <PageHeader kicker="Segments" title="Build a segment" description="Add rules. The count updates as you go." />
      <SegmentBuilder />
    </>
  );
}
