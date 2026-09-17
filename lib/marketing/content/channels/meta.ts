import { ChannelError, type AdAdapter, type AdCampaignPayload, type Credentials, type DailyMetrics, type PostAdapter } from './types';

/**
 * Meta Marketing API + Page/Instagram publishing. Everything is created
 * PAUSED; Advantage+ creative enhancements are opted out so Meta can't rewrite
 * approved copy. Requires `externalAccountId` = ad account id (act_…) for ads,
 * Page id for Facebook, IG user id for Instagram.
 */

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? 'v25.0'}`;
const TIMEOUT_MS = 20_000;
const METERS_PER_MILE = 1609.34;

async function graph<T>(path: string, token: string, params: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  body.set('access_token', token);
  const url = method === 'GET' ? `${GRAPH}/${path}?${body}` : `${GRAPH}/${path}`;
  const response = await fetch(url, { method, body: method === 'POST' ? body : undefined, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string; is_transient?: boolean } };
  if (!response.ok || data.error) {
    throw new ChannelError(`Meta: ${data.error?.message ?? `HTTP ${response.status}`}`, 'meta_ads', Boolean(data.error?.is_transient));
  }
  return data;
}

const OBJECTIVES: Record<AdCampaignPayload['objective'], string> = {
  leads: 'OUTCOME_LEADS', traffic: 'OUTCOME_TRAFFIC', calls: 'OUTCOME_LEADS', awareness: 'OUTCOME_AWARENESS', sales: 'OUTCOME_SALES',
};

function requireAccount(credentials: Credentials): string {
  const id = credentials.externalAccountId;
  if (!id) throw new ChannelError('Meta: ad account id is not set on the connection', 'meta_ads');
  return id.startsWith('act_') ? id : `act_${id}`;
}

export function metaAdAdapter(credentials: Credentials, pageId: string | null): AdAdapter {
  const token = credentials.accessToken;
  return {
    platform: 'meta_ads',
    async publish({ campaign, variants, attemptKey }) {
      const account = requireAccount(credentials);
      if (!pageId) throw new ChannelError('Meta: connect the Facebook Page first (ads run from the Page)', 'meta_ads');
      const created = await graph<{ id: string }>(`${account}/campaigns`, token, {
        name: `${campaign.name} [${attemptKey.slice(0, 8)}]`, objective: OBJECTIVES[campaign.objective], status: 'PAUSED', special_ad_categories: [],
      });
      const adset = await graph<{ id: string }>(`${account}/adsets`, token, {
        name: `${campaign.name} · ${campaign.radiusMiles}mi`, campaign_id: created.id, status: 'PAUSED',
        daily_budget: campaign.dailyBudgetCents, billing_event: 'IMPRESSIONS', optimization_goal: campaign.objective === 'traffic' ? 'LINK_CLICKS' : 'LEAD_GENERATION',
        start_time: `${campaign.startsOn}T08:00:00-0400`, end_time: `${campaign.endsOn}T23:00:00-0400`,
        targeting: { geo_locations: { custom_locations: [{ latitude: campaign.latitude, longitude: campaign.longitude, radius: Math.round((campaign.radiusMiles * METERS_PER_MILE) / 1000), distance_unit: 'kilometer' }] }, age_min: 21 },
        promoted_object: { page_id: pageId },
      });
      const ids: Record<string, string> = { campaign: created.id, adset: adset.id };
      for (const variant of variants) {
        const creative = await graph<{ id: string }>(`${account}/adcreatives`, token, {
          name: variant.headline,
          object_story_spec: { page_id: pageId, link_data: { link: variant.landingUrl, message: variant.primaryText, name: variant.headline, description: variant.description ?? undefined, picture: variant.imageUrl, call_to_action: { type: variant.cta, value: { link: variant.landingUrl } } } },
          degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } } },
        });
        const ad = await graph<{ id: string }>(`${account}/ads`, token, { name: variant.headline, adset_id: adset.id, creative: { creative_id: creative.id }, status: 'PAUSED' });
        ids[`ad:${variant.variantId}`] = ad.id;
      }
      return { externalIds: ids, statusOnPlatform: 'PAUSED', simulated: false, requestPreview: { account, campaign, variants: variants.map((v) => v.variantId) } };
    },
    async setStatus(externalIds, status) {
      for (const [key, id] of Object.entries(externalIds)) {
        if (key === 'campaign' || key === 'adset' || key.startsWith('ad:')) await graph(id, token, { status });
      }
    },
    async insights(externalIds, date): Promise<DailyMetrics | null> {
      if (!externalIds.campaign) return null;
      const data = await graph<{ data?: { impressions?: string; clicks?: string; spend?: string; actions?: { action_type: string; value: string }[] }[] }>(
        `${externalIds.campaign}/insights`, token, { fields: 'impressions,clicks,spend,actions', time_range: { since: date, until: date } }, 'GET',
      );
      const row = data.data?.[0];
      if (!row) return { date, impressions: 0, clicks: 0, spendCents: 0, leads: 0, conversions: 0, conversionValueCents: 0 };
      const leads = Number(row.actions?.find((a) => a.action_type === 'lead')?.value ?? 0);
      return { date, impressions: Number(row.impressions ?? 0), clicks: Number(row.clicks ?? 0), spendCents: Math.round(Number(row.spend ?? 0) * 100), leads, conversions: 0, conversionValueCents: 0 };
    },
  };
}

export function facebookPostAdapter(credentials: Credentials): PostAdapter {
  return {
    platform: 'facebook',
    async publish(request) {
      const pageId = credentials.externalAccountId;
      if (!pageId) throw new ChannelError('Facebook: Page id is not set on the connection', 'facebook');
      const tenMinutes = Date.now() + 11 * 60_000;
      const scheduled = request.scheduledFor && request.scheduledFor.getTime() > tenMinutes ? Math.floor(request.scheduledFor.getTime() / 1000) : null;
      const message = request.linkUrl ? `${request.caption}\n\n${request.linkUrl}` : request.caption;
      const params = request.imageUrl ? { url: request.imageUrl, caption: message } : { message, link: request.linkUrl ?? undefined };
      const data = await graph<{ id?: string; post_id?: string }>(`${pageId}/${request.imageUrl ? 'photos' : 'feed'}`, credentials.accessToken, {
        ...params, ...(scheduled ? { published: false, scheduled_publish_time: scheduled } : {}),
      });
      return { externalId: data.post_id ?? data.id ?? null, permalink: null, status: scheduled ? 'scheduled' : 'published', simulated: false, requestPreview: { pageId, scheduled } };
    },
  };
}

export function instagramPostAdapter(credentials: Credentials): PostAdapter {
  return {
    platform: 'instagram',
    async publish(request) {
      const userId = credentials.externalAccountId;
      if (!userId) throw new ChannelError('Instagram: IG user id is not set on the connection', 'instagram');
      if (!request.imageUrl) throw new ChannelError('Instagram posts need an image', 'instagram');
      const container = await graph<{ id: string }>(`${userId}/media`, credentials.accessToken, { image_url: request.imageUrl, caption: request.caption });
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const status = await graph<{ status_code?: string }>(container.id, credentials.accessToken, { fields: 'status_code' }, 'GET');
        if (status.status_code === 'FINISHED') break;
        if (status.status_code === 'ERROR') throw new ChannelError('Instagram rejected the media', 'instagram');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      const published = await graph<{ id: string }>(`${userId}/media_publish`, credentials.accessToken, { creation_id: container.id });
      return { externalId: published.id, permalink: null, status: 'published', simulated: false, requestPreview: { userId, container: container.id } };
    },
  };
}
