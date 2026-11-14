import { describe, expect, it } from 'vitest';
import airportsJson from '../data/airports.json';
import { blockMinFor, formatBlock, haulFor, matchesFilter, rawMinutes, routeDuration } from './duration';
import { distanceMi, headingAt, interpolate, positionAt, routeLine } from './geo';
import { flightNoFor, gateFor } from './ids';
import { defaultMeals, delayMeal, focusMinAt, legs, mealOptions, phaseAt, validateMeals } from './schedule';
import { moveSeat, seatLabel, seatTypeFor, SEAT_RULES } from './seats';
import { applyOutcome, currentStreak, defaultProfile, localDay } from './stats';
import { advance, board, canDelay, delayNextMeal, divert, elapsedMs, fastenSeatbelt, newSession, openPass, view } from './timer';
import type { Airport, Booking, MealService, Session } from './types';
import { keyValueAdapter, memoryKeyValue, type AppData } from '../storage/adapter';
import { adoptGuestData, mergeData, syncedAdapter } from '../storage/merge';

const airports = airportsJson as Airport[];
const ap = (code: string) => airports.find((a) => a.iata === code)!;
const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 13, 18, 0, 0);

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', createdAt: T0, origin: 'SEA', destination: 'SFO', distanceMi: 679, blockMin: 110,
    flightNo: 'AX123', gate: 'B4', purpose: 'coding', seat: '14A', seatType: 'window',
    meals: [{ kind: 'snack', startMin: 50, lengthMin: 15 }],
    ...over,
  };
}
const boarded = (b: Booking): Session => board(openPass(newSession(b, T0), T0), T0);

describe('duration', () => {
  it.each([
    ['PDX', 129, 45.5, 45, '45 min'],
    ['SFO', 679, 111.5, 110, '1h 50m'],
    // The PRD says "about 4,780 mi → 10h 05m". With the real OurAirports
    // coordinates the great-circle distance is 4,757 mi, which the PRD formula
    // rounds to 10h 00m. The formula itself matches the PRD (next test).
    ['NRT', 4757, 600.8, 600, '10h 00m'],
  ])('SEA → %s', (dest, miles, raw, block, label) => {
    const d = distanceMi(ap('SEA'), ap(dest));
    expect(Math.abs(d - miles)).toBeLessThan(1);
    expect(Math.abs(rawMinutes(d) - raw)).toBeLessThan(0.1);
    expect(routeDuration(ap('SEA'), ap(dest)).blockMin).toBe(block);
    expect(formatBlock(block)).toBe(label);
  });
  it('rounds the PRD distances exactly', () => {
    expect(blockMinFor(129)).toBe(45);
    expect(blockMinFor(679)).toBe(110);
    expect(blockMinFor(4780)).toBe(605);
  });
  it('classifies hauls and filters with one long-haul rule (over 3 h)', () => {
    expect(haulFor(85)).toBe('short');
    expect(haulFor(90)).toBe('medium');
    expect(haulFor(180)).toBe('medium');
    expect(haulFor(185)).toBe('long');
    expect(matchesFilter(45, 'under-1h')).toBe(true);
    expect(matchesFilter(110, '1-2h')).toBe(true);
    expect(matchesFilter(150, '2-3h')).toBe(true);
    expect(matchesFilter(185, 'long-haul')).toBe(true);
    expect(matchesFilter(180, 'long-haul')).toBe(false);
  });
});

