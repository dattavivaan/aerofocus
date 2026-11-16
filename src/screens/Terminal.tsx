import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { signInOAuth, signOut, useAuth } from '../auth/auth';
import { Button } from '../components/ui/Button';
import { FlapText } from '../components/ui/FlapBoard';
import { Screen, TopBar } from '../components/ui/TopBar';
import { airport, departuresFrom, guessHomeAirport } from '../data/airports';
import { formatBlock } from '../engine/duration';
import { flightNoFor, gateFor } from '../engine/ids';
import { clock } from '../lib/format';
import { useIsMobile, useNow } from '../lib/hooks';
import { useBooking } from '../store/bookingStore';
import { useProfile } from '../store/profileStore';

const STATUSES = ['Boarding', 'On time', 'On time', 'Gate open', 'On time', 'On time', 'On time', 'On time'];

function SignInCard({ onGuest, compact }: { onGuest: () => void; compact?: boolean }) {
  const user = useAuth((s) => s.user);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const run = async (fn: () => ReturnType<typeof signInOAuth>) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? (r.note ? { text: r.note, bad: false } : null) : { text: r.error, bad: true });
    if (r.ok && !r.note) onGuest();
  };

  if (user) {
    return (
      <div className="flex flex-col gap-3">
        <p className="label">Checked in</p>
        <p className="text-[17px] font-semibold">{user.name}</p>
        <Button onClick={onGuest}>Book a flight</Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={onGuest} className="h-13 text-[16px]">
        Continue with a Guest Pass
      </Button>
      <p className="text-muted text-center text-[13px]">No account. Everything is saved on this device.</p>
      {!expanded && (
        <Button variant="ghost" aria-expanded={false} onClick={() => setExpanded(true)}>
          Check in with Google
        </Button>
      )}
      {expanded && (<>
      <Button variant="secondary" disabled={busy} onClick={() => void run(() => signInOAuth())}>
        Continue with Google
      </Button>
      </>)}
      {msg && (
        <p role="status" className={`text-[13px] ${msg.bad ? 'text-divert' : 'text-sky'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function Terminal() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const now = useNow(30_000);
  const homeCode = useProfile((s) => s.profile.homeAirport);
  const home = useMemo(() => airport(homeCode) ?? guessHomeAirport(), [homeCode]);
  const rows = useMemo(() => departuresFrom(home, mobile ? 5 : 8), [home, mobile]);
  const startFrom = useBooking((s) => s.startFrom);
  const draftOrigin = useBooking((s) => s.origin);

  const book = (dest?: string) => {
    if (dest) startFrom(home.iata, dest);
    else if (!draftOrigin) startFrom(home.iata);
    nav(ROUTES.booking);
  };

  const board = (
    <section aria-labelledby="dep-title" className="bg-surface-sunk border-border overflow-hidden rounded-[24px] border shadow-[var(--shadow-card)]">
      <div className="border-border flex items-center justify-between border-b px-4 py-3 md:px-6">
        <h2 id="dep-title" className="label !text-text">
          Departures · {home.iata}
        </h2>
        <span className="label">{clock(now)}</span>
      </div>
      <table className="w-full border-collapse text-[13px] md:text-[15px]">
        <thead>
          <tr className="label text-left !text-[10px] md:!text-[11px]">
            <th className="hidden py-2 pl-6 font-normal md:table-cell">Flight</th>
            <th className="py-2 pl-4 font-normal md:pl-2">Destination</th>
            <th className="py-2 font-normal">Block</th>
            <th className="hidden py-2 font-normal md:table-cell">Gate</th>
            <th className="py-2 pr-4 font-normal md:pr-6">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr
              key={d.airport.iata}
              onClick={() => book(d.airport.iata)}
              className="border-border/60 hover:bg-surface cursor-pointer border-t"
            >
              <td className="hidden py-2 pl-6 md:table-cell">
                <FlapText text={flightNoFor(home.iata, d.airport.iata)} delay={i * 90} tone="accent" />
              </td>
              <td className="py-2 pl-4 md:pl-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    book(d.airport.iata);
                  }}
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-left"
                >
                  <FlapText text={d.airport.iata} delay={i * 90 + 120} />
                  <span className="text-muted hidden max-w-[150px] truncate text-[13px] lg:inline">{d.airport.city}</span>
                  <span className="sr-only">
                    {d.airport.city}: book this flight, {formatBlock(d.blockMin)}
                  </span>
                </button>
              </td>
              <td className="py-2">
                <FlapText text={formatBlock(d.blockMin).replace(' min', 'M').replace(' ', '')} width={6} delay={i * 90 + 200} />
              </td>
              <td className="hidden py-2 md:table-cell">
                <FlapText text={gateFor(home.iata, d.airport.iata)} width={3} delay={i * 90 + 300} />
              </td>
              <td className="py-2 pr-4 md:pr-6">
                <span className={`label !text-[11px] ${i === 0 ? '!text-accent' : '!text-sky'}`}>{STATUSES[i]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <Screen glows={['8% 6%', '92% 12%', '64% 100%']} className={mobile ? '!pb-[200px]' : ''}>
      <TopBar>
        <span className="label pr-3">
          Terminal {home.iata} · {clock(now)}
        </span>
      </TopBar>

      <main className="mx-auto mt-8 grid max-w-[1344px] gap-8 md:mt-14 md:grid-cols-[minmax(0,460px)_minmax(0,1fr)] md:gap-14">
        <div>
          <p className="label !text-accent">● Now boarding</p>
          <h1 className="mt-3 text-[38px] leading-[1.05] md:text-[56px]">Every focus session is a flight.</h1>
          <p className="text-muted mt-4 text-[15px] md:text-[17px]">
            Pick a route. The real flight time becomes your focus block, and breaks arrive as meal service.
          </p>
          {!mobile && (
            <div className="card mt-8 p-6">
              <SignInCard onGuest={() => book()} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {board}
          <div className="hidden grid-cols-6 gap-3 md:grid" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="border-border h-24 rounded-[20px] border"
                style={{
                  background: `linear-gradient(180deg, hsl(${222 - i * 4} 45% ${16 + i * 2}%) 0%, hsl(${268 - i * 22} 38% ${30 + i * 3}%) 55%, hsl(${28 + i * 3} 80% ${48 + i * 3}%) 100%)`,
                }}
              />
            ))}
          </div>
          <p className="text-muted font-mono text-[12px] leading-relaxed">
            FOCUS BLOCK = GREAT-CIRCLE DISTANCE ÷ 500 MPH + 30 MIN FOR TAXI, TAKEOFF AND LANDING, ROUNDED TO 5 MIN.
          </p>
        </div>
      </main>

      {mobile && (
        <div className="glass fixed inset-x-0 bottom-0 z-20 rounded-t-[28px] p-[18px] pb-[max(18px,env(safe-area-inset-bottom))]">
          <SignInCard onGuest={() => book()} compact />
        </div>
      )}
    </Screen>
  );
}
