// Shared data model. All times are UTC epoch milliseconds.

export type Iata = string; // 'SEA'

export interface Airport {
  iata: Iata;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  tz: string;
  large: boolean;
}

export type SeatType = 'window' | 'aisle' | 'middle' | 'exit' | 'first';
export type Purpose = 'deep-work' | 'coding' | 'studying' | 'writing';
export type Haul = 'short' | 'medium' | 'long';

export interface MealService {
  kind: 'beverage' | 'snack' | 'hot-meal' | 'refreshment';
  startMin: number;
  lengthMin: number;
  delayed?: boolean;
}

export interface Booking {
  id: string;
  createdAt: number;
  origin: Iata;
  destination: Iata;
  distanceMi: number;
  blockMin: number;
  flightNo: string;
  gate: string;
  purpose: Purpose;
  seat: string;
  seatType: SeatType;
  meals: MealService[];
}

export type SessionState =
  | 'booked'
  | 'boarding'
  | 'focus'
  | 'meal'
  | 'seatbelt'
  | 'landed'
  | 'diverted';

export interface Session {
  id: string;
  bookingId: string;
  state: SessionState;
  departedAt?: number;
  endedAt?: number;
  pauses: { from: number; to?: number }[]; // seatbelt waits only
  events: { at: number; type: string }[]; // audit trail for recovery
  focusedMin: number; // set when the session ends
}

export interface Stamp {
  iata: Iata;
  visits: number;
  firstAt: number;
  lastAt: number;
}

export type AudioChannel = 'cabin' | 'rain' | 'lofi' | 'chime' | 'voice';

export interface Profile {
  homeAirport?: Iata;
  units: 'mi' | 'km';
  totals: { focusMin: number; miles: number; flights: number; diverted: number };
  streak: { current: number; best: number; lastDay?: string }; // lastDay = local 'YYYY-MM-DD'
  firstClassUnlocked: boolean;
  firstClassNoticeShown: boolean;
  audio: Record<AudioChannel, { on: boolean; vol: number }>;
}
