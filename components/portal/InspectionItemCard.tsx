import type { Enums } from '@/lib/db/database.types';
import type { PortalLine } from './lines';

/* Presentational only (no hooks, no server APIs) so both the static report and the approval form can use it. */

export interface InspectionPhoto {
  id: string;
  url: string;
  caption: string | null;
}

export interface InspectionItemView {
  id: string;
  category: string;
  label: string;
  rating: Enums<'inspection_rating'>;
  notes: string | null;
  photos: InspectionPhoto[];
  lines: PortalLine[];
}

export interface InspectionGroup {
  category: string;
  items: InspectionItemView[];
}

export const RATING: Record<Enums<'inspection_rating'>, { label: string; dot: string; edge: string; text: string }> = {
  green: { label: 'Good', dot: 'bg-clover', edge: 'border-l-clover', text: 'text-clover' },
  yellow: { label: 'Keep an eye on it', dot: 'bg-amber-300', edge: 'border-l-amber-300', text: 'text-amber-300' },
  red: { label: 'Needs attention', dot: 'bg-danger', edge: 'border-l-danger', text: 'text-danger' },
  na: { label: 'Not checked', dot: 'bg-steel', edge: 'border-l-steel/50', text: 'text-steel' },
};

interface InspectionItemCardProps {
  item: InspectionItemView;
  /** Rendered under the notes: the estimate lines tied to this finding. */
  children?: React.ReactNode;
}

export function InspectionItemCard({ item, children }: InspectionItemCardProps) {
  const rating = RATING[item.rating];
  return (
    <article className={`rounded-md border border-line border-l-4 bg-carbon ${rating.edge}`} aria-labelledby={`item-${item.id}`}>
      <div className={`grid gap-4 p-4 ${item.photos.length ? 'sm:grid-cols-[1fr_minmax(0,16rem)]' : ''}`}>
        <div className="min-w-0">
          <p className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${rating.text}`}>
            <span className={`size-2 rounded-full ${rating.dot}`} aria-hidden="true" />
            {rating.label}
          </p>
          <h4 id={`item-${item.id}`} className="mt-1.5 text-lg font-semibold leading-snug">{item.label}</h4>
          {item.notes && <p className="mt-1.5 text-chalk/70">{item.notes}</p>}
        </div>
        {item.photos.length > 0 && (
          <div className="grid gap-2">
            {item.photos.map((photo) => (
              <figure key={photo.id}>
                <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm border border-line bg-gunmetal">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Supabase URL; remote patterns aren't configured */}
                  <img src={photo.url} alt={photo.caption ?? item.label} width={640} height={480} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
                {photo.caption && <figcaption className="mt-1 text-xs text-chalk/55">{photo.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
      {children && <div className="border-t border-line">{children}</div>}
    </article>
  );
}
