import { useReducedMotion } from '../../lib/hooks';

/** One split-flap cell. Flips once on load, staggered by `delay`. */
export function FlapCell({ char, delay = 0, tone = 'text' }: { char: string; delay?: number; tone?: 'text' | 'accent' | 'sky' }) {
  const reduced = useReducedMotion();
  const color = tone === 'accent' ? 'text-accent' : tone === 'sky' ? 'text-sky' : 'text-text';
  return (
    <span
      className={`flap ${color} ${reduced ? '' : 'flap-anim'}`}
      style={reduced ? undefined : { animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      {char === ' ' ? ' ' : char}
    </span>
  );
}

/** A word in split-flap cells, padded to `width`. Screen readers get the text. */
export function FlapText({ text, width, delay = 0, tone }: { text: string; width?: number; delay?: number; tone?: 'text' | 'accent' | 'sky' }) {
  const padded = width ? text.toUpperCase().slice(0, width).padEnd(width, ' ') : text.toUpperCase();
  return (
    <span className="inline-flex gap-[2px]">
      <span className="sr-only">{text}</span>
      {[...padded].map((c, i) => (
        <FlapCell key={i} char={c} delay={delay + i * 28} tone={tone} />
      ))}
    </span>
  );
}
