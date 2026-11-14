import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { mixer } from '../audio/mixer';
import { announce, SCRIPT, silence } from '../audio/voice';
import { AudioMixer } from '../components/audio/AudioMixer';
import { CabinWindow } from '../components/CabinWindow';
import { DivertDialog } from '../components/DivertDialog';
import { MealTimeline } from '../components/MealTimeline';
import type { MapMode } from '../components/map/FlightMap';
import { Button } from '../components/ui/Button';
import { PlaneIcon } from '../components/ui/PlaneIcon';
import { Screen } from '../components/ui/TopBar';
import { airport } from '../data/airports';
import { headingAt, positionAt } from '../engine/geo';
import { SEAT_RULES } from '../engine/seats';
import { view as flightView } from '../engine/timer';
import { now as clockNow, skipAhead } from '../lib/clock';
import { keepAwake, notifyIfHidden, tzAt } from '../lib/device';
import { clock, distance, hms, MEAL_NAMES, ms2, purposeLabel } from '../lib/format';
import { useIsMobile, useNow } from '../lib/hooks';
import { useProfile } from '../store/profileStore';
import { isFlying, useSession } from '../store/sessionStore';

const FlightMap = lazy(() => import('../components/map/FlightMap'));

const PHASE_LABEL: Record<string, string> = {
  boarding: 'Boarding',
  taxiing: 'Taxiing',
  climbing: 'Climbing',
  cruising: 'Cruising',
  meal: 'Meal Service',
  seatbelt: 'Fasten Seatbelt',
  descending: 'Descending',
  arrived: 'Arrived',
  diverted: 'Diverted',
};
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function Tray() {
  return (
    <svg viewBox="0 0 120 70" className="h-16 w-28 shrink-0" aria-hidden="true">
      <rect x="6" y="14" width="108" height="48" rx="10" fill="none" stroke="var(--sky)" strokeWidth="2" />
      <rect x="16" y="24" width="38" height="28" rx="6" fill="none" stroke="var(--sky)" strokeWidth="2" />
      <circle cx="78" cy="38" r="12" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="78" cy="38" r="6" fill="var(--accent)" opacity="0.5" />
      <rect x="98" y="26" width="8" height="24" rx="3" fill="none" stroke="var(--sky)" strokeWidth="2" />
      <path d="M26 8c0 4 4 4 4 8M36 6c0 4 4 4 4 8" stroke="var(--text-muted)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Stat({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="bg-surface border-border min-w-0 rounded-[24px] border p-4 shadow-[var(--shadow-card)] md:p-6">
      <p className="label !text-[11px]">{label}</p>
      <p className="mt-1.5 truncate font-mono text-[22px] font-bold md:text-[28px]">{value}</p>
      {sub && <p className="text-muted mt-0.5 truncate text-[13px]">{sub}</p>}
      {children}
    </div>
  );
}