describe('geo', () => {
  it('interpolates end points and a midpoint', () => {
    const a = ap('SEA'), b = ap('SFO');
    expect(interpolate(a, b, 0).lat).toBeCloseTo(a.lat, 4);
    expect(interpolate(a, b, 1).lon).toBeCloseTo(b.lon, 4);
    const mid = interpolate(a, b, 0.5);
    expect(distanceMi(a, mid)).toBeCloseTo(distanceMi(a, b) / 2, 3);
  });
  it('keeps SEA → NRT continuous across the 180° meridian', () => {
    const line = routeLine(ap('SEA'), ap('NRT'));
    for (let i = 1; i < line.length; i++) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(10);
    expect(line[line.length - 1][0]).toBeCloseTo(ap('NRT').lon - 360, 3);
    // Flown and remaining halves meet at the plane.
    const flown = routeLine(ap('SEA'), ap('NRT'), 0, 0.6);
    const rest = routeLine(ap('SEA'), ap('NRT'), 0.6, 1);
    expect(flown[flown.length - 1][0]).toBeCloseTo(rest[0][0], 6);
    expect(positionAt(ap('SEA'), ap('NRT'), 0.6).lon).toBeCloseTo(rest[0][0], 6);
  });
  it('heads south-ish to SFO and west-north-west to NRT', () => {
    const h = headingAt(ap('SEA'), ap('SFO'), 0);
    expect(h).toBeGreaterThan(170);
    expect(h).toBeLessThan(200);
    const n = headingAt(ap('SEA'), ap('NRT'), 0);
    expect(n).toBeGreaterThan(280);
    expect(n).toBeLessThan(320);
    expect(headingAt(ap('SEA'), ap('SFO'), 1)).toBeGreaterThan(150);
  });
});

describe('schedule', () => {
  it('SEA → SFO defaults to 50 work, 15 break, 45 work', () => {
    const meals = defaultMeals(110);
    expect(meals).toEqual([{ kind: 'snack', startMin: 50, lengthMin: 15 }]);
    expect(legs(110, meals).map((l) => [l.type, l.endMin - l.startMin])).toEqual([
      ['work', 50], ['meal', 15], ['work', 45],
    ]);
  });
  it('defaults: none under 60 min, a 5 min beverage for 60–90, a 25 min hot meal for long', () => {
    expect(defaultMeals(45)).toEqual([]);
    expect(defaultMeals(75)).toMatchObject([{ kind: 'beverage', lengthMin: 5 }]);
    expect(defaultMeals(605)).toMatchObject([{ kind: 'hot-meal', lengthMin: 25 }]);
  });
  it('every preset for many flight lengths is valid', () => {
    for (let block = 35; block <= 1000; block += 5) {
      const opts = mealOptions(block);
      expect(opts.filter((o) => o.isDefault)).toHaveLength(1);
      for (const o of opts) expect(validateMeals(block, o.meals), `${block} ${o.id}`).toEqual([]);
    }
  });
  it('long haul carts come about every 90 min', () => {
    const o = mealOptions(605).find((x) => x.id === 'hot-carts-10')!;
    expect(o.meals.length).toBe(6);
    expect(o.meals.filter((m) => m.kind === 'hot-meal')).toHaveLength(1);
  });
  it('rejects meals outside cruising and legs under 15 min', () => {
    expect(validateMeals(110, [{ kind: 'snack', startMin: 10, lengthMin: 10 }])).not.toEqual([]);
    expect(validateMeals(110, [{ kind: 'snack', startMin: 90, lengthMin: 10 }])).not.toEqual([]);
    const close: MealService[] = [
      { kind: 'snack', startMin: 30, lengthMin: 10 },
      { kind: 'snack', startMin: 50, lengthMin: 10 },
    ];
    expect(validateMeals(110, close)).not.toEqual([]);
    expect(validateMeals(110, [{ kind: 'snack', startMin: 6, lengthMin: 10 }], { free: true })).toEqual([]);
  });
  it('phases: first 15 min climb, last 15 min descend', () => {
    const m = defaultMeals(110);
    expect(phaseAt(110, m, 2)).toBe('taxiing');
    expect(phaseAt(110, m, 10)).toBe('climbing');
    expect(phaseAt(110, m, 20)).toBe('cruising');
    expect(phaseAt(110, m, 55)).toBe('meal');
    expect(phaseAt(110, m, 96)).toBe('descending');
  });
  it('focus minutes leave out meal time', () => {
    const m = defaultMeals(110);
    expect(focusMinAt(m, 40)).toBe(40);
    expect(focusMinAt(m, 60)).toBe(50);
    expect(focusMinAt(m, 110)).toBe(95);
  });
  it('delay moves a meal 10 min once, and refuses when it breaks a rule', () => {
    const m = defaultMeals(110);
    const d = delayMeal(110, m, 0)!;
    expect(d[0]).toMatchObject({ startMin: 60, delayed: true });
    expect(delayMeal(110, d, 0)).toBeNull();
    // 75 min flight: break at 35–40; +10 would end at 50 ≤ 60, fine. At 45–55 it would not be.
    expect(delayMeal(75, [{ kind: 'beverage', startMin: 45, lengthMin: 10 }], 0)).toBeNull();
  });
});

