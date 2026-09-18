import 'server-only';
import { cookies } from 'next/headers';
import { parseRecent, RECENT_COOKIE } from './recent';

/** The parts this visitor has opened, read on the server so the strip is in the
 *  first paint rather than appearing a moment later. */
export async function readRecent(): Promise<string[]> {
  return parseRecent((await cookies()).get(RECENT_COOKIE)?.value);
}
