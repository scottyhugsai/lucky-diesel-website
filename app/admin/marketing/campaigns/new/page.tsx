import { CampaignWizard } from '@/components/admin/marketing/core-ui/CampaignWizard';
import { defaultSendAt, loadSegmentsForPicker } from '@/components/admin/marketing/core-ui/campaigns-data';
import { PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { getMarketingSettings } from '@/lib/marketing/core/settings';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'New campaign | Marketing' };

export default async function NewCampaignPage() {
  await requireRole('admin');
  const [segments, settings] = await Promise.all([loadSegmentsForPicker(), getMarketingSettings(createAdminClient())]);

  return (
    <>
      <PageHeader kicker="Campaigns" title="New campaign" description="Four steps. Save a draft anytime on the last one." />
      <div className="rounded-md border border-line bg-carbon-2 p-4 sm:p-6">
        <CampaignWizard segments={segments} quiet={{ start: settings.quietHoursStart, end: settings.quietHoursEnd }} defaultSendAt={defaultSendAt()} />
      </div>
    </>
  );
}
