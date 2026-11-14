import raw from './airports.json';
import { routeDuration, matchesFilter, type FocusFilter } from '../engine/duration';
import type { Airport, Haul, Iata } from '../engine/types';

export const AIRPORTS = raw as Airport[];
export const AIRPORT_COUNT = AIRPORTS.length;

const BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));
export const airport = (iata: Iata | undefined | null): Airport | undefined =>
  iata ? BY_IATA.get(iata) : undefined;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const INDEX = AIRPORTS.map((a) => ({ a, code: a.iata.toLowerCase(), city: norm(a.city), name: norm(a.name) }));

/** Autocomplete by IATA code, city or airport name. Best matches first. */
export function searchAirports(query: string, limit = 8, exclude?: Iata): Airport[] {
  const q = norm(query.trim());
  if (!q) return [];
  const scored: { a: Airport; score: number }[] = [];
  for (const e of INDEX) {
    if (e.a.iata === exclude) continue;
    let score = 0;
    if (e.code === q) score = 100;
    else if (e.code.startsWith(q)) score = 80;
    else if (e.city.startsWith(q)) score = 70;
    else if (e.city.includes(` ${q}`)) score = 55;
    else if (e.name.startsWith(q)) score = 50;
    else if (q.length >= 3 && (e.name.includes(q) || e.city.includes(q))) score = 30;
    if (score) scored.push({ a: e.a, score: score + (e.a.large ? 8 : 0) });
  }
  return scored
    .sort((x, y) => y.score - x.score || x.a.city.localeCompare(y.a.city))
    .slice(0, limit)
    .map((s) => s.a);
}

export interface Destination {
  airport: Airport;
  distanceMi: number;
  blockMin: number;
  haul: Haul;
}

/** Destinations from an origin whose focus block falls in a filter range. */
export function destinationsFrom(origin: Airport, filter: FocusFilter, limit = 8): Destination[] {
  const out: Destination[] = [];
  for (const a of AIRPORTS) {
    if (a.iata === origin.iata || !a.large) continue;
    const d = routeDuration(origin, a);
    if (d.distanceMi >= 60 && matchesFilter(d.blockMin, filter)) out.push({ airport: a, ...d });
  }
  out.sort((x, y) => x.blockMin - y.blockMin || x.airport.city.localeCompare(y.airport.city));
  if (out.length <= limit) return out;
  // An even sample across the range, shortest to longest.
  return Array.from({ length: limit }, (_, i) => out[Math.round((i * (out.length - 1)) / (limit - 1))]);
}

/** A varied departures board: short to long flights from the home airport. */
export function departuresFrom(origin: Airport, count: number): Destination[] {
  const all: Destination[] = [];
  for (const a of AIRPORTS) {
    if (a.iata === origin.iata || !a.large) continue;
    const d = routeDuration(origin, a);
    if (d.distanceMi >= 90) all.push({ airport: a, ...d });
  }
  all.sort((x, y) => x.blockMin - y.blockMin);
  // Targets from a quick 45 min hop to a long haul.
  const targets = [45, 60, 80, 110, 150, 200, 320, 600].slice(0, count);
  const used = new Set<string>();
  return targets.map((t) => {
    let best = all[0];
    for (const d of all) {
      if (used.has(d.airport.iata)) continue;
      if (used.has(best.airport.iata) || Math.abs(d.blockMin - t) < Math.abs(best.blockMin - t)) best = d;
    }
    used.add(best.airport.iata);
    return best;
  });
}

const HUBS = ['SEA', 'SFO', 'LAX', 'DEN', 'ORD', 'DFW', 'ATL', 'JFK', 'BOS', 'YYZ', 'YVR', 'MEX', 'GRU', 'LHR', 'CDG', 'AMS', 'FRA', 'MAD', 'FCO', 'IST', 'DXB', 'DEL', 'BOM', 'SIN', 'HKG', 'NRT', 'ICN', 'PEK', 'SYD', 'AKL', 'JNB', 'CAI', 'KBP', 'WAW'];

/** A sensible home airport before the first booking, from the device timezone. */
export function guessHomeAirport(): Airport {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* ignore */
  }
  const hub = HUBS.map((h) => BY_IATA.get(h)).find((a) => a?.tz === tz);
  return hub ?? AIRPORTS.find((a) => a.large && a.tz === tz) ?? BY_IATA.get('SEA')!;
}
