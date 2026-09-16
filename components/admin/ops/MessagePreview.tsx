import { smsSegments } from '@/lib/messaging/template';

/** Phone-style SMS bubble preview. */
export function SmsPreview({ body }: { body: string }) {
  const segments = body ? smsSegments(body) : 0;
  return (
    <div className="mx-auto w-full max-w-[18rem] rounded-[2rem] border-[6px] border-gunmetal bg-black p-3 shadow-2xl">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-gunmetal" aria-hidden="true" />
      <p className="text-center text-[0.65rem] font-semibold text-steel">Lucky Diesel · Text Message</p>
      <div className="mt-3 min-h-28">
        {body ? (
          <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-[#2a2d2c] px-3 py-2 text-[0.8rem] leading-snug text-chalk">{body}</p>
        ) : (
          <p className="text-center text-xs text-steel">Nothing to send</p>
        )}
      </div>
      <p className={`mt-3 text-center text-[0.65rem] font-semibold ${segments > 2 ? 'text-amber-300' : 'text-steel'}`}>
        {body.length} chars · {segments} segment{segments === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/** Email client card preview. */
export function EmailPreview({ subject, body, to }: { subject: string; body: string; to: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-chalk text-carbon shadow-2xl">
      <div className="border-b border-carbon/10 bg-[#e3e8e4] px-4 py-3 text-xs">
        <p><span className="text-carbon/50">From</span> Lucky Diesel &lt;service@luckydiesel.com&gt;</p>
        <p><span className="text-carbon/50">To</span> {to}</p>
        <p className="mt-1.5 text-sm font-bold">{subject || '(no subject)'}</p>
      </div>
      <p className="min-h-32 whitespace-pre-wrap break-words px-4 py-4 text-sm leading-relaxed">{body || 'Nothing to send'}</p>
    </div>
  );
}
