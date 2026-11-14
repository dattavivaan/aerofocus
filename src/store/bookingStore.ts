import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_SEAT } from '../engine/seats';
import type { Iata, MealService, Purpose } from '../engine/types';

/** The booking being put together (steps 1–4). Kept across reloads. */
interface BookingDraft {
  origin?: Iata;
  destination?: Iata;
  purpose: Purpose;
  /** Preset id, or 'custom'. Undefined = the default for the flight length. */
  mealOption?: string;
  customMeals: MealService[];
  seat: string;
  set(patch: Partial<Omit<BookingDraft, 'set' | 'swap' | 'startFrom'>>): void;
  swap(): void;
  /** Start a fresh booking from an airport (after landing, or a board row). */
  startFrom(origin: Iata, destination?: Iata): void;
}

export const useBooking = create<BookingDraft>()(
  persist(
    (set, get) => ({
      purpose: 'deep-work',
      customMeals: [],
      seat: DEFAULT_SEAT,
      set: (patch) => {
        const routeChanged =
          ('origin' in patch && patch.origin !== get().origin) ||
          ('destination' in patch && patch.destination !== get().destination);
        // A new route has a new length, so the meal plan goes back to default.
        set(routeChanged ? { mealOption: undefined, customMeals: [], ...patch } : patch);
      },
      swap: () => set({ origin: get().destination, destination: get().origin, mealOption: undefined, customMeals: [] }),
      startFrom: (origin, destination) =>
        set({ origin, destination, mealOption: undefined, customMeals: [] }),
    }),
    { name: 'af:draft' },
  ),
);