export function InFlight() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const nowTs = useNow(1000);
  const { booking, session, tick, fasten, delay, divert } = useSession();
  const profile = useProfile((s) => s.profile);
  const updateProfile = useProfile((s) => s.updateProfile);
  const [mode, setMode] = useState<MapMode>('3d');
  const [slowNote, setSlowNote] = useState(false);
  const [divertOpen, setDivertOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);

  const flying = isFlying(session);
  const rules = booking ? SEAT_RULES[booking.seatType] : null;

  // Crew announcements follow their own switch; middle seats get chimes only.
  const voice = profile.audio.voice;
  const voiceOn = voice.on && !!rules?.ambientAudio;
  const say = useCallback(
    (text: string, delayMs: number) => {
      if (voiceOn) announce(text, voice.vol, delayMs);
    },
    [voiceOn, voice.vol],
  );
  useEffect(() => {
    if (!voiceOn) silence();
  }, [voiceOn]);

  // The timer: recalculated every second and whenever the tab wakes.
  useEffect(() => {
    if (!flying) return;
    // After a sleep several events can be due at once; only voice the last.
    const last = tick(clockNow()).filter((t) => t === 'meal-start' || t === 'meal-end' || t === 'landed').pop();
    const b = useSession.getState().booking;
    const s = useSession.getState().session;
    if (!b || !s) return;
    if (last === 'meal-start') {
      mixer.cue('meal-start');
      const meal = [...b.meals].sort((x, y) => x.startMin - y.startMin)[s.events.filter((e) => e.type === 'meal-end').length];
      if (meal) say(SCRIPT.mealStart(meal.lengthMin), 1400);
      notifyIfHidden('Meal service', 'Your break has started. Step away from the work.');
    } else if (last === 'meal-end') {
      mixer.cue('meal-end', { sign: !rules?.autoResume });
      say(SCRIPT.mealEnd(!!rules?.autoResume), rules?.autoResume ? 1400 : 2800);
      notifyIfHidden('Meal service is over', rules?.autoResume ? 'Back to work. The flight continues.' : 'Fasten your seatbelt to resume the flight.');
    } else if (last === 'landed') {
      mixer.cue('landing');
      say(SCRIPT.landing(airport(b.destination)?.city ?? b.destination, s.focusedMin), 5200);
      notifyIfHidden('Landed', 'Welcome to your destination. Your stamp is waiting.');
    }
  }, [nowTs, flying, tick, rules?.autoResume, say]);

  // Audio: started here (and on Board), unlocked by any click. On exit the
  // loops fade and the context stays open briefly so the landing cue can finish.
  useEffect(() => {
    mixer.start();
    const unlock = () => mixer.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      mixer.stop(7000);
    };
  }, []);
  useEffect(() => {
    if (rules) mixer.apply(profile.audio, rules.ambientAudio);
  }, [profile.audio, rules]);

  // Engines and the seatbelt sign follow the flight phase.
  const phaseNow = booking && session && flying ? flightView(booking, session, nowTs).phase : null;
  const lastPhase = useRef<string | null>(null);
  useEffect(() => {
    if (!phaseNow || !session) return;
    const prev = lastPhase.current;
    lastPhase.current = phaseNow;
    mixer.setPhase(phaseNow);
    if (prev === null) {
      // Just boarded (not a reload mid-flight): doors close, sign on.
      if (booking && clockNow() - (session.departedAt ?? 0) < 5000) {
        mixer.cue('boarding');
        say(SCRIPT.boarding(booking.flightNo, airport(booking.destination)?.city ?? booking.destination, booking.blockMin), 2600);
      }
    } else if (prev === 'climbing' && phaseNow === 'cruising') {
      mixer.cue('seatbelt-off');
      say(SCRIPT.cruise(), 1400);
    } else if (prev !== 'descending' && phaseNow === 'descending' && booking) {
      mixer.cue('seatbelt-on');
      const left = (booking.blockMin * 60_000 - flightView(booking, session, clockNow()).elapsedMs) / 60_000;
      say(SCRIPT.descent(airport(booking.destination)?.city ?? booking.destination, Math.round(left)), 1400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseNow]);

  useEffect(() => (flying ? keepAwake() : undefined), [flying]);

  const onSlow = useCallback(() => {
    setMode('2d');
    setSlowNote(true);
  }, []);

  if (!booking || !session) return <Navigate to={ROUTES.booking} replace />;
  if (session.state === 'landed' || session.state === 'diverted') return <Navigate to={ROUTES.landing} replace />;
  if (!flying) return <Navigate to={ROUTES.pass} replace />;

  const from = airport(booking.origin)!;
  const to = airport(booking.destination)!;
  const v = flightView(booking, session, nowTs);
  const elapsedMin = v.elapsedMs / 60_000;
  const pos = positionAt(from, to, v.progress);
  const heading = Math.round(headingAt(from, to, v.progress));
  const tz = tzAt(pos.lat, pos.lon);
  const flownMi = booking.distanceMi * v.progress;
  const focusedMin = Math.floor(v.focusMs / 60_000);
  const inMeal = v.state === 'meal';
  const waiting = v.state === 'seatbelt';

  const header = (
    <header className="glass z-30 mx-auto flex w-full max-w-[1344px] items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 md:gap-4 md:pl-6">
      <PlaneIcon size={18} rotate={45} className="text-accent hidden shrink-0 md:block" />
      <span className="font-mono text-[14px] font-bold md:text-[16px]">{booking.flightNo}</span>
      <span className="font-mono text-[14px] whitespace-nowrap md:text-[16px]">
        {from.iata} <span className="text-accent">→</span> {to.iata}
      </span>
      <span className="label hidden md:inline">
        Seat {booking.seat} · {purposeLabel(booking.purpose)}
      </span>
      <span
        role="status"
        className={`label ml-auto flex min-h-8 items-center rounded-full px-3 !text-[11px] whitespace-nowrap ${inMeal || waiting ? 'bg-sky/15 !text-sky' : 'bg-accent/15 !text-accent'}`}
      >
        {PHASE_LABEL[v.phase]}
      </span>
      {import.meta.env.DEV && (
        <Button variant="ghost" className="!px-2 text-[12px]" onClick={() => skipAhead(5 * 60_000)}>
          +5m
        </Button>
      )}
      <Button variant="divert" onClick={() => setDivertOpen(true)} className="!px-4">
        Divert
      </Button>
    </header>
  );

  const map = (
    <div className={`relative overflow-hidden ${mobile ? 'map-mobile h-[470px]' : 'border-border h-[470px] rounded-[28px] border shadow-[var(--shadow-card)]'}`}>
      <Suspense fallback={<div className="bg-surface-sunk absolute inset-0" />}>
        <FlightMap from={from} to={to} progress={v.progress} mode={mode} onSlow={onSlow} className="absolute inset-0" />
      </Suspense>
      {mobile && <div className="to-bg pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent" />}
      <div className={`absolute left-3 flex flex-col gap-2 md:left-4 ${mobile ? 'top-[76px]' : 'top-4'}`}>
        <div className="glass rounded-[16px] px-3.5 py-2">
          <p className="label !text-[10px]">Local time</p>
          <p className="font-mono text-[16px] font-bold">{clock(nowTs, tz)}</p>
        </div>
        <div className="glass rounded-[16px] px-3.5 py-2">
          <p className="label !text-[10px]">Heading</p>
          <p className="font-mono text-[16px] font-bold">
            {String(heading).padStart(3, '0')}° {COMPASS[Math.round(heading / 45) % 8]}
          </p>
        </div>
      </div>
      <div className={`glass absolute right-3 flex rounded-full p-1 md:right-4 ${mobile ? 'top-[76px]' : 'top-4'}`} role="group" aria-label="Map view">
        {(['3d', '2d'] as MapMode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setSlowNote(false);
            }}
            className={`min-h-11 min-w-11 cursor-pointer rounded-full px-3 font-mono text-[13px] font-bold ${mode === m ? 'bg-accent text-on-accent' : 'text-text'}`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {slowNote && (
        <p role="status" className="glass absolute right-3 bottom-10 rounded-full px-3 py-1.5 text-[12px] md:right-4">
          Switched to 2D to keep things smooth.
        </p>
      )}
    </div>
  );

  const countdown = (
    <>
      <p className="label">Time to arrival</p>
      <p className="text-accent mt-1 font-mono text-[44px] leading-none font-bold tabular-nums md:text-[58px]" role="timer" aria-label={`Time to arrival ${hms(v.remainingMs)}`}>
        {hms(v.remainingMs)}
      </p>
      <p className="text-muted mt-2 text-[13px]">
        {waiting ? 'Clock stopped until you fasten your seatbelt.' : `Arriving ${to.city} at ${clock(v.arrivalAt)}`}
      </p>
    </>
  );

  const mealPanel = (inMeal || waiting) && (
    <section role="status" aria-live="polite" className="bg-surface border-sky/40 flex flex-wrap items-center gap-4 rounded-[24px] border p-4 shadow-[var(--shadow-card)] md:gap-6 md:p-6">
      <Tray />
      <div className="min-w-0 flex-1">
        <p className="label !text-sky">{inMeal ? 'Meal Service Active' : 'Meal service is over'}</p>
        {inMeal && v.activeMeal ? (
          <>
            <p className="font-mono text-[34px] leading-tight font-bold tabular-nums">{ms2(v.activeMeal.remainingMs)}</p>
            <p className="text-muted text-[14px]">
              {MEAL_NAMES[v.activeMeal.meal.kind]} · {rules!.autoResume ? 'work resumes on its own' : 'you resume when you are ready'}
            </p>
          </>
        ) : (
          <p className="mt-1 text-[16px]">Tray tables up. The clock is stopped until you’re ready.</p>
        )}
      </div>
      {waiting && (
        <Button
          onClick={() => {
            mixer.cue('buckle');
            fasten(clockNow());
          }}
          className="h-13 w-full px-8 text-[16px] md:w-auto"
          autoFocus
        >
          Fasten seatbelt
        </Button>
      )}
    </section>
  );

  const nextMeal = (
    <Stat
      label="Next meal service"
      value={inMeal ? 'Now' : v.nextMeal ? ms2(v.nextMeal.inMs) : '—'}
      sub={inMeal ? MEAL_NAMES[v.activeMeal!.meal.kind] : v.nextMeal ? `${MEAL_NAMES[v.nextMeal.meal.kind]} · ${v.nextMeal.meal.lengthMin} min` : 'None left on this flight'}
    >
      {rules!.canDelay && v.nextMeal && !inMeal && !waiting && (
        <Button
          variant="secondary"
          disabled={!v.canDelay}
          onClick={() => {
            mixer.cue('delay');
            delay(clockNow());
          }} className="mt-3 !min-h-11 w-full text-[13px]">
          {v.nextMeal.meal.delayed ? 'Already delayed' : 'Delay 10 min'}
        </Button>
      )}
    </Stat>
  );
  const focused = <Stat label="Focused so far" value={`${focusedMin} min`} sub={purposeLabel(booking.purpose)} />;
  const flown = (
    <Stat
      label="Distance flown"
      value={distance(flownMi, profile.units)}
      sub={`of ${distance(booking.distanceMi, profile.units)}`}
    />
  );
  const arrival = <Stat label="Arrival" value={clock(v.arrivalAt)} sub={to.city} />;

  const timeline = (
    <MealTimeline
      blockMin={booking.blockMin}
      meals={booking.meals}
      nowMin={elapsedMin}
      thin={mobile}
      startLabel={`${from.iata} ${clock(session.departedAt!)}`}
      endLabel={`${clock(v.arrivalAt)} ${to.iata}`}
    />
  );
  const audio = <AudioMixer audio={profile.audio} ambient={rules!.ambientAudio} onChange={(a) => updateProfile({ audio: a })} />;

  const dialog = divertOpen && (
    <DivertDialog
      holdSec={rules!.divertHoldSec}
      focusedMin={focusedMin}
      onCancel={() => setDivertOpen(false)}
      onConfirm={() => {
        setDivertOpen(false);
        mixer.cue('divert');
        say(SCRIPT.divert(focusedMin), 1200);
        divert(clockNow());
        nav(ROUTES.landing);
      }}
    />
  );

  if (mobile) {
    return (
      <div className="bg-bg min-h-dvh pb-8">
        <div className="relative">
          {map}
          <div className="absolute inset-x-3 top-3">{header}</div>
        </div>
        <main className="relative z-10 -mt-24 flex flex-col gap-3 px-4">
          <section className="glass rounded-[24px] p-[18px]">
            {countdown}
            <div className="mt-3">{timeline}</div>
          </section>
          {mealPanel}
          <div className="grid grid-cols-2 gap-3">
            {nextMeal}
            {focused}
          </div>
          <div className="flex items-stretch gap-3">
            {rules!.window && <CabinWindow progress={v.progress} compact />}
            <button
              type="button"
              onClick={() => setMixerOpen(true)}
              className="bg-surface border-border flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[24px] border p-4 text-[15px] font-semibold"
            >
              <SlidersHorizontal size={18} aria-hidden="true" /> Cabin audio
            </button>
          </div>
        </main>
        {mixerOpen && (
          <div className="fade-in fixed inset-0 z-40 flex items-end bg-black/60" onClick={() => setMixerOpen(false)}>
            <div role="dialog" aria-modal="true" aria-label="Cabin audio" className="bg-surface border-border w-full rounded-t-[28px] border p-[18px] pb-8" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[22px]">Cabin audio</h2>
                <button type="button" aria-label="Close" onClick={() => setMixerOpen(false)} className="flex size-11 cursor-pointer items-center justify-center">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              {audio}
            </div>
          </div>
        )}
        {dialog}
      </div>
    );
  }

  return (
    <Screen glows={['96% 58%', '28% -2%', '2% 98%']}>
      {header}
      <main className="mx-auto mt-6 flex max-w-[1344px] flex-col gap-6">
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
          {map}
          <div className="flex flex-col gap-6">
            {rules!.window && <CabinWindow progress={v.progress} />}
            <section className="card flex flex-1 flex-col justify-center p-7">{countdown}</section>
          </div>
        </div>
        {mealPanel}
        <div className="grid grid-cols-4 gap-6">
          {nextMeal}
          {flown}
          {focused}
          {arrival}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-6">
          <section className="card p-7" aria-label="Flight timeline">
            <h2 className="mb-4 text-[22px]">Timeline</h2>
            {timeline}
          </section>
          <section className="card p-7" aria-label="Cabin audio">
            <h2 className="mb-2 text-[22px]">Cabin audio</h2>
            {audio}
          </section>
        </div>
      </main>
      {dialog}
    </Screen>
  );
}
