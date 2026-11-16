import type { PlacementRules } from './schedule';
import type { SeatType } from './types';

export const FIRST_ECONOMY_ROW = 10;
/** The longest plane has economy rows 10–30. */
export const MAX_ROW = 30;
const rowsTo = (last: number): number[] => Array.from({ length: last - FIRST_ECONOMY_ROW + 1 }, (_, i) => FIRST_ECONOMY_ROW + i);
export const ECONOMY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
/** The front cabins are all 2 + 2, so they have no middle seats. */
export const FRONT_LETTERS = ['A', 'C', 'D', 'F'] as const;
export const FIRST_ROWS = [1, 2] as const;
export const BUSINESS_ROWS = [3, 4, 5] as const;
export const PREMIUM_ROWS = [6, 7, 8, 9] as const;
export const FIRST_LETTERS = FRONT_LETTERS;
export const EXIT_ROW = 12;
/** Exists on every plane, so a stale seat can always fall back to it. */
export const DEFAULT_SEAT = '14A';
/** The private jet is its own aircraft with a single seat. */
export const JET_SEAT = 'JET';

/** The classes above economy, in the order they unlock. */
export type CabinClass = 'premium' | 'business' | 'first';
export const CABIN_CLASSES: readonly CabinClass[] = ['premium', 'business', 'first'];
export const UNLOCK_MIN: Record<CabinClass, number> = { premium: 10 * 60, business: 25 * 60, first: 50 * 60 };
export const FIRST_CLASS_UNLOCK_MIN = UNLOCK_MIN.first;
export const CABIN_NAMES: Record<CabinClass, string> = { premium: 'Premium economy', business: 'Business', first: 'First class' };
export const CABIN_ROWS: Record<CabinClass, readonly number[]> = { premium: PREMIUM_ROWS, business: BUSINESS_ROWS, first: FIRST_ROWS };

export const ROWS_TEXT: Record<CabinClass, string> = { premium: 'Rows 6 to 9', business: 'Rows 3 to 5', first: 'Rows 1 and 2' };

export type Access = Record<CabinClass, boolean>;
export const NO_ACCESS: Access = { premium: false, business: false, first: false };
export const FULL_ACCESS: Access = { premium: true, business: true, first: true };

/**
 * Which cabins a profile may sit in. First class, once earned, is never taken
 * back (`firstSticky`), so people who unlocked it at an earlier threshold keep it.
 * The private jet comes with first class.
 */
export function accessFor(totalFocusMin: number, firstSticky = false): Access {
  return {
    premium: totalFocusMin >= UNLOCK_MIN.premium,
    business: totalFocusMin >= UNLOCK_MIN.business,
    first: firstSticky || totalFocusMin >= UNLOCK_MIN.first,
  };
}

export type CabinSize = 'short' | 'medium' | 'long';

export interface CabinPlan {
  size: CabinSize;
  /** Economy rows, nose to tail. */
  rows: number[];
  /** Economy letters, port to starboard. */
  letters: readonly string[];
  /** The plane has the premium economy, business and first cabins (each still has to be unlocked). */
  hasFront: boolean;
  name: string;
}

const SHORT_LETTERS = ['A', 'C', 'D', 'F'] as const;

/**
 * The plane follows the focus block: under 1 h is a small regional jet
 * (rows 10–15, 2+2, no middle seats, economy only), 1–3 h is the standard
 * cabin (rows 10–21), and over 3 h is a larger plane (rows 10–30).
 */
export function cabinFor(blockMin: number): CabinPlan {
  if (blockMin < 60) return { size: 'short', rows: rowsTo(15), letters: SHORT_LETTERS, hasFront: false, name: 'Regional jet' };
  if (blockMin <= 180) return { size: 'medium', rows: rowsTo(21), letters: ECONOMY_LETTERS, hasFront: true, name: 'Standard cabin' };
  return { size: 'long', rows: rowsTo(MAX_ROW), letters: ECONOMY_LETTERS, hasFront: true, name: 'Wide cabin' };
}

export type StampClass = 'business' | 'first' | 'jet';

