import { Clock, KeyRound, ListChecks, PlugZap } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import type { ActionState } from '@/components/admin/core/parse';
import { Badge, fieldClass, labelClass } from '@/components/app/ui';
import { dateOnly } from '@/lib/format';
import type { ConnectionView } from '@/lib/marketing/content/channels/registry';

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

const STATUS: Record<string, { label: string; tone: 'neutral' | 'info' | 'good' | 'warn' | 'bad' }> = {
  not_connected: { label: 'Not connected', tone: 'neutral' },
  demo: { label: 'Demo', tone: 'info' },
  connected: { label: 'Connected', tone: 'good' },
  expired: { label: 'Expired', tone: 'warn' },
  error: { label: 'Error', tone: 'bad' },
  revoked: { label: 'Revoked', tone: 'neutral' },
};

/** One platform: status, what it needs, honest wait time, and a write-only connect form. */
export function ConnectionCard({ connection, hint, connect, setMode }: { connection: ConnectionView; hint: string | null; connect: Action; setMode: Action }) {
  const req = connection.requirements;
  const status = STATUS[connection.status] ?? STATUS.not_connected!;
  const platform = <input type="hidden" name="platform" value={connection.platform} />;

  return (
    <li className="flex min-w-0 flex-col rounded-md border border-line bg-carbon-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="display text-xl not-italic">{req.label}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {req.readOnly && <Badge>Read-only</Badge>}
        </div>
      </div>
      {connection.accountName && <p className="mt-1 text-sm text-chalk/70">{connection.accountName}{hint ? ` · ${hint}` : ''}</p>}
      {connection.tokenExpiresAt && <p className="text-xs text-chalk/55">Token expires {dateOnly(connection.tokenExpiresAt)}</p>}
      {connection.lastError && <p className="mt-1 text-sm text-danger">{connection.lastError}</p>}
      <p className="mt-2 text-sm text-chalk/70">{req.capability}</p>

      <p className="mt-3 flex items-center gap-2 text-sm font-semibold"><Clock className="size-4 text-clover" aria-hidden="true" />Typical wait: {req.typicalWait}</p>
      <details className="mt-2">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-chalk/75 hover:text-chalk"><ListChecks className="size-4" aria-hidden="true" />What you need</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-chalk/70">
          {req.ownerSteps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <p className="mt-2 text-xs text-steel">Scopes: {req.scopes.join(', ')}</p>
      </details>

      <div className="mt-auto pt-3">
        <details className="rounded-sm border border-line">
          <summary className="flex h-10 cursor-pointer items-center gap-2 px-3 text-sm font-semibold"><PlugZap className="size-4 text-clover" aria-hidden="true" />{connection.status === 'connected' ? 'Replace credentials' : 'Connect'}</summary>
          <ActionForm action={connect} resetOnSuccess className="grid gap-2 border-t border-line p-3">
            {platform}
            <label className={labelClass} htmlFor={`tok-${connection.platform}`}>Access token</label>
            <input id={`tok-${connection.platform}`} name="accessToken" type="password" autoComplete="off" className={fieldClass} required />
            <label className={labelClass} htmlFor={`ref-${connection.platform}`}>Refresh token (optional)</label>
            <input id={`ref-${connection.platform}`} name="refreshToken" type="password" autoComplete="off" className={fieldClass} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className={labelClass} htmlFor={`acc-${connection.platform}`}>Account ID</label><input id={`acc-${connection.platform}`} name="accountId" className={fieldClass} required /></div>
              <div><label className={labelClass} htmlFor={`nm-${connection.platform}`}>Account name</label><input id={`nm-${connection.platform}`} name="accountName" className={fieldClass} required /></div>
            </div>
            <label className={labelClass} htmlFor={`sc-${connection.platform}`}>Scopes granted</label>
            <input id={`sc-${connection.platform}`} name="scopes" className={fieldClass} defaultValue={req.scopes.join(', ')} />
            <label className={labelClass} htmlFor={`ex-${connection.platform}`}>Token expires (optional)</label>
            <input id={`ex-${connection.platform}`} name="expiresOn" type="date" className={fieldClass} />
            <p className="flex items-start gap-2 text-xs text-chalk/55"><KeyRound className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Encrypted on save. Never shown again.</p>
            <PendingButton size="sm">Save connection</PendingButton>
          </ActionForm>
        </details>
        <div className="mt-2 flex flex-wrap gap-2">
          {connection.status !== 'demo' && <ActionForm action={setMode}>{platform}<input type="hidden" name="mode" value="demo" /><PendingButton size="sm" variant="ghost">Use demo mode</PendingButton></ActionForm>}
          {['connected', 'expired', 'error', 'demo'].includes(connection.status) && (
            <ActionForm action={setMode} confirm="Disconnect and delete the stored token?">{platform}<input type="hidden" name="mode" value="not_connected" /><PendingButton size="sm" variant="ghost">Disconnect</PendingButton></ActionForm>
          )}
        </div>
      </div>
    </li>
  );
}
