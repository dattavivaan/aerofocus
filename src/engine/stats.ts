import { isFirstClassUnlocked } from './seats';
import type { Booking, Profile, Session, Stamp } from './types';

export function defaultProfile(): Profile {
  return {
    units: 'mi',
    totals: { focusMin: 0, miles: 0, flights: 0, diverted: 0 },
    streak: { current: 0, best: 0 },
    firstClassUnlocked: false,
    firstClassNoticeShown: false,
    audio: {
      cabin: { on: true, vol: 0.5 },
      rain: { on: false, vol: 0.4 },
      lofi: { on: false, vol: 0.4 },
      chime: { on: true, vol: 0.7 },
    },
  };
}

/** Local calendar day, 'YYYY-MM-DD'. */
export function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d - 1, 12).getTime());
}

/** The streak to show today: it lapses if the last landing was before yesterday. */
export function currentStreak(profile: Profile, now: number): number {
  const { lastDay, current } = profile.streak;
  if (!lastDay) return 0;
  const today = localDay(now);
  return lastDay === today || lastDay === dayBefore(today) ? current : 0;
}

export interface Ledger {
  profile: Profile;
  stamps: Stamp[];
}

/**
 * Credit a finished session. Landed: stamp, miles, focus minutes, streak.
 * Diverted: focus minutes only (no stamp, miles or streak).
 */
export function applyOutcome(ledger: Ledger, booking: Booking, session: Session): Ledger {
  if (session.state !== 'landed' && session.state !== 'diverted') return ledger;
  const at = session.endedAt ?? Date.now();
  const p = ledger.profile;
  const totals = { ...p.totals, focusMin: p.totals.focusMin + session.focusedMin };
  let streak = p.streak;
  let stamps = ledger.stamps;

  if (session.state === 'landed') {
    totals.miles += booking.distanceMi;
    totals.flights += 1;
    const day = localDay(at);
    if (streak.lastDay !== day) {
      const current = streak.lastDay === dayBefore(day) ? streak.current + 1 : 1;
      streak = { current, best: Math.max(streak.best, current), lastDay: day };
    }
    const old = stamps.find((s) => s.iata === booking.destination);
    const stamp: Stamp = old
      ? { ...old, visits: old.visits + 1, lastAt: at }
      : { iata: booking.destination, visits: 1, firstAt: at, lastAt: at };
    stamps = [...stamps.filter((s) => s.iata !== booking.destination), stamp];
  } else {
    totals.diverted += 1;
  }

  return {
    profile: {
      ...p,
      homeAirport: p.homeAirport ?? booking.origin,
      totals,
      streak,
      firstClassUnlocked: p.firstClassUnlocked || isFirstClassUnlocked(totals.focusMin),
    },
    stamps,
  };
}
