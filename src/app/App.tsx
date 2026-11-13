import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from './routes';
import { Placeholder } from '../screens/Placeholder';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path={ROUTES.terminal}
          element={
            <Placeholder
              route="terminal"
              step="Screen 1"
              title="Terminal"
              glows={['10% 6%', '90% 14%', '62% 98%']}
            />
          }
        />
        <Route
          path={ROUTES.booking}
          element={
            <Placeholder
              route="booking"
              step="Screen 2 · Step 1–2 of 4"
              title="Booking"
              glows={['86% 4%', '8% 30%', '50% 100%']}
            />
          }
        />
        <Route
          path={ROUTES.seat}
          element={
            <Placeholder
              route="seat"
              step="Screen 3 · Step 3 of 4"
              title="Choose your seat"
              glows={['50% 0%', '4% 70%', '96% 80%']}
            />
          }
        />
        <Route
          path={ROUTES.pass}
          element={
            <Placeholder
              route="pass"
              step="Screen 4 · Step 4 of 4"
              title="Boarding pass"
              glows={['20% 90%', '80% 6%', '96% 70%']}
            />
          }
        />
        <Route
          path={ROUTES.flight}
          element={
            <Placeholder
              route="flight"
              step="Screen 5"
              title="In flight"
              glows={['94% 60%', '30% 0%', '4% 96%']}
            />
          }
        />
        <Route
          path={ROUTES.landing}
          element={
            <Placeholder
              route="landing"
              step="Screen 6"
              title="Landing"
              glows={['30% 10%', '80% 40%', '14% 92%']}
            />
          }
        />
        <Route
          path={ROUTES.passport}
          element={
            <Placeholder
              route="passport"
              step="Screen 6 · Tab"
              title="Passport"
              glows={['70% 8%', '10% 50%', '86% 94%']}
            />
          }
        />
        <Route
          path={ROUTES.log}
          element={
            <Placeholder
              route="log"
              step="Screen 6 · Tab"
              title="Flight log"
              glows={['6% 20%', '92% 30%', '44% 100%']}
            />
          }
        />
        <Route path="*" element={<Navigate to={ROUTES.terminal} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
