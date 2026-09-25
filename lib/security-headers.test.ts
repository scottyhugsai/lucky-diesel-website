import { describe, expect, test } from 'vitest';
import { STATIC_SECURITY_HEADERS, contentSecurityPolicy } from './security-headers';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((part) => part.startsWith(`${name} `) || part === name) ?? '';

describe('the content security policy', () => {
  const prod = contentSecurityPolicy('abc123', false);

  test('carries the request nonce and lets it cover the chunks it loads', () => {
    expect(directive(prod, 'script-src')).toContain("'nonce-abc123'");
    expect(directive(prod, 'script-src')).toContain("'strict-dynamic'");
  });

  // The whole point: an injected <script> must not run even if markup escapes.
  test('never allows inline or arbitrary scripts in production', () => {
    expect(directive(prod, 'script-src')).not.toContain("'unsafe-inline'");
    expect(directive(prod, 'script-src')).not.toContain("'unsafe-eval'");
  });

  test("the bundler's eval is development only", () => {
    expect(contentSecurityPolicy('n', true)).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
  });

  test('refuses to be framed, which is what protects a signed-in portal', () => {
    expect(directive(prod, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(STATIC_SECURITY_HEADERS.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
  });

  test('pins where a form may post and what the base URL may be', () => {
    expect(directive(prod, 'form-action')).toBe("form-action 'self'");
    expect(directive(prod, 'base-uri')).toBe("base-uri 'self'");
  });

  test('allows the image hosts the catalogue actually uses, and no others', () => {
    const img = directive(prod, 'img-src');
    expect(img).toContain('https://cdn.shopify.com');
    expect(img).toContain('https://*.supabase.co');
    expect(img).not.toContain('https:;');
    expect(img).not.toMatch(/\*[^.]/);
  });

  test('a fresh nonce produces a different policy every request', () => {
    expect(contentSecurityPolicy('one', false)).not.toBe(contentSecurityPolicy('two', false));
  });
});

describe('the static headers', () => {
  test('sets HSTS for a year, including subdomains', () => {
    const hsts = STATIC_SECURITY_HEADERS.find((h) => h.key === 'Strict-Transport-Security')?.value ?? '';
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  test('turns off the device APIs the site never asks for', () => {
    const permissions = STATIC_SECURITY_HEADERS.find((h) => h.key === 'Permissions-Policy')?.value ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(permissions, feature).toContain(`${feature}=()`);
    }
  });

  test('every header has a name and a value', () => {
    for (const header of STATIC_SECURITY_HEADERS) {
      expect(header.key.length).toBeGreaterThan(3);
      expect(header.value.length).toBeGreaterThan(3);
    }
  });
});
