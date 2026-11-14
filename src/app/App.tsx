import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from './routes';
import { initAuth } from '../auth/auth';
import { Booking } from '../screens/Booking';
import { InFlight } from '../screens/InFlight';
import { BoardingPassScreen } from '../screens/BoardingPassScreen';
import { FlightLog } from '../screens/FlightLog';
import { Landing } from '../screens/Landing';
import { Passport } from '../screens/Passport';
import { Seat } from '../screens/Seat';
import { Terminal } from '../screens/Terminal';
import { useProfile } from '../store/profileStore';
import { useSession } from '../store/sessionStore';

export function App() {
  const hydrated = useProfile((s) => s.hydrated);

  useEffect(() => {
    void (async () => {
      await initAuth();
      if (!useProfile.getState().hydrated) await useProfile.getState().hydrate();
      useSession.getState().resume();
    })();
  }, []);

  if (!hydrated) return <div className="screen-bg min-h-dvh" aria-busy="true" />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.terminal} element={<Terminal />} />
        <Route path={ROUTES.booking} element={<Booking />} />
        <Route path={ROUTES.seat} element={<Seat />} />
        <Route path={ROUTES.pass} element={<BoardingPassScreen />} />
        <Route path={ROUTES.flight} element={<InFlight />} />
        <Route path={ROUTES.landing} element={<Landing />} />
        <Route path={ROUTES.passport} element={<Passport />} />
        <Route path={ROUTES.log} element={<FlightLog />} />
        <Route path="*" element={<Navigate to={ROUTES.terminal} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
