import type { Iata } from './types';

/** Small stable string hash (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "AX" + 3 digits; the same route always gets the same number. */
export function flightNoFor(origin: Iata, destination: Iata): string {
  const n = 100 + (hash(`${origin}>${destination}`) % 900);
  return `AX${n}`;
}

/** A gate like "B4", stable per route. */
export function gateFor(origin: Iata, destination: Iata): string {
  const h = hash(`gate:${origin}>${destination}`);
  return `${'ABCD'[h % 4]}${1 + ((h >>> 4) % 24)}`;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
