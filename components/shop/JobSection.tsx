interface JobSectionProps {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
}

export function JobSection({ id, title, kicker, children }: JobSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-32 rounded-md border border-line bg-carbon-2 lg:scroll-mt-20">
      <header className="flex items-end justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 id={`${id}-heading`} className="display text-3xl">{title}</h2>
        {kicker && <p className="truncate pb-0.5 text-xs font-semibold uppercase tracking-widest text-steel">{kicker}</p>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

interface SectionNavProps {
  sections: { id: string; label: string; count?: number }[];
}

/** Sticky jump bar so a thumb can get to any part of a long job. */
export function SectionNav({ sections }: SectionNavProps) {
  return (
    <nav aria-label="Job sections" className="sticky top-14 z-10 -mx-4 border-b border-line bg-carbon/95 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-md lg:border lg:px-2">
      <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {sections.map((section) => (
          <li key={section.id} className="shrink-0">
            <a href={`#${section.id}`} className="flex h-11 items-center gap-2 rounded-sm border border-line bg-carbon-2 px-3.5 text-sm font-semibold text-chalk/80 transition-colors hover:border-clover hover:text-clover">
              {section.label}
              {section.count ? <span className="rounded-sm bg-gunmetal px-1.5 font-mono text-xs tabular-nums text-chalk">{section.count}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
