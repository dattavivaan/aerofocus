import { useRef } from 'react';
import { Lock } from 'lucide-react';
import {
  EXIT_ROW,
  FIRST_LETTERS,
  FIRST_ROWS,
  moveSeat,
  seatLabel,
  seatTypeFor,
  type CabinPlan,
  type SeatMove,
} from '../../engine/seats';
import type { SeatType } from '../../engine/types';

interface Props {
  selected: string;
  onSelect: (seat: string) => void;
  firstUnlocked: boolean;
  plan: CabinPlan;
  /** Mobile: nose at the top, rows run down the page. */
  vertical: boolean;
}

const TYPE_STYLE: Record<SeatType, string> = {
  window: 'border-sky/60 text-sky',
  aisle: 'border-border text-muted',
  middle: 'border-border text-muted/80',
  exit: 'border-accent/50 text-accent',
  first: 'border-gold/70 text-gold',
};

export function CabinMap({ selected, onSelect, firstUnlocked, plan, vertical }: Props) {
  const root = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, SeatMove> = vertical
      ? { ArrowUp: 'fore', ArrowDown: 'aft', ArrowLeft: 'port', ArrowRight: 'starboard' }
      : { ArrowLeft: 'fore', ArrowRight: 'aft', ArrowUp: 'port', ArrowDown: 'starboard' };
    const move = map[e.key];
    if (!move) return;
    e.preventDefault();
    const next = moveSeat(selected, move, firstUnlocked, plan);
    if (next !== selected) {
      onSelect(next);
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-seat="${next}"]`)?.focus());
    }
  };

  const seat = (code: string, locked = false) => {
    const type = seatTypeFor(code);
    const on = code === selected;
    return (
      <button
        key={code}
        type="button"
        data-seat={code}
        disabled={locked}
        aria-pressed={on}
        aria-label={locked ? `${seatLabel(code)}, locked until 25 focus hours` : seatLabel(code)}
        tabIndex={on ? 0 : -1}
        onClick={() => onSelect(code)}
        className={`flex size-11 shrink-0 cursor-pointer lg:size-[52px] lg:text-[12px] items-center justify-center rounded-[12px_12px_8px_8px] border font-mono text-[11px] font-semibold transition enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed ${
          on
            ? 'seat-pop bg-accent border-accent text-on-accent shadow-[0_0_18px_rgba(142,193,255,0.45)]'
            : locked
              ? 'border-border text-muted/50 bg-surface-sunk'
              : `bg-surface-sunk hover:bg-surface ${TYPE_STYLE[type]}`
        } ${type === 'first' ? (vertical ? '!w-[52px]' : '!h-[52px] lg:!h-[64px]') : ''}`}
      >
        {locked ? <Lock size={13} aria-hidden="true" /> : code}
      </button>
    );
  };

  const rowNum = (n: number) => (
    <span
      className={`flex shrink-0 flex-col items-center justify-center font-mono text-[11px] ${vertical ? 'w-9' : 'h-9'} ${n === EXIT_ROW ? 'text-accent' : 'text-muted'}`}
      aria-hidden="true"
    >
      {n}
      {n === EXIT_ROW && <span className="text-[8px] tracking-widest">EXIT</span>}
    </span>
  );

  const row = (n: number, letters: readonly string[], locked: boolean, index = 0) => {
    const half = letters.length / 2;
    return (
      <div
        key={n}
        style={{ animationDelay: `${Math.min(index, 22) * 22}ms` }}
        className={`seat-row-in flex items-center ${vertical ? 'flex-row gap-1' : 'flex-col gap-1 lg:gap-1.5'} ${n === EXIT_ROW ? (vertical ? 'mt-3' : 'ml-3') : ''}`}
      >
        {letters.slice(0, half).map((l) => seat(`${n}${l}`, locked))}
        {rowNum(n)}
        {letters.slice(half).map((l) => seat(`${n}${l}`, locked))}
      </div>
    );
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label="Cabin seat map. Use the arrow keys to move between seats."
      onKeyDown={onKeyDown}
      className={vertical ? '' : 'overflow-x-auto pb-2'}
    >
     <div className={`mx-auto flex w-fit ${vertical ? 'flex-col items-center' : 'items-stretch'}`}>
      {/* nose */}
      <div
        aria-hidden="true"
        className={`border-border bg-surface-sunk shrink-0 border ${
          vertical ? 'h-16 w-full rounded-t-[140px] border-b-0' : 'w-28 rounded-l-[180px] border-r-0'
        }`}
      />
      <div
        className={`border-border flex border ${
          vertical ? 'flex-col items-center gap-1 rounded-b-3xl border-t-0 px-2 pt-1 pb-4' : 'items-center gap-1 rounded-r-3xl border-l-0 py-4 pr-5 pl-1'
        }`}
      >
        {plan.hasFirst && (
          <>
            <div className={`flex ${vertical ? 'flex-col gap-1' : 'gap-1 lg:gap-2'}`}>
              {FIRST_ROWS.map((n, i) => row(n, FIRST_LETTERS, !firstUnlocked, i))}
            </div>
            <span className={`label !text-[9px] ${vertical ? 'my-2' : 'mx-2 [writing-mode:vertical-rl]'}`}>
              {firstUnlocked ? 'First class' : 'First · 25 h to unlock'}
            </span>
          </>
        )}
        <div className={`flex ${vertical ? 'flex-col gap-1' : 'gap-1 lg:gap-2'}`}>
          {plan.rows.map((n, i) => row(n, plan.letters, false, i + (plan.hasFirst ? FIRST_ROWS.length : 0)))}
        </div>
      </div>
     </div>
    </div>
  );
}
