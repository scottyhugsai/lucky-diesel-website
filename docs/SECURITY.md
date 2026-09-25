# Security

What protects customer data here, what the rules are, and what is still owed.

## What actually protects the data

**Row-level security, with 50 tests.** Every table enforces at the database
which rows an identity may read. This is the thing that matters: even a leaked
public key cannot pull another customer's jobs, invoices or messages. It is
worth more than everything else on this page combined, and any change that
weakens it is the change to refuse.

**Auth is Supabase**, not hand-rolled. No password hashing, no session tokens
and no reset flow of our own to get wrong. Sign-in is a password or an emailed
link; the link is the recovery path.

**Every webhook verifies its signature** — Stripe, Resend and Twilio — with
constant-time comparison. Nobody can forge "payment succeeded" or a STOP.

**Headers**, in `lib/security-headers.ts`: HSTS, nosniff, `X-Frame-Options:
DENY`, a strict Referrer-Policy, a Permissions-Policy turning off device APIs
the site never asks for, and a per-request nonce CSP with `strict-dynamic`.
An injected `<script>` does not run, and no origin can frame the portals.

**Rate limits** count in Postgres (`consume_rate_limit`, migration 037), so
they hold across serverless instances. The named limits are in
`lib/marketing/core/rate-limit-policy.ts`.

**Scanning**: gitleaks, semgrep and trivy on every push; CI on every push and
pull request; Dependabot weekly.

## The admin-key rule

`createAdminClient()` uses the service role, which **bypasses RLS entirely**.
Twenty-two public surfaces use it, because a signed-out visitor still has to
see events, bio links and shop settings. On those surfaces the query itself is
the only thing standing between a visitor and the table, so:

1. **Name the columns. Never `select('*')`.** A wildcard on a public page
   publishes whatever column someone adds to that table next — which is how a
   `waiver_text` or an internal note leaks a release after it was written.
2. **Validate anything from the URL before it reaches `.eq()`.** `/refer/[code]`
   is the pattern: a regex, then a lookup, then one column.
3. **Select the narrowest thing that answers the question.** `/refer/[code]`
   reads `full_name` and renders a first name, not the customer row.
4. **Prefer the user-scoped client.** Reach for the admin key only when the
   visitor genuinely has no session.

Reviewed 2026-09-25: all twenty-two surfaces read business-public data
(events, bio links, shop settings) or narrow, validated lookups. One
`select('*')` on the public event page was replaced with named columns.

## Data retention

The site holds names, phone numbers, email addresses, vehicle details and
message history. The commitments:

| Data | Kept | Then |
| --- | --- | --- |
| Leads that never became customers | 24 months | Deleted |
| Customer records and job history | While a customer, then 7 years | Deleted, except what tax law requires |
| Unfinished quote forms (`partial_leads`) | 90 days | Deleted |
| Marketing analytics (`tracking_visitors`, attribution) | 14 months | Deleted |
| Rate-limit counters | 1 hour | Overwritten |
| Consent ledger (`contact_consent_events`) | 7 years | Kept — it is the evidence a contact opted in |
| Message and call logs | 24 months | Deleted |

**Deletion on request.** A customer may ask for their data to be removed.
`customers.anonymized_at` exists and the contact list already filters on it,
so the mechanism is there; the request path is a manual admin action today.

**Still owed** (both need the owner, and neither is code):
- The retention table above published in `/privacy` so it is a promise, not a
  note in a repo.
- An attorney's review of the privacy, SMS-consent and waiver text before
  launch.

## Before going live

- [ ] Rotate every key that has ever been pasted into a terminal or a transcript
- [ ] `DEMO_MODE=false`, `DEMO_CATALOG=false`, unset `DEMO_EMAIL_TO`, delete the demo users
- [ ] Turn on Vercel's firewall and bot filtering
- [ ] Confirm Supabase point-in-time recovery is on, and restore once to prove it
- [ ] Remove the Demo Tools from the admin
- [ ] Attorney review of waiver, SMS and privacy text
- [ ] Review who holds an admin account, and do that again quarterly
