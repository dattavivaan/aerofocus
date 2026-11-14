import { create } from 'zustand';
import { applyOutcome, defaultProfile } from '../engine/stats';
import type { Booking, Profile, Session, Stamp } from '../engine/types';
import type { StorageAdapter } from '../storage/adapter';
import { createLocalAdapter } from '../storage/localAdapter';

interface ProfileState {
  hydrated: boolean;
  adapter: StorageAdapter;
  profile: Profile;
  stamps: Stamp[];
  bookings: Booking[];
  sessions: Session[];
  /** Set when first class has just unlocked; cleared when the notice is seen. */
  hydrate(adapter?: StorageAdapter): Promise<void>;
  updateProfile(patch: Partial<Profile>): void;
  saveFlight(booking: Booking, session: Session): void;
  recordOutcome(booking: Booking, session: Session): void;
  reset(): Promise<void>;
}

// Writes run one after another so read-modify-write saves never interleave.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (fn: () => Promise<unknown>) => {
  queue = queue.then(fn).catch((e) => console.warn('AeroFocus: save failed', e));
};

const upsert = <T extends { id: string }>(list: T[], item: T) => [...list.filter((x) => x.id !== item.id), item];

export const useProfile = create<ProfileState>((set, get) => ({
  hydrated: false,
  adapter: createLocalAdapter(),
  profile: defaultProfile(),
  stamps: [],
  bookings: [],
  sessions: [],

  async hydrate(adapter) {
    const a = adapter ?? get().adapter;
    const data = await a.loadAll().catch(() => ({ profile: null, bookings: [], sessions: [], stamps: [] }));
    set({
      adapter: a,
      hydrated: true,
      profile: { ...defaultProfile(), ...(data.profile ?? {}) },
      stamps: data.stamps,
      bookings: data.bookings,
      sessions: data.sessions,
    });
  },

  updateProfile(patch) {
    const profile = { ...get().profile, ...patch };
    set({ profile });
    enqueue(() => get().adapter.saveProfile(profile));
  },

  saveFlight(booking, session) {
    set({ bookings: upsert(get().bookings, booking), sessions: upsert(get().sessions, session) });
    const a = get().adapter;
    enqueue(() => a.saveBooking(booking));
    enqueue(() => a.saveSession(session));
  },

  recordOutcome(booking, session) {
    const { profile, stamps } = applyOutcome({ profile: get().profile, stamps: get().stamps }, booking, session);
    set({ profile, stamps });
    const a = get().adapter;
    enqueue(() => a.saveProfile(profile));
    enqueue(() => a.saveStamps(stamps));
  },

  async reset() {
    await get().adapter.clear();
    set({ profile: defaultProfile(), stamps: [], bookings: [], sessions: [] });
  },
}));
