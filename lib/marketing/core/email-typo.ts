/* Email syntax and common domain typos. Pure and client-safe. */

export const EMAIL_SYNTAX = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com', 'me.com',
  'comcast.net', 'att.net', 'bellsouth.net', 'sbcglobal.net', 'verizon.net', 'charter.net', 'ymail.com', 'protonmail.com',
];
/** Real domains one edit away from a common one; never "corrected". */
const LOOKALIKES = new Set(['mail.com', 'mac.com', 'live.co', 'gmx.com', 'email.com', 'att.com', 'me.co']);
const TLD_TYPOS: Record<string, string> = { con: 'com', cmo: 'com', ocm: 'com', comm: 'com', cim: 'com', vom: 'com', xom: 'com', nte: 'net', ner: 'net', ent: 'net' };

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = prev[j]!;
      const swap = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : swap));
      diagonal = above;
    }
  }
  return prev[b.length]!;
}

/** "jim@gmial.com" → "jim@gmail.com". Null when nothing looks wrong. */
export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || COMMON_DOMAINS.includes(domain) || LOOKALIKES.has(domain)) return null;
  const parts = domain.split('.');
  const tld = parts[parts.length - 1]!;
  if (TLD_TYPOS[tld]) {
    const fixed = [...parts.slice(0, -1), TLD_TYPOS[tld]].join('.');
    return `${local}@${fixed}`;
  }
  const best = COMMON_DOMAINS.map((d) => ({ d, n: distance(domain, d) })).sort((x, y) => x.n - y.n)[0]!;
  return best.n > 0 && best.n <= (domain.length > 8 ? 2 : 1) ? `${local}@${best.d}` : null;
}
