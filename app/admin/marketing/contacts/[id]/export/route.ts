import { NextResponse, type NextRequest } from 'next/server';
import { UUID_RE } from '@/components/admin/core/parse';
import { getViewer } from '@/lib/auth';
import { buildContactExport, loadConsentProof } from '@/lib/marketing/core/contact-privacy';
import { createAdminClient } from '@/lib/supabase/admin';

/** Neutralises spreadsheet formulas and quotes a CSV cell. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.map(cell).join(','), ...rows.map((row) => headers.map((h) => cell(row[h])).join(','))].join('\r\n');
}

const slug = (name: string) => (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contact').slice(0, 40);

/**
 * One person's data, for a data-access request (`kind=data`) or a consent-proof
 * packet for one address (`kind=consent`). Admin only; never cached.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== 'admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Unknown contact' }, { status: 400 });
  const kind = request.nextUrl.searchParams.get('kind') ?? 'data';
  if (kind !== 'data' && kind !== 'consent') return NextResponse.json({ error: 'Unknown export' }, { status: 400 });

  const db = createAdminClient();
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === 'consent') {
    const proof = await loadConsentProof(db, id);
    if (!proof) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const headers = ['created_at', 'channel', 'purpose', 'action', 'method', 'address', 'consent_text_version', 'source_url', 'ip', 'user_agent', 'evidence'];
    const rows = proof.events.map((e) => {
      const evidence = (e.evidence ?? {}) as Record<string, unknown>;
      return {
        created_at: e.created_at, channel: e.channel, purpose: e.purpose, action: e.action, method: e.method,
        address: e.address, consent_text_version: e.consent_text_version,
        source_url: evidence.url ?? evidence.source_url ?? '', ip: evidence.ip ?? '', user_agent: evidence.user_agent ?? '',
        evidence: JSON.stringify(evidence),
      };
    });
    const suppressed = proof.suppressions.map((s) => `${s.channel}:${s.address} (${s.reason ?? 'no reason'}, ${s.created_at})`);
    const body = [
      csv(headers, rows),
      '',
      csv(['contact', 'addresses', 'suppressions', 'generated_at'], [{
        contact: proof.customer.full_name, addresses: proof.addresses, suppressions: suppressed, generated_at: new Date().toISOString(),
      }]),
    ].join('\r\n');
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="consent-proof-${slug(proof.customer.full_name)}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const data = await buildContactExport(db, id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const name = slug(String((data.customer as { full_name?: string }).full_name ?? ''));
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="contact-data-${name}-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
