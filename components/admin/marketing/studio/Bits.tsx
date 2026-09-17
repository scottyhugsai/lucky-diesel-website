import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FlaskConical, Info, OctagonX, Sparkles } from 'lucide-react';
import { Badge } from '@/components/app/ui';
import type { ClaimIssue, ComplianceStatus } from '@/lib/marketing/content/types';
import { statusLabel, statusTone } from './labels';

/* Small server-safe pieces used across the marketing studio screens. */

export function SectionTabs({ tabs, active }: { tabs: readonly { href: string; label: string }[]; active: string }) {
  return (
    <nav aria-label="Section" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const current = tab.href === active;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={`-mb-px inline-flex h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors ${current ? 'border-clover text-chalk' : 'border-transparent text-chalk/60 hover:text-chalk'}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>;
}

const COMPLIANCE: Record<ComplianceStatus, { tone: 'good' | 'warn' | 'bad'; label: string; Icon: typeof CheckCircle2 }> = {
  pass: { tone: 'good', label: 'Clear', Icon: CheckCircle2 },
  warn: { tone: 'warn', label: 'Check wording', Icon: AlertTriangle },
  block: { tone: 'bad', label: 'Blocked', Icon: OctagonX },
};

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const meta = COMPLIANCE[status];
  return (
    <Badge tone={meta.tone}>
      <meta.Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function IssueList({ issues }: { issues: readonly ClaimIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {issues.map((issue) => (
        <li key={issue.term} className={`flex gap-2 ${issue.severity === 'block' ? 'text-danger' : 'text-amber-300'}`}>
          {issue.severity === 'block' ? <OctagonX className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <span>
            <strong className="font-semibold">{issue.term}:</strong> <span className="text-chalk/75">{issue.reason}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GeneratorBadge({ generator }: { generator: string }) {
  return generator === 'ai' ? (
    <Badge tone="violet">
      <Sparkles className="size-3.5" aria-hidden="true" />
      AI copy
    </Badge>
  ) : (
    <Badge tone="neutral">
      <FlaskConical className="size-3.5" aria-hidden="true" />
      Demo copy
    </Badge>
  );
}

export function SimulatedBadge() {
  return (
    <Badge tone="info">
      <FlaskConical className="size-3.5" aria-hidden="true" />
      Simulated
    </Badge>
  );
}

export function Notice({ tone = 'info', title, children, action }: { tone?: 'info' | 'warn'; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const look = tone === 'warn' ? 'border-amber-400/30 bg-amber-400/5' : 'border-sky-400/25 bg-sky-400/5';
  const Icon = tone === 'warn' ? AlertTriangle : Info;
  return (
    <div role="note" className={`mb-6 flex flex-wrap items-start gap-3 rounded-md border px-4 py-3 ${look}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone === 'warn' ? 'text-amber-300' : 'text-sky-300'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <p className="mt-0.5 text-sm text-chalk/70">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="display grid size-9 shrink-0 place-items-center rounded-sm bg-clover text-lg not-italic text-carbon" aria-hidden="true">
        {step}
      </span>
      <div>
        <h2 className="display text-2xl not-italic">{title}</h2>
        {hint && <p className="text-sm text-chalk/60">{hint}</p>}
      </div>
    </div>
  );
}
