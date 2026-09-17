/** CSV rendering for admin exports and report feeds. Cells are formula-neutralised. */

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: readonly string[], rows: readonly Record<string, unknown>[]): string {
  return [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(','))].join('\r\n');
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Cents → plain dollars for spreadsheet columns. */
export const dollars = (cents: number): string => (Math.round(cents) / 100).toFixed(2);
