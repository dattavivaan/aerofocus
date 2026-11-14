import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ROUTES } from '../../app/routes';
import { PlaneIcon } from './PlaneIcon';

export function Wordmark({ iconOnlyOnMobile }: { iconOnlyOnMobile?: boolean }) {
  return (
    <Link to={ROUTES.terminal} className="flex min-h-11 shrink-0 items-center gap-2" aria-label="AeroFocus home">
      <PlaneIcon size={18} rotate={45} className="text-accent" />
      <span className={`font-display text-[17px] font-bold tracking-[0.14em] md:text-[20px] ${iconOnlyOnMobile ? 'hidden md:inline' : ''}`}>AEROFOCUS</span>
    </Link>
  );
}

/** Glass pill top bar. Floats over the page glows. */
export function TopBar({ children, className = '', compact }: { children?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <header
      className={`glass sticky top-3 z-30 mx-auto flex w-full max-w-[1344px] items-center justify-between gap-3 rounded-full py-1.5 pr-2 pl-4 md:pl-6 ${className}`}
    >
      <Wordmark iconOnlyOnMobile={compact} />
      {children}
    </header>
  );
}

const STEPS = [
  { n: 1, label: 'Route', to: ROUTES.booking },
  { n: 2, label: 'Meal service', to: ROUTES.booking },
  { n: 3, label: 'Seat', to: ROUTES.seat },
  { n: 4, label: 'Boarding pass', to: ROUTES.pass },
];

/** The four booking steps. `current` is 1–4. */
export function StepPills({ current }: { current: number }) {
  return (
    <ol className="hidden items-center gap-1 md:flex" aria-label="Booking steps">
      {STEPS.map((s) => (
        <li key={s.n}>
          <span
            aria-current={s.n === current ? 'step' : undefined}
            className={`label flex min-h-9 items-center gap-2 rounded-full px-3 ${
              s.n === current ? 'bg-accent !text-on-accent' : s.n < current ? '!text-text' : ''
            }`}
          >
            <span className="opacity-70">{s.n}</span>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

const TABS = [
  { label: 'Book', to: ROUTES.booking },
  { label: 'Passport', to: ROUTES.passport },
  { label: 'Flight log', to: ROUTES.log },
];

export function MainNav() {
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `label flex min-h-11 items-center rounded-full px-3 md:px-4 ${isActive ? 'bg-accent !text-on-accent' : 'hover:!text-text'}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Mobile header for booking steps: back button + "STEP n OF 4". */
export function MobileStepHeader({ back, step, title }: { back: string; step: number; title?: string }) {
  return (
    <div className="flex items-center justify-between md:hidden">
      <Link
        to={back}
        aria-label="Back"
        className="bg-surface border-border flex size-11 items-center justify-center rounded-full border text-lg"
      >
        ←
      </Link>
      {title && <span className="font-display text-[17px] font-bold">{title}</span>}
      <span className="label">Step {step} of 4</span>
    </div>
  );
}

export function Screen({ glows, children, className = '' }: { glows: [string, string, string]; children: ReactNode; className?: string }) {
  return (
    <div
      className={`screen-bg min-h-dvh overflow-x-clip px-4 pt-3 pb-10 md:px-8 ${className}`}
      style={{ '--glow-1': glows[0], '--glow-2': glows[1], '--glow-3': glows[2] } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
