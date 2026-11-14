import type { SupabaseClient } from '@supabase/supabase-js';
import type { Booking, Profile, Session, Stamp } from '../engine/types';
import type { StorageAdapter } from './adapter';

/**
 * Cloud storage on Supabase Postgres. Tables are in supabase/schema.sql; each
 * row is keyed by user_id with owner-only row-level security.
 */
export function createSupabaseAdapter(db: SupabaseClient, userId: string): StorageAdapter {
  const ok = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  return {
    kind: 'supabase',
    async loadAll() {
      const [p, b, s, st] = await Promise.all([
        db.from('profiles').select('data').eq('user_id', userId).maybeSingle(),
        db.from('bookings').select('data').eq('user_id', userId),
        db.from('sessions').select('data').eq('user_id', userId),
        db.from('stamps').select('iata, visits, first_at, last_at').eq('user_id', userId),
      ]);
      return {
        profile: (ok(p)?.data as Profile | undefined) ?? null,
        bookings: (ok(b) ?? []).map((r) => r.data as Booking),
        sessions: (ok(s) ?? []).map((r) => r.data as Session),
        stamps: (ok(st) ?? []).map((r): Stamp => ({ iata: r.iata, visits: r.visits, firstAt: r.first_at, lastAt: r.last_at })),
      };
    },
    async saveProfile(profile) {
      ok(await db.from('profiles').upsert({ user_id: userId, data: profile }));
    },
    async saveBooking(b) {
      ok(await db.from('bookings').upsert({ id: b.id, user_id: userId, data: b }));
    },
    async saveSession(s) {
      ok(await db.from('sessions').upsert({ id: s.id, user_id: userId, booking_id: s.bookingId, state: s.state, data: s }));
    },
    async saveStamps(stamps) {
      if (!stamps.length) return;
      ok(
        await db
          .from('stamps')
          .upsert(stamps.map((s) => ({ user_id: userId, iata: s.iata, visits: s.visits, first_at: s.firstAt, last_at: s.lastAt }))),
      );
    },
    async clear() {
      for (const t of ['sessions', 'bookings', 'stamps', 'profiles']) ok(await db.from(t).delete().eq('user_id', userId));
    },
  };
}
