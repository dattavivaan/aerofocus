import type { SupabaseClient, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createLocalAdapter } from '../storage/localAdapter';
import { adoptGuestData, syncedAdapter } from '../storage/merge';
import { useProfile } from '../store/profileStore';
import { useSession } from '../store/sessionStore';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

interface AuthState {
  user: AuthUser | null;
  /** False until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
  configured: boolean;
}

export const useAuth = create<AuthState>(() => ({ user: null, configured: !!URL && !!KEY }));

export type AuthResult = { ok: true; note?: string } | { ok: false; error: string };

const NOT_SET_UP: AuthResult = {
  ok: false,
  error: 'Accounts are not set up on this build yet. Continue with a Guest Pass; your flights are saved on this device.',
};

let client: Promise<SupabaseClient> | null = null;
/** The Supabase library is only downloaded when accounts are configured. */
function supabase(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL!, KEY!));
  return client;
}

const toUser = (u: User): AuthUser => ({
  id: u.id,
  email: u.email ?? '',
  name: (u.user_metadata?.full_name as string | undefined) ?? (u.user_metadata?.name as string | undefined) ?? u.email?.split('@')[0] ?? 'Passenger',
});

let activeUserId: string | null = null;

/** Point the app at the right storage for whoever is signed in. */
async function switchStorageFor(user: User | null): Promise<void> {
  const id = user?.id ?? null;
  if (id === activeUserId && useProfile.getState().hydrated) return;
  activeUserId = id;
  const guest = createLocalAdapter();
  if (!user) {
    useAuth.setState({ user: null });
    useSession.getState().clear();
    await useProfile.getState().hydrate(guest);
    return;
  }
  const { createSupabaseAdapter } = await import('../storage/supabaseAdapter');
  const account = syncedAdapter(createLocalAdapter(user.id), createSupabaseAdapter(await supabase(), user.id));
  // Signing up or in moves the guest's flights, stamps and stats into the account.
  await adoptGuestData(guest, account).catch((e) => console.warn('AeroFocus: could not move guest data yet', e));
  useAuth.setState({ user: toUser(user) });
  useSession.getState().clear();
  await useProfile.getState().hydrate(account);
  useSession.getState().resume();
}

/** Restore a saved sign-in and follow sign-in / sign-out from here on. */
export async function initAuth(): Promise<void> {
  if (!useAuth.getState().configured) return;
  try {
    const db = await supabase();
    const { data } = await db.auth.getSession();
    await switchStorageFor(data.session?.user ?? null);
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void switchStorageFor(session?.user ?? null);
    });
  } catch (e) {
    console.warn('AeroFocus: sign-in is unavailable, continuing as a guest', e);
  }
}

/** Google is the only sign-in method. Redirects to Google and back. */
export async function signInOAuth(): Promise<AuthResult> {
  if (!useAuth.getState().configured) return NOT_SET_UP;
  try {
    const db = await supabase();
    const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } });
    return error ? { ok: false, error: error.message } : { ok: true, note: 'Opening the sign-in page…' };
  } catch {
    return { ok: false, error: 'Could not reach the sign-in service. You can still fly with a Guest Pass.' };
  }
}

export async function signOut(): Promise<void> {
  if (!useAuth.getState().configured) return;
  const db = await supabase();
  await db.auth.signOut();
  await switchStorageFor(null);
}
