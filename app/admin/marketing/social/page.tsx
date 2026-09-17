import { CalendarPlus, Layers, Sparkles } from 'lucide-react';
import { ActionForm, PendingButton } from '@/components/admin/core/ActionForm';
import { ButtonLink, Card, PageHeader, fieldClass } from '@/components/app/ui';
import { SectionTabs } from '@/components/admin/marketing/studio/Bits';
import { IdeasPanel } from '@/components/admin/marketing/studio/IdeasPanel';
import { DemoBanner } from '@/components/admin/marketing/studio/DemoBanner';
import { SOCIAL_LABEL, SOCIAL_PLATFORMS, SOCIAL_TABS } from '@/components/admin/marketing/studio/labels';
import { CalendarNav, MonthView, WeekView } from '@/components/admin/marketing/studio/SocialCalendar';
import { addDays, draftSources, monthDays, postsBetween, todayShop, weekDays } from '@/components/admin/marketing/studio/social-data';
import { requireRole } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import { CONTENT_PILLARS } from '@/lib/marketing/content/calendar';
import { suggestTimes } from '@/lib/marketing/content/social-service';
import { autoDraft, draftPillars } from './actions';

export const metadata = { title: 'Social | Lucky Diesel admin' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ view?: string; d?: string }> }) {
  await requireRole('admin');
  const params = await searchParams;
  const view = params.view === 'month' ? 'month' : 'week';
  const today = todayShop();
  const date = params.d && DATE_RE.test(params.d) && !Number.isNaN(Date.parse(params.d)) ? params.d : today;
  const days = view === 'week' ? weekDays(date) : monthDays(date);
  const month = date.slice(0, 7);
  const prev = view === 'week' ? addDays(date, -7) : `${addDays(`${month}-01`, -1).slice(0, 7)}-01`;
  const next = view === 'week' ? addDays(date, 7) : `${addDays(`${month}-28`, 7).slice(0, 7)}-01`;

  const [posts, sources, times] = await Promise.all([
    postsBetween(days[0]!, days[days.length - 1]!),
    draftSources(),
    Promise.all(SOCIAL_PLATFORMS.map(async (p) => ({ platform: p, at: await suggestTimes(p, 2) }))),
  ]);
  const options = [
    ...sources.builds.map((b) => ({ value: `build:${b.id}`, label: `Build: ${b.title}`, drafted: b.drafted })),
    ...sources.dynoRuns.map((r) => ({ value: `dyno:${r.id}`, label: `Dyno: ${r.label}`, drafted: r.drafted })),
  ];

  return (
    <>
      <PageHeader
        kicker="Marketing · Social"
        title="Social calendar"
        description="Plan, approve and post to IG, FB, GBP, TikTok."
        actions={<ButtonLink href="/admin/marketing/social/new"><CalendarPlus className="size-4" aria-hidden="true" />New post</ButtonLink>}
      />
      <SectionTabs tabs={SOCIAL_TABS} active="/admin/marketing/social" />
      <DemoBanner platforms={['instagram', 'facebook', 'gbp', 'tiktok']} what="posts" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <section aria-label="Calendar" className="min-w-0">
          <CalendarNav view={view} date={date} start={days[0]!} prev={prev} next={next} today={today} />
          {view === 'week' ? <WeekView days={days} posts={posts} today={today} /> : <MonthView days={days} month={month} posts={posts} today={today} />}
          <p className="mt-3 text-sm text-chalk/55">To move a post, open it and pick a new time.</p>
        </section>

        <div className="grid gap-6">
          <Card title={<span className="inline-flex items-center gap-2"><Sparkles className="size-5 text-clover" aria-hidden="true" />Auto-drafts</span>}>
            <p className="mb-3 text-sm text-chalk/60">Turn a new build or dyno pull into posts.</p>
            {options.length ? (
              <ActionForm action={autoDraft} className="grid gap-2">
                <select name="source" aria-label="Build or dyno run" className={fieldClass}>
                  {options.map((o) => <option key={o.value} value={o.value}>{o.drafted ? '✓ ' : ''}{o.label}</option>)}
                </select>
                <PendingButton size="sm">Draft posts</PendingButton>
              </ActionForm>
            ) : (
              <p className="text-sm text-chalk/55">Publish a build or log a dyno run first.</p>
            )}
          </Card>

          <Card title={<span className="inline-flex items-center gap-2"><Layers className="size-5 text-clover" aria-hidden="true" />Content pillars</span>}>
            <ul className="mb-3 grid gap-2 text-sm">
              {CONTENT_PILLARS.map((p) => <li key={p.key}><strong>{p.name}</strong> <span className="text-chalk/60">{p.description}</span></li>)}
            </ul>
            <ActionForm action={draftPillars}><PendingButton size="sm" variant="secondary">Draft next 2 weeks</PendingButton></ActionForm>
          </Card>

          <IdeasPanel />

          <Card title="Best times to post">
            <ul className="grid gap-2 text-sm">
              {times.map((t) => (
                <li key={t.platform} className="flex flex-wrap justify-between gap-x-3">
                  <strong>{SOCIAL_LABEL[t.platform]}</strong>
                  <span className="text-chalk/70">{t.at.map((d) => dateTime(d)).join(' · ') || 'No open slot'}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
