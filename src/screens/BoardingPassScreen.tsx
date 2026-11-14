import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { useAuth } from '../auth/auth';
import { BoardingPass } from '../components/pass/BoardingPass';
import { Button } from '../components/ui/Button';
import { MobileStepHeader, Screen, StepPills, TopBar } from '../components/ui/TopBar';
import { airport } from '../data/airports';
import { mixer } from '../audio/mixer';
import { now as clockNow } from '../lib/clock';
import { askNotifications } from '../lib/device';
import { useIsMobile, useNow, useReducedMotion } from '../lib/hooks';
import { useBooking } from '../store/bookingStore';
import { useProfile } from '../store/profileStore';
import { isFlying, useSession } from '../store/sessionStore';

const DEPART_IN_MS = 5 * 60_000;

export function BoardingPassScreen() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const reduced = useReducedMotion();
  const now = useNow(15_000);
  const draft = useBooking();
  const units = useProfile((s) => s.profile.units);
  const user = useAuth((s) => s.user);
  const { booking, session, passOpenedAt, openPass, discard, board } = useSession();
  const hasRoute = !!airport(draft.origin) && !!airport(draft.destination);

  // Opening the pass locks in the seat and meals (booked → boarding).
  const stale =
    !booking ||
    session?.state !== 'boarding' ||
    booking.origin !== draft.origin ||
    booking.destination !== draft.destination ||
    booking.seat !== draft.seat;
  useEffect(() => {
    if (hasRoute && stale && !isFlying(session)) openPass(clockNow());
  }, [hasRoute, stale, session, openPass]);

  if (isFlying(session)) return <Navigate to={ROUTES.flight} replace />;
  if (!hasRoute) return <Navigate to={ROUTES.booking} replace />;
  if (!booking || !passOpenedAt || stale) return <Screen glows={['20% 90%', '80% 6%', '96% 70%']}>{null}</Screen>;

  // Departure is 5 min after the pass opened, and never in the past.
  const departAt = Math.max(passOpenedAt + DEPART_IN_MS, now);

  const start = () => {
    // Both need a click: audio may only start, and permission only be asked, from one.
    mixer.start();
    askNotifications();
    board(clockNow());
    nav(ROUTES.flight);
  };
  const changeSeat = () => {
    discard();
    nav(ROUTES.seat);
  };

  return (
    <Screen glows={['18% 92%', '82% 4%', '98% 72%']} className={mobile ? '!pb-28' : ''}>
      <div className="hidden md:block">
        <TopBar>
          <StepPills current={4} />
        </TopBar>
      </div>
      <MobileStepHeader back={ROUTES.seat} step={4} />

      <main className="mx-auto mt-4 max-w-[1040px] md:mt-10">
        <p className="label !text-accent">
          Gate {booking.gate} · Boarding now
        </p>
        <h1 className="mt-2 text-[30px] md:text-[44px]">Your boarding pass</h1>

        <motion.div
          className="mt-5 md:mt-8"
          style={{ transformPerspective: 1200 }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, rotateX: -70, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 90, damping: 14 }}
        >
          <BoardingPass
            booking={booking}
            passenger={user?.name ?? 'Guest'}
            boardingAt={passOpenedAt}
            departAt={departAt}
            units={units}
          />
        </motion.div>

        <div className="mt-6 hidden gap-3 md:flex">
          <Button onClick={start} className="h-13 px-10 text-[16px]">
            Board flight
          </Button>
          <Button variant="secondary" onClick={changeSeat} className="h-13">
            Change seat
          </Button>
        </div>
        {mobile && (
          <Button variant="secondary" onClick={changeSeat} className="mt-5 w-full">
            Change seat
          </Button>
        )}
        <p className="text-muted mt-4 text-[14px]">
          Boarding starts the clock and closes the doors. Leaving early logs a Diverted Flight with partial credit.
        </p>
      </main>
      {mobile && (
        <div className="from-bg fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-60% to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <Button onClick={start} className="h-13 w-full text-[16px]">
            Board flight
          </Button>
        </div>
      )}
    </Screen>
  );
}
