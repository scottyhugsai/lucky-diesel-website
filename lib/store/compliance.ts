import type { CategoryId } from './normalize';

/**
 * SKU compliance tags. Parts that touch power or emissions (tuning, exhaust,
 * fuel, turbo) are unverified until the owner records a CARB EO number or a
 * SEMA Garage verification. Unverified or off-road parts never go into promos,
 * ads, social drafts or product feeds.
 */

export const COMPLIANCE_STATUSES = ['carb_eo', 'sema_verified', 'unverified', 'not_applicable'] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  carb_eo: 'CARB EO',
  sema_verified: 'SEMA verified',
  unverified: 'Not verified',
  not_applicable: 'No emissions impact',
};

const EMISSIONS_CATEGORIES: readonly CategoryId[] = ['tuning', 'exhaust', 'fuel', 'turbo'];

export interface ComplianceRecord { status: ComplianceStatus; eoNumber: string | null }
export type ComplianceMap = ReadonlyMap<string, ComplianceRecord>;

export interface ComplianceProduct { handle: string; category: CategoryId; offRoadOnly: boolean }

export function isComplianceStatus(value: unknown): value is ComplianceStatus {
  return typeof value === 'string' && (COMPLIANCE_STATUSES as readonly string[]).includes(value);
}

/** Owner tag wins; otherwise emissions-related categories default to unverified. */
export function complianceFor(product: ComplianceProduct, map: ComplianceMap): ComplianceStatus {
  const tagged = map.get(product.handle)?.status;
  if (tagged) return tagged;
  return EMISSIONS_CATEGORIES.includes(product.category) ? 'unverified' : 'not_applicable';
}

export function isPromotable(product: ComplianceProduct, map: ComplianceMap): boolean {
  if (product.offRoadOnly) return false;
  return complianceFor(product, map) !== 'unverified';
}

/** CARB EO numbers look like "D-123-45". */
export function normalizeEoNumber(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase() ?? '';
  return /^[A-Z]-\d{1,4}-\d{1,4}(-\d{1,4})?$/.test(value) ? value : null;
}

export interface FeedProduct extends ComplianceProduct { title: string; vendor: string; summary: string; available: boolean; priceMinCents: number; images: { src: string }[] }

/** Google Merchant Center / Meta catalog TSV. Only promotable, in-stock parts with an image. */
export function productFeedTsv(products: readonly FeedProduct[], map: ComplianceMap, siteUrl: string): string {
  const clean = (text: string) => text.replace(/[\t\r\n]+/g, ' ').trim();
  const header = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand'];
  const rows = products
    .filter((p) => p.available && p.images[0] && isPromotable(p, map))
    .map((p) => [p.handle, clean(p.title).slice(0, 150), clean(p.summary || p.title).slice(0, 5000), 'in stock', 'new', `${(p.priceMinCents / 100).toFixed(2)} USD`, `${siteUrl}/store/products/${p.handle}`, p.images[0]!.src, clean(p.vendor)]);
  return [header, ...rows].map((r) => r.join('\t')).join('\n');
}

// ─── Carts ─────────────────────────────────────────────────────────────────

export const HIGH_VALUE_CART_CENTS = 100_000;

export interface CheckoutClick { id: string; customerId: string | null; valueCents: number; occurredAt: string }

/** Checkout clicks ≥ threshold in the last day with no store order or paid invoice since. */
export function highValueCarts(clicks: readonly CheckoutClick[], convertedCustomerIds: ReadonlySet<string>, now: Date, threshold = HIGH_VALUE_CART_CENTS): CheckoutClick[] {
  const since = now.getTime() - 86_400_000;
  return clicks
    .filter((c) => c.valueCents >= threshold && Date.parse(c.occurredAt) >= since && !(c.customerId && convertedCustomerIds.has(c.customerId)))
    .sort((a, b) => b.valueCents - a.valueCents);
}