describe('seats and ids', () => {
  it('maps seats to types; row 12 is exit whatever the letter', () => {
    expect(seatTypeFor('14A')).toBe('window');
    expect(seatTypeFor('14F')).toBe('window');
    expect(seatTypeFor('14C')).toBe('aisle');
    expect(seatTypeFor('14E')).toBe('middle');
    expect(seatTypeFor('12B')).toBe('exit');
    expect(seatTypeFor('1A')).toBe('first');
    expect(() => seatTypeFor('1B')).toThrow();
    expect(() => seatTypeFor('22A')).toThrow();
    expect(seatLabel('14A')).toBe('Seat 14A, window');
    expect(SEAT_RULES.exit).toMatchObject({ autoResume: true, divertHoldSec: 10, window: true });
    expect(SEAT_RULES.middle.ambientAudio).toBe(false);
  });
  it('moves with arrow keys and stops at edges and the locked cabin', () => {
    expect(moveSeat('14A', 'starboard', false)).toBe('14B');
    expect(moveSeat('14A', 'port', false)).toBe('14A');
    expect(moveSeat('10B', 'fore', false)).toBe('10B');
    expect(moveSeat('10B', 'fore', true)).toBe('2A');
    expect(moveSeat('2C', 'starboard', true)).toBe('2D');
    expect(moveSeat('21F', 'aft', true)).toBe('21F');
  });
  it('flight number and gate are stable per route', () => {
    expect(flightNoFor('SEA', 'SFO')).toMatch(/^AX\d{3}$/);
    expect(flightNoFor('SEA', 'SFO')).toBe(flightNoFor('SEA', 'SFO'));
    expect(flightNoFor('SEA', 'SFO')).not.toBe(flightNoFor('SFO', 'SEA'));
    expect(gateFor('SEA', 'SFO')).toMatch(/^[A-D]\d{1,2}$/);
  });
});

