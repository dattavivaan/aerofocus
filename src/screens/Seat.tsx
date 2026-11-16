import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { CabinMap } from '../components/seat/CabinMap';
import { Button } from '../components/ui/Button';
import { MobileStepHeader, Screen, StepPills, TopBar } from '../components/ui/TopBar';
import { airport } from '../data/airports';
import { formatBlock, routeDuration } from '../engine/duration';
import { Plane } from 'lucide-react';
import { accessFor, cabinFor, CABIN_NAMES, DEFAULT_SEAT, isJetSeat, JET_SEAT, resolveSeat, SEAT_INFO, seatTypeFor, UNLOCK_MIN, type CabinClass } from '../engine/seats';
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

const CLASS_CARDS: { cabin: CabinClass; seats: string; note: string }[] = [
  { cabin: 'premium', seats: 'Rows 6–9', note: 'Window, a meal delay and +10% miles.' },
  { cabin: 'business', seats: 'Rows 3–5', note: 'All that, +25% miles and a silver stamp.' },
  { cabin: 'first', seats: 'Rows 1–2', note: 'Place breaks anywhere, +50% miles, gold stamp, and the private jet.' },
];

export function Seat() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const draft = useBooking();
  const profile = useProfile((s) => s.profile);
  const access = accessFor(profile.totals.focusMin, profile.firstClassUnlocked);
  const origin = airport(draft.origin);
  const dest = airport(draft.destination);
  if (!origin || !dest) return <Navigate to={ROUTES.booking} replace />;

  const dur = routeDuration(origin, dest);
  const plan = cabinFor(dur.blockMin);
  // A saved seat that is not on this plane (or is locked first class) falls back.
  const seat = resolveSeat(draft.seat, plan, access);
  const jet = isJetSeat(seat);
  const type = seatTypeFor(seat);
  const info = SEAT_INFO[type];
  const cards = TYPE_CARDS.filter((c) => c.type !== 'middle' || plan.letters.includes('B'));

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
    <Screen scene="cabin" glows={['50% -2%', '2% 72%', '98% 82%']} className={mobile ? '!pb-28' : ''}>
      <div className="hidden md:block">
        <TopBar>
          <StepPills current={2} />
        </TopBar>
      </div>
      <MobileStepHeader back={ROUTES.booking} step={2} />

      <main className="mx-auto mt-4 max-w-[1344px] md:mt-10">
        <h1 className="text-[30px] md:text-[44px]">Choose your seat</h1>
        <p className="label mt-2">
          {origin.iata} → {dest.iata} · {formatBlock(dur.blockMin)} · {plan.name} · your seat sets the rules
        </p>

        <section className="card mt-4 p-[14px] md:mt-7 md:p-7" aria-label="Cabin">
          {access.first && (
            <div role="radiogroup" aria-label="Aircraft" className="mb-4 grid grid-cols-2 gap-2 md:mx-auto md:max-w-[420px]">
              {[
                { id: 'commercial', label: plan.name, on: !jet },
                { id: 'jet', label: 'Private jet', on: jet },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={o.on}
                  onClick={() => draft.set({ seat: o.id === 'jet' ? JET_SEAT : DEFAULT_SEAT })}
                  className={`min-h-11 cursor-pointer rounded-full border px-3 text-[14px] font-semibold transition ${
                    o.on ? (o.id === 'jet' ? 'bg-gold border-gold text-on-accent' : 'bg-accent border-accent text-on-accent') : 'border-border text-muted hover:text-text'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {jet ? (
            <div className="border-gold/50 mx-auto flex max-w-[520px] flex-col items-center gap-3 rounded-[24px] border px-6 py-10 text-center">
              <Plane className="text-gold" size={44} aria-hidden="true" />
              <p className="font-display text-[26px] font-bold">Your private jet</p>
              <p className="text-muted text-[14px]">One suite, no row numbers. Break length and placement are entirely up to you.</p>
            </div>
          ) : (
            <CabinMap key={plan.size} selected={seat} onSelect={(s) => draft.set({ seat: s })} access={access} plan={plan} vertical={mobile} />
          )}
        </section>

        <div className="mt-4 grid gap-4 md:mt-7 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-7">
          <section className="card p-[18px] md:p-7" aria-live="polite" aria-label="Selected seat">
            <div className="flex items-center gap-4">
              <span className={`font-mono leading-none font-bold ${jet ? 'text-gold text-[34px]' : 'text-accent text-[52px]'}`}>{seat}</span>
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
            {!jet && plan.hasFront && CLASS_CARDS.map((c) => (
              <div
                key={c.cabin}
                className={`bg-surface rounded-[24px] border p-4 md:p-5 ${type === c.cabin ? 'border-accent' : 'border-border'} ${access[c.cabin] ? '' : 'opacity-60'}`}
              >
                <p className="label !text-[11px]">{c.seats}</p>
                <p className={`font-display mt-1 text-[18px] font-bold ${type === c.cabin ? 'text-accent' : ''}`}>{CABIN_NAMES[c.cabin]}</p>
                <p className="text-muted mt-1 text-[13px]">{access[c.cabin] ? c.note : `Unlocks at ${UNLOCK_MIN[c.cabin] / 60} focus hours.`}</p>
              </div>
            ))}
            {!jet && cards.map((c) => (
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
