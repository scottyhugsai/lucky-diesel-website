import { Children } from 'react';

interface BoardSectionProps {
  id: string;
  title: string;
  count: number;
  empty: string;
  muted?: boolean;
  children: React.ReactNode;
}

export function BoardSection({ id, title, count, empty, muted = false, children }: BoardSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex items-center gap-3">
        <h2 id={headingId} className={`display text-3xl not-italic ${muted ? 'text-chalk/70' : ''}`}>{title}</h2>
        <span className={`grid h-7 min-w-7 place-items-center rounded-sm px-2 font-mono text-sm font-bold tabular-nums ${count && !muted ? 'bg-clover text-carbon' : 'bg-gunmetal text-chalk/70'}`}>
          {count}
        </span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      {Children.count(children) ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>
      ) : (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-chalk/55">{empty}</p>
      )}
    </section>
  );
}
