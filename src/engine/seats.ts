import type { SeatType } from './types';

export const FIRST_ECONOMY_ROW = 10;
/** The longest plane has economy rows 10–30. */
export const MAX_ROW = 30;
const rowsTo = (last: number): number[] => Array.from({ length: last - FIRST_ECONOMY_ROW + 1 }, (_, i) => FIRST_ECONOMY_ROW + i);
export const ECONOMY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const FIRST_ROWS = [1, 2] as const;
export const FIRST_LETTERS = ['A', 'C', 'D', 'F'] as const;
export const EXIT_ROW = 12;
/** Exists on every plane, so a stale seat can always fall back to it. */
export const DEFAULT_SEAT = '14A';
export const FIRST_CLASS_UNLOCK_MIN = 25 * 60;

export type CabinSize = 'short' | 'medium' | 'long';

export interface CabinPlan {
  size: CabinSize;
  /** Economy rows, nose to tail. */
  rows: number[];
  /** Economy letters, port to starboard. */
  letters: readonly string[];
  /** The plane has a first class cabin (it still has to be unlocked). */
  hasFirst: boolean;
  name: string;
}

const SHORT_LETTERS = ['A', 'C', 'D', 'F'] as const;

/**
 * The plane follows the focus block: under 1 h is a small regional jet
 * (rows 10–15, 2+2, no middle seats, no first class), 1–3 h is the standard
 * cabin (rows 10–21), and over 3 h is a larger plane (rows 10–30).
 */
export function cabinFor(blockMin: number): CabinPlan {
  if (blockMin < 60) return { size: 'short', rows: rowsTo(15), letters: SHORT_LETTERS, hasFirst: false, name: 'Regional jet' };
  if (blockMin <= 180) return { size: 'medium', rows: rowsTo(21), letters: ECONOMY_LETTERS, hasFirst: true, name: 'Standard cabin' };
  return { size: 'long', rows: rowsTo(MAX_ROW), letters: ECONOMY_LETTERS, hasFirst: true, name: 'Wide cabin' };
}

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
  /** First class: place meals anywhere. */
  freeMeals: boolean;
  /** First class: gold stamp on landing. */
  goldStamp: boolean;
}

const BASE: SeatRules = {
  window: false,
  autoResume: false,
  canDelay: false,
  ambientAudio: true,
  divertHoldSec: 0,
  freeMeals: false,
  goldStamp: false,
};

export const SEAT_RULES: Record<SeatType, SeatRules> = {
  window: { ...BASE, window: true },
  aisle: { ...BASE, canDelay: true },
  middle: { ...BASE, ambientAudio: false },
  exit: { ...BASE, window: true, autoResume: true, divertHoldSec: 10 },
  first: { ...BASE, window: true, freeMeals: true, goldStamp: true },
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
  first: {
    name: 'First class',
    blurb: 'Earned with 25 focus hours.',
    changes: ['Cabin window shows the sky outside', 'Place meal services anywhere in the flight', 'Gold passport stamp on landing'],
  },
};

export function parseSeat(seat: string): { row: number; letter: string } | null {
  const m = /^(\d{1,2})([A-F])$/.exec(seat);
  if (!m) return null;
  const row = Number(m[1]);
  const letter = m[2];
  const first = (FIRST_ROWS as readonly number[]).includes(row) && (FIRST_LETTERS as readonly string[]).includes(letter);
  const eco = row >= FIRST_ECONOMY_ROW && row <= MAX_ROW && (ECONOMY_LETTERS as readonly string[]).includes(letter);
  return first || eco ? { row, letter } : null;
}

export function seatTypeFor(seat: string): SeatType {
  const p = parseSeat(seat);
  if (!p) throw new Error(`Unknown seat ${seat}`);
  if (p.row <= 2) return 'first';
  if (p.row === EXIT_ROW) return 'exit';
  if (p.letter === 'A' || p.letter === 'F') return 'window';
  if (p.letter === 'C' || p.letter === 'D') return 'aisle';
  return 'middle';
}

export function seatLabel(seat: string): string {
  const t = seatTypeFor(seat);
  return `Seat ${seat}, ${SEAT_INFO[t].name.toLowerCase()}`;
}

export function isFirstClassUnlocked(totalFocusMin: number): boolean {
  return totalFocusMin >= FIRST_CLASS_UNLOCK_MIN;
}

/** Is this seat on this plane (ignores whether first class is unlocked)? */
export function seatOnPlan(seat: string, plan: CabinPlan): boolean {
  const p = parseSeat(seat);
  if (!p) return false;
  if (p.row <= 2) return plan.hasFirst;
  return plan.rows.includes(p.row) && plan.letters.includes(p.letter);
}

/** The seat if it can be used on this plane, otherwise the default seat. */
export function resolveSeat(seat: string, plan: CabinPlan, firstUnlocked: boolean): string {
  if (!seatOnPlan(seat, plan)) return DEFAULT_SEAT;
  if (seatTypeFor(seat) === 'first' && !firstUnlocked) return DEFAULT_SEAT;
  return seat;
}

export type SeatMove = 'fore' | 'aft' | 'port' | 'starboard';

/**
 * Arrow-key movement on the cabin map. fore/aft change the row, port/starboard
 * change the letter (towards A / towards F). Returns the same seat at an edge.
 */
export function moveSeat(seat: string, move: SeatMove, firstUnlocked: boolean, plan: CabinPlan = cabinFor(120)): string {
  const p = parseSeat(seat);
  if (!p) return DEFAULT_SEAT;
  const rows: number[] = [...(firstUnlocked && plan.hasFirst ? FIRST_ROWS : []), ...plan.rows];
  const lettersFor = (row: number): readonly string[] => (row <= 2 ? FIRST_LETTERS : plan.letters);
  if (move === 'fore' || move === 'aft') {
    const i = rows.indexOf(p.row) + (move === 'aft' ? 1 : -1);
    if (i < 0 || i >= rows.length) return seat;
    const row = rows[i];
    const letters = lettersFor(row);
    let letter = p.letter;
    if (!letters.includes(letter)) letter = letter === 'B' ? 'A' : 'F'; // B→A, E→F in first
    return `${row}${letter}`;
  }
  const letters = lettersFor(p.row);
  const j = letters.indexOf(p.letter) + (move === 'starboard' ? 1 : -1);
  if (j < 0 || j >= letters.length) return seat;
  return `${p.row}${letters[j]}`;
}
