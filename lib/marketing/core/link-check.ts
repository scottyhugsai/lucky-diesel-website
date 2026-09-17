import 'server-only';
import { isIP } from 'node:net';

const TIMEOUT_MS = 4000;
const MAX_URLS = 10;

/** Only public https/http hosts are fetched; internal names and IP literals are skipped. */
function checkable(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    if (isIP(host.replace(/^\[|\]$/g, '')) || host === 'localhost' || !host.includes('.') || /\.(?:local|internal|localhost|lan|home)$/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

async function probe(url: URL): Promise<boolean> {
  const attempt = (method: 'HEAD' | 'GET') => fetch(url, { method, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'LuckyDieselLinkCheck/1.0' } });
  try {
    let response = await attempt('HEAD');
    if (response.status === 405 || response.status === 403) response = await attempt('GET');
    return response.status < 400;
  } catch {
    return false;
  }
}

/** Returns the links that look broken (4xx/5xx, DNS failure or timeout). */
export async function findBrokenLinks(urls: readonly string[]): Promise<string[]> {
  const targets = [...new Set(urls)].slice(0, MAX_URLS).map((raw) => ({ raw, url: checkable(raw) })).filter((t): t is { raw: string; url: URL } => t.url !== null);
  const results = await Promise.all(targets.map(async (t) => ((await probe(t.url)) ? null : t.raw)));
  return results.filter((r): r is string => r !== null);
}
