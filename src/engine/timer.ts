// Timestamp-based flight timer. Nothing here counts down: every value is
// recalculated from saved timestamps, so it stays right across tab sleep,
// laptop close and page reload. All functions are pure; `now` is passed in.

import { delayMeal, focusMinAt, mealTotalMin, phaseAt, sortMeals, type Phase } from './schedule';
import { placementFor, SEAT_RULES } from './seats';
import { newId } from './ids';
import type { Booking, MealService, Session } from './types';

const MIN = 60_000;

export function newSession(booking: Booking, now: number): Session {
  return {
    id: newId(),
    bookingId: booking.id,
    state: 'booked',
    pauses: [],
    events: [{ at: now, type: 'booked' }],
    focusedMin: 0,
  };
}

const withEvent = (s: Session, at: number, type: string, patch: Partial<Session> = {}): Session => ({
  ...s,
  ...patch,
  events: [...s.events, { at, type }],
});

const closedPauseMs = (s: Session) => s.pauses.reduce((t, p) => t + (p.to !== undefined ? p.to - p.from : 0), 0);
const openPause = (s: Session) => s.pauses.find((p) => p.to === undefined);
const mealsDone = (s: Session) => s.events.filter((e) => e.type === 'meal-end').length;

/** Elapsed flight time in ms: now − departedAt − all pauses. */
export function elapsedMs(session: Session, now: number): number {
  if (session.departedAt === undefined) return 0;
  const end = session.endedAt ?? openPause(session)?.from ?? now;
  return Math.max(0, end - session.departedAt - closedPauseMs(session));
}

/** booked → boarding: the pass was opened. */
export function openPass(session: Session, now: number): Session {
  return session.state === 'booked' ? withEvent(session, now, 'pass-opened', { state: 'boarding' }) : session;
}

/** boarding → focus: doors close, the clock starts. */
export function board(session: Session, now: number): Session {
  if (session.state !== 'boarding' && session.state !== 'booked') return session;
  return withEvent(session, now, 'boarded', { state: 'focus', departedAt: now });
}

/**
 * Apply every transition that is due at `now`, in order. This is both the
 * 1-second tick and the catch-up after sleep or reload.
 */
export function advance(booking: Booking, session: Session, now: number): Session {
  let s = session;
  const meals = sortMeals(booking.meals);
  const blockMs = booking.blockMin * MIN;
  const autoResume = SEAT_RULES[booking.seatType].autoResume;

  for (let guard = 0; guard < 1000; guard++) {
    if (s.departedAt === undefined || (s.state !== 'focus' && s.state !== 'meal')) return s;
    const ft = elapsedMs(s, now);
    // Real time at which flight time T is reached (no pause is open here).
    const realAt = (T: number) => s.departedAt! + closedPauseMs(s) + T;
    const meal = meals[mealsDone(s)];

    if (s.state === 'focus') {
      if (meal && ft >= meal.startMin * MIN) {
        s = withEvent(s, realAt(meal.startMin * MIN), 'meal-start', { state: 'meal' });
      } else if (ft >= blockMs) {
        const at = realAt(blockMs);
        s = withEvent(s, at, 'landed', {
          state: 'landed',
          endedAt: at,
          focusedMin: booking.blockMin - mealTotalMin(meals),
        });
      } else return s;
    } else {
      const endMs = (meal.startMin + meal.lengthMin) * MIN;
      if (ft < endMs) return s;
      const at = realAt(endMs);
      s = autoResume
        ? withEvent(s, at, 'meal-end', { state: 'focus' })
        : withEvent(s, at, 'meal-end', { state: 'seatbelt', pauses: [...s.pauses, { from: at }] });
    }
  }
  return s;
}

/** seatbelt → focus: the pause ends and arrival moves later by its length. */
export function fastenSeatbelt(booking: Booking, session: Session, now: number): Session {
  const s = advance(booking, session, now);
  if (s.state !== 'seatbelt') return s;
  const pauses = s.pauses.map((p) => (p.to === undefined ? { ...p, to: Math.max(now, p.from) } : p));
  return advance(booking, withEvent(s, now, 'seatbelt-fastened', { state: 'focus', pauses }), now);
}

