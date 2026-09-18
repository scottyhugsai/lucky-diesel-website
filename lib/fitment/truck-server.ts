import 'server-only';
import { cookies } from 'next/headers';
import { decodeTruck, TRUCK_COOKIE, type SavedTruck } from './truck-cookie';

/** The visitor's truck, read on the server so pages arrive already filtered. */
export async function readSavedTruck(): Promise<SavedTruck | null> {
  return decodeTruck((await cookies()).get(TRUCK_COOKIE)?.value);
}