describe('timer', () => {
  it('walks booked → boarding → focus → meal → seatbelt → focus → landed', () => {
    const b = booking();
    let s = newSession(b, T0);
    expect(s.state).toBe('booked');
    s = openPass(s, T0);
    expect(s.state).toBe('boarding');
    s = board(s, T0);
    expect(s).toMatchObject({ state: 'focus', departedAt: T0 });
    s = advance(b, s, T0 + 49 * MIN);
    expect(s.state).toBe('focus');
    s = advance(b, s, T0 + 50 * MIN);
    expect(s.state).toBe('meal');
    expect(view(b, s, T0 + 55 * MIN).activeMeal?.remainingMs).toBe(10 * MIN);
    s = advance(b, s, T0 + 65 * MIN + 500);
    expect(s.state).toBe('seatbelt');
    expect(s.pauses).toEqual([{ from: T0 + 65 * MIN }]);
    // Clock is stopped while waiting.
    expect(elapsedMs(s, T0 + 80 * MIN)).toBe(65 * MIN);
    s = fastenSeatbelt(b, s, T0 + 72 * MIN);
    expect(s.state).toBe('focus');
    // A 7 min wait moves arrival 7 min later.
    expect(view(b, s, T0 + 72 * MIN).arrivalAt).toBe(T0 + 117 * MIN);
    s = advance(b, s, T0 + 117 * MIN - 1);
    expect(s.state).toBe('focus');
    s = advance(b, s, T0 + 117 * MIN);
    expect(s).toMatchObject({ state: 'landed', endedAt: T0 + 117 * MIN, focusedMin: 95 });
  });

  it('exit row resumes on its own with no pause', () => {
    const b = booking({ seat: '12A', seatType: 'exit' });
    const s = advance(b, boarded(b), T0 + 66 * MIN);
    expect(s.state).toBe('focus');
    expect(s.pauses).toEqual([]);
    expect(advance(b, s, T0 + 110 * MIN).state).toBe('landed');
  });

  it('catch-up: sleeping through a meal start lands in the meal', () => {
    const b = booking();
    const s = advance(b, boarded(b), T0 + 58 * MIN);
    expect(s.state).toBe('meal');
    expect(s.events.at(-1)).toEqual({ at: T0 + 50 * MIN, type: 'meal-start' });
  });

  it('catch-up: a non-exit seat that slept through a meal end waits in seatbelt from the meal end', () => {
    const b = booking();
    // Laptop closed at minute 10, opened 5 hours later.
    let s = advance(b, boarded(b), T0 + 10 * MIN);
    s = advance(b, s, T0 + 300 * MIN);
    expect(s.state).toBe('seatbelt');
    expect(s.pauses).toEqual([{ from: T0 + 65 * MIN }]);
    expect(s.events.map((e) => e.type)).toEqual(['booked', 'pass-opened', 'boarded', 'meal-start', 'meal-end']);
    s = fastenSeatbelt(b, s, T0 + 300 * MIN);
    const v = view(b, s, T0 + 300 * MIN);
    expect(v.remainingMs).toBe(45 * MIN);
    expect(v.arrivalAt).toBe(T0 + 345 * MIN);
  });

  it('catch-up: an exit row seat that slept past everything has landed at the right time', () => {
    const b = booking({ seat: '12A', seatType: 'exit' });
    const s = advance(b, boarded(b), T0 + 900 * MIN);
    expect(s).toMatchObject({ state: 'landed', endedAt: T0 + 110 * MIN, focusedMin: 95 });
    expect(s.events.slice(-3).map((e) => [e.type, (e.at - T0) / MIN])).toEqual([
      ['meal-start', 50], ['meal-end', 65], ['landed', 110],
    ]);
  });

  it('catch-up handles several meals in one jump for exit seats', () => {
    const meals: MealService[] = [
      { kind: 'snack', startMin: 30, lengthMin: 10 },
      { kind: 'snack', startMin: 70, lengthMin: 10 },
    ];
    const b = booking({ seat: '12C', seatType: 'exit', meals });
    expect(advance(b, boarded(b), T0 + 75 * MIN).state).toBe('meal');
    expect(advance(b, boarded(b), T0 + 500 * MIN)).toMatchObject({ state: 'landed', focusedMin: 90 });
  });

  it('a session with no meals just lands', () => {
    const b = booking({ blockMin: 45, meals: [] });
    expect(advance(b, boarded(b), T0 + 44 * MIN).state).toBe('focus');
    expect(advance(b, boarded(b), T0 + 45 * MIN)).toMatchObject({ state: 'landed', focusedMin: 45 });
  });

  it('aisle delay: meal moves 10 min, next leg shrinks, total unchanged, once per leg', () => {
    const b0 = booking({ seat: '14C', seatType: 'aisle' });
    const s0 = advance(b0, boarded(b0), T0 + 40 * MIN);
    expect(canDelay(b0, s0, T0 + 40 * MIN)).toBe(true);
    const { booking: b1, session: s1 } = delayNextMeal(b0, s0, T0 + 40 * MIN);
    expect(b1.meals[0]).toMatchObject({ startMin: 60, lengthMin: 15, delayed: true });
    expect(b1.blockMin).toBe(110);
    expect(legs(110, b1.meals).map((l) => l.endMin - l.startMin)).toEqual([60, 15, 35]);
    expect(canDelay(b1, s1, T0 + 41 * MIN)).toBe(false);
    expect(delayNextMeal(b1, s1, T0 + 41 * MIN).booking).toBe(b1);
    expect(advance(b1, s1, T0 + 55 * MIN).state).toBe('focus');
    expect(advance(b1, s1, T0 + 60 * MIN).state).toBe('meal');
  });

  it('delay is refused for other seats, during a meal, and when no meal is left', () => {
    const w = booking();
    expect(canDelay(w, boarded(w), T0 + 10 * MIN)).toBe(false);
    const a = booking({ seat: '14C', seatType: 'aisle' });
    expect(canDelay(a, boarded(a), T0 + 55 * MIN)).toBe(false);
    const done = fastenSeatbelt(a, advance(a, boarded(a), T0 + 70 * MIN), T0 + 70 * MIN);
    expect(canDelay(a, done, T0 + 71 * MIN)).toBe(false);
  });

  it('divert from focus, meal and seatbelt credits focused minutes only', () => {
    const b = booking();
    const f = divert(b, boarded(b), T0 + 30 * MIN + 40_000);
    expect(f).toMatchObject({ state: 'diverted', focusedMin: 30, endedAt: T0 + 30 * MIN + 40_000 });
    const m = divert(b, boarded(b), T0 + 58 * MIN);
    expect(m).toMatchObject({ state: 'diverted', focusedMin: 50 });
    const sb = divert(b, boarded(b), T0 + 200 * MIN);
    expect(sb).toMatchObject({ state: 'diverted', focusedMin: 50 });
    expect(sb.pauses).toEqual([{ from: T0 + 65 * MIN, to: T0 + 200 * MIN }]);
    // No divert after the flight is over.
    const landed = advance(booking({ seatType: 'exit' }), boarded(b), T0 + 999 * MIN);
    expect(divert(b, landed, T0 + 1000 * MIN).state).toBe('landed');
  });

  it('survives a reload: a JSON round trip rebuilds the same state', () => {
    const b = booking();
    const s = advance(b, boarded(b), T0 + 20 * MIN);
    const reloaded = JSON.parse(JSON.stringify(s)) as Session;
    const v = view(b, advance(b, reloaded, T0 + 52 * MIN), T0 + 52 * MIN);
    expect(v.state).toBe('meal');
    expect(v.remainingMs).toBe(58 * MIN);
    expect(v.activeMeal?.remainingMs).toBe(13 * MIN);
  });

  it('view reports countdowns, progress and phase to the second', () => {
    const b = booking();
    const s = boarded(b);
    const v = view(b, s, T0 + 20 * MIN + 1000);
    expect(v).toMatchObject({ phase: 'cruising', remainingMs: 90 * MIN - 1000, focusMs: 20 * MIN + 1000 });
    expect(v.nextMeal?.inMs).toBe(30 * MIN - 1000);
    expect(v.progress).toBeCloseTo(20.0167 / 110, 4);
    expect(view(b, s, T0 + 3 * MIN).phase).toBe('taxiing');
    expect(view(b, s, T0 + 100 * MIN).phase).toBe('descending');
  });
});

