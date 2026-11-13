export const ROUTES = {
  terminal: '/',
  booking: '/book',
  seat: '/seat',
  pass: '/pass',
  flight: '/flight',
  landing: '/landing',
  passport: '/passport',
  log: '/log',
} as const;

export type RouteKey = keyof typeof ROUTES;
