import { Link } from 'react-router-dom';
import { ROUTES } from '../app/routes';
import { finishedFlights, FlightList } from '../components/Records';
import { MainNav, Screen, TopBar } from '../components/ui/TopBar';
import { useProfile } from '../store/profileStore';

export function FlightLog() {
  const { bookings, sessions, profile } = useProfile();
  const flights = finishedFlights(bookings, sessions);
  return (
    <Screen glows={['6% 18%', '94% 28%', '44% 102%']}>
      <TopBar compact>
        <MainNav />
      </TopBar>
      <main className="mx-auto mt-6 max-w-[900px] md:mt-10">
        <h1 className="text-[30px] md:text-[44px]">Flight log</h1>
        <p className="label mt-2">
          {profile.totals.flights} landed · {profile.totals.diverted} diverted
        </p>
        <section className="card mt-5 p-[18px] md:mt-7 md:p-7" aria-label="Past flights">
          <FlightList flights={flights} />
          {!flights.length && (
            <Link to={ROUTES.booking} className="text-accent mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              Book your first flight
            </Link>
          )}
        </section>
      </main>
    </Screen>
  );
}
