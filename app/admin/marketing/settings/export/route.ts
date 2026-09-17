import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const MAX_ROWS = 10_000;

/** Neutralises spreadsheet formulas and quotes a CSV cell. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: Record<string, unknown>[]): string {
  return [headers.map(cell).join(','), ...rows.map((row) => headers.map((h) => cell(row[h])).join(','))].join('\r\n');
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== 'admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const kind = request.nextUrl.searchParams.get('kind');
  if (kind !== 'contacts' && kind !== 'consent') return NextResponse.json({ error: 'Unknown export' }, { status: 400 });

  const supabase = await createClient();
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'contacts') {
    const headers = ['id', 'full_name', 'email', 'phone', 'lifecycle_stage', 'lead_score', 'tags', 'source', 'first_touch_source', 'email_marketing_status', 'sms_marketing_consent_at', 'sms_marketing_opted_out_at', 'sms_opted_out_at', 'is_fleet', 'created_at'];
    const { data, error } = await supabase.from('customers').select(headers.join(', ')).order('created_at').limit(MAX_ROWS);
    if (error) return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    return new NextResponse(csv(headers, (data ?? []) as unknown as Record<string, unknown>[]), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lucky-diesel-contacts-${stamp}.csv"`, 'Cache-Control': 'no-store' },
    });
  }
  const headers = ['created_at', 'customer_id', 'channel', 'purpose', 'action', 'method', 'address', 'consent_text_version', 'evidence'];
  const { data, error } = await supabase.from('contact_consent_events').select(headers.join(', ')).order('created_at').limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ ...r, evidence: JSON.stringify(r.evidence ?? {}) }));
  return new NextResponse(csv(headers, rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lucky-diesel-consent-${stamp}.csv"`, 'Cache-Control': 'no-store' },
  });
}
