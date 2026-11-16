import { create } from 'zustand';
import { airport } from '../data/airports';
import { routeDuration } from '../engine/duration';
import { flightNoFor, gateFor, newId } from '../engine/ids';
import { defaultMeals, mealOptions, validateMeals } from '../engine/schedule';
import { cabinFor, resolveSeat, SEAT_RULES, seatTypeFor } from '../engine/seats';
import * as timer from '../engine/timer';
import type { Booking, Session } from '../engine/types';
import { useBooking } from './bookingStore';
import { useProfile } from './profileStore';

const FLYING: Session['state'][] = ['focus', 'meal', 'seatbelt'];

interface SessionState {
  booking: Booking | null;
  session: Session | null;
  /** When the boarding pass was opened (drives the printed times). */
  passOpenedAt: number | null;
  /** Build the booking from the draft and open the pass (booked → boarding). */
  openPass(now: number): boolean;
  discard(): void;
  board(now: number): void;
  /** Apply due transitions. Returns the event types that just happened. */
  tick(now: number): string[];
  fasten(now: number): void;
  delay(now: number): void;
  divert(now: number): void;
  /** Pick up a flight that was in the air when the app was closed. */
  resume(): void;
  clear(): void;
}

function persist(booking: Booking, session: Session, prev: Session | null) {
  const p = useProfile.getState();
  p.saveFlight(booking, session);
  const ended = session.state === 'landed' || session.state === 'diverted';
  if (ended && prev?.state !== session.state) p.recordOutcome(booking, session);
}

export const useSession = create<SessionState>((set, get) => ({
  booking: null,
  session: null,
  passOpenedAt: null,

  openPass(now) {
    const d = useBooking.getState();
    const o = airport(d.origin);
    const dest = airport(d.destination);
    if (!o || !dest || o.iata === dest.iata) return false;
    const dur = routeDuration(o, dest);
    // A seat that is not on this plane (route changed) falls back to the default.
    const seat = resolveSeat(d.seat, cabinFor(dur.blockMin), useProfile.getState().profile.firstClassUnlocked);
    if (seat !== d.seat) d.set({ seat });
    const preset = mealOptions(dur.blockMin).find((x) => x.id === d.mealOption);
    const free = SEAT_RULES[seatTypeFor(seat)].freeMeals;
    const custom = d.mealOption === 'custom' && validateMeals(dur.blockMin, d.customMeals, { free }).length === 0;
    const meals = custom ? d.customMeals : (preset?.meals ?? defaultMeals(dur.blockMin));
    const booking: Booking = {
      id: newId(),
      createdAt: now,
      origin: o.iata,
      destination: dest.iata,
      distanceMi: dur.distanceMi,
      blockMin: dur.blockMin,
      flightNo: flightNoFor(o.iata, dest.iata),
      gate: gateFor(o.iata, dest.iata),
      purpose: d.purpose,
      seat,
      seatType: seatTypeFor(seat),
      meals,
    };
    set({ booking, session: timer.openPass(timer.newSession(booking, now), now), passOpenedAt: now });
    return true;
  },

  discard: () => set({ booking: null, session: null, passOpenedAt: null }),

  board(now) {
    const { booking, session } = get();
    if (!booking || !session) return;
    const next = timer.board(session, now);
    set({ session: next });
    persist(booking, next, session);
  },

  tick(now) {
    const { booking, session } = get();
    if (!booking || !session) return [];
    const next = timer.advance(booking, session, now);
    if (next === session) return [];
    set({ session: next });
    persist(booking, next, session);
    return next.events.slice(session.events.length).map((e) => e.type);
  },

  fasten(now) {
    const { booking, session } = get();
    if (!booking || !session) return;
    const next = timer.fastenSeatbelt(booking, session, now);
    set({ session: next });
    persist(booking, next, session);
  },

  delay(now) {
    const { booking, session } = get();
    if (!booking || !session) return;
    const r = timer.delayNextMeal(booking, session, now);
    set(r);
    persist(r.booking, r.session, session);
  },

  divert(now) {
    const { booking, session } = get();
    if (!booking || !session) return;
    const next = timer.divert(booking, session, now);
    set({ session: next });
    persist(booking, next, session);
  },

  resume() {
    if (get().session) return;
    const { sessions, bookings } = useProfile.getState();
    const live = [...sessions].reverse().find((s) => FLYING.includes(s.state));
    const booking = live && bookings.find((b) => b.id === live.bookingId);
    if (live && booking) set({ booking, session: live, passOpenedAt: live.departedAt ?? null });
  },

  clear: () => set({ booking: null, session: null, passOpenedAt: null }),
}));

export const isFlying = (s: Session | null) => !!s && FLYING.includes(s.state);
