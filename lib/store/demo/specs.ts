import { findGroup, type FitmentGroup } from './groups';
import { PART_FAMILIES, type PartFamily } from './parts';

/** One sample product, before it is turned into a StoreProduct. */
export interface ProductSpec {
  handle: string;
  title: string;
  family: PartFamily;
  groups: readonly FitmentGroup[];
}

/** Platform buckets in the order the rest of the store lists them; gas last. */
const BUCKETS = [
  { key: 'duramax', slug: 'duramax', label: 'Duramax' },
  { key: 'powerstroke', slug: 'power-stroke', label: 'Power Stroke' },
  { key: 'cummins', slug: 'cummins', label: 'Cummins' },
  { key: 'gas', slug: 'gas', label: 'Gas V8' },
] as const;

const bucketOf = (group: FitmentGroup): string => group.platforms[0] ?? 'gas';

function groupsOf(family: PartFamily): FitmentGroup[] {
  return family.groups.flatMap((id) => {
    const group = findGroup(id);
    return group ? [group] : [];
  });
}

function specsFor(family: PartFamily): ProductSpec[] {
  const groups = groupsOf(family);
  if (family.split === 'single') {
    return [{ handle: `demo-${family.id}`, title: family.name, family, groups }];
  }
  if (family.split === 'platform') {
    return BUCKETS.flatMap((bucket) => {
      const members = groups.filter((group) => bucketOf(group) === bucket.key);
      if (members.length === 0) return [];
      return [{ handle: `demo-${family.id}-${bucket.slug}`, title: `${family.name} — ${bucket.label}`, family, groups: members }];
    });
  }
  return groups.map((group) => ({ handle: `demo-${family.id}-${group.id}`, title: `${family.name} — ${group.short}`, family, groups: [group] }));
}

/** Stable order: families as written, groups as listed. Product ids depend on it. */
export const PRODUCT_SPECS: readonly ProductSpec[] = PART_FAMILIES.flatMap(specsFor);
