import { distanceMi, type LatLon } from './geo';
import type { Haul } from './types';

export const CRUISE_MPH = 500;
export const GROUND_BUFFER_MIN = 30; // taxi, takeoff and landing

/** Raw (unrounded) flight minutes for a distance. */
export function rawMinutes(distMi: number): number {
  return (distMi / CRUISE_MPH) * 60 + GROUND_BUFFER_MIN;
}

/** Focus block: great-circle time at 500 mph + 30 min, to the nearest 5 min. */
export function blockMinFor(distMi: number): number {
  return 5 * Math.round(rawMinutes(distMi) / 5);
}

export function routeDuration(a: LatLon, b: LatLon): { distanceMi: number; blockMin: number; haul: Haul } {
  const d = distanceMi(a, b);
  const blockMin = blockMinFor(d);
  return { distanceMi: Math.round(d), blockMin, haul: haulFor(blockMin) };
}

/** Short: under 90 min. Medium: 90 min to 3 h. Long: over 3 h. */
export function haulFor(blockMin: number): Haul {
  if (blockMin < 90) return 'short';
  if (blockMin <= 180) return 'medium';
  return 'long';
}

/** "45 min", "1h 50m", "10h 05m". */
export function formatBlock(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export type FocusFilter = 'under-1h' | '1-2h' | '2-3h' | 'long-haul';

/** Booking filter buckets. "Long haul" matches the haul rule: over 3 h. */
export function matchesFilter(blockMin: number, f: FocusFilter): boolean {
  switch (f) {
    case 'under-1h':
      return blockMin < 60;
    case '1-2h':
      return blockMin >= 60 && blockMin <= 120;
    case '2-3h':
      return blockMin > 120 && blockMin <= 180;
    case 'long-haul':
      return blockMin > 180;
  }
}