export interface SeatRules {
  /** Cabin window panel is shown in flight. */
  window: boolean;
  /** After a break the session resumes on its own. */
  autoResume: boolean;
  /** Can push the next meal service back 10 min, once per leg. */
  canDelay: boolean;
  /** Ambient channels (cabin, rain, lo-fi) are available. */
  ambientAudio: boolean;
  /** Seconds the Divert button must be held. 0 = a normal confirm. */
  divertHoldSec: number;
  /** First class and the jet: place meals anywhere, with 5 min legs. */
  freeMeals: boolean;
  /** Private jet: 1 min steps and breaks of any length from 1 to 60 min. */
  flexBreaks: boolean;
  /** Frequent flyer bonus on the miles credited for a landing. */
  mileMultiplier: number;
  /** A silver or gold stamp on landing. */
  stampClass: StampClass | null;
}

const BASE: SeatRules = {
  window: false,
  autoResume: false,
  canDelay: false,
  ambientAudio: true,
  divertHoldSec: 0,
  freeMeals: false,
  flexBreaks: false,
  mileMultiplier: 1,
  stampClass: null,
};

export const SEAT_RULES: Record<SeatType, SeatRules> = {
  window: { ...BASE, window: true },
  aisle: { ...BASE, canDelay: true },
  middle: { ...BASE, ambientAudio: false },
  exit: { ...BASE, window: true, autoResume: true, divertHoldSec: 10 },
  premium: { ...BASE, window: true, canDelay: true, mileMultiplier: 1.1 },
  business: { ...BASE, window: true, canDelay: true, mileMultiplier: 1.25, stampClass: 'business' },
  first: { ...BASE, window: true, canDelay: true, freeMeals: true, mileMultiplier: 1.5, stampClass: 'first' },
  jet: { ...BASE, window: true, canDelay: true, freeMeals: true, flexBreaks: true, mileMultiplier: 2, stampClass: 'jet' },
};

export const SEAT_INFO: Record<SeatType, { name: string; blurb: string; changes: string[] }> = {
  window: {
    name: 'Window',
    blurb: 'A view to drift into between paragraphs.',
    changes: ['Cabin window shows the sky outside', 'You resume manually after each break', 'Full audio mix'],
  },
  aisle: {
    name: 'Aisle',
    blurb: 'Room to stretch, and a little flexibility.',
    changes: ['No cabin window', 'Push the next meal service back 10 min, once per leg', 'You resume manually after each break'],
  },
  middle: {
    name: 'Middle',
    blurb: 'Nothing to look at, nothing to hear. Just the work.',
    changes: ['No cabin window', 'Ambient audio off, chimes only', 'You resume manually after each break'],
  },
  exit: {
    name: 'Exit row',
    blurb: 'The strict seat. You agreed to assist the crew.',
    changes: ['Cabin window shows the sky outside', 'Work resumes on its own after each break', 'Divert needs a 10 second hold'],
  },
  premium: {
    name: 'Premium economy',
    blurb: 'A wider seat up front. Earned with 10 focus hours.',
    changes: ['Cabin window shows the sky outside', 'Push the next meal service back 10 min, once per leg', '+10% bonus miles'],
  },
  business: {
    name: 'Business',
    blurb: 'Lie-flat comfort. Earned with 25 focus hours.',
    changes: ['Cabin window shows the sky outside', 'Push the next meal service back 10 min, once per leg', '+25% bonus miles', 'Silver passport stamp on landing'],
  },
  first: {
    name: 'First class',
    blurb: 'Earned with 50 focus hours.',
    changes: [
      'Cabin window shows the sky outside',
      'Place meal services anywhere in the flight',
      'Push the next meal service back 10 min, once per leg',
      '+50% bonus miles',
      'Gold passport stamp on landing',
      'Unlocks the private jet',
    ],
  },
  jet: {
    name: 'Private jet',
    blurb: 'Your own aircraft. You decide when to take a break.',
    changes: [
      'Breaks of any length from 1 to 60 min, placed to the minute',
      'Work legs only need to be 5 min',
      'Flies on any route, short or long',
      '+100% bonus miles (double)',
      'Gold “Private jet” passport stamp on landing',
    ],
  },
};

/** Break placement rules for a seat type. */
export const placementFor = (t: SeatType): PlacementRules => ({ free: SEAT_RULES[t].freeMeals, flex: SEAT_RULES[t].flexBreaks });

