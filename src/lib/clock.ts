// One clock for the whole app. In dev builds it can be skipped forward so a
// flight can be tried without waiting (see the "Skip 5 min" button).
let skewMs = 0;

export const now = (): number => Date.now() + skewMs;

export function skipAhead(ms: number): void {
  if (import.meta.env.DEV) skewMs += ms;
}
