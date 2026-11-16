import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { signInEmail, useAuth } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { Screen, TopBar } from '../components/ui/TopBar';
import { airport, guessHomeAirport } from '../data/airports';
import { useBooking } from '../store/bookingStore';
import { useProfile } from '../store/profileStore';

export function SignIn() {
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const homeCode = useProfile((s) => s.profile.homeAirport);
  const startFrom = useBooking((s) => s.startFrom);
  const draftOrigin = useBooking((s) => s.origin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const toBooking = () => {
    if (!draftOrigin) startFrom((airport(homeCode) ?? guessHomeAirport()).iata);
    nav(ROUTES.booking, { replace: true });
  };

  // Already signed in (or just signed in): carry on to booking.
  useEffect(() => {
    if (user) toBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await signInEmail(email.trim(), password);
    setBusy(false);
    setMsg(r.ok ? (r.note ? { text: r.note, bad: false } : null) : { text: r.error, bad: true });
  };

  return (
    <Screen glows={['8% 6%', '92% 12%', '64% 100%']}>
      <TopBar />
      <main className="mx-auto mt-8 max-w-[440px] md:mt-14">
        <h1 className="text-[30px] md:text-[44px]">Check in</h1>
        <p className="text-muted mt-3 text-[15px]">Sign in with your email and password. New here? Enter a new email and password and we will create your account.</p>
        <form className="card mt-6 flex flex-col gap-2.5 p-5 md:p-6" onSubmit={(e) => void submit(e)}>
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input id="email" className="input" type="email" autoComplete="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <input id="password" className="input" type="password" autoComplete="current-password" required minLength={6} placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={busy || !configured}>
            Check in
          </Button>
          {!configured && (
            <p role="status" className="text-divert text-[13px]">
              Accounts are not set up on this build yet. Continue with a Guest Pass instead.
            </p>
          )}
          {msg && (
            <p role="status" className={`text-[13px] ${msg.bad ? 'text-divert' : 'text-sky'}`}>
              {msg.text}
            </p>
          )}
        </form>
        <Link to={ROUTES.terminal} className="text-muted hover:text-text mt-4 inline-flex min-h-11 items-center text-[14px] underline underline-offset-4">
          Back
        </Link>
      </main>
    </Screen>
  );
}
