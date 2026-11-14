import { useRef } from 'react';
import { CRUISE_BUFFER_MIN, legs, sortMeals, validateMeals, type PlacementRules } from '../engine/schedule';
import { formatBlock } from '../engine/duration';
import type { MealService } from '../engine/types';
import { MEAL_NAMES } from '../lib/format';

interface Props {
  blockMin: number;
  meals: MealService[];
  /** Minutes flown: draws the "now" marker and fills the flown part. */
  nowMin?: number;
  /** Custom mode: meals can be dragged or moved with the arrow keys. */
  onChange?: (meals: MealService[]) => void;
  rules?: PlacementRules;
  thin?: boolean;
  startLabel?: string;
  endLabel?: string;
}

/** The flight as a bar of work legs and meal services. */
export function MealTimeline({ blockMin, meals, nowMin, onChange, rules, thin, startLabel, endLabel }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const sorted = sortMeals(meals);
  const pct = (min: number) => `${(min / blockMin) * 100}%`;
  const edge = rules?.free ? 5 : CRUISE_BUFFER_MIN;

  const tryMove = (index: number, startMin: number) => {
    if (!onChange) return;
    const next = sorted.map((m, i) => (i === index ? { ...m, startMin } : m));
    if (validateMeals(blockMin, next, rules).length === 0) onChange(next);
  };

  const onPointerDown = (index: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!onChange || !bar.current) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const width = bar.current.getBoundingClientRect().width;
    const x0 = e.clientX;
    const start0 = sorted[index].startMin;
    const move = (ev: PointerEvent) => {
      const d = ((ev.clientX - x0) / width) * blockMin;
      tryMove(index, 5 * Math.round((start0 + d) / 5));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const onKey = (index: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      tryMove(index, sorted[index].startMin + (e.key === 'ArrowRight' ? 5 : -5));
    }
  };

  return (
    <div>
      <div
        ref={bar}
        className={`bg-surface-sunk border-border relative w-full overflow-hidden rounded-full border ${thin ? 'h-2.5' : 'h-9'}`}
      >
        {/* climb and descent */}
        {!thin && (
          <>
            <div className="absolute inset-y-0 left-0 bg-white/5" style={{ width: pct(Math.min(edge, blockMin / 2)) }} />
            <div className="absolute inset-y-0 right-0 bg-white/5" style={{ width: pct(Math.min(edge, blockMin / 2)) }} />
          </>
        )}
        {nowMin !== undefined && (
          <div className="bg-accent/35 absolute inset-y-0 left-0" style={{ width: pct(Math.min(nowMin, blockMin)) }} />
        )}
        {sorted.map((m, i) =>
          onChange ? (
            <button
              key={i}
              type="button"
              onPointerDown={onPointerDown(i)}
              onKeyDown={onKey(i)}
              aria-label={`${MEAL_NAMES[m.kind]}, ${m.lengthMin} minutes, starts at ${formatBlock(m.startMin)}. Use left and right arrow keys to move.`}
              className="bg-sky absolute inset-y-0 cursor-grab touch-none rounded-sm active:cursor-grabbing"
              style={{ left: pct(m.startMin), width: pct(m.lengthMin), minWidth: 10 }}
            />
          ) : (
            <div
              key={i}
              className="bg-sky absolute inset-y-0"
              style={{ left: pct(m.startMin), width: pct(m.lengthMin), minWidth: 3 }}
            />
          ),
        )}
        {nowMin !== undefined && (
          <div
            className="bg-accent absolute inset-y-0 w-[3px] rounded-full shadow-[0_0_8px_var(--accent)]"
            style={{ left: `calc(${pct(Math.min(nowMin, blockMin))} - 1.5px)` }}
            aria-hidden="true"
          />
        )}
      </div>
      {!thin && (
        <div className="relative mt-2 h-5">
          {legs(blockMin, sorted).map((l, i) => (
            <span
              key={i}
              className={`absolute -translate-x-1/2 font-mono text-[11px] whitespace-nowrap ${l.type === 'meal' ? 'text-sky' : 'text-muted'}`}
              style={{ left: pct((l.startMin + l.endMin) / 2) }}
            >
              {l.endMin - l.startMin}m
            </span>
          ))}
        </div>
      )}
      {(startLabel || endLabel) && (
        <div className="label mt-1 flex justify-between !text-[11px]">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}
