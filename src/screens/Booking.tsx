import { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { AirportField } from '../components/AirportField';
import { Globe } from '../components/Globe';
import { MealTimeline } from '../components/MealTimeline';
import { Button } from '../components/ui/Button';
import { MobileStepHeader, Screen, StepPills, TopBar } from '../components/ui/TopBar';
import { airport, destinationsFrom, guessHomeAirport } from '../data/airports';
import { formatBlock, routeDuration, type FocusFilter } from '../engine/duration';
import { defaultMeals, mealOptions, validateMeals } from '../engine/schedule';
import { cabinFor, resolveSeat, SEAT_RULES, seatTypeFor } from '../engine/seats';
import type { MealService } from '../engine/types';
import { distance, MEAL_NAMES, PURPOSES } from '../lib/format';
import { useIsMobile } from '../lib/hooks';
import { useBooking } from '../store/bookingStore';
import { useProfile } from '../store/profileStore';
import { isFlying, useSession } from '../store/sessionStore';

const FILTERS: { id: FocusFilter; label: string }[] = [
  { id: 'under-1h', label: 'Under 1h' },
  { id: '1-2h', label: '1–2h' },
  { id: '2-3h', label: '2–3h' },
  { id: 'long-haul', label: 'Long haul' },
];
const HAUL_LABEL = { short: 'Short haul', medium: 'Medium haul', long: 'Long haul' };

export function Booking() {
  const nav = useNavigate();
  const mobile = useIsMobile();
  const draft = useBooking();
  const units = useProfile((s) => s.profile.units);
  const homeCode = useProfile((s) => s.profile.homeAirport);
  const flying = useSession((s) => isFlying(s.session));
  const [filter, setFilter] = useState<FocusFilter | null>(null);
  const unlocked = useProfile((s) => s.profile.firstClassUnlocked);

  const origin = airport(draft.origin) ?? airport(homeCode) ?? guessHomeAirport();
  const dest = airport(draft.destination);
  const dur = useMemo(() => (dest ? routeDuration(origin, dest) : null), [origin, dest]);
  // First class may place meals anywhere. A seat not on this plane does not count.
  const seat = resolveSeat(draft.seat, cabinFor(dur?.blockMin ?? 120), unlocked);
  const rules = { free: SEAT_RULES[seatTypeFor(seat)].freeMeals };
  const suggestions = useMemo(() => (filter ? destinationsFrom(origin, filter, 6) : []), [origin, filter]);

  const options = useMemo(() => (dur ? mealOptions(dur.blockMin) : []), [dur]);
  const optionId = draft.mealOption ?? options.find((o) => o.isDefault)?.id ?? 'none';
  const meals: MealService[] = !dur
    ? []
    : optionId === 'custom'
      ? draft.customMeals
      : (options.find((o) => o.id === optionId)?.meals ?? defaultMeals(dur.blockMin));

  if (flying) return <Navigate to={ROUTES.flight} replace />;

  const startCustom = () => {
    if (!dur) return;
    draft.set({ mealOption: 'custom', customMeals: meals.length ? meals : defaultMeals(dur.blockMin) });
  };
  const addBreak = () => {
    if (!dur) return;
    // Try each 5 min slot for a new 10 min break; take the first that fits.
    for (let start = 15; start <= dur.blockMin - 25; start += 5) {
      const next = [...draft.customMeals, { kind: 'snack', startMin: start, lengthMin: 10 } as MealService];
      if (validateMeals(dur.blockMin, next, rules).length === 0) return draft.set({ customMeals: next });
    }
  };

  const ready = !!dest && !!dur && origin.iata !== dest.iata;
  const proceed = () => {
    if (!ready) return;
    if (!draft.origin) draft.set({ origin: origin.iata });
    nav(ROUTES.seat);
  };

  const routeCard = (
    <section className="card flex items-center gap-4 p-[18px] md:gap-7 md:p-7" aria-label="Route">
      <Globe from={origin} to={dest} size={mobile ? 96 : 180} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[28px] font-bold md:text-[40px]">
          {origin.iata} <span className="text-accent">→</span> {dest?.iata ?? '···'}
        </p>
        <p className="text-muted truncate text-[14px]">
          {origin.city} to {dest?.city ?? 'choose a destination'}
        </p>
        {dur ? (
          <dl className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
            <div>
              <dt className="label !text-[11px]">{mobile ? 'Block' : 'Focus block'}</dt>
              <dd className="text-accent font-mono text-[16px] font-bold whitespace-nowrap md:text-[22px]">{formatBlock(dur.blockMin)}</dd>
            </div>
            <div>
              <dt className="label !text-[11px]">Distance</dt>
              <dd className="font-mono text-[16px] font-bold whitespace-nowrap md:text-[22px]">{distance(dur.distanceMi, units)}</dd>
            </div>
            <div>
              <dt className="label !text-[11px]">Haul</dt>
              <dd className="font-mono text-[16px] font-bold whitespace-nowrap md:text-[22px]">{HAUL_LABEL[dur.haul].split(' ')[0]}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted mt-4 text-[14px]">The focus block appears once you pick a destination.</p>
        )}
      </div>
    </section>
  );

  const formCard = (
    <section className="card flex flex-col gap-5 p-[18px] md:p-7" aria-label="Flight details">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <AirportField label="From" value={origin.iata} exclude={dest?.iata} onChange={(o) => draft.set({ origin: o })} />
        </div>
        <button
          type="button"
          onClick={() => dest && draft.swap()}
          disabled={!dest}
          aria-label="Swap origin and destination"
          className="bg-surface-sunk border-border hover:border-muted flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border disabled:opacity-40"
        >
          <ArrowLeftRight size={18} aria-hidden="true" />
        </button>
      </div>
      <AirportField
        label="To"
        value={dest?.iata}
        exclude={origin.iata}
        onChange={(d) => draft.set({ origin: origin.iata, destination: d })}
        placeholder="Where to? Code, city or airport"
      />

      <div>
        <p className="label mb-2">Or filter by focus length</p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(filter === f.id ? null : f.id)}
              className={`min-h-11 cursor-pointer rounded-full border px-4 text-[14px] font-semibold ${
                filter === f.id ? 'bg-accent border-accent text-on-accent' : 'border-border text-muted hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filter && (
          <ul className="bg-surface-sunk border-border mt-3 rounded-[14px] border p-1">
            {suggestions.length === 0 && <li className="text-muted p-3 text-sm">No large airports in that range from {origin.iata}.</li>}
            {suggestions.map((s) => (
              <li key={s.airport.iata}>
                <button
                  type="button"
                  onClick={() => draft.set({ origin: origin.iata, destination: s.airport.iata })}
                  aria-pressed={dest?.iata === s.airport.iata}
                  className={`hover:bg-surface flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left ${dest?.iata === s.airport.iata ? 'bg-surface' : ''}`}
                >
                  <span className="text-accent w-10 font-mono text-[15px] font-bold">{s.airport.iata}</span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{s.airport.city}</span>
                  <span className="text-muted font-mono text-[13px]">{formatBlock(s.blockMin)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="min-w-0">
        <legend className="label mb-2">Trip purpose</legend>
        <div className="relative flex gap-2 overflow-x-auto p-1 md:grid md:grid-cols-4 md:overflow-visible">
          {PURPOSES.map((p) => (
            <label
              key={p.id}
              className={`flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border px-4 text-[14px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--accent)] ${
                draft.purpose === p.id ? 'bg-accent border-accent text-on-accent' : 'border-border text-muted hover:text-text'
              }`}
            >
              <input type="radio" name="purpose" className="sr-only" checked={draft.purpose === p.id} onChange={() => draft.set({ purpose: p.id })} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );

  const mealCard = dur && (
    <section className="card p-[18px] md:p-7" aria-label="Meal service">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[22px]">Meal service</h2>
        <span className="label">{HAUL_LABEL[dur.haul]}</span>
      </div>
      <p className="text-muted mt-1 text-[14px]">Breaks sit inside the flight time. They don’t add to it.</p>
      <div className="mt-5">
        <MealTimeline
          blockMin={dur.blockMin}
          meals={meals}
          onChange={optionId === 'custom' ? (m) => draft.set({ customMeals: m }) : undefined}
          rules={rules}
          startLabel={origin.iata}
          endLabel={dest!.iata}
        />
      </div>
      <fieldset className="mt-4">
        <legend className="sr-only">Meal service plan</legend>
        <div className="grid gap-2 md:grid-cols-2">
          {[...options, { id: 'custom', label: 'Custom · drag the breaks', meals: [] }].map((o) => (
            <label
              key={o.id}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 py-2 text-[14px] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--accent)] ${
                optionId === o.id ? 'border-accent text-text' : 'border-border text-muted hover:text-text'
              }`}
            >
              <input
                type="radio"
                name="meal"
                className="accent-[var(--accent)]"
                checked={optionId === o.id}
                onChange={() => (o.id === 'custom' ? startCustom() : draft.set({ mealOption: o.id }))}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      {optionId === 'custom' && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-muted text-[13px]">
            Drag a blue break along the bar, or focus it and use the arrow keys. Work legs can’t be shorter than 15 min, and breaks stay inside cruising.
          </p>
          {draft.customMeals.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-[14px]">
              <span className="text-sky min-w-0 flex-1 truncate font-mono">
                {formatBlock(m.startMin)} · {MEAL_NAMES[m.kind]}
              </span>
              <label className="sr-only" htmlFor={`len-${i}`}>
                Length of break {i + 1}
              </label>
              <select
                id={`len-${i}`}
                className="input !min-h-11 !w-24"
                value={m.lengthMin}
                onChange={(e) => {
                  const next = draft.customMeals.map((x, j) => (j === i ? { ...x, lengthMin: Number(e.target.value) } : x));
                  if (validateMeals(dur.blockMin, next, rules).length === 0) draft.set({ customMeals: next });
                }}
              >
                {[5, 10, 15, 20, 25, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
              <Button variant="ghost" aria-label={`Remove break ${i + 1}`} onClick={() => draft.set({ customMeals: draft.customMeals.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={addBreak} className="self-start">
            Add a break
          </Button>
        </div>
      )}
    </section>
  );

  const cta = (
    <Button onClick={proceed} disabled={!ready} className="h-13 w-full text-[16px]">
      Choose your seat →
    </Button>
  );

  return (
    <Screen glows={['88% 2%', '6% 34%', '50% 104%']} className={mobile ? '!pb-28' : ''}>
      <div className="hidden md:block">
        <TopBar>
          <StepPills current={1} />
        </TopBar>
      </div>
      <MobileStepHeader back={ROUTES.terminal} step={1} />

      <main className="mx-auto mt-4 max-w-[1344px] md:mt-10">
        <h1 className="text-[30px] md:text-[44px]">Book a flight</h1>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:mt-7 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-7">
          {mobile ? (
            <>
              {routeCard}
              {formCard}
              {mealCard}
            </>
          ) : (
            <>
              {formCard}
              <div className="flex min-w-0 flex-col gap-7">
                {routeCard}
                {mealCard}
                {cta}
              </div>
            </>
          )}
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
