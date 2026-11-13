import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, type RouteKey } from '../app/routes';

const ORDER: RouteKey[] = [
  'terminal',
  'booking',
  'seat',
  'pass',
  'flight',
  'landing',
  'passport',
  'log',
];

interface Props {
  route: RouteKey;
  step: string;
  title: string;
  glows: [string, string, string];
}

/** Phase 0 stand-in for a screen: proves routing, tokens, fonts and glass. */
export function Placeholder({ route, step, title, glows }: Props) {
  const style = {
    '--glow-1': glows[0],
    '--glow-2': glows[1],
    '--glow-3': glows[2],
  } as CSSProperties;

  return (
    <main className="screen-bg min-h-dvh px-4 py-4 md:px-8 md:py-6" style={style}>
      <nav
        aria-label="Screens"
        className="glass mx-auto flex max-w-[1280px] items-center gap-2 overflow-x-auto rounded-full px-4 py-2"
      >
        <span className="font-display mr-2 shrink-0 text-[20px] font-bold tracking-[0.14em]">
          AEROFOCUS
        </span>
        {ORDER.map((key) => (
          <Link
            key={key}
            to={ROUTES[key]}
            aria-current={key === route ? 'page' : undefined}
            className={`label flex min-h-11 shrink-0 items-center rounded-full px-3 ${
              key === route ? 'bg-accent !text-on-accent' : 'hover:text-text'
            }`}
          >
            {key}
          </Link>
        ))}
      </nav>

      <section className="card mx-auto mt-6 max-w-[1280px] p-[18px] md:p-7">
        <p className="label">{step}</p>
        <h1 className="mt-2 text-[38px] leading-tight md:text-[44px]">{title}</h1>
        <p className="text-muted mt-3 max-w-prose text-[15px] md:text-[17px]">
          Blank page for now. This screen is built in a later phase.
        </p>
        <p className="text-accent mt-6 font-mono text-[58px] leading-none font-bold">01:50:00</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-semibold">
            accent
          </span>
          <span className="text-sky border-border rounded-full border px-4 py-2 font-mono text-sm">
            sky
          </span>
          <span className="bg-divert-bg text-divert rounded-full px-4 py-2 text-sm font-semibold">
            divert
          </span>
          <span className="bg-paper text-ink rounded-full px-4 py-2 font-mono text-sm">paper</span>
          <span className="bg-surface-sunk border-border rounded-full border px-4 py-2 text-sm">
            sunk
          </span>
        </div>
      </section>
    </main>
  );
}
