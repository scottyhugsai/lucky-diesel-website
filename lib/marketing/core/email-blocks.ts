/**
 * Email block composer: validation plus HTML and plain-text rendering. Pure.
 * Product, build and dyno data is resolved by the caller and passed in.
 */

import { evaluateCondition, type ConditionFacts } from './merge';

export const BLOCK_TYPES = ['heading', 'text', 'image', 'button', 'product', 'build', 'my_dyno', 'offer', 'divider'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export interface EmailBlock {
  type: BlockType;
  text?: string;
  url?: string;
  alt?: string;
  label?: string;
  handle?: string;
  slug?: string;
  /** Optional condition, e.g. `platform=cummins` or `vip`. */
  when?: string;
}

export const MAX_BLOCKS = 20;
const TEXT_MAX = 1600;
const SHORT_MAX = 120;
const URL_MAX = 500;
const HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const SAFE_URL = /^(https:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*|\{\{\s*[a-z_]+\s*\}\})$/i;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim().length <= max ? value.trim() : null);

/** Validates blocks from the browser. Unknown keys are dropped. */
export function parseBlocks(raw: unknown): Parsed<EmailBlock[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'Blocks are not valid.' };
  if (raw.length > MAX_BLOCKS) return { ok: false, error: `At most ${MAX_BLOCKS} blocks.` };
  const blocks: EmailBlock[] = [];
  for (const item of raw) {
    const b = (item ?? {}) as Record<string, unknown>;
    const type = BLOCK_TYPES.find((t) => t === b.type);
    if (!type) return { ok: false, error: 'Unknown block type.' };
    const when = text(b.when ?? '', 80);
    if (when === null) return { ok: false, error: 'Block condition is too long.' };
    const block: EmailBlock = { type, ...(when ? { when } : {}) };
    if (type === 'heading' || type === 'text') {
      const value = text(b.text, type === 'heading' ? SHORT_MAX : TEXT_MAX);
      if (!value) return { ok: false, error: `A ${type} block is empty or too long.` };
      block.text = value;
    }
    if (type === 'image' || type === 'button') {
      const url = text(b.url, URL_MAX);
      if (!url || !SAFE_URL.test(url)) return { ok: false, error: `${type === 'image' ? 'Image' : 'Button'} links must start with https:// or /.` };
      if (type === 'image' && !url.startsWith('https://')) return { ok: false, error: 'Images need a full https:// address.' };
      block.url = url;
    }
    if (type === 'image') {
      const alt = text(b.alt ?? '', SHORT_MAX);
      if (alt === null) return { ok: false, error: 'Alt text is too long.' };
      block.alt = alt;
    }
    if (type === 'button') {
      const label = text(b.label, 40);
      if (!label) return { ok: false, error: 'Buttons need a label (max 40).' };
      block.label = label;
    }
    if (type === 'product') {
      const handle = text(b.handle, 100)?.toLowerCase();
      if (!handle || !HANDLE.test(handle)) return { ok: false, error: 'Pick a product.' };
      block.handle = handle;
    }
    if (type === 'build') {
      const slug = text(b.slug, 100)?.toLowerCase();
      if (!slug || !HANDLE.test(slug)) return { ok: false, error: 'Pick a build.' };
      block.slug = slug;
    }
    blocks.push(block);
  }
  return { ok: true, value: blocks };
}

/** Handles and slugs a set of blocks needs resolved before rendering. */
export function blockRefs(blocks: readonly EmailBlock[]): { handles: string[]; slugs: string[]; needsDyno: boolean } {
  return {
    handles: [...new Set(blocks.filter((b) => b.type === 'product' && b.handle).map((b) => b.handle!))],
    slugs: [...new Set(blocks.filter((b) => b.type === 'build' && b.slug).map((b) => b.slug!))],
    needsDyno: blocks.some((b) => b.type === 'my_dyno'),
  };
}

/** All copy in the blocks, for claims and spam checks. */
export function blocksText(blocks: readonly EmailBlock[]): string {
  return blocks.map((b) => [b.text, b.label, b.alt].filter(Boolean).join(' ')).filter(Boolean).join('\n');
}

