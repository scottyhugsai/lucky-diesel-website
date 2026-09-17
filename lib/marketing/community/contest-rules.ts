/**
 * Official-rules generator and checks for giveaways and build-of-the-month.
 * Output is a starting template, not legal advice; the owner has counsel review it.
 */

export interface ContestParams {
  title: string;
  sponsor: string;
  sponsorAddress: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  eligibility: string; // e.g. "legal US residents 18+"
  howToEnter: string;
  prize: string;
  prizeValueCents: number;
  winnerSelection: 'vote' | 'random' | 'judged';
  winnerNotice: string; // e.g. "within 7 days of the end date"
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateContest(p: ContestParams): string[] {
  const issues: string[] = [];
  if (p.title.trim().length < 3) issues.push('Add a contest name.');
  if (p.sponsor.trim().length < 2) issues.push('Add the sponsor name.');
  if (p.sponsorAddress.trim().length < 8) issues.push('Add the sponsor address.');
  if (!DATE.test(p.startDate) || !DATE.test(p.endDate) || p.endDate < p.startDate) issues.push('Dates are not valid.');
  if (p.prize.trim().length < 3) issues.push('Describe the prize.');
  if (!Number.isInteger(p.prizeValueCents) || p.prizeValueCents < 0) issues.push('Prize value is not valid.');
  if (p.prizeValueCents > 500_000) issues.push('Prizes over $5,000 may need registration or bonding in some states. Check with counsel.');
  if (/\b(purchase|buy|spend|order)\b/i.test(p.howToEnter) && !/no purchase/i.test(p.howToEnter)) issues.push('Entry cannot require a purchase.');
  if (/\b(share|tag|repost|like)\b/i.test(p.howToEnter)) issues.push('Don’t require shares or tags to enter (Meta rules).');
  return issues;
}

const long = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

const SELECTION: Record<ContestParams['winnerSelection'], string> = {
  vote: 'The eligible entry with the most valid votes at the end of the contest wins. One vote per person and per device; duplicate or automated votes are void. Ties are broken by earliest entry.',
  random: 'The winner is drawn at random from all eligible entries. Odds depend on the number of eligible entries received.',
  judged: 'Entries are judged by the sponsor on build quality, presentation and story (equal weight). The sponsor’s decision is final.',
};

/** Plain-text official rules with the required no-purchase and platform disclaimers. */
export function buildContestRules(p: ContestParams): string {
  const value = `$${(p.prizeValueCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return [
    `${p.title.toUpperCase()} — OFFICIAL RULES`,
    '',
    'NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE DOES NOT IMPROVE YOUR CHANCES. VOID WHERE PROHIBITED.',
    '',
    `1. Sponsor. ${p.sponsor}, ${p.sponsorAddress}.`,
    `2. Dates. Starts ${long(p.startDate)} at 12:00 a.m. ET and ends ${long(p.endDate)} at 11:59 p.m. ET.`,
    `3. Eligibility. Open to ${p.eligibility || 'legal residents of the United States who are 18 or older'}. Employees of the sponsor and their households are not eligible.`,
    `4. How to enter. ${p.howToEnter} Entry is free. Sharing, tagging or following is never required.`,
    `5. Winner selection. ${SELECTION[p.winnerSelection]}`,
    `6. Prize. ${p.prize} (approximate retail value ${value}). No cash substitute or transfer. Winner is responsible for any taxes.`,
    `7. Notification. The winner is notified ${p.winnerNotice || 'within 7 days after the contest ends'} and has 7 days to respond or an alternate is selected.`,
    '8. Vehicles. Featured trucks must be street-legal with emissions equipment in place. Entries showing emissions tampering are disqualified.',
    '9. Publicity. By entering, you allow the sponsor to share your first name, last initial, truck photos and entry on its channels, unless prohibited by law.',
    '10. Release. Entrants release the sponsor from liability arising from the contest or prize, to the extent allowed by law.',
    '11. Platforms. This promotion is in no way sponsored, endorsed, administered by or associated with Facebook, Instagram, Meta, TikTok or Google.',
    `12. Winner list. For the winner’s name, write to ${p.sponsor} at the address above within 30 days of the end date.`,
  ].join('\n');
}

/** Flags promo copy that runs a giveaway without the basics. Used for offers and posts. */
export function contestCopyIssues(copy: string): string[] {
  const isContest = /\b(giveaway|sweepstakes|contest|win a|chance to win|raffle)\b/i.test(copy);
  if (!isContest) return [];
  const issues: string[] = [];
  if (!/no purchase necessary/i.test(copy)) issues.push('Say “No purchase necessary.”');
  if (!/\brules\b/i.test(copy)) issues.push('Link the official rules.');
  if (/\braffle\b/i.test(copy)) issues.push('Paid raffles are illegal for businesses in most states.');
  if (/\b(share|tag \d|tag a friend|tag your)\b/i.test(copy)) issues.push('Don’t require shares or tags to enter.');
  return issues;
}
