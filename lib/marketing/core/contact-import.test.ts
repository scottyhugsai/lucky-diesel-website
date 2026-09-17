import { describe, expect, test } from 'vitest';
import { buildImportRows, guessMapping, parseCsv, parseMapping } from './contact-import';

describe('parseCsv', () => {
  test('quotes, doubled quotes, CRLF, BOM and blank lines', () => {
    const text = '﻿Name,Email,Notes\r\n"Doe, Jim",jim@x.com,"said ""hi"""\r\n\r\nSue,sue@y.com,"line1\nline2"\n';
    expect(parseCsv(text)).toEqual([
      ['Name', 'Email', 'Notes'],
      ['Doe, Jim', 'jim@x.com', 'said "hi"'],
      ['Sue', 'sue@y.com', 'line1\nline2'],
    ]);
  });
  test('stops at the row cap', () => {
    expect(parseCsv('a\nb\nc\nd', 2)).toHaveLength(2);
  });
});

describe('guessMapping / parseMapping', () => {
  test('guesses common export headers', () => {
    expect(guessMapping(['First Name', 'Last Name', 'Email Address', 'Mobile Phone', 'Accepts Email Marketing', 'Tags'])).toEqual({
      first_name: 0, last_name: 1, email: 2, phone: 3, email_consent: 4, tags: 5,
    });
  });
  test('drops unknown fields and out-of-range columns', () => {
    expect(parseMapping({ email: 1, phone: 9, sql: 0, full_name: -1 }, 3)).toEqual({ email: 1 });
  });
});

describe('buildImportRows', () => {
  const rows = [
    ['Name', 'Email', 'Phone', 'Opt in', 'Tags'],
    ['Jim Doe', 'JIM@x.com', '843-555-0142', 'yes', 'boat, tows, <bad>'],
    ['No Reach', '', '', 'yes', ''],
    ['Sue', 'sue@gmial.com', '12', 'no', ''],
    ['Jim Again', 'jim@x.com', '', 'yes', ''],
    ['', 'nobody@x.com', '', '', ''],
  ];
  const mapping = { full_name: 0, email: 1, phone: 2, email_consent: 3, tags: 4 };

  test('validates, dedupes and maps consent from a column', () => {
    const result = buildImportRows(rows, mapping, 'column');
    expect(result.rows).toEqual([
      { line: 2, fullName: 'Jim Doe', email: 'jim@x.com', phone: '(843) 555-0142', tags: ['boat', 'tows'], emailOptIn: true },
      { line: 4, fullName: 'Sue', email: 'sue@gmial.com', phone: null, tags: [], emailOptIn: false },
    ]);
    expect(result.issues.map((i) => i.reason)).toEqual([
      'Skipped: no email or phone',
      'Check email: sue@gmial.com (did you mean sue@gmail.com?)',
      'Bad phone “12”',
      'Skipped: duplicate in file',
      'Skipped: no name',
    ]);
  });

  test('basis none never opts anyone in', () => {
    expect(buildImportRows(rows, mapping, 'none').rows.every((r) => !r.emailOptIn)).toBe(true);
    expect(buildImportRows(rows, mapping, 'all').rows.every((r) => r.emailOptIn === Boolean(r.email))).toBe(true);
  });
});
