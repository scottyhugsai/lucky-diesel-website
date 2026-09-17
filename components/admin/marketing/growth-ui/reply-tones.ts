/* Tone presets for review replies. Every preset must pass checkReplyText: no offers, no job details. */

export const REPLY_TONES = ['warm', 'brief', 'formal'] as const;
export type ReplyTone = (typeof REPLY_TONES)[number];

export const TONE_LABELS: Record<ReplyTone, string> = { warm: 'Warm', brief: 'Brief', formal: 'Formal' };

const SHOP_PHONE = '(843) 995-9252';

function first(author: string): string {
  const cleaned = author.replace(/^Sample\s*[—-]\s*/i, '').trim();
  return cleaned.split(/\s+/)[0] || 'there';
}

export function toneReply(tone: ReplyTone, rating: number, author: string): string {
  const name = first(author);
  const happy = rating >= 4;
  if (tone === 'brief') {
    return happy ? `Thanks, ${name}. Glad the truck is running right.` : `${name}, sorry we missed the mark. Please call ${SHOP_PHONE} so we can fix it.`;
  }
  if (tone === 'formal') {
    return happy
      ? `Thank you for the review, ${name}. We appreciate your trust in our team and look forward to seeing you again.`
      : `${name}, thank you for your feedback. We apologize for your experience. Please contact the owner at ${SHOP_PHONE} so we can resolve it.`;
  }
  return happy
    ? `${name}, thanks for trusting us with your truck. Reviews like this keep the shop going. See you next time.`
    : `${name}, I’m sorry we let you down. That’s not the shop we want to be. Call me at ${SHOP_PHONE} and we’ll make it right.`;
}
