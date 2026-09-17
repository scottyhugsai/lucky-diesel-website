import type { FaqItem, SeoSection } from '@/lib/marketing/content/seo';

/** Approved article sections as plain paragraphs (no HTML from the database is rendered). */
export function SeoSections({ sections }: { sections: readonly SeoSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section, i) => (
        <section key={`${i}-${section.heading}`}>
          <h2 className="display text-3xl not-italic">{section.heading}</h2>
          {section.text.split(/\n{2,}/).map((para, j) => (
            <p key={j} className="mt-3 whitespace-pre-line text-lg leading-relaxed text-chalk/75">{para}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function FaqList({ items }: { items: readonly FaqItem[] }) {
  if (!items.length) return null;
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details key={item.q} className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-semibold marker:hidden hover:text-clover">
            <span>{item.q}</span>
            <span aria-hidden="true" className="mt-1 text-clover transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-chalk/75">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
