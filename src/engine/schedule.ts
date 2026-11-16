import { haulFor } from './duration';
import type { MealService } from './types';

export const CRUISE_BUFFER_MIN = 15; // climb at the start, descent at the end
export const MIN_LEG_MIN = 15; // shortest allowed work leg
export const DELAY_MIN = 10;

export type Phase = 'taxiing' | 'climbing' | 'cruising' | 'meal' | 'descending';

export interface PlacementRules {
  /** First class and the jet: meals may go anywhere, with 5 min legs. */
  free?: boolean;
  /** Private jet: breaks are placed to the minute and can be 1–60 min long. */
  flex?: boolean;
}

/** The step (min) breaks snap to when dragged or moved with the keys. */
export const stepFor = (rules?: PlacementRules): number => (rules?.flex ? 1 : 5);
export const MAX_FLEX_BREAK_MIN = 60;

const round5 = (n: number) => 5 * Math.round(n / 5);

export function sortMeals(meals: MealService[]): MealService[] {
  return [...meals].sort((a, b) => a.startMin - b.startMin);
}

export function mealTotalMin(meals: MealService[]): number {
  return meals.reduce((s, m) => s + m.lengthMin, 0);
}

/** Why a meal plan is not allowed, or [] when it is fine. */
export function validateMeals(blockMin: number, meals: MealService[], rules: PlacementRules = {}): string[] {
  const errors: string[] = [];
  const loose = rules.free || rules.flex;
  const edge = loose ? 5 : CRUISE_BUFFER_MIN;
  const minLeg = loose ? 5 : MIN_LEG_MIN;
  const sorted = sortMeals(meals);
  let prevEnd = 0;
  sorted.forEach((m, i) => {
    const end = m.startMin + m.lengthMin;
    if (m.lengthMin <= 0) errors.push(`Meal ${i + 1} has no length`);
    if (rules.flex && m.lengthMin > MAX_FLEX_BREAK_MIN) errors.push(`Meal ${i + 1} is over ${MAX_FLEX_BREAK_MIN} min`);
    if (m.startMin < edge || end > blockMin - edge)
      errors.push(`Meal ${i + 1} must sit inside cruising`);
    if (m.startMin - prevEnd < minLeg) errors.push(`Work leg before meal ${i + 1} is under ${minLeg} min`);
    prevEnd = end;
  });
  if (sorted.length && blockMin - prevEnd < minLeg) errors.push(`Final work leg is under ${minLeg} min`);
  return errors;
}

/** n services spread so that the work legs are as even as possible. */
export function spreadMeals(blockMin: number, parts: Pick<MealService, 'kind' | 'lengthMin'>[]): MealService[] {
  const work = blockMin - parts.reduce((s, p) => s + p.lengthMin, 0);
  const leg = work / (parts.length + 1);
  let used = 0;
  return parts.map((p, i) => {
    const startMin = round5(leg * (i + 1) + used);
    used += p.lengthMin;
    return { kind: p.kind, startMin, lengthMin: p.lengthMin };
  });
}

export interface MealOption {
  id: string;
  label: string;
  meals: MealService[];
  isDefault?: boolean;
}

