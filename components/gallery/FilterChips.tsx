import Link from 'next/link';
import { PLATFORMS } from '@/lib/site';
import { GALLERY_CATEGORIES, type GalleryPhoto } from './constants';
import { applyFilters, filterHref, type GalleryFilters } from './data';

const chipClass =
  'inline-flex h-11 shrink-0 items-center gap-2 border px-4 text-sm font-semibold transition-colors ' +
  'rounded-sm font-[family-name:var(--font-condensed)] uppercase tracking-[0.14em] ' +
  'border-line text-chalk/70 hover:border-chalk/40 hover:text-chalk ' +
  'aria-[current=true]:border-clover aria-[current=true]:bg-clover aria-[current=true]:text-carbon ' +
  '[[data-design=v2]_&]:rounded-full [[data-design=v2]_&]:border-transparent [[data-design=v2]_&]:bg-gunmetal ' +
  '[[data-design=v2]_&]:font-[family-name:var(--font-v2)] [[data-design=v2]_&]:normal-case [[data-design=v2]_&]:tracking-normal ' +
  '[[data-design=v2]_&]:font-medium [[data-design=v2]_&]:aria-[current=true]:bg-chalk [[data-design=v2]_&]:aria-[current=true]:text-carbon';

interface ChipOption {
  key: string;
  label: string;
  filters: GalleryFilters;
  active: boolean;
  count: number;
}

function ChipRow({ label, options }: { label: string; options: ChipOption[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 py-1">
        {options.map((option) => (
          <li key={option.key}>
            <Link href={filterHref(option.filters)} scroll={false} aria-current={option.active ? 'true' : undefined} className={chipClass}>
              {option.label}
              <span className="text-xs tabular-nums opacity-60">{option.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Two independent rows of link chips. Links, not buttons: filters work without JS and are shareable. */
export function FilterChips({ photos, filters }: { photos: GalleryPhoto[]; filters: GalleryFilters }) {
  const count = (f: GalleryFilters) => applyFilters(photos, f).length;
  const categories: ChipOption[] = [
    { key: 'all', label: 'All', filters: { ...filters, category: null }, active: !filters.category, count: count({ ...filters, category: null }) },
    ...GALLERY_CATEGORIES.map((c) => {
      const next = { ...filters, category: c.id };
      return { key: c.id, label: c.label, filters: next, active: filters.category === c.id, count: count(next) };
    }),
  ];
  const platforms: ChipOption[] = [
    { key: 'all', label: 'Every truck', filters: { ...filters, platform: null }, active: !filters.platform, count: count({ ...filters, platform: null }) },
    ...PLATFORMS.map((p) => {
      const next = { ...filters, platform: p.id };
      return { key: p.id, label: p.name, filters: next, active: filters.platform === p.id, count: count(next) };
    }),
  ];

  // A chip that leads to an empty gallery is furniture advertising an absence —
  // "DYNO 0", "EVENTS 0", "POWERSTROKE 0". With a handful of photos most facets
  // are empty, so only offer the ones that go somewhere, and drop a row
  // entirely when it would hold nothing but "All". The currently active chip
  // always stays, so a filtered view never loses its own way back.
  const offered = (options: ChipOption[]) => {
    const kept = options.filter((option) => option.count > 0 || option.active);
    return kept.length > 1 ? kept : [];
  };
  const categoryChips = offered(categories);
  const platformChips = offered(platforms);

  return (
    <div className="grid gap-2">
      {categoryChips.length > 0 && <ChipRow label="Filter by category" options={categoryChips} />}
      {platformChips.length > 0 && <ChipRow label="Filter by platform" options={platformChips} />}
    </div>
  );
}
