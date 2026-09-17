import 'server-only';
import { CHECKLISTS, periodKey, type ChecklistKind } from '@/lib/marketing/content/checklists';
import { adminDb } from '@/lib/marketing/content/db';
import { loadHealth, type HealthSnapshot } from '@/lib/marketing/content/health-service';
import { scanTemplates, type PolicyScanItem } from '@/lib/marketing/content/templates';
import { defaultProfile, readProfile, validateProfile, tendlcPacket, type TendlcIssue, type TendlcProfile } from '@/lib/marketing/content/tendlc';
import { SMS_CONSENT_TEXT } from '@/lib/lead';
import { BUSINESS } from '@/lib/site';
import { siteUrl } from '@/lib/site-url';
import type { ComplianceReport } from '@/lib/marketing/content/compliance';

export interface OpsData {
  aiCapUsd: number;
  tendlc: { profile: TendlcProfile; issues: TendlcIssue[]; packet: string };
  health: HealthSnapshot;
  /** Ticked item ids for the current period, per checklist. */
  ticks: Record<ChecklistKind, string[]>;
  policy: (PolicyScanItem & { report: ComplianceReport })[];
}

/** Everything the Settings ops sections show. Each block degrades to empty. */
export async function loadOps(): Promise<OpsData> {
  const db = adminDb();
  const [{ data: settings }, health, { data: tickRows }, { data: automations }, { data: templates }, { data: steps }] = await Promise.all([
    db.from('marketing_settings').select('ai_monthly_cap_usd, tendlc_profile, sender_name, sender_email, postal_address').eq('id', 1).maybeSingle(),
    loadHealth(db).catch(() => ({ alerts: [], dns: null, lastCronAt: null, complaints: null })),
    db.from('ops_checklist_ticks').select('checklist, period, item'),
    db.from('automations').select('key, name, sms_template, email_subject_template, email_body_template').limit(80),
    db.from('marketing_templates').select('id, name, channel, subject, body').limit(80),
    db.from('campaign_steps').select('id, subject, body, campaign_id, campaigns(name)').limit(120),
  ]);

  const base = siteUrl();
  const defaults = defaultProfile({
    legalName: settings?.sender_name ?? BUSINESS.name,
    brandName: BUSINESS.name,
    website: base,
    city: BUSINESS.city,
    state: BUSINESS.region,
    contactEmail: settings?.sender_email ?? BUSINESS.email,
    contactPhone: BUSINESS.phoneDisplay,
    consentText: SMS_CONSENT_TEXT,
    quoteUrl: `${base}/#quote`,
    privacyUrl: `${base}/privacy`,
    termsUrl: `${base}/privacy#sms`,
    samples: [],
  });
  const profile = readProfile(settings?.tendlc_profile, defaults);

  const ticks = Object.fromEntries(
    CHECKLISTS.map((list) => {
      const period = periodKey(list.kind);
      return [list.kind, (tickRows ?? []).filter((t) => t.checklist === list.kind && t.period === period).map((t) => t.item)];
    }),
  ) as Record<ChecklistKind, string[]>;

  const scanItems: PolicyScanItem[] = [
    ...(automations ?? []).map((a) => ({
      id: `automation-${a.key}`, label: a.name, kind: 'Automation', href: `/admin/automations/${a.key}`,
      fields: [a.sms_template, a.email_subject_template, a.email_body_template],
    })),
    ...(templates ?? []).map((t) => ({
      id: `template-${t.id}`, label: t.name, kind: 'Template', href: '/admin/marketing/content/templates',
      fields: [t.subject, t.body],
    })),
    ...(steps ?? []).map((s) => ({
      id: `step-${s.id}`, label: s.campaigns?.name ?? 'Campaign step', kind: 'Campaign', href: `/admin/marketing/campaigns/${s.campaign_id}`,
      fields: [s.subject, s.body],
    })),
  ];

  return {
    aiCapUsd: settings?.ai_monthly_cap_usd ?? 0,
    tendlc: { profile, issues: validateProfile(profile, BUSINESS.name), packet: tendlcPacket(profile) },
    health,
    ticks,
    policy: scanTemplates(scanItems).slice(0, 25),
  };
}
