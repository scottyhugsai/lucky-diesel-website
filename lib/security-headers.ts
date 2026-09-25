/**
 * The headers a browser needs to defend this site, in one place.
 *
 * Static ones are set in `next.config.ts` so they also cover API routes and
 * static files, which the proxy does not match. The CSP is built here because
 * it carries a per-request nonce and has to be set by the proxy.
 */

/** Frozen, not per-request: safe to apply everywhere including /api. */
export const STATIC_SECURITY_HEADERS = [
  // A year, with subdomains, and preload-eligible. Only ever sent over HTTPS,
  // so it is inert on localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Belt and braces with the CSP's frame-ancestors, for anything that predates it.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The site asks for none of these; saying so stops an embedded third party asking.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
] as const;

/**
 * Sources the browser is allowed to load from.
 *
 * `strict-dynamic` means a nonce on the bootstrap script covers every chunk it
 * goes on to load, so Next's hashed filenames need no allowlist and an injected
 * `<script src>` still cannot run.
 *
 * `style-src` keeps `unsafe-inline`: Next and Tailwind both inject style tags
 * during hydration and there is no nonce path for them. Inline *styles* are a
 * far weaker vector than inline scripts, which this does block.
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    // `unsafe-eval` is the dev bundler's hot reload only; it never ships.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    // Product photography comes from Shopify's CDN and the owner's own uploads.
    `img-src 'self' data: blob: https://cdn.shopify.com https://luckydiesel.com https://*.supabase.co`,
    `font-src 'self' data:`,
    // Supabase for data and auth; ws: is the dev bundler's reload socket.
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? ' ws://localhost:* http://localhost:*' : ''}`,
    `media-src 'self'`,
    // Nothing on this site embeds anything, and nothing may embed it.
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    // Stops a form on a compromised page posting credentials elsewhere.
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ];
  return directives.map((directive) => directive.replace(/\s+/g, ' ').trim()).join('; ');
}
