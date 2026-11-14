import { airport, AIRPORT_COUNT } from '../data/airports';
import { formatBlock } from '../engine/duration';
import { currentStreak } from '../engine/stats';
import type { Booking, Profile, Session, Stamp } from '../engine/types';
import { distance, purposeLabel, shortDate } from '../lib/format';
import { StampMark } from './Stamp';

export function StatTiles({ profile, now }: { profile: Profile; now: number }) {
  const hours = profile.totals.focusMin / 60;
  const streak = currentStreak(profile, now);
  const tiles = [
    { label: 'Hours flown', value: hours >= 10 ? hours.toFixed(0) : hours.toFixed(1) },
    { label: 'Miles', value: distance(profile.totals.miles, profile.units).replace(/ (mi|km)$/, ''), unit: profile.units },
    { label: 'Flights', value: String(profile.totals.flights) },
    { label: 'Streak', value: String(streak), unit: streak === 1 ? 'day' : 'days' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface border-border rounded-[24px] border p-4 md:p-5">
          <dt className="label !text-[11px]">{t.label}</dt>
          <dd className="mt-1 font-mono text-[26px] font-bold md:text-[30px]">
            {t.value}
            {t.unit && <span className="text-muted ml-1.5 text-[13px] font-normal">{t.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Stamps, newest first, padded with dashed empty spots. */
export function PassportGrid({ stamps, slots, size = 120, single }: { stamps: Stamp[]; slots: number; size?: number; single?: boolean }) {
  const sorted = [...stamps].sort((a, b) => b.lastAt - a.lastAt);
  const shown = single ? sorted.slice(0, slots) : sorted;
  const empty = Math.max(0, slots - shown.length);
  return (
    <div>
      <ul className="grid grid-cols-4 gap-2 md:gap-4">
        {shown.map((s) => {
          const a = airport(s.iata);
          return (
            <li key={s.iata} className="flex flex-col items-center text-center">
              <StampMark stamp={{ iata: s.iata, city: a?.city ?? s.iata, date: s.lastAt }} size={size} />
              <span className="text-muted mt-1 font-mono text-[10px] md:text-[11px]">
                {s.visits} {s.visits === 1 ? 'visit' : 'visits'}
              </span>
            </li>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`e${i}`} className="flex justify-center" aria-hidden="true">
            <span className="border-border block rounded-full border-2 border-dashed" style={{ width: size * 0.92, height: size * 0.92, margin: size * 0.04 }} />
          </li>
        ))}
      </ul>
      <p className="label mt-4 !text-[11px]">
        {stamps.length.toLocaleString('en-US')} of {AIRPORT_COUNT.toLocaleString('en-US')} airports
      </p>
    </div>
  );
}

export interface Flight {
  booking: Booking;
  session: Session;
}

/** Finished flights, newest first. */
export function finishedFlights(bookings: Booking[], sessions: Session[]): Flight[] {
  const byId = new Map(bookings.map((b) => [b.id, b]));
  return sessions
    .filter((s) => s.state === 'landed' || s.state === 'diverted')
    .map((s) => ({ session: s, booking: byId.get(s.bookingId)! }))
    .filter((f) => f.booking)
    .sort((a, b) => (b.session.endedAt ?? 0) - (a.session.endedAt ?? 0));
}

export function FlightList({ flights, limit }: { flights: Flight[]; limit?: number }) {
  const rows = limit ? flights.slice(0, limit) : flights;
  if (!rows.length) return <p className="text-muted text-[15px]">No flights yet. Your first landing will show up here.</p>;
  return (
    <ul className="divide-border divide-y">
      {rows.map(({ booking: b, session: s }) => {
        const landed = s.state === 'landed';
        return (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[16px] font-bold">
                {b.origin} <span className="text-accent">→</span> {b.destination}
                <span className="text-muted ml-2 text-[12px] font-normal">{b.flightNo}</span>
              </p>
              <p className="text-muted truncate text-[13px]">
                {shortDate(s.endedAt ?? b.createdAt)} · {purposeLabel(b.purpose)} · {formatBlock(s.focusedMin)} focused
              </p>
            </div>
            <span
              className={`label shrink-0 rounded-full px-3 py-1.5 !text-[11px] ${landed ? 'bg-sky/15 !text-sky' : 'bg-divert-bg !text-divert'}`}
            >
              {landed ? 'Landed' : 'Diverted'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
