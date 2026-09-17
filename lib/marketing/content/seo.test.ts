import { describe, expect, test } from 'vitest';
import { auditNap, draftBuildPage, draftJobBlogPost, draftServiceFaq, faqSchema, jsonLd, reviewSchema, slugify } from './seo';

const build = { id: 'b', slug: 'x', title: 'Purple-piped L5P', vehicleLabel: 'GMC Sierra 2500HD', platform: 'duramax', beforeHp: 445, afterHp: 548, beforeTorque: 910, afterTorque: 1105, parts: ['Intake pipes'], image: null, isSample: false };

describe('SEO drafts', () => {
  test('build page uses real numbers, a clean slug and a short meta description', () => {
    const draft = draftBuildPage(build, null);
    expect(draft.slug).toBe('purple-piped-l5p-gmc-sierra-2500hd');
    expect(draft.body.map((s) => s.text).join(' ')).toContain('445 → 548 hp');
    expect(draft.metaDescription.length).toBeLessThanOrEqual(160);
    expect(draft.compliance.status).not.toBe('block');
  });

  test('blog drafts strip phone numbers from the complaint', () => {
    const draft = draftJobBlogPost({ title: 'Turbo replacement', platform: 'powerstroke', vehicleLabel: '2019 F-250', lines: ['Turbocharger'], complaint: 'Whistle at 2k rpm, call me 843-555-0101' });
    expect(draft.body[0]!.text).not.toMatch(/555/);
  });

  test('FAQ never produces blocked language even when discussing emissions', () => {
    expect(draftServiceFaq().compliance.status).not.toBe('block');
    expect(slugify('  Hello, World!! ')).toBe('hello-world');
  });
});

describe('NAP audit and schema', () => {
  test('flags mismatched phone and website, ignores formatting', () => {
    expect(auditNap({ name: 'Lucky Diesel', phone: '+1 843-995-9252', website: 'https://www.luckydiesel.com/' }).consistent).toBe(true);
    expect(auditNap({ name: 'Lucky Diesel LLC', phone: '843-000-0000', website: 'https://luckydiesel.com' }).mismatches).toEqual(['name', 'phone']);
  });

  test('review schema only includes real reviews; json-ld is script-safe', () => {
    expect(reviewSchema([{ author: 'A', rating: 5, body: 'x', source: 'sample', reviewedAt: '2026-09-01' }])).toBeNull();
    const schema = reviewSchema([{ author: 'A', rating: 5, body: '</script><b>', source: 'google', reviewedAt: '2026-09-01T00:00:00Z' }]);
    expect(schema).not.toBeNull();
    expect(jsonLd(schema!)).not.toContain('</script>');
    expect(faqSchema([])).toBeNull();
    expect(faqSchema([{ q: 'Q', a: 'A' }])).toMatchObject({ '@type': 'FAQPage' });
  });
});