/** Index of the next meal that has not started, or -1. */
function nextMealIndex(booking: Booking, session: Session): number {
  if (session.state !== 'focus') return -1;
  const i = mealsDone(session);
  return i < booking.meals.length ? i : -1;
}

export function canDelay(booking: Booking, session: Session, now: number): boolean {
  if (!SEAT_RULES[booking.seatType].canDelay) return false;
  const s = advance(booking, session, now);
  const i = nextMealIndex(booking, s);
  return i >= 0 && delayMeal(booking.blockMin, booking.meals, i, placementFor(booking.seatType)) !== null;
}

/** Aisle seats: push the next meal service back 10 min, once per leg. */
export function delayNextMeal(
  booking: Booking,
  session: Session,
  now: number,
): { booking: Booking; session: Session } {
  const s = advance(booking, session, now);
  if (!canDelay(booking, s, now)) return { booking, session: s };
  const meals = delayMeal(booking.blockMin, booking.meals, nextMealIndex(booking, s), placementFor(booking.seatType))!;
  return { booking: { ...booking, meals }, session: withEvent(s, now, 'meal-delay') };
}

/** Divert: ends the flight early. Focused minutes so far are credited. */
export function divert(booking: Booking, session: Session, now: number): Session {
  const s = advance(booking, session, now);
  if (s.state !== 'focus' && s.state !== 'meal' && s.state !== 'seatbelt') return s;
  const ft = elapsedMs(s, now);
  const pauses = s.pauses.map((p) => (p.to === undefined ? { ...p, to: Math.max(now, p.from) } : p));
  return withEvent(s, now, 'diverted', {
    state: 'diverted',
    pauses,
    endedAt: now,
    focusedMin: Math.floor(focusMinAt(booking.meals, ft / MIN)),
  });
}

export interface FlightView {
  state: Session['state'];
  phase: Phase | 'boarding' | 'seatbelt' | 'arrived' | 'diverted';
  elapsedMs: number;
  remainingMs: number;
  /** 0..1 through the flight; drives the plane position and sky color. */
  progress: number;
  /** Real time of arrival given the pauses so far. */
  arrivalAt: number;
  focusMs: number;
  /** The meal now being served, with ms left in it. */
  activeMeal?: { meal: MealService; remainingMs: number };
  /** The next meal still to come, with ms until it starts. */
  nextMeal?: { meal: MealService; inMs: number };
  canDelay: boolean;
}

/** Everything the In-flight screen shows, from one timestamp. */
export function view(booking: Booking, session: Session, now: number): FlightView {
  const meals = sortMeals(booking.meals);
  const blockMs = booking.blockMin * MIN;
  const ft = Math.min(elapsedMs(session, now), blockMs);
  const remainingMs = blockMs - ft;
  const done = mealsDone(session);

  let phase: FlightView['phase'];
  if (session.state === 'booked' || session.state === 'boarding') phase = 'boarding';
  else if (session.state === 'seatbelt') phase = 'seatbelt';
  else if (session.state === 'landed') phase = 'arrived';
  else if (session.state === 'diverted') phase = 'diverted';
  else if (session.state === 'meal') phase = 'meal';
  else {
    const p = phaseAt(booking.blockMin, meals, ft / MIN);
    phase = p === 'meal' ? 'cruising' : p;
  }

  const active = session.state === 'meal' ? meals[done] : undefined;
  const upcoming = session.state === 'meal' || session.state === 'seatbelt' ? meals[done + (session.state === 'meal' ? 1 : 0)] : meals[done];
  const flying = session.state === 'focus' || session.state === 'meal' || session.state === 'seatbelt';

  return {
    state: session.state,
    phase,
    elapsedMs: ft,
    remainingMs,
    progress: blockMs ? ft / blockMs : 0,
    arrivalAt: session.endedAt ?? (session.departedAt === undefined ? now + blockMs : now + remainingMs),
    focusMs: focusMinAt(meals, ft / MIN) * MIN,
    activeMeal: active && {
      meal: active,
      remainingMs: Math.max(0, (active.startMin + active.lengthMin) * MIN - ft),
    },
    nextMeal: flying && upcoming ? { meal: upcoming, inMs: Math.max(0, upcoming.startMin * MIN - ft) } : undefined,
    canDelay: canDelay(booking, session, now),
  };
}
