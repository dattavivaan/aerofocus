import { signOut, useAuth } from '../auth/auth';
import { AirportField } from '../components/AirportField';
import { FirstClassNotice } from '../components/FirstClassNotice';
import { PassportGrid, StatTiles } from '../components/Records';
import { Button } from '../components/ui/Button';
import { MainNav, Screen, TopBar } from '../components/ui/TopBar';
import { guessHomeAirport } from '../data/airports';
import { accessFor, CABIN_CLASSES, CABIN_NAMES, UNLOCK_MIN } from '../engine/seats';
import { useIsMobile, useNow } from '../lib/hooks';
import { useProfile } from '../store/profileStore';

export function Passport() {
  const mobile = useIsMobile();
  const now = useNow(60_000);
  const { profile, stamps, updateProfile } = useProfile();
  const user = useAuth((s) => s.user);
  const access = accessFor(profile.totals.focusMin, profile.firstClassUnlocked);
  const nextClass = CABIN_CLASSES.find((c) => !access[c]);
  const toGo = nextClass ? Math.max(0, UNLOCK_MIN[nextClass] - profile.totals.focusMin) : 0;
  const pct = nextClass ? Math.min(100, (profile.totals.focusMin / UNLOCK_MIN[nextClass]) * 100) : 100;
  const slots = Math.max(mobile ? 8 : 12, Math.ceil((stamps.length + 1) / 4) * 4);

  return (
    <Screen scene="quiet" glows={['72% 6%', '8% 52%', '88% 96%']}>
      <TopBar compact>
        <MainNav />
      </TopBar>
      <main className="mx-auto mt-6 flex max-w-[1344px] flex-col gap-5 md:mt-10 md:gap-7">
        <h1 className="text-[30px] md:text-[44px]">Passport</h1>
        <StatTiles profile={profile} now={now} />
        <div className="grid gap-5 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] md:gap-7">
          <section className="card p-[18px] md:p-7" aria-labelledby="st-title">
            <h2 id="st-title" className="mb-4 text-[22px]">
              Stamps
            </h2>
            <PassportGrid stamps={stamps} slots={slots} size={mobile ? 74 : 150} />
          </section>

          <div className="flex min-w-0 flex-col gap-5 md:gap-7">
            <section className="card p-[18px] md:p-7" aria-labelledby="fc-h">
              <h2 id="fc-h" className="text-[22px]">
                Cabin classes
              </h2>
              <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
                {CABIN_CLASSES.map((c) => (
                  <li key={c} className="flex items-center justify-between gap-3">
                    <span className={access[c] ? 'text-text' : 'text-muted'}>{CABIN_NAMES[c]}</span>
                    <span className={`font-mono text-[12px] ${access[c] ? 'text-accent' : 'text-muted'}`}>
                      {access[c] ? 'Unlocked' : `${UNLOCK_MIN[c] / 60} h`}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3">
                  <span className={access.first ? 'text-text' : 'text-muted'}>Private jet</span>
                  <span className={`font-mono text-[12px] ${access.first ? 'text-gold' : 'text-muted'}`}>{access.first ? 'Unlocked' : 'With first class'}</span>
                </li>
              </ul>
              <p className="text-muted mt-3 text-[14px]">
                {nextClass
                  ? `${(toGo / 60).toFixed(1)} focus hours to ${CABIN_NAMES[nextClass]}. Diverted minutes count too.`
                  : 'Every cabin and the private jet are open.'}
              </p>
              <div className="bg-surface-sunk border-border mt-4 h-3 overflow-hidden rounded-full border" role="progressbar" aria-valuemin={0} aria-valuemax={nextClass ? UNLOCK_MIN[nextClass] / 60 : 50} aria-valuenow={nextClass ? Math.min(UNLOCK_MIN[nextClass] / 60, Math.round(profile.totals.focusMin / 60)) : 50} aria-label={`Focus hours towards ${nextClass ? CABIN_NAMES[nextClass] : 'the top cabin'}`}>
                <div className="bg-accent h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </section>

            <section className="card flex flex-col gap-5 p-[18px] md:p-7" aria-labelledby="set-h">
              <h2 id="set-h" className="text-[22px]">
                Settings
              </h2>
              {access.first && (
                <fieldset>
                  <legend className="label mb-2">Appearance</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['navy', 'Navy'],
                      ['gold', 'First class gold'],
                    ] as const).map(([id, name]) => (
                      <label
                        key={id}
                        className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full border text-[14px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--accent)] ${
                          profile.theme === id ? 'bg-accent border-accent text-on-accent' : 'border-border text-muted'
                        }`}
                      >
                        <input type="radio" name="theme" className="sr-only" checked={profile.theme === id} onChange={() => updateProfile({ theme: id })} />
                        {name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <AirportField
                label="Home airport"
                value={profile.homeAirport ?? guessHomeAirport().iata}
                onChange={(iata) => updateProfile({ homeAirport: iata })}
              />
              <fieldset>
                <legend className="label mb-2">Distance units</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['mi', 'km'] as const).map((u) => (
                    <label
                      key={u}
                      className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full border text-[14px] font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--accent)] ${
                        profile.units === u ? 'bg-accent border-accent text-on-accent' : 'border-border text-muted'
                      }`}
                    >
                      <input type="radio" name="units" className="sr-only" checked={profile.units === u} onChange={() => updateProfile({ units: u })} />
                      {u === 'mi' ? 'Miles' : 'Kilometres'}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="border-border border-t pt-4">
                <p className="label mb-1">Account</p>
                {user ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[14px]">{user.email}</span>
                    <Button variant="secondary" onClick={() => void signOut()}>
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted text-[14px]">Guest Pass. Everything is saved on this device only.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      <FirstClassNotice />
    </Screen>
  );
}
