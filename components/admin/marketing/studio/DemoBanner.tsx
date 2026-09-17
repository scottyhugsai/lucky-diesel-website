import 'server-only';
import { ButtonLink } from '@/components/app/ui';
import { listConnections } from '@/lib/marketing/content/channels/registry';
import type { ConnectionPlatform } from '@/lib/marketing/content/channels/types';
import { Notice } from './Bits';

/** Shows when any of the given platforms is not truly connected, so nothing reads as real spend. */
export async function DemoBanner({ platforms, what }: { platforms: readonly ConnectionPlatform[]; what: string }) {
  const connections = await listConnections();
  const offline = connections.filter((c) => platforms.includes(c.platform) && c.status !== 'connected');
  if (!offline.length) return null;
  const names = offline.length === platforms.length ? 'all accounts' : offline.map((c) => c.requirements.label.replace(/ \(.*\)$/, '')).join(', ');
  return (
    <Notice
      title={`Demo mode: ${what} are simulated`}
      action={<ButtonLink href="/admin/marketing/content/connections" variant="secondary" size="sm">Connect accounts</ButtonLink>}
    >
      Not connected: {names}. Nothing real is spent or posted.
    </Notice>
  );
}
