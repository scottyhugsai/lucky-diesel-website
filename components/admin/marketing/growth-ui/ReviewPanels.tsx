import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/app/ui';
import { ReviewStripView } from '@/components/marketing-public/ReviewStripView';
import type { ReviewWidget } from '@/lib/marketing/content/reputation';
import { Metric, SampleTag, Stars, shortDate } from './kit';
import type { ReviewsOverview, ReviewView } from './reviews-data';

export function PolicyNote() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-clover/30 bg-clover/5 px-4 py-3 text-sm text-chalk/80">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-clover" aria-hidden="true" />
      Every customer gets asked. No rewards for reviews. No filtering by score.
    </p>
  );
}

export function NpsCard({ nps, requests }: Pick<ReviewsOverview, 'nps' | 'requests'>) {
  const max = 100;
  const rate = requests.sent ? Math.round((requests.completed / requests.sent) * 100) : 0;
  return (
    <Card title="NPS">
      <div className="grid grid-cols-2 gap-4">
        <Metric label="Score" value={nps.score ?? '—'} tone={nps.score === null ? 'neutral' : nps.score >= 50 ? 'good' : nps.score >= 0 ? 'warn' : 'bad'} />
        <Metric label="Replies" value={`${requests.completed}/${requests.sent}`} />
      </div>
      <p className="mt-2 text-xs text-steel">{rate}% of surveys answered. {nps.promoters} promoters · {nps.passives} passive · {nps.detractors} detractors.</p>
      <figure className="mt-4">
        <figcaption className="mb-2 text-xs font-semibold uppercase tracking-widest text-steel">8-week trend</figcaption>
        <ol className="grid h-24 grid-cols-8 items-end gap-1.5">
          {nps.weeks.map((week) => {
            const height = week.score === null ? 4 : Math.max(6, Math.round(((week.score + max) / (2 * max)) * 100));
            return (
              <li key={week.label} className="flex h-full flex-col justify-end gap-1" title={`${week.label}: ${week.score ?? 'no'} (${week.responses})`}>
                <span className={`block rounded-t-sm ${week.score === null ? 'bg-line' : week.score >= 0 ? 'bg-clover/70' : 'bg-danger/70'}`} style={{ height: `${height}%` }} />
                <span className="sr-only">Week of {week.label}: {week.score === null ? 'no responses' : `score ${week.score}`}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-1 flex justify-between text-[0.65rem] text-steel" aria-hidden="true">
          <span>{nps.weeks[0]?.label}</span>
          <span>{nps.weeks.at(-1)?.label}</span>
        </div>
      </figure>
      {nps.lowScores.length > 0 && (
        <ul className="mt-4 grid gap-2 border-t border-line pt-3 text-sm">
          {nps.lowScores.map((low, i) => (
            <li key={i} className="flex gap-2"><span className="font-mono text-danger">{low.score}</span><span className="text-chalk/75">{low.comment ?? 'No comment'} · {shortDate(low.at)}</span></li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function NegativeAlerts({ reviews }: { reviews: ReviewView[] }) {
  return (
    <Card title="Needs you">
      {reviews.length === 0 ? (
        <p className="text-sm text-chalk/60">No unanswered low ratings.</p>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="grid gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2"><Stars rating={r.rating} />{r.isSample && <SampleTag />}<span className="text-steel">{shortDate(r.reviewedAt)}</span></span>
              <span className="line-clamp-2 text-chalk/80">{r.body ?? 'No text'}</span>
              <span className="text-xs text-steel">{r.alertedAt ? `Alert sent ${shortDate(r.alertedAt, true)}` : 'No alert sent'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function samplePreview(reviews: ReviewView[]): ReviewWidget {
  const shown = reviews.filter((r) => r.isSample && r.source !== 'internal' && r.body).slice(0, 3);
  return {
    average: shown.length ? Math.round((shown.reduce((t, r) => t + r.rating, 0) / shown.length) * 10) / 10 : null,
    count: shown.length,
    reviews: shown.map((r) => ({ id: r.id, author: r.author.replace(/^Sample\s*[—-]\s*/i, ''), rating: r.rating, body: r.body ?? '', source: 'manual', reviewedAt: r.reviewedAt })),
  };
}

export function WidgetPreview({ widget, all }: { widget: ReviewWidget; all: ReviewView[] }) {
  const isEmpty = widget.reviews.length === 0;
  const preview = isEmpty ? samplePreview(all) : widget;
  return (
    <Card title="Site widget" action={isEmpty ? <SampleTag /> : undefined} padded={false}>
      <p className="px-4 pt-4 text-sm text-chalk/65 sm:px-5">
        {isEmpty ? 'No real reviews yet, so the site shows nothing. Sample look below.' : `Live: ${widget.count} real reviews.`}
      </p>
      <div className="pointer-events-none origin-top overflow-hidden [&_section]:border-t-0 [&_section]:py-5">
        <ReviewStripView widget={preview} heading="What owners say" stack />
      </div>
    </Card>
  );
}
