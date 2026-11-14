import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { CabinMap } from '../components/seat/CabinMap';
import { Button } from '../components/ui/Button';
import { MobileStepHeader, Screen, StepPills, TopBar } from '../components/ui/TopBar';
import { airport } from '../data/airports';
import { formatBlock, routeDuration } from '../engine/duration';
import { DEFAULT_SEAT, parseSeat, SEAT_INFO, seatTypeFor } from '../engine/seats';
import type { SeatType } from '../engine/types';
import { useIsMobile } from '../lib/hooks';
import { useBooking } from '../store/bookingStore';
import { useProfile } from '../store/profileStore';

const TYPE_CARDS: { type: SeatType; seats: string; note: string }[] = [
  { type: 'window', seats: 'A · F', note: 'A cabin window with the sky outside.' },
  { type: 'aisle', seats: 'C · D', note: 'Push a meal service back 10 min, once per leg.' },
  { type: 'middle', seats: 'B · E', note: 'Ambient audio off. Chimes only.' },
  { type: 'exit', seats: 'Row 12', note: 'Auto-resume after breaks. Divert needs a 10 s hold.' },
];

export function Seat() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const draft = useBooking();
  const unlocked = useProfile((s) => s.profile.firstClassUnlocked);
  const origin = airport(draft.origin);
  const dest = airport(draft.destination);
  if (!origin || !dest) return <Navigate to={ROUTES.booking} replace />;

  // A saved seat that is no longer valid (e.g. locked first class) falls back.
  const valid = parseSeat(draft.seat) && (seatTypeFor(draft.seat) !== 'first' || unlocked);
  const seat = valid ? draft.seat : DEFAULT_SEAT;
  const type = seatTypeFor(seat);
  const info = SEAT_INFO[type];
  const dur = routeDuration(origin, dest);

  const confirm = () => {
    draft.set({ seat });
    nav(ROUTES.pass);
  };
  const cta = (
    <Button onClick={confirm} className="h-13 w-full text-[16px] md:w-auto md:px-8">
      Confirm seat {seat}
    </Button>
  );

  return (
    <Screen glows={['50% -2%', '2% 72%', '98% 82%']} className={mobile ? '!pb-28' : ''}>
      <div className="hidden md:block">
        <TopBar>
          <StepPills current={3} />
        </TopBar>
      </div>
      <MobileStepHeader back={ROUTES.booking} step={3} />

      <main className="mx-auto mt-4 max-w-[1344px] md:mt-10">
        <h1 className="text-[30px] md:text-[44px]">Choose your seat</h1>
        <p className="label mt-2">
          {origin.iata} → {dest.iata} · {formatBlock(dur.blockMin)} · your seat sets the rules
        </p>

        <section className="card mt-4 p-[14px] md:mt-7 md:p-7" aria-label="Cabin">
          <CabinMap selected={seat} onSelect={(s) => draft.set({ seat: s })} firstUnlocked={unlocked} vertical={mobile} />
        </section>

        <div className="mt-4 grid gap-4 md:mt-7 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-7">
          <section className="card p-[18px] md:p-7" aria-live="polite" aria-label="Selected seat">
            <div className="flex items-center gap-4">
              <span className="text-accent font-mono text-[52px] leading-none font-bold">{seat}</span>
              <div>
                <p className="font-display text-[22px] font-bold">{info.name}</p>
                <p className="text-muted text-[14px]">{info.blurb}</p>
              </div>
            </div>
            <p className="label mt-5">Changes to your flight</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {info.changes.map((c) => (
                <li key={c} className="flex gap-2 text-[15px]">
                  <span className="text-accent" aria-hidden="true">
                    ›
                  </span>
                  {c}
                </li>
              ))}
            </ul>
            {!mobile && <div className="mt-6">{cta}</div>}
          </section>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {TYPE_CARDS.map((c) => (
              <div
                key={c.type}
                className={`bg-surface rounded-[24px] border p-4 md:p-5 ${type === c.type ? 'border-accent' : 'border-border'}`}
              >
                <p className="label !text-[11px]">{c.seats}</p>
                <p className={`font-display mt-1 text-[18px] font-bold ${type === c.type ? 'text-accent' : ''}`}>
                  {SEAT_INFO[c.type].name}
                </p>
                <p className="text-muted mt-1 text-[13px]">{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      {mobile && (
        <div className="from-bg fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-60% to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {cta}
        </div>
      )}
    </Screen>
  );
}
