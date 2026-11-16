import { motion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ROUTES } from '../../app/routes';
import { useReducedMotion } from '../../lib/hooks';
import { PlaneIcon } from './PlaneIcon';
import { Scene, type SceneName } from './Scene';

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
      className={`glass glass-refract sticky top-3 z-30 mx-auto flex w-full max-w-[1344px] items-center justify-between gap-3 rounded-full py-1.5 pr-2 pl-4 md:pl-6 ${className}`}
    >
      <Wordmark iconOnlyOnMobile={compact} />
      {children}
    </header>
  );
}

const STEPS = [
  { n: 1, label: 'Route & meals', to: ROUTES.booking },
  { n: 2, label: 'Seat', to: ROUTES.seat },
  { n: 3, label: 'Boarding pass', to: ROUTES.pass },
];

/** Where the highlight sat on the previous screen, so it can glide to the new step. */
let lastStep = 0;

/** The three booking steps. `current` is 1–3. The highlight is a liquid blob that slides and stretches between steps. */
export function StepPills({ current }: { current: number }) {
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const reduced = useReducedMotion();
  const [span, setSpan] = useState<{ from: { x: number; w: number }; to: { x: number; w: number } } | null>(null);

  useLayoutEffect(() => {
    const at = (n: number) => {
      const el = items.current[n - 1];
      return el && el.offsetWidth ? { x: el.offsetLeft, w: el.offsetWidth } : null;
    };
    const to = at(current);
    if (to) setSpan({ from: (lastStep && !reduced && at(lastStep)) || to, to });
    lastStep = current;
  }, [current, reduced]);

  return (
    <ol className="relative hidden items-center gap-1 md:flex" aria-label="Booking steps">
      {span && (
        <motion.span
          aria-hidden="true"
          className="btn-gel absolute top-0 left-0 h-full rounded-full"
          initial={{ x: span.from.x, width: span.from.w }}
          animate={{ x: span.to.x, width: span.to.w }}
          transition={{ type: 'spring', stiffness: 240, damping: 17, mass: 0.9 }}
        />
      )}
      {STEPS.map((s, i) => (
        <li key={s.n} ref={(el) => void (items.current[i] = el)} className="relative z-10">
          <span
            aria-current={s.n === current ? 'step' : undefined}
            className={`label flex min-h-9 items-center gap-2 rounded-full px-3 transition-colors duration-300 ${
              s.n === current ? '!text-on-accent delay-150' : s.n < current ? '!text-text' : ''
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

/** Mobile header for booking steps: back button + "STEP n OF 3". */
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
      <span className="label">Step {step} of 3</span>
    </div>
  );
}

export function Screen({
  glows,
  scene = 'quiet',
  children,
  className = '',
}: {
  glows: [string, string, string];
  scene?: SceneName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`screen-bg page-in min-h-dvh overflow-x-clip px-4 pt-3 pb-10 md:px-8 ${className}`}
      style={{ '--glow-1': glows[0], '--glow-2': glows[1], '--glow-3': glows[2] } as React.CSSProperties}
    >
      <Scene name={scene} />
      {children}
    </div>
  );
}
