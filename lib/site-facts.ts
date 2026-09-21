import { BUSINESS } from './site';

/**
 * The business facts the site does not have yet.
 *
 * Borrowed in shape from the roofing project, which keeps `[INSERT ...]` in its
 * constants and renders them on the page so the owner sees the gap. This site
 * is still a pitch the owner has not seen, so a page covered in placeholders
 * would read as unfinished rather than as a question. The gap is tracked here
 * instead, surfaced to the owner as a document, and everywhere a fact is
 * missing the site simply says less — an omitted property is valid, a
 * placeholder one is not.
 *
 * `businessKey` names a key of BUSINESS that would hold the value. A test
 * asserts those keys really are absent, so the moment someone fills one in the
 * list stops asking for it rather than quietly going stale.
 *
 * Regenerate the owner's copy with: node scripts/facts.mjs
 */

export type FactSeverity = 'blocks-launch' | 'blocks-feature' | 'improves';

export interface MissingFact {
  id: string;
  /** What to ask for, in the owner's words. */
  label: string;
  severity: FactSeverity;
  /** What is switched off or weaker without it, verified against the code. */
  blocks: string;
  /** Where the answer comes from, so it is not a research task for the owner. */
  where: string;
  /** The BUSINESS key it would fill, when it is one. */
  businessKey?: string;
}

export const MISSING_FACTS: readonly MissingFact[] = [
  {
    id: 'street-address',
    label: 'Shop street address and ZIP',
    severity: 'blocks-launch',
    blocks:
      'The AutoRepair schema publishes city and state only, so there is no streetAddress or geo for Google to match against a Business Profile. The footer says "Charleston, SC" and nothing more.',
    where: 'The address on your insurance, your lease or your business licence.',
    businessKey: 'address',
  },
  {
    id: 'hours',
    label: 'Opening hours, including Saturdays',
    severity: 'blocks-launch',
    blocks:
      'No openingHoursSpecification in the schema. The chat widget guesses 8-6 weekdays (CHAT_HOURS in engage/rules.ts is marked "assumed until the owner confirms") and the booking page cannot show a closed day.',
    where: 'What you actually answer the phone between, not what you wish it was.',
    businessKey: 'hours',
  },
  {
    id: 'google-business-profile',
    label: 'Google Business Profile URL (verified)',
    severity: 'blocks-launch',
    blocks:
      'Not in sameAs, so the site and the map listing are two unconnected entities. This is the single biggest local-search item and it is not code.',
    where: 'business.google.com — if it is unclaimed, claiming it is the job.',
  },
  {
    id: 'google-review-url',
    label: 'Google review link',
    severity: 'blocks-feature',
    blocks:
      '/review is built to redirect straight to it and currently falls back to a text-us page instead. Every review request in the automations points at /review.',
    where: 'Your Business Profile, "Ask for reviews" — it is a g.page/r/... link.',
  },
  {
    id: 'shopify-storefront-token',
    label: 'Shopify Storefront API token',
    severity: 'blocks-feature',
    blocks:
      'Checkout currently leaves the site through a Shopify cart permalink. With the token the cart completes here.',
    where: 'Shopify admin - Settings - Apps - Develop apps - Storefront API.',
  },
  {
    id: 'shipping-returns',
    label: 'Shipping rate and returns window',
    severity: 'blocks-feature',
    blocks:
      'Merchant listing schema is plumbed and deliberately emits nothing until both exist (migration 035 is waiting on them). Without it parts are ineligible for the shopping rich result.',
    where: 'What you charge to ship a turbo, and how many days a customer has to send one back.',
  },
  {
    id: 'carb-eo',
    label: 'CARB EO numbers for the parts that have them',
    severity: 'improves',
    blocks:
      'The public CARB/EO display has nothing to show. Nearly every performance part is unverified, so this is a short list, but the parts that do carry one should say so.',
    where: 'The manufacturer listing or the box.',
  },
  {
    id: 'ein',
    label: 'EIN and registered business name',
    severity: 'blocks-feature',
    blocks:
      'Twilio A2P 10DLC registration cannot be filed, so marketing SMS stays simulated. Review is 10-15 business days once filed, so this one wants starting early.',
    where: 'Your EIN letter from the IRS.',
  },
  {
    id: 'dyno-figures',
    label: 'Real before/after dyno numbers',
    severity: 'improves',
    blocks:
      'Every build on the site is badged "Example" and the headline averages are suppressed, because the only figures present came from seeded demo rows.',
    where: 'Your dyno sheets. One real pull is enough to turn the board on.',
  },
] as const;

export const factsBySeverity = (severity: FactSeverity): MissingFact[] =>
  MISSING_FACTS.filter((fact) => fact.severity === severity);

/** Keys a fact claims to fill that BUSINESS already has — i.e. the list is stale. */
export function stalefacts(): string[] {
  const known = BUSINESS as unknown as Record<string, unknown>;
  return MISSING_FACTS.filter((fact) => {
    if (!fact.businessKey) return false;
    const value = known[fact.businessKey];
    return value !== undefined && value !== null && value !== '';
  }).map((fact) => fact.id);
}
