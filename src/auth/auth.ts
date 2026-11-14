import { create } from 'zustand';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: AuthUser | null;
  configured: boolean;
}

export const useAuth = create<AuthState>(() => ({ user: null, configured: false }));

export type AuthResult = { ok: true; note?: string } | { ok: false; error: string };

const NOT_SET_UP: AuthResult = {
  ok: false,
  error: 'Accounts are not set up on this build yet. Continue with a Guest Pass; your flights are saved on this device.',
};

export async function signInEmail(_email: string, _password: string): Promise<AuthResult> {
  return NOT_SET_UP;
}
export async function signInOAuth(_provider: 'google' | 'apple'): Promise<AuthResult> {
  return NOT_SET_UP;
}
export async function signOut(): Promise<void> {}
export async function initAuth(): Promise<void> {}
