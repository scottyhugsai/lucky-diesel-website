import { Badge, Card, PageHeader } from '@/components/app/ui';
import { CopilotChat } from '@/components/admin/marketing/ops/CopilotChat';
import { SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { CONTENT_TABS } from '@/components/admin/marketing/studio/labels';
import { requireRole } from '@/lib/auth';
import { resolveAiMode } from '@/lib/marketing/content/ai';
import { SUGGESTED_QUESTIONS } from '@/lib/marketing/content/copilot-intents';

export const metadata = { title: 'Copilot | Lucky Diesel admin' };

export default async function CopilotPage() {
  await requireRole('admin');
  const ai = resolveAiMode();
  return (
    <>
      <PageHeader kicker="Marketing · Content" title="Copilot" description="Ask questions about your marketing data." />
      <SectionTabs tabs={CONTENT_TABS} active="/admin/marketing/content/copilot" />
      <Card title="Ask" action={<Badge tone={ai.live ? 'violet' : 'info'}>{ai.live ? 'Live AI' : 'Data answers'}</Badge>} className="mx-auto w-full max-w-3xl">
        <CopilotChat suggestions={SUGGESTED_QUESTIONS} />
        <p className="mt-3 text-xs text-steel">Numbers not in your data are never shown.</p>
      </Card>
    </>
  );
}