/** Preset meal plans for a flight length. Invalid ones are left out. */
export function mealOptions(blockMin: number): MealOption[] {
  const haul = haulFor(blockMin);
  const opts: MealOption[] = [];
  const add = (id: string, label: string, parts: Pick<MealService, 'kind' | 'lengthMin'>[], isDefault = false) => {
    const meals = spreadMeals(blockMin, parts);
    if (validateMeals(blockMin, meals).length === 0) opts.push({ id, label, meals, isDefault });
  };

  if (haul === 'short') {
    opts.push({ id: 'none', label: 'No service', meals: [], isDefault: blockMin < 60 });
    add('bev-5', 'Beverage Service · 5 min', [{ kind: 'beverage', lengthMin: 5 }], blockMin >= 60);
    add('bev-10', 'Beverage Service · 10 min', [{ kind: 'beverage', lengthMin: 10 }]);
  } else if (haul === 'medium') {
    add('snack-15', 'Snack & Beverage · 15 min', [{ kind: 'snack', lengthMin: 15 }], true);
    add('snack-10', 'Snack & Beverage · 10 min', [{ kind: 'snack', lengthMin: 10 }]);
    add('snack-2x10', '2 × Snack & Beverage · 10 min', [
      { kind: 'snack', lengthMin: 10 },
      { kind: 'snack', lengthMin: 10 },
    ]);
    add('snack-2x15', '2 × Snack & Beverage · 15 min', [
      { kind: 'snack', lengthMin: 15 },
      { kind: 'snack', lengthMin: 15 },
    ]);
    opts.push({ id: 'none', label: 'No service', meals: [] });
  } else {
    add('hot-25', 'Hot Meal · 25 min', [{ kind: 'hot-meal', lengthMin: 25 }], true);
    add('hot-20', 'Hot Meal · 20 min', [{ kind: 'hot-meal', lengthMin: 20 }]);
    add('hot-30', 'Hot Meal · 30 min', [{ kind: 'hot-meal', lengthMin: 30 }]);
    // One service about every 90 min; the middle one is the hot meal.
    const n = Math.max(2, Math.round(blockMin / 90) - 1);
    const mid = Math.floor((n - 1) / 2);
    for (const cart of [10, 5]) {
      const parts = Array.from({ length: n }, (_, i) =>
        i === mid
          ? ({ kind: 'hot-meal', lengthMin: 25 } as const)
          : ({ kind: 'refreshment', lengthMin: cart } as const),
      );
      add(`hot-carts-${cart}`, `Hot Meal + ${n - 1} Refreshment Cart${n > 2 ? 's' : ''} · ${cart} min`, parts);
    }
    opts.push({ id: 'none', label: 'No service', meals: [] });
  }
  if (!opts.some((o) => o.isDefault) && opts[0]) opts[0].isDefault = true;
  return opts;
}

export function defaultMeals(blockMin: number): MealService[] {
  const opts = mealOptions(blockMin);
  return (opts.find((o) => o.isDefault) ?? opts[0]).meals;
}

export interface Leg {
  type: 'work' | 'meal';
  startMin: number;
  endMin: number;
  meal?: MealService;
}

/** The flight as alternating work legs and meal services (for the timeline). */
export function legs(blockMin: number, meals: MealService[]): Leg[] {
  const out: Leg[] = [];
  let t = 0;
  for (const m of sortMeals(meals)) {
    if (m.startMin > t) out.push({ type: 'work', startMin: t, endMin: m.startMin });
    out.push({ type: 'meal', startMin: m.startMin, endMin: m.startMin + m.lengthMin, meal: m });
    t = m.startMin + m.lengthMin;
  }
  if (t < blockMin) out.push({ type: 'work', startMin: t, endMin: blockMin });
  return out;
}

export function phaseAt(blockMin: number, meals: MealService[], elapsedMin: number): Phase {
  if (meals.some((m) => elapsedMin >= m.startMin && elapsedMin < m.startMin + m.lengthMin)) return 'meal';
  const climb = Math.min(CRUISE_BUFFER_MIN, blockMin / 2);
  if (elapsedMin < climb / 3) return 'taxiing';
  if (elapsedMin < climb) return 'climbing';
  if (elapsedMin >= blockMin - climb) return 'descending';
  return 'cruising';
}

/** Minutes of focus (not meal) time inside the first `elapsedMin` of flight. */
export function focusMinAt(meals: MealService[], elapsedMin: number): number {
  let inMeals = 0;
  for (const m of meals) {
    inMeals += Math.min(Math.max(elapsedMin - m.startMin, 0), m.lengthMin);
  }
  return Math.max(0, elapsedMin - inMeals);
}

/**
 * Push meal `index` back 10 min (aisle seats). The leg after it gets 10 min
 * shorter and the total is unchanged. Returns null when that would break the
 * placement rules or the meal was already delayed.
 */
export function delayMeal(blockMin: number, meals: MealService[], index: number, rules: PlacementRules = {}): MealService[] | null {
  const sorted = sortMeals(meals);
  const m = sorted[index];
  if (!m || m.delayed) return null;
  const next = sorted.map((x, i) => (i === index ? { ...x, startMin: x.startMin + DELAY_MIN, delayed: true } : x));
  return validateMeals(blockMin, next, rules).length === 0 ? next : null;
}
