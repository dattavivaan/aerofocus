import { airport } from '../../data/airports';
import { formatBlock } from '../../engine/duration';
import { SEAT_INFO } from '../../engine/seats';
import type { Booking } from '../../engine/types';
import { clock, distance, MEAL_NAMES, purposeLabel } from '../../lib/format';
import { PlaneIcon } from '../ui/PlaneIcon';

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-ink-label font-mono text-[10px] tracking-[0.12em] uppercase md:text-[11px]">{label}</dt>
      <dd className="text-ink mt-0.5 font-mono text-[14px] font-bold md:text-[16px]">{value}</dd>
    </div>
  );
}

/** Decorative barcode, stable per booking. */
function Barcode({ seed, vertical }: { seed: string; vertical?: boolean }) {
  const bars: number[] = [];
  let h = 7;
  for (let i = 0; i < 46; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length) + i) % 9973;
    bars.push(1 + (h % 4));
  }
  return (
    <div aria-hidden="true" className={`flex ${vertical ? 'h-full flex-col' : 'h-14 w-full'} items-stretch gap-[2px]`}>
      {bars.map((w, i) => (
        <span key={i} className="bg-ink" style={vertical ? { height: w * 1.6, width: '100%' } : { width: w * 1.6, flexGrow: w }} />
      ))}
    </div>
  );
}

function mealSummary(b: Booking): string {
  if (!b.meals.length) return 'None';
  const first = b.meals.find((m) => m.kind === 'hot-meal') ?? b.meals[0];
  const extra = b.meals.length - 1;
  return `${MEAL_NAMES[first.kind]} ${first.lengthMin}m${extra ? ` +${extra}` : ''}`;
}

interface Props {
  booking: Booking;
  passenger: string;
  /** Planned or real departure time. */
  departAt: number;
  boardingAt: number;
  units: 'mi' | 'km';
}

export function BoardingPass({ booking: b, passenger, departAt, boardingAt, units }: Props) {
  const from = airport(b.origin)!;
  const to = airport(b.destination)!;
  const arriveAt = departAt + b.blockMin * 60_000;

  return (
    <article
      aria-label={`Boarding pass, flight ${b.flightNo} from ${from.city} to ${to.city}`}
      className="text-ink mx-auto flex w-full max-w-[1040px] flex-col shadow-[var(--shadow-pass)] md:flex-row"
    >
      <div className="bg-paper flex-1 rounded-t-[24px] p-5 md:rounded-l-[28px] md:rounded-tr-none md:p-8">
        <div className="flex items-center justify-between">
          <span className="font-display flex items-center gap-2 text-[15px] font-bold tracking-[0.14em]">
            <PlaneIcon size={16} rotate={45} /> AEROFOCUS
          </span>
          <span className="text-ink-label font-mono text-[11px] tracking-[0.12em] uppercase">Boarding pass</span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3 md:mt-7">
          <div className="min-w-0">
            <p className="text-ink-label font-mono text-[11px] tracking-[0.12em] uppercase">From</p>
            <p className="font-mono text-[52px] leading-none font-bold md:text-[72px]">{from.iata}</p>
            <p className="mt-1 truncate text-[14px] font-medium">{from.city}</p>
          </div>
          <div className="text-ink-label flex flex-1 items-center gap-2 pb-7 md:pb-10">
            <span className="border-ink-label/50 flex-1 border-t-2 border-dashed" />
            <PlaneIcon size={26} rotate={90} className="text-ink" />
            <span className="border-ink-label/50 flex-1 border-t-2 border-dashed" />
          </div>
          <div className="min-w-0 text-right">
            <p className="text-ink-label font-mono text-[11px] tracking-[0.12em] uppercase">To</p>
            <p className="font-mono text-[52px] leading-none font-bold md:text-[72px]">{to.iata}</p>
            <p className="mt-1 truncate text-[14px] font-medium">{to.city}</p>
          </div>
        </div>

        <dl className="border-ink-label/25 mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-5 md:mt-7 md:grid-cols-4 md:pt-6">
          <Field label="Passenger" value={passenger} />
          <Field label="Flight" value={b.flightNo} />
          <Field label="Gate" value={b.gate} />
          <Field label="Seat" value={`${b.seat} · ${SEAT_INFO[b.seatType].name}`} />
          <Field label="Boarding" value={clock(boardingAt)} />
          <Field label="Departs" value={clock(departAt)} />
          <Field label="Arrives" value={clock(arriveAt)} />
          <Field label="Focus block" value={formatBlock(b.blockMin)} />
          <Field label="Meal service" value={mealSummary(b)} />
          <Field label="Distance" value={distance(b.distanceMi, units)} />
          <Field label="Purpose" value={purposeLabel(b.purpose)} />
          <Field label="Class" value={b.seatType === 'first' ? 'First' : 'Economy'} />
        </dl>
      </div>

      {/* perforation */}
      <div className="bg-paper relative h-0 md:h-auto md:w-0" aria-hidden="true">
        <span className="bg-bg absolute -top-3 -left-3 size-6 rounded-full md:-top-3 md:-left-3" />
        <span className="bg-bg absolute -top-3 -right-3 size-6 rounded-full md:top-auto md:-right-3 md:-bottom-3" />
        <span className="border-ink-label/40 absolute inset-x-4 top-0 border-t-2 border-dashed md:inset-x-auto md:inset-y-4 md:left-0 md:border-t-0 md:border-l-2" />
      </div>

      <div className="bg-paper-stub flex flex-col gap-4 rounded-b-[24px] p-5 md:w-[250px] md:rounded-r-[28px] md:rounded-bl-none md:p-7">
        <dl className="grid grid-cols-4 gap-3 md:grid-cols-2 md:gap-4">
          <Field label="Flight" value={b.flightNo} />
          <Field label="Seat" value={b.seat} />
          <Field label="Block" value={formatBlock(b.blockMin)} />
          <Field label="Route" value={`${from.iata}–${to.iata}`} />
        </dl>
        <div className="mt-auto">
          <Barcode seed={`${b.flightNo}${b.seat}${b.origin}${b.destination}`} />
        </div>
      </div>
    </article>
  );
}