describe('stats', () => {
  const day = (n: number) => new Date(2026, 10, n, 15).getTime();
  const landedOn = (n: number, b = booking()): Session => ({
    id: `s${n}`, bookingId: b.id, state: 'landed', departedAt: day(n) - 110 * MIN, endedAt: day(n),
    pauses: [], events: [], focusedMin: 95,
  });

  it('a landed flight adds a stamp, miles, minutes and streak', () => {
    const b = booking();
    let l = applyOutcome({ profile: defaultProfile(), stamps: [] }, b, landedOn(10));
    expect(l.profile.totals).toEqual({ focusMin: 95, miles: 679, flights: 1, diverted: 0 });
    expect(l.profile.streak).toEqual({ current: 1, best: 1, lastDay: localDay(day(10)) });
    expect(l.profile.homeAirport).toBe('SEA');
    expect(l.stamps).toEqual([{ iata: 'SFO', visits: 1, firstAt: day(10), lastAt: day(10) }]);
    l = applyOutcome(l, b, landedOn(10));
    expect(l.profile.streak.current).toBe(1);
    l = applyOutcome(l, b, landedOn(11));
    expect(l.profile.streak).toMatchObject({ current: 2, best: 2 });
    expect(l.stamps[0]).toMatchObject({ visits: 3, firstAt: day(10), lastAt: day(11) });
    l = applyOutcome(l, b, landedOn(14));
    expect(l.profile.streak).toMatchObject({ current: 1, best: 2 });
    expect(currentStreak(l.profile, day(15))).toBe(1);
    expect(currentStreak(l.profile, day(17))).toBe(0);
  });

  it('a diverted flight credits minutes only: no stamp, miles or streak', () => {
    const b = booking();
    const s: Session = { ...landedOn(10), state: 'diverted', focusedMin: 30 };
    const l = applyOutcome({ profile: defaultProfile(), stamps: [] }, b, s);
    expect(l.profile.totals).toEqual({ focusMin: 30, miles: 0, flights: 0, diverted: 1 });
    expect(l.profile.streak.current).toBe(0);
    expect(l.stamps).toEqual([]);
  });

  it('first class unlocks at 25 focus hours, counting diverted minutes', () => {
    const p = defaultProfile();
    p.totals.focusMin = 1500 - 95 - 30;
    let l = applyOutcome({ profile: p, stamps: [] }, booking(), landedOn(10));
    expect(l.profile.firstClassUnlocked).toBe(false);
    l = applyOutcome(l, booking(), { ...landedOn(10), state: 'diverted', focusedMin: 30 });
    expect(l.profile.firstClassUnlocked).toBe(true);
  });
});

