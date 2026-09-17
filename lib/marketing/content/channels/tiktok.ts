import { ChannelError, type AdAdapter, type Credentials, type DailyMetrics, type PostAdapter } from './types';

/**
 * TikTok Business API (ads) and Content Posting API (inbox drafts).
 * Ads: `externalAccountId` = advertiser id. Everything is created DISABLE.
 * Posts: unaudited apps can only post privately, so we send photo posts to the
 * creator's inbox (MEDIA_UPLOAD) and the owner finishes them in the app.
 */

const BUSINESS = 'https://business-api.tiktok.com/open_api/v1.3';
const CONTENT = 'https://open.tiktokapis.com/v2';
const TIMEOUT_MS = 20_000;

async function business<T>(credentials: Credentials, path: string, body: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const url = method === 'GET' ? `${BUSINESS}/${path}?${new URLSearchParams(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))}` : `${BUSINESS}/${path}`;
  const response = await fetch(url, {
    method,
    headers: { 'Access-Token': credentials.accessToken, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
  if (!response.ok || data.code !== 0 || !data.data) throw new ChannelError(`TikTok: ${data.message ?? `HTTP ${response.status}`}`, 'tiktok_ads');
  return data.data;
}

function advertiser(credentials: Credentials): string {
  if (!credentials.externalAccountId) throw new ChannelError('TikTok advertiser id is not set on the connection', 'tiktok_ads');
  return credentials.externalAccountId;
}

export function tiktokAdAdapter(credentials: Credentials): AdAdapter {
  return {
    platform: 'tiktok_ads',
    async publish({ campaign, variants, attemptKey }) {
      const advertiser_id = advertiser(credentials);
      const created = await business<{ campaign_id: string }>(credentials, 'campaign/create/', {
        advertiser_id, campaign_name: `${campaign.name} [${attemptKey.slice(0, 8)}]`, objective_type: campaign.objective === 'traffic' ? 'TRAFFIC' : 'LEAD_GENERATION', budget_mode: 'BUDGET_MODE_INFINITE', operation_status: 'DISABLE',
      });
      const group = await business<{ adgroup_id: string }>(credentials, 'adgroup/create/', {
        advertiser_id, campaign_id: created.campaign_id, adgroup_name: campaign.name, operation_status: 'DISABLE', placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
        budget_mode: 'BUDGET_MODE_DAY', budget: campaign.dailyBudgetCents / 100, schedule_type: 'SCHEDULE_START_END',
        schedule_start_time: `${campaign.startsOn} 12:00:00`, schedule_end_time: `${campaign.endsOn} 23:00:00`, billing_event: 'CPC', optimization_goal: 'CLICK', location_ids: [],
      });
      const ids: Record<string, string> = { campaign: created.campaign_id, adgroup: group.adgroup_id };
      for (const variant of variants) {
        const image = await business<{ image_id: string }>(credentials, 'file/image/ad/upload/', { advertiser_id, upload_type: 'UPLOAD_BY_URL', image_url: variant.imageUrl });
        const ad = await business<{ ad_ids: string[] }>(credentials, 'ad/create/', {
          advertiser_id, adgroup_id: group.adgroup_id, operation_status: 'DISABLE',
          creatives: [{ ad_name: variant.headline, ad_format: 'SINGLE_IMAGE', image_ids: [image.image_id], ad_text: variant.primaryText, call_to_action: variant.cta, landing_page_url: variant.landingUrl, identity_type: 'CUSTOMIZED_USER', display_name: 'Lucky Diesel' }],
        });
        if (ad.ad_ids[0]) ids[`ad:${variant.variantId}`] = ad.ad_ids[0];
      }
      return { externalIds: ids, statusOnPlatform: 'PAUSED', simulated: false, requestPreview: { advertiser_id, campaign, variants: variants.map((v) => v.variantId) } };
    },
    async setStatus(externalIds, status) {
      if (!externalIds.campaign) return;
      await business(credentials, 'campaign/status/update/', { advertiser_id: advertiser(credentials), campaign_ids: [externalIds.campaign], operation_status: status === 'ACTIVE' ? 'ENABLE' : 'DISABLE' });
    },
    async insights(externalIds, date): Promise<DailyMetrics | null> {
      if (!externalIds.campaign) return null;
      const data = await business<{ list?: { metrics?: Record<string, string> }[] }>(credentials, 'report/integrated/get/', {
        advertiser_id: advertiser(credentials), report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN', dimensions: ['campaign_id'],
        metrics: ['spend', 'impressions', 'clicks', 'conversion'], start_date: date, end_date: date, filtering: [{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify([externalIds.campaign]) }],
      }, 'GET');
      const m = data.list?.[0]?.metrics ?? {};
      return { date, impressions: Number(m.impressions ?? 0), clicks: Number(m.clicks ?? 0), spendCents: Math.round(Number(m.spend ?? 0) * 100), leads: Number(m.conversion ?? 0), conversions: 0, conversionValueCents: 0 };
    },
  };
}

export function tiktokPostAdapter(credentials: Credentials): PostAdapter {
  return {
    platform: 'tiktok',
    async publish(request) {
      if (!request.imageUrl) throw new ChannelError('TikTok photo posts need an image', 'tiktok');
      const response = await fetch(`${CONTENT}/post/publish/content/init/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          post_info: { title: request.caption.slice(0, 90), description: request.caption.slice(0, 4000) },
          source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: [request.imageUrl] },
          post_mode: 'MEDIA_UPLOAD',
          media_type: 'PHOTO',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await response.json().catch(() => ({}))) as { data?: { publish_id?: string }; error?: { code?: string; message?: string } };
      if (!response.ok || (data.error?.code && data.error.code !== 'ok')) throw new ChannelError(`TikTok: ${data.error?.message ?? `HTTP ${response.status}`}`, 'tiktok');
      return { externalId: data.data?.publish_id ?? null, permalink: null, status: 'draft_handoff', simulated: false, requestPreview: { mode: 'MEDIA_UPLOAD (inbox draft)' } };
    },
  };
}
