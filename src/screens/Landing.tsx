import { useState } from 'react';
import { motion } from 'motion/react';
import { Share2 } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { FirstClassNotice } from '../components/FirstClassNotice';
import { finishedFlights, FlightList, PassportGrid, StatTiles } from '../components/Records';
import { shareStamp, StampMark, type StampInfo } from '../components/Stamp';
import { Button } from '../components/ui/Button';
import { MainNav, Screen, TopBar } from '../components/ui/TopBar';
import { airport } from '../data/airports';
import { SEAT_INFO, SEAT_RULES } from '../engine/seats';
import { distance } from '../lib/format';
import { useIsMobile, useNow, useReducedMotion } from '../lib/hooks';
import { useBooking } from '../store/bookingStore';
import { useProfile } from '../store/profileStore';
import { isFlying, useSession } from '../store/sessionStore';

export function Landing() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const reduced = useReducedMotion();
  const now = useNow(60_000);
  const { profile, stamps, bookings, sessions } = useProfile();
  const live = useSession();
  const startFrom = useBooking((s) => s.startFrom);
  const [shareMsg, setShareMsg] = useState('');

  const flights = finishedFlights(bookings, sessions);
  // The flight that just ended, or the latest one in the log.
  const ended = live.session && (live.session.state === 'landed' || live.session.state === 'diverted');
  const flight = ended && live.booking ? { booking: live.booking, session: live.session! } : flights[0];

  if (isFlying(live.session)) return <Navigate to={ROUTES.flight} replace />;
  if (!flight) return <Navigate to={ROUTES.booking} replace />;

  const { booking: b, session: s } = flight;
  const landed = s.state === 'landed';
  const from = airport(b.origin)!;
  const to = airport(b.destination)!;
  const nextOrigin = landed ? to : from;
  const stamp: StampInfo = {
    iata: to.iata,
    city: to.city,
    date: s.endedAt ?? now,
    flightNo: b.flightNo,
    gold: SEAT_RULES[b.seatType].goldStamp,
  };

  const bookNext = () => {
    live.clear();
    startFrom(nextOrigin.iata);
    nav(ROUTES.booking);
  };
  const share = async () => {
    try {
      const r = await shareStamp(stamp);
      setShareMsg(r === 'downloaded' ? 'Stamp saved as a PNG.' : r === 'shared' ? 'Stamp shared.' : '');
    } catch {
      setShareMsg('Could not create the stamp image.');
    }
  };

  const stampEl = landed ? (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 2.6, rotate: -24 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 420, damping: 17, delay: 0.25 }}
      className="pointer-events-none shrink-0"
    >
      <StampMark stamp={stamp} size={mobile ? 190 : 210} />
    </motion.div>
  ) : (
    <div className="border-divert/50 text-divert flex size-[170px] shrink-0 -rotate-6 flex-col items-center justify-center rounded-full border-4 border-dashed" role="img" aria-label="Diverted flight, no stamp">
      <span className="font-mono text-[26px] font-bold">DIVERTED</span>
      <span className="font-mono text-[11px] tracking-widest">NO STAMP</span>
    </div>
  );

  const summary = (
    <dl className="grid grid-cols-3 gap-3">
      <div>
        <dt className="label !text-[11px]">Focused</dt>
        <dd className="text-accent font-mono text-[22px] font-bold">{s.focusedMin} min</dd>
      </div>
      <div>
        <dt className="label !text-[11px]">{landed ? 'Miles' : 'Miles credited'}</dt>
        <dd className="font-mono text-[22px] font-bold">{landed ? distance(b.distanceMi, profile.units) : '0'}</dd>
      </div>
      <div>
        <dt className="label !text-[11px]">Seat</dt>
        <dd className="font-mono text-[22px] font-bold">
          {b.seat}
          <span className="text-muted ml-1.5 hidden text-[12px] font-normal md:inline">{SEAT_INFO[b.seatType].name}</span>
        </dd>
      </div>
    </dl>
  );

  const headline = (
    <>
      <p className="label !text-accent">
        {b.flightNo} · {from.iata} → {to.iata}
      </p>
      <h1 className="mt-2 text-[34px] leading-tight md:text-[44px]">{landed ? `Welcome to ${to.city}` : 'Flight diverted'}</h1>
      <p className="text-muted mt-2 text-[15px]">
        {landed
          ? 'Landed. Your stamp, miles and focus time are in your passport.'
          : `You left before ${to.city}. The focused minutes are credited, with no stamp or miles.`}
      </p>
    </>
  );

  const bookBtn = (
    <Button onClick={bookNext} className="h-13 flex-1 text-[16px] md:flex-none md:px-8">
      Book next flight from {nextOrigin.iata}
    </Button>
  );

  return (
    <Screen scene="arrival" glows={['28% 8%', '82% 40%', '12% 94%']} className={mobile ? '!pb-28' : ''}>
      <TopBar compact>
        <MainNav />
      </TopBar>
      <main className="mx-auto mt-6 grid max-w-[1344px] gap-5 md:mt-10 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-7">
        <div className="flex min-w-0 flex-col gap-5 md:gap-7">
          <section className="md:bg-surface md:border-border flex flex-col items-center gap-5 text-center md:flex-row md:gap-8 md:rounded-[28px] md:border md:p-8 md:text-left md:shadow-[var(--shadow-card)]" aria-label="Flight summary">
            {stampEl}
            <div className="w-full min-w-0">
              {headline}
              <div className="mt-5">{summary}</div>
              <div className="mt-6 hidden items-center gap-3 md:flex">
                {bookBtn}
                {landed && (
                  <Button variant="secondary" onClick={() => void share()} className="h-13">
                    <Share2 size={17} aria-hidden="true" /> Share stamp
                  </Button>
                )}
              </div>
              <p role="status" className="text-sky mt-3 min-h-5 text-[13px]">
                {shareMsg}
              </p>
            </div>
          </section>
          <StatTiles profile={profile} now={now} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 md:gap-7">
          <section className="card p-[18px] md:p-7" aria-labelledby="pp-title">
            <h2 id="pp-title" className="mb-4 text-[22px]">
              Passport
            </h2>
            <PassportGrid stamps={stamps} slots={mobile ? 4 : 8} size={mobile ? 72 : 112} single={mobile} />
          </section>
          <section className="card hidden p-7 md:block" aria-labelledby="rf-title">
            <h2 id="rf-title" className="mb-2 text-[22px]">
              Recent flights
            </h2>
            <FlightList flights={flights} limit={4} />
          </section>
        </div>
      </main>

      {mobile && (
        <div className="from-bg fixed inset-x-0 bottom-0 z-20 flex gap-3 bg-gradient-to-t from-60% to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {bookBtn}
          {landed && (
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Share stamp"
              className="bg-surface border-border flex size-13 shrink-0 cursor-pointer items-center justify-center rounded-full border"
            >
              <Share2 size={19} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <FirstClassNotice />
    </Screen>
  );
}
