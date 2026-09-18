'use client';

import { useEffect } from 'react';
import type { SavedTruck } from '@/lib/fitment/truck-cookie';
import { useStore } from './CartProvider';

/**
 * The cookie can change on the server — a save from the fitment picker, a clear
 * from the truck bar — without the provider ever remounting. This hands the
 * server's reading back to the client so both agree. Renders nothing.
 */
export function TruckSync({ truck }: { truck: SavedTruck | null }) {
  const { syncTruck } = useStore();
  useEffect(() => { syncTruck(truck); }, [truck, syncTruck]);
  return null;
}
