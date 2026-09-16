import { CircleCheck, CircleDashed } from 'lucide-react';
import { SettingsForm } from '@/components/admin/ops/SettingsForm';
import { Card, EmptyState, PageHeader } from '@/components/app/ui';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Settings | Lucky Diesel admin' };

function present(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      {ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-clover" aria-hidden="true" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />}
      <span>
        <span className="block text-sm font-semibold">{label}<span className="sr-only">: {ok ? 'ready' : 'not set up'}</span></span>
        <span className="block text-xs text-chalk/55">{detail}</span>
      </span>
    </li>
  );
}

export default async function SettingsPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data: settings } = await supabase.from('shop_settings').select('*').eq('id', 1).maybeSingle();

  // Presence checks only. Secret values never leave the server.
  const smsLive = process.env.MESSAGING_SMS_MODE === 'live';
  const twilio = present('TWILIO_ACCOUNT_SID') && present('TWILIO_AUTH_TOKEN') && present('TWILIO_MESSAGING_SERVICE_SID');
  const resend = present('RESEND_API_KEY');
  const demoInbox = present('DEMO_EMAIL_TO');
  const stripe = present('STRIPE_SECRET_KEY');

  return (
    <>
      <PageHeader kicker="Settings" title="Shop settings" description="Rates, alerts, reviews and hours. Changes apply immediately." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {settings ? <SettingsForm settings={settings} /> : <EmptyState title="Settings missing">The shop settings row hasn’t been created. Run the database migration.</EmptyState>}
        <Card title="Integrations" className="self-start">
          <ul className="grid gap-4">
            <Status ok={resend} label="Email · Resend" detail={resend ? (demoInbox ? 'API key set. Demo mode: every email goes to the presenter inbox.' : 'API key set. Emails go to real recipients.') : 'RESEND_API_KEY missing. Emails fail and are logged.'} />
            <Status ok={smsLive && twilio} label={`SMS · ${smsLive ? 'Live' : 'Simulated'}`} detail={smsLive ? (twilio ? 'Twilio configured. Texts deliver to phones.' : 'Live mode is on but Twilio credentials are missing.') : `Texts land in the Demo Phone. Twilio ${twilio ? 'is configured' : 'not configured yet'}; go live after A2P 10DLC approval.`} />
            <Status ok={stripe} label="Payments · Stripe" detail={stripe ? 'Secret key set. Pay links work.' : 'STRIPE_SECRET_KEY missing. Online payment is off.'} />
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-xs text-steel">Only presence is checked. Keys are never shown.</p>
        </Card>
      </div>
    </>
  );
}
