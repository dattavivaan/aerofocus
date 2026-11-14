import { KM_PER_MI } from '../engine/geo';

export function clock(ts: number, tz?: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(ts);
}

export function shortDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(ts);
}

export function distance(mi: number, units: 'mi' | 'km'): string {
  const n = units === 'km' ? mi * KM_PER_MI : mi;
  return `${Math.round(n).toLocaleString('en-US')} ${units}`;
}

/** "01:50:00" from milliseconds (rounded up so 00:00 means done). */
export function hms(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** "14:59" from milliseconds. */
export function ms2(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const PURPOSES = [
  { id: 'deep-work', label: 'Deep Work' },
  { id: 'coding', label: 'Coding' },
  { id: 'studying', label: 'Studying' },
  { id: 'writing', label: 'Writing' },
] as const;

export const purposeLabel = (id: string) => PURPOSES.find((p) => p.id === id)?.label ?? id;

export const MEAL_NAMES = {
  beverage: 'Beverage Service',
  snack: 'Snack & Beverage',
  'hot-meal': 'Hot Meal',
  refreshment: 'Refreshment Cart',
} as const;
