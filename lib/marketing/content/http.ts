import 'server-only';
import { NextResponse } from 'next/server';
import { getViewer, type Viewer } from '@/lib/auth';
import type { Result } from './db';

/** Route-handler helpers for the marketing content API. */

export async function requireAdmin(): Promise<{ viewer: Viewer } | { response: NextResponse }> {
  const viewer = await getViewer();
  if (!viewer) return { response: NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 }) };
  if (viewer.profile.role !== 'admin') return { response: NextResponse.json({ ok: false, error: 'Owner only.' }, { status: 403 }) };
  return { viewer };
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

export function str(body: Record<string, unknown>, key: string, max = 200): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : null;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function reply<T>(result: Result<T>, failStatus = 422): NextResponse {
  return result.ok ? NextResponse.json({ ok: true, data: result.data }) : NextResponse.json({ ok: false, error: result.error }, { status: failStatus });
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

/** Per-instance sliding-window throttle for public endpoints. */
export function throttle(bucket: Map<string, number[]>, key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const hits = (bucket.get(key) ?? []).filter((t) => now - t < windowMs);
  bucket.set(key, [...hits, now]);
  return hits.length >= max;
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
