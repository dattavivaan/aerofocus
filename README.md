# AeroFocus

A flight-themed focus timer. The real flight time between two airports becomes your focus block, and breaks arrive as meal service. Built from `AeroFocus PRD v2`.

## Run it

```bash
npm install
npm run dev
```

Open the address it prints. In dev mode the in-flight header has a **+5m** button that skips the clock forward so you can try a flight without waiting.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the build (needed to try the installable PWA and offline mode) |
| `npm test` | Engine unit tests (Vitest) |
| `npm run e2e` | Browser flow tests (Playwright). First run: `npx playwright install chromium` |
| `npm run build:airports` | Rebuild `src/data/airports.json` from OurAirports |

When hosting, send every path to `index.html` (single-page app fallback).

## Accounts (optional)

Without setup the app runs in guest mode and saves everything on the device. To turn on sign-in:

1. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
3. In Supabase → Authentication → Providers, enable Email and Google.

Signing in moves the guest's flights into the account. Account data is saved on the device first and synced to Supabase, so flying still works offline. **This path has unit tests for the merge and sync logic but has not been run against a real Supabase project.**

## How it is built

- `src/engine/` — plain TypeScript, no UI: `duration`, `geo` (great-circle math), `schedule` (phases and meals), `timer` (the state machine), `seats`, `stats`, `sky`. Everything is derived from saved timestamps; nothing counts down.
- `src/store/` — Zustand stores: `bookingStore` (the draft), `sessionStore` (the live flight), `profileStore` (totals, stamps, log).
- `src/storage/` — one adapter interface; IndexedDB for guests, Supabase for accounts, `merge.ts` to join them.
- `src/screens/` — Terminal, Booking, Seat, BoardingPass, InFlight, Landing, Passport, FlightLog.
- `src/audio/mixer.ts` — loops and cabin cues are synthesized with the Web Audio API. `src/audio/voice.ts` speaks the crew announcements with the browser's built-in speech. There are no audio files.

## Where this differs from the PRD

| PRD | Built | Why |
| --- | --- | --- |
| SEA → NRT is 10h 05m | 10h 00m | The PRD's "about 4,780 mi" is slightly high. With the real airport coordinates the distance is 4,757 mi, which the PRD's own formula rounds to 600 min. The formula is unchanged and `blockMinFor(4780)` still gives 605. |
| `@turf/*` packages | `engine/geo.ts` | Turf's great-circle line splits at the 180° meridian, which breaks SEA → NRT. |
| "4 of 1,000 airports" | "of 3,245" | The real count from the data. |
| "Long haul (over 4h)" filter | 2–3h and Long haul (over 3h) | One definition of long haul everywhere. |
| Flight numbers "AF###" | "AX###" | AF is Air France's code. |
| Mobile seat map rows 10–18 | All rows 10–21 | Otherwise rows 19–21 can't be picked on a phone. |
| Four audio loop files | Synthesized | No licensing, no download, works offline. |
| Email, Google and Apple sign-in | Email and Google | Apple sign-in was removed on request. |
| One cabin chime | A set of cabin cues | Door close and seatbelt sign at boarding, sign off at cruise, sign on for descent, meal chimes, a buckle click, touchdown with reverse thrust and an arrival chime, a divert alert. The engine sound also follows the flight phase. All cues follow the "Cabin chime alerts" switch. |
| Camera eases every second | One redraw per second | At cruise the plane moves a fraction of a pixel per second; continuous animation would keep the GPU busy for the whole flight. Switching to 3D still eases in. |
| React 18 + Framer Motion | React 18 + `motion` (Framer Motion's current package name) | Same library. Split-flap cells use CSS animation. |
| 60–90 min flights default to no break | One 5 min Beverage Service | Approved open question. Under 60 min: none. |
| First class "to be decided" | Window-seat rules + free meal placement + gold stamp | Approved open question. |
| Streak | Landed flights only | Approved open question. |

## Known limits

- **Crew announcements** use the browser's built-in speech, so the voice differs by device and can sound robotic. They have their own switch in the audio mixer, are off for middle seats, and are skipped where the browser has no speech support.

- **Focus credit is an honor system.** The timer credits flight time whether or not you were working. In an exit-row seat (auto-resume) a closed laptop still earns the full flight.
- **Notifications are best-effort.** Browsers throttle hidden tabs and can't schedule a notification for later, so a break alert can be late and won't fire on a sleeping device. The timer itself is always right when you come back.
- **Map tiles** come from OpenFreeMap. Confirm their terms before a public launch. With no tiles the map shows the route on a plain dark background.
- **Frame-rate fallback** (auto-switch to 2D under 30 fps for 5 s) is implemented but was only exercised on a software renderer.
- `npm audit` reports a `deepmerge` advisory inside `workbox-build`, a build-time dependency of `vite-plugin-pwa`. It is not shipped to the browser.