describe('storage adapter', () => {
  it('saves and reloads everything, and upserts by id', async () => {
    const a = keyValueAdapter(memoryKeyValue(), 'memory');
    expect(await a.loadAll()).toEqual({ profile: null, bookings: [], sessions: [], stamps: [] });
    const b = booking();
    const s = boarded(b);
    await a.saveProfile(defaultProfile());
    await a.saveBooking(b);
    await a.saveSession(s);
    await a.saveSession({ ...s, state: 'meal' });
    await a.saveStamps([{ iata: 'SFO', visits: 1, firstAt: 1, lastAt: 1 }]);
    const all = await a.loadAll();
    expect(all.bookings).toEqual([b]);
    expect(all.sessions).toHaveLength(1);
    expect(all.sessions[0].state).toBe('meal');
    expect(all.stamps).toHaveLength(1);
    await a.clear();
    expect((await a.loadAll()).profile).toBeNull();
  });
});

describe('sky', () => {
  it('goes from day to golden hour to night', async () => {
    const { skyAt } = await import('./sky');
    expect(skyAt(0)).toMatchObject({ label: 'Day', stars: 0 });
    expect(skyAt(0.7).label).toBe('Golden hour');
    expect(skyAt(0.88).label).toBe('Dusk');
    expect(skyAt(1)).toMatchObject({ label: 'Night', stars: 1 });
    expect(skyAt(5).top).toBe(skyAt(1).top);
  });
});

