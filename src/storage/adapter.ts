import type { Booking, Profile, Session, Stamp } from '../engine/types';

/** Everything a user owns. The same shape is used for guests and accounts. */
export interface AppData {
  profile: Profile | null;
  bookings: Booking[];
  sessions: Session[];
  stamps: Stamp[];
}

export interface StorageAdapter {
  readonly kind: 'local' | 'memory' | 'supabase';
  loadAll(): Promise<AppData>;
  saveProfile(profile: Profile): Promise<void>;
  saveBooking(booking: Booking): Promise<void>;
  saveSession(session: Session): Promise<void>;
  saveStamps(stamps: Stamp[]): Promise<void>;
  clear(): Promise<void>;
}

const upsert = <T extends { id: string }>(list: T[], item: T) => [...list.filter((x) => x.id !== item.id), item];

/** A key-value backend (IndexedDB, or a Map in tests). */
export interface KeyValue {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryKeyValue(): KeyValue {
  const map = new Map<string, string>();
  return {
    async get<T>(key: string) {
      const v = map.get(key);
      return v === undefined ? undefined : (JSON.parse(v) as T);
    },
    async set(key, value) {
      map.set(key, JSON.stringify(value));
    },
    async del(key) {
      map.delete(key);
    },
  };
}


/** Adapter over any key-value store. Guest mode uses it with IndexedDB. */
export function keyValueAdapter(kv: KeyValue, kind: 'local' | 'memory', prefix = 'af:'): StorageAdapter {
  const KEYS = {
    profile: `${prefix}profile`,
    bookings: `${prefix}bookings`,
    sessions: `${prefix}sessions`,
    stamps: `${prefix}stamps`,
  };
  return {
    kind,
    async loadAll() {
      const [profile, bookings, sessions, stamps] = await Promise.all([
        kv.get<Profile>(KEYS.profile),
        kv.get<Booking[]>(KEYS.bookings),
        kv.get<Session[]>(KEYS.sessions),
        kv.get<Stamp[]>(KEYS.stamps),
      ]);
      return { profile: profile ?? null, bookings: bookings ?? [], sessions: sessions ?? [], stamps: stamps ?? [] };
    },
    saveProfile: (p) => kv.set(KEYS.profile, p),
    async saveBooking(b) {
      await kv.set(KEYS.bookings, upsert((await kv.get<Booking[]>(KEYS.bookings)) ?? [], b));
    },
    async saveSession(s) {
      await kv.set(KEYS.sessions, upsert((await kv.get<Session[]>(KEYS.sessions)) ?? [], s));
    },
    saveStamps: (s) => kv.set(KEYS.stamps, s),
    async clear() {
      await Promise.all(Object.values(KEYS).map((k) => kv.del(k)));
    },
  };
}