export interface ProductCard { title: string; priceCents: number; image: string | null; url: string }
export interface BuildCard { title: string; vehicle: string; image: string | null; url: string; beforeHp: number | null; afterHp: number | null; beforeTq: number | null; afterTq: number | null }
export interface DynoCard { label: string; beforeHp: number | null; afterHp: number | null; beforeTq: number | null; afterTq: number | null }

export interface RenderContext {
  /** Fills conditionals and {{placeholders}} in block copy. */
  fill: (value: string) => string;
  facts: ConditionFacts;
  siteUrl: string;
  products: ReadonlyMap<string, ProductCard>;
  builds: ReadonlyMap<string, BuildCard>;
  dyno: DynoCard | null;
  offerCode: string | null;
  /** 1×1 open-tracking pixel, if any. */
  openPixelUrl?: string | null;
}

const ACCENT = '#3fbf6f';
const INK = '#16181b';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function absolute(url: string, siteUrl: string): string {
  return url.startsWith('/') ? `${siteUrl}${url}` : url;
}

function safeHref(url: string): string | null {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

function paragraphs(value: string): string {
  return value.split(/\n{2,}/).map((para) => {
    const linked = escapeHtml(para).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:${ACCENT}">${url}</a>`);
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55">${linked.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;

function gain(before: number | null, after: number | null, unit: string): string | null {
  if (!after) return null;
  return before ? `${before} → ${after} ${unit} (+${after - before})` : `${after} ${unit}`;
}

function button(label: string, href: string): string {
  return `<p style="margin:0 0 20px"><a href="${escapeHtml(href)}" style="display:inline-block;background:${ACCENT};color:${INK};font-weight:700;text-decoration:none;padding:12px 20px;border-radius:4px">${escapeHtml(label)}</a></p>`;
}

interface Rendered { html: string; text: string }

function renderBlock(block: EmailBlock, ctx: RenderContext): Rendered | null {
  if (block.when && !evaluateCondition(block.when, ctx.facts)) return null;
  switch (block.type) {
    case 'heading': {
      const value = ctx.fill(block.text ?? '');
      return value ? { html: `<h2 style="margin:8px 0 12px;font-size:22px;line-height:1.25">${escapeHtml(value)}</h2>`, text: value.toUpperCase() } : null;
    }
    case 'text': {
      const value = ctx.fill(block.text ?? '');
      return value ? { html: paragraphs(value), text: value } : null;
    }
    case 'image': {
      const src = safeHref(block.url ?? '');
      return src ? { html: `<p style="margin:0 0 16px"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt ?? '')}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:4px"></p>`, text: block.alt ? `[${block.alt}]` : '' } : null;
    }
    case 'button': {
      const href = safeHref(absolute(ctx.fill(block.url ?? ''), ctx.siteUrl));
      return href ? { html: button(block.label ?? 'Learn more', href), text: `${block.label}: ${href}` } : null;
    }
    case 'product': {
      const product = block.handle ? ctx.products.get(block.handle) : undefined;
      if (!product) return null;
      const image = product.image && safeHref(product.image) ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" width="160" style="display:block;width:160px;height:auto;border:0;border-radius:4px">` : '';
      return {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #d9dde1;border-radius:4px"><tr>${image ? `<td width="176" style="padding:12px">${image}</td>` : ''}<td style="padding:12px;vertical-align:top"><p style="margin:0 0 6px;font-weight:700;font-size:16px">${escapeHtml(product.title)}</p><p style="margin:0 0 12px;color:#555">From ${money(product.priceCents)}</p><a href="${escapeHtml(product.url)}" style="color:${ACCENT};font-weight:700">Shop now</a></td></tr></table>`,
        text: `${product.title} — from ${money(product.priceCents)}: ${product.url}`,
      };
    }
    case 'build': {
      const build = block.slug ? ctx.builds.get(block.slug) : undefined;
      if (!build) return null;
      const stats = [gain(build.beforeHp, build.afterHp, 'hp'), gain(build.beforeTq, build.afterTq, 'lb-ft')].filter(Boolean) as string[];
      const image = build.image && safeHref(build.image) ? `<img src="${escapeHtml(build.image)}" alt="${escapeHtml(build.title)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:4px 4px 0 0">` : '';
      return {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #d9dde1;border-radius:4px"><tr><td>${image}</td></tr><tr><td style="padding:14px"><p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#555">Build spotlight</p><p style="margin:0 0 6px;font-weight:700;font-size:18px">${escapeHtml(build.title)}</p><p style="margin:0 0 8px;color:#555">${escapeHtml(build.vehicle)}</p>${stats.map((s) => `<p style="margin:0 0 4px;font-weight:700">${escapeHtml(s)}</p>`).join('')}<p style="margin:10px 0 0"><a href="${escapeHtml(build.url)}" style="color:${ACCENT};font-weight:700">See the build</a></p></td></tr></table>`,
        text: [`BUILD SPOTLIGHT: ${build.title} (${build.vehicle})`, ...stats, build.url].join('\n'),
      };
    }
    case 'my_dyno': {
      const dyno = ctx.dyno;
      const stats = dyno ? ([gain(dyno.beforeHp, dyno.afterHp, 'hp'), gain(dyno.beforeTq, dyno.afterTq, 'lb-ft')].filter(Boolean) as string[]) : [];
      if (!dyno || !stats.length) return null;
      return {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${INK};color:#fff;border-radius:4px"><tr><td style="padding:16px"><p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${ACCENT}">Your truck on our dyno</p><p style="margin:0 0 8px;font-weight:700">${escapeHtml(dyno.label)}</p>${stats.map((s) => `<p style="margin:0 0 4px;font-size:18px;font-weight:700">${escapeHtml(s)}</p>`).join('')}</td></tr></table>`,
        text: [`YOUR TRUCK ON OUR DYNO: ${dyno.label}`, ...stats].join('\n'),
      };
    }
    case 'offer': {
      if (!ctx.offerCode) return null;
      return {
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:2px dashed ${ACCENT};border-radius:4px"><tr><td style="padding:16px;text-align:center"><p style="margin:0 0 4px;color:#555">Use code</p><p style="margin:0;font-size:24px;font-weight:800;letter-spacing:2px">${escapeHtml(ctx.offerCode)}</p></td></tr></table>`,
        text: `Use code ${ctx.offerCode}`,
      };
    }
    case 'divider':
      return { html: '<hr style="border:0;border-top:1px solid #d9dde1;margin:8px 0 20px">', text: '—' };
    default:
      return null;
  }
}

/** HTML plus the plain-text part. `intro` is the already-filled email body. */
export function renderEmail(intro: string, blocks: readonly EmailBlock[], ctx: RenderContext): Rendered {
  const parts = blocks.map((block) => renderBlock(block, ctx)).filter((part): part is Rendered => part !== null);
  const text = [intro, ...parts.map((p) => p.text)].filter(Boolean).join('\n\n');
  const pixel = ctx.openPixelUrl && safeHref(ctx.openPixelUrl) ? `<img src="${escapeHtml(ctx.openPixelUrl)}" width="1" height="1" alt="" style="display:block;border:0">` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f5"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:6px;font-family:Arial,Helvetica,sans-serif;color:${INK}"><tr><td style="padding:28px 24px">${intro ? paragraphs(intro) : ''}${parts.map((p) => p.html).join('')}<!--footer--></td></tr></table></td></tr></table>${pixel}</body></html>`;
  return { html, text };
}

/** Puts the compliance footer inside the email card. */
export function withHtmlFooter(html: string, footerText: string): string {
  const footer = `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #d9dde1;font-size:12px;line-height:1.5;color:#666">${footerText.split('\n').map((line) => escapeHtml(line).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#666">${url}</a>`)).join('<br>')}</div>`;
  return html.includes('<!--footer-->') ? html.replace('<!--footer-->', footer) : html.replace('</body>', `${footer}</body>`);
}