describe('account sync', () => {
  const flight = (id: string, dest: string, endedAt: number, state: 'landed' | 'diverted' = 'landed') => ({
    booking: booking({ id: `b${id}`, destination: dest }),
    session: { id: `s${id}`, bookingId: `b${id}`, state, departedAt: endedAt - 110 * MIN, endedAt, pauses: [], events: [], focusedMin: state === 'landed' ? 95 : 30 } as Session,
  });
  const dataOf = (flights: ReturnType<typeof flight>[], profile: AppData['profile'] = null): AppData => ({
    profile, bookings: flights.map((f) => f.booking), sessions: flights.map((f) => f.session), stamps: [],
  });
  const d = (n: number) => new Date(2026, 10, n, 15).getTime();

  it('merging guest data into an account keeps every flight and rebuilds the totals', () => {
    const account = dataOf([flight('1', 'SFO', d(10))], { ...defaultProfile(), units: 'km', homeAirport: 'LAX' });
    const guest = dataOf([flight('2', 'PDX', d(11)), flight('3', 'SFO', d(12)), flight('4', 'NRT', d(12), 'diverted')]);
    const m = mergeData(account, guest);
    expect(m.sessions).toHaveLength(4);
    expect(m.profile!.totals).toEqual({ focusMin: 95 * 3 + 30, miles: 679 * 3, flights: 3, diverted: 1 });
    expect(m.profile!.streak).toMatchObject({ current: 3, best: 3 });
    expect(m.profile).toMatchObject({ units: 'km', homeAirport: 'LAX' });
    expect(m.stamps.find((s) => s.iata === 'SFO')).toMatchObject({ visits: 2, firstAt: d(10), lastAt: d(12) });
    expect(m.stamps.map((s) => s.iata).sort()).toEqual(['PDX', 'SFO']);
  });

  it('merging the same data twice does not double-count', () => {
    const a = dataOf([flight('1', 'SFO', d(10)), flight('2', 'PDX', d(11))]);
    const once = mergeData(a, a);
    const twice = mergeData(once, a);
    expect(twice.profile!.totals).toEqual(once.profile!.totals);
    expect(twice.profile!.totals.flights).toBe(2);
    expect(twice.stamps).toEqual(once.stamps);
  });

  it('keeps the finished copy of a session over an older in-flight copy', () => {
    const f = flight('1', 'SFO', d(10));
    const stale = { ...f.session, state: 'focus' as const, endedAt: undefined, focusedMin: 0 };
    const m = mergeData(dataOf([{ booking: f.booking, session: stale }]), dataOf([f]));
    expect(m.sessions[0].state).toBe('landed');
    expect(m.profile!.totals.flights).toBe(1);
  });

  it('signing up moves guest flights into the account and empties the guest copy', async () => {
    const guest = keyValueAdapter(memoryKeyValue(), 'memory');
    const cloud = keyValueAdapter(memoryKeyValue(), 'memory');
    const device = keyValueAdapter(memoryKeyValue(), 'memory', 'af:u:1:');
    const f = flight('1', 'PDX', d(10));
    await guest.saveBooking(f.booking);
    await guest.saveSession(f.session);
    await guest.saveProfile(defaultProfile());
    const account = syncedAdapter(device, cloud);
    await adoptGuestData(guest, account);
    expect((await guest.loadAll()).sessions).toEqual([]);
    const loaded = await account.loadAll();
    expect(loaded.sessions).toHaveLength(1);
    expect(loaded.profile!.totals.flights).toBe(1);
    await new Promise((r) => setTimeout(r, 10));
    expect((await cloud.loadAll()).sessions).toHaveLength(1);
  });

  it('works offline: a failing cloud falls back to the device copy and uploads later', async () => {
    const device = keyValueAdapter(memoryKeyValue(), 'memory');
    const cloud = keyValueAdapter(memoryKeyValue(), 'memory');
    let online = false;
    const flaky = new Proxy(cloud, {
      get: (t, k: keyof typeof cloud) =>
        typeof t[k] === 'function' ? (...a: unknown[]) => (online ? (t[k] as (...x: unknown[]) => unknown)(...a) : Promise.reject(new Error('offline'))) : t[k],
    });
    const account = syncedAdapter(device, flaky);
    const f = flight('1', 'PDX', d(10));
    const warn = console.warn;
    console.warn = () => {};
    await account.saveBooking(f.booking);
    await account.saveSession(f.session);
    expect((await account.loadAll()).sessions).toHaveLength(1);
    console.warn = warn;
    expect((await cloud.loadAll()).sessions).toHaveLength(0);
    online = true;
    await account.loadAll();
    await new Promise((r) => setTimeout(r, 10));
    expect((await cloud.loadAll()).sessions).toHaveLength(1);
    expect((await cloud.loadAll()).profile!.totals.flights).toBe(1);
  });
});

describe('voice', () => {
  it('speaks durations and announcements in plain words', async () => {
    const { spokenDuration, SCRIPT } = await import('../audio/voice');
    expect(spokenDuration(45)).toBe('45 minutes');
    expect(spokenDuration(60)).toBe('1 hour');
    expect(spokenDuration(110)).toBe('1 hour 50 minutes');
    expect(spokenDuration(601)).toBe('10 hours 1 minute');
    expect(spokenDuration(0)).toBe('0 minutes');
    expect(SCRIPT.boarding('AX500', 'San Francisco', 110)).toContain('flight A X 500 to San Francisco. Our flight time is 1 hour 50 minutes');
    expect(SCRIPT.mealEnd(false)).toContain('fasten your seatbelt');
    expect(SCRIPT.mealEnd(true)).not.toContain('seatbelt');
  });
  it('older saved profiles gain the voice setting without losing the rest', async () => {
    const { withDefaults } = await import('./stats');
    const old = { units: 'km', audio: { cabin: { on: false, vol: 0.2 }, rain: { on: true, vol: 0.4 }, lofi: { on: false, vol: 0.4 }, chime: { on: true, vol: 0.7 } } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = withDefaults(old as any);
    expect(p.units).toBe('km');
    expect(p.audio.cabin).toEqual({ on: false, vol: 0.2 });
    expect(p.audio.voice).toEqual({ on: true, vol: 0.8 });
  });
});
