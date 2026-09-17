import { googleAdSchedule } from '../ad-presets';
import { ChannelError, type AdAdapter, type AdCampaignPayload, type Credentials, type DailyMetrics, type PostAdapter } from './types';

/**
 * Google Ads (Performance Max), Local Services Ads (read-only) and Google
 * Business Profile local posts. Access tokens are refreshed by the registry
 * before these run. `externalAccountId` = Ads customer id (digits) or, for
 * GBP, `accounts/{a}/locations/{l}`.
 */

const ADS_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? 'v22';
const ADS = `https://googleads.googleapis.com/${ADS_VERSION}`;
const TIMEOUT_MS = 30_000;

function customerId(credentials: Credentials, platform: 'google_ads' | 'lsa'): string {
  const id = credentials.externalAccountId?.replace(/-/g, '');
  if (!id) throw new ChannelError('Google Ads customer id is not set on the connection', platform);
  return id;
}

async function ads<T>(credentials: Credentials, path: string, body: unknown, platform: 'google_ads' | 'lsa'): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) headers['developer-token'] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const response = await fetch(`${ADS}/${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok || data.error) throw new ChannelError(`Google Ads: ${data.error?.message ?? `HTTP ${response.status}`}`, platform);
  return data;
}

async function gaql(credentials: Credentials, query: string, platform: 'google_ads' | 'lsa'): Promise<Record<string, Record<string, string | number>>[]> {
  const data = await ads<{ results?: Record<string, Record<string, string | number>>[] }[]>(credentials, `customers/${customerId(credentials, platform)}/googleAds:searchStream`, { query }, platform);
  return data.flatMap((chunk) => chunk.results ?? []);
}

const MICRO = 1_000_000;

/** Location (proximity), exclusions, negative keywords and call-hour schedule for a new campaign. */
export function campaignCriteria(camp: string, campaign: AdCampaignPayload): Record<string, unknown>[] {
  const proximity = (c: { latitude: number; longitude: number; radiusMiles: number }, negative: boolean) => ({
    campaignCriterionOperation: { create: { campaign: camp, negative, proximity: { geoPoint: { latitudeInMicroDegrees: Math.round(c.latitude * MICRO), longitudeInMicroDegrees: Math.round(c.longitude * MICRO) }, radius: c.radiusMiles, radiusUnits: 'MILES' } } },
  });
  return [
    ...campaign.geo.include.map((c) => proximity(c, false)),
    ...campaign.geo.exclude.map((c) => proximity(c, true)),
    ...campaign.negativeKeywords.map((text) => ({ campaignCriterionOperation: { create: { campaign: camp, negative: true, keyword: { text, matchType: 'PHRASE' } } } })),
    ...googleAdSchedule(campaign.callHours).map((adSchedule) => ({ campaignCriterionOperation: { create: { campaign: camp, adSchedule } } })),
  ];
}

/** Call and sitelink assets from shop facts, linked at campaign level. */
export function extensionAssets(cid: string, camp: string, campaign: AdCampaignPayload, nextTemp: () => number): Record<string, unknown>[] {
  const link = (asset: Record<string, unknown>, fieldType: string) => {
    const resourceName = `customers/${cid}/assets/${nextTemp()}`;
    return [
      { assetOperation: { create: { resourceName, ...asset } } },
      { campaignAssetOperation: { create: { campaign: camp, asset: resourceName, fieldType } } },
    ];
  };
  const digits = campaign.extensions.phone.replace(/\D/g, '');
  return [
    ...(digits.length >= 10 ? link({ callAsset: { countryCode: 'US', phoneNumber: digits.slice(-10) } }, 'CALL') : []),
    ...campaign.extensions.sitelinks.slice(0, 4).flatMap((s) => link({ finalUrls: [s.url], sitelinkAsset: { linkText: s.text.slice(0, 25) } }, 'SITELINK')),
  ];
}

export function googlePmaxAdapter(credentials: Credentials): AdAdapter {
  return {
    platform: 'google_ads',
    async publish({ campaign, variants, attemptKey }) {
      const cid = customerId(credentials, 'google_ads');
      if (variants.length === 0) throw new ChannelError('No approved variants to publish', 'google_ads');
      const headlines = [...new Set(variants.map((v) => v.headline))].slice(0, 15);
      const descriptions = [...new Set(variants.map((v) => v.description ?? v.primaryText.slice(0, 60)))].slice(0, 5);
      if (headlines.length < 3 || descriptions.length < 2) throw new ChannelError('Performance Max needs at least 3 headlines and 2 descriptions', 'google_ads');
      const budget = `customers/${cid}/campaignBudgets/-1`;
      const camp = `customers/${cid}/campaigns/-2`;
      const group = `customers/${cid}/assetGroups/-3`;
      let temp = -10;
      const textAsset = (text: string, fieldType: string) => {
        const resourceName = `customers/${cid}/assets/${temp--}`;
        return [
          { assetOperation: { create: { resourceName, textAsset: { text } } } },
          { assetGroupAssetOperation: { create: { assetGroup: group, asset: resourceName, fieldType } } },
        ];
      };
      const mutateOperations = [
        { campaignBudgetOperation: { create: { resourceName: budget, name: `${campaign.name} budget ${attemptKey.slice(0, 8)}`, amountMicros: campaign.dailyBudgetCents * 10_000, explicitlyShared: false } } },
        { campaignOperation: { create: {
          resourceName: camp, name: `${campaign.name} [${attemptKey.slice(0, 8)}]`, status: 'PAUSED', advertisingChannelType: 'PERFORMANCE_MAX', campaignBudget: budget, maximizeConversions: {},
          startDate: campaign.startsOn.replace(/-/g, ''), endDate: campaign.endsOn.replace(/-/g, ''),
          // Google may not rewrite approved text unless the owner turned AI edits on.
          assetAutomationSettings: [{ assetAutomationType: 'TEXT_ASSET_AUTOMATION', assetAutomationStatus: campaign.aiEnhancements ? 'OPTED_IN' : 'OPTED_OUT' }],
        } } },
        ...campaignCriteria(camp, campaign),
        { assetGroupOperation: { create: { resourceName: group, name: campaign.name, campaign: camp, finalUrls: [variants[0]!.landingUrl], status: 'PAUSED' } } },
        ...headlines.flatMap((h) => textAsset(h, 'HEADLINE')),
        ...textAsset(variants[0]!.longHeadline ?? variants[0]!.headline, 'LONG_HEADLINE'),
        ...descriptions.flatMap((d) => textAsset(d, 'DESCRIPTION')),
        ...textAsset('Lucky Diesel', 'BUSINESS_NAME'),
        ...extensionAssets(cid, camp, campaign, () => temp--),
      ];
      // Image and logo assets are uploaded from the rendered PNGs by the owner step in the UI when required by policy.
      const data = await ads<{ mutateOperationResponses?: Record<string, { resourceName?: string }>[] }>(credentials, `customers/${cid}/googleAds:mutate`, { mutateOperations }, 'google_ads');
      const names = (data.mutateOperationResponses ?? []).flatMap((r) => Object.values(r).map((x) => x.resourceName ?? ''));
      const campaignName = names.find((n) => n.includes('/campaigns/')) ?? '';
      const budgetName = names.find((n) => n.includes('/campaignBudgets/')) ?? '';
      return { externalIds: { campaign: campaignName, budget: budgetName, customer: cid }, statusOnPlatform: 'PAUSED', simulated: false, requestPreview: { operations: mutateOperations.length, headlines, descriptions, geo: campaign.geo, negativeKeywords: campaign.negativeKeywords.length } };
    },
    async setBudget(externalIds, dailyBudgetCents) {
      if (!externalIds.budget) throw new ChannelError('Google Ads: no budget id stored for this campaign', 'google_ads');
      await ads(credentials, `customers/${customerId(credentials, 'google_ads')}/campaignBudgets:mutate`, { operations: [{ update: { resourceName: externalIds.budget, amountMicros: dailyBudgetCents * 10_000 }, updateMask: 'amount_micros' }] }, 'google_ads');
    },
    async setStatus(externalIds, status) {
      if (!externalIds.campaign) return;
      await ads(credentials, `customers/${customerId(credentials, 'google_ads')}/campaigns:mutate`, { operations: [{ update: { resourceName: externalIds.campaign, status }, updateMask: 'status' }] }, 'google_ads');
    },
    async insights(externalIds, date): Promise<DailyMetrics | null> {
      const id = externalIds.campaign?.split('/').pop();
      if (!id || !/^\d+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const rows = await gaql(credentials, `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE campaign.id = ${id} AND segments.date = '${date}'`, 'google_ads');
      const m = rows[0]?.metrics ?? {};
      return { date, impressions: Number(m.impressions ?? 0), clicks: Number(m.clicks ?? 0), spendCents: Math.round(Number(m.costMicros ?? 0) / 10_000), leads: Math.round(Number(m.conversions ?? 0)), conversions: Math.round(Number(m.conversions ?? 0)), conversionValueCents: Math.round(Number(m.conversionsValue ?? 0) * 100) };
    },
  };
}

/** LSA is reporting-only: publishing always refuses. */
export function lsaAdapter(credentials: Credentials): AdAdapter {
  return {
    platform: 'lsa',
    async publish() {
      throw new ChannelError('Local Services Ads can’t be created by API. Manage them in the LSA dashboard; we import leads and spend.', 'lsa');
    },
    async setStatus() {
      throw new ChannelError('Local Services Ads are read-only by API.', 'lsa');
    },
    async setBudget() {
      throw new ChannelError('Change Local Services Ads budgets in the LSA dashboard.', 'lsa');
    },
    async insights(_ids, date): Promise<DailyMetrics | null> {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const rows = await gaql(credentials, `SELECT local_services_lead.lead_type, local_services_lead.creation_date_time FROM local_services_lead WHERE local_services_lead.creation_date_time >= '${date} 00:00:00' AND local_services_lead.creation_date_time <= '${date} 23:59:59'`, 'lsa');
      return { date, impressions: 0, clicks: 0, spendCents: 0, leads: rows.length, conversions: 0, conversionValueCents: 0 };
    },
  };
}

/** Adds the image to the profile's Photos tab too. A failed photo never fails the post. */
async function uploadGbpPhoto(token: string, location: string, sourceUrl: string): Promise<string> {
  try {
    const response = await fetch(`https://mybusiness.googleapis.com/v4/${location}/media`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaFormat: 'PHOTO', locationAssociation: { category: 'ADDITIONAL' }, sourceUrl }), signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? 'uploaded' : `photo upload failed: HTTP ${response.status}`;
  } catch (error) {
    return `photo upload failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function gbpPostAdapter(credentials: Credentials): PostAdapter {
  return {
    platform: 'gbp',
    async publish(request) {
      const location = credentials.externalAccountId;
      if (!location?.startsWith('accounts/')) throw new ChannelError('GBP location (accounts/…/locations/…) is not set on the connection', 'gbp');
      const offer = request.options.offer as { couponCode?: string; redeemOnlineUrl?: string; termsConditions?: string } | undefined;
      const body = {
        languageCode: 'en-US',
        summary: request.caption.slice(0, 1500),
        topicType: offer ? 'OFFER' : 'STANDARD',
        ...(request.linkUrl ? { callToAction: { actionType: offer ? 'LEARN_MORE' : 'BOOK', url: request.linkUrl } } : {}),
        ...(request.imageUrl ? { media: [{ mediaFormat: 'PHOTO', sourceUrl: request.imageUrl }] } : {}),
        ...(offer ? { offer } : {}),
      };
      const response = await fetch(`https://mybusiness.googleapis.com/v4/${location}/localPosts`, {
        method: 'POST', headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await response.json().catch(() => ({}))) as { name?: string; searchUrl?: string; error?: { message?: string } };
      if (!response.ok) throw new ChannelError(`GBP: ${data.error?.message ?? `HTTP ${response.status}`}`, 'gbp');
      const photo = request.options.addToPhotos === true && request.imageUrl ? await uploadGbpPhoto(credentials.accessToken, location, request.imageUrl) : null;
      return { externalId: data.name ?? null, permalink: data.searchUrl ?? null, status: 'published', simulated: false, requestPreview: { location, topicType: body.topicType, photo } };
    },
  };
}
