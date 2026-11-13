import type { SeatType } from './types';

export const ECONOMY_ROWS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const;
export const ECONOMY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const FIRST_ROWS = [1, 2] as const;
export const FIRST_LETTERS = ['A', 'C', 'D', 'F'] as const;
export const EXIT_ROW = 12;
export const DEFAULT_SEAT = '14A';
export const FIRST_CLASS_UNLOCK_MIN = 25 * 60;

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
  const eco = (ECONOMY_ROWS as readonly number[]).includes(row);
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

export type SeatMove = 'fore' | 'aft' | 'port' | 'starboard';

/**
 * Arrow-key movement on the cabin map. fore/aft change the row, port/starboard
 * change the letter (towards A / towards F). Returns the same seat at an edge.
 */
export function moveSeat(seat: string, move: SeatMove, firstUnlocked: boolean): string {
  const p = parseSeat(seat);
  if (!p) return DEFAULT_SEAT;
  const rows: number[] = [...(firstUnlocked ? FIRST_ROWS : []), ...ECONOMY_ROWS];
  const lettersFor = (row: number): readonly string[] => (row <= 2 ? FIRST_LETTERS : ECONOMY_LETTERS);
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