export function isJetSeat(seat: string): boolean {
  return seat === JET_SEAT;
}

/** The class a front-cabin row belongs to, or null for economy. */
export function cabinOfRow(row: number): CabinClass | null {
  if (row <= 2) return 'first';
  if (row <= 5) return 'business';
  if (row <= 9) return 'premium';
  return null;
}

export function parseSeat(seat: string): { row: number; letter: string } | null {
  const m = /^(\d{1,2})([A-F])$/.exec(seat);
  if (!m) return null;
  const row = Number(m[1]);
  const letter = m[2];
  const front = row >= 1 && row < FIRST_ECONOMY_ROW && (FRONT_LETTERS as readonly string[]).includes(letter);
  const eco = row >= FIRST_ECONOMY_ROW && row <= MAX_ROW && (ECONOMY_LETTERS as readonly string[]).includes(letter);
  return front || eco ? { row, letter } : null;
}

export function seatTypeFor(seat: string): SeatType {
  if (isJetSeat(seat)) return 'jet';
  const p = parseSeat(seat);
  if (!p) throw new Error(`Unknown seat ${seat}`);
  const cabin = cabinOfRow(p.row);
  if (cabin) return cabin;
  if (p.row === EXIT_ROW) return 'exit';
  if (p.letter === 'A' || p.letter === 'F') return 'window';
  if (p.letter === 'C' || p.letter === 'D') return 'aisle';
  return 'middle';
}

export function seatLabel(seat: string): string {
  if (isJetSeat(seat)) return 'Private jet';
  const t = seatTypeFor(seat);
  return `Seat ${seat}, ${SEAT_INFO[t].name.toLowerCase()}`;
}

export function isFirstClassUnlocked(totalFocusMin: number): boolean {
  return totalFocusMin >= UNLOCK_MIN.first;
}

/** Is this seat on this plane (ignores whether its cabin is unlocked)? The jet is its own aircraft. */
export function seatOnPlan(seat: string, plan: CabinPlan): boolean {
  const p = parseSeat(seat);
  if (!p) return false;
  if (p.row < FIRST_ECONOMY_ROW) return plan.hasFront;
  return plan.rows.includes(p.row) && plan.letters.includes(p.letter);
}

/** The seat if it can be used on this plane, otherwise the default seat. */
export function resolveSeat(seat: string, plan: CabinPlan, access: Access): string {
  if (isJetSeat(seat)) return access.first ? seat : DEFAULT_SEAT;
  if (!seatOnPlan(seat, plan)) return DEFAULT_SEAT;
  const cabin = cabinOfRow(parseSeat(seat)!.row);
  if (cabin && !access[cabin]) return DEFAULT_SEAT;
  return seat;
}

export type SeatMove = 'fore' | 'aft' | 'port' | 'starboard';

/**
 * Arrow-key movement on the cabin map. fore/aft change the row, port/starboard
 * change the letter (towards A / towards F). Returns the same seat at an edge.
 * Locked cabins are skipped.
 */
export function moveSeat(seat: string, move: SeatMove, access: Access, plan: CabinPlan = cabinFor(120)): string {
  const p = parseSeat(seat);
  if (!p) return DEFAULT_SEAT;
  const front: number[] = plan.hasFront ? CABIN_CLASSES.slice().reverse().filter((c) => access[c]).flatMap((c) => [...CABIN_ROWS[c]]) : [];
  const rows: number[] = [...front, ...plan.rows];
  const lettersFor = (row: number): readonly string[] => (row < FIRST_ECONOMY_ROW ? FRONT_LETTERS : plan.letters);
  if (move === 'fore' || move === 'aft') {
    const i = rows.indexOf(p.row) + (move === 'aft' ? 1 : -1);
    if (i < 0 || i >= rows.length) return seat;
    const row = rows[i];
    const letters = lettersFor(row);
    let letter = p.letter;
    if (!letters.includes(letter)) letter = letter === 'B' ? 'A' : 'F'; // B→A, E→F in the front cabins
    return `${row}${letter}`;
  }
  const letters = lettersFor(p.row);
  const j = letters.indexOf(p.letter) + (move === 'starboard' ? 1 : -1);
  if (j < 0 || j >= letters.length) return seat;
  return `${p.row}${letters[j]}`;
}
