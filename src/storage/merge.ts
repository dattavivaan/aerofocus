import { applyOutcome, defaultProfile } from '../engine/stats';
import type { Booking, Profile, Session } from '../engine/types';
import type { AppData, StorageAdapter } from './adapter';

const ENDED = ['landed', 'diverted'];
const rank = (s: Session) => (ENDED.includes(s.state) ? 1_000_000 : 0) + s.events.length;

/**
 * Merge two copies of a user's data (guest + account, or device + cloud).
 * Flights are joined by id. Totals, streak and stamps are rebuilt from the
 * finished flights, so merging the same data twice never double-counts.
 */
export function mergeData(primary: AppData, secondary: AppData): AppData {
  const bookings = new Map<string, Booking>();
  for (const b of [...secondary.bookings, ...primary.bookings]) bookings.set(b.id, b);
  const sessions = new Map<string, Session>();
  for (const s of [...secondary.sessions, ...primary.sessions]) {
    const old = sessions.get(s.id);
    if (!old || rank(s) >= rank(old)) sessions.set(s.id, s);
  }
  const settings: Profile = { ...defaultProfile(), ...(secondary.profile ?? {}), ...(primary.profile ?? {}) };
  return rebuild(settings, [...bookings.values()], [...sessions.values()]);
}

/** Recompute totals, streak, stamps and the first-class unlock from the log. */
export function rebuild(settings: Profile, bookings: Booking[], sessions: Session[]): AppData {
  const byId = new Map(bookings.map((b) => [b.id, b]));
  let ledger = {
    profile: { ...settings, totals: defaultProfile().totals, streak: defaultProfile().streak, firstClassUnlocked: false },
    stamps: [] as AppData['stamps'],
  };
  const finished = sessions
    .filter((s) => ENDED.includes(s.state) && byId.has(s.bookingId))
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0));
  for (const s of finished) ledger = applyOutcome(ledger, byId.get(s.bookingId)!, s);
  // Keep a chosen home airport; applyOutcome only fills it in when unset.
  if (settings.homeAirport) ledger.profile.homeAirport = settings.homeAirport;
  return { profile: ledger.profile, bookings, sessions, stamps: ledger.stamps };
}

async function saveAll(adapter: StorageAdapter, data: AppData): Promise<void> {
  if (data.profile) await adapter.saveProfile(data.profile);
  for (const b of data.bookings) await adapter.saveBooking(b);
  for (const s of data.sessions) await adapter.saveSession(s);
  await adapter.saveStamps(data.stamps);
}

/**
 * Local-first storage for accounts: every write goes to the device first and
 * then to the cloud, so flying works offline. Loading merges both sides and
 * pushes the result back, which also uploads anything saved while offline.
 */
export function syncedAdapter(local: StorageAdapter, remote: StorageAdapter): StorageAdapter {
  const push = (fn: () => Promise<void>) => fn().catch((e) => console.warn('AeroFocus: cloud sync will retry on next load', e));
  return {
    kind: 'supabase',
    async loadAll() {
      const mine = await local.loadAll();
      try {
        const merged = mergeData(await remote.loadAll(), mine);
        await saveAll(local, merged);
        void push(() => saveAll(remote, merged));
        return merged;
      } catch {
        return mine; // offline: carry on with the device copy
      }
    },
    async saveProfile(p) {
      await local.saveProfile(p);
      void push(() => remote.saveProfile(p));
    },
    async saveBooking(b) {
      await local.saveBooking(b);
      void push(() => remote.saveBooking(b));
    },
    async saveSession(s) {
      await local.saveSession(s);
      void push(() => remote.saveSession(s));
    },
    async saveStamps(s) {
      await local.saveStamps(s);
      void push(() => remote.saveStamps(s));
    },
    async clear() {
      await local.clear();
    },
  };
}

/** Move a guest's flights into an account's storage, then empty the guest copy. */
export async function adoptGuestData(guest: StorageAdapter, account: StorageAdapter): Promise<void> {
  const g = await guest.loadAll();
  if (!g.bookings.length && !g.sessions.length && !g.profile) return;
  const merged = mergeData(await account.loadAll(), g);
  await saveAll(account, merged);
  await guest.clear();
}
