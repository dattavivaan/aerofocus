import { skyAt } from '../engine/sky';

const STARS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 37 + 13) % 100,
  y: (i * 53 + 7) % 62,
  r: 0.5 + ((i * 7) % 3) * 0.3,
}));

/** The view from a window seat. The sky follows progress through the flight. */
export function CabinWindow({ progress, compact }: { progress: number; compact?: boolean }) {
  const sky = skyAt(progress);
  return (
    <div className={`bg-surface border-border flex items-center justify-center rounded-[24px] border ${compact ? 'p-3' : 'p-5'}`}>
      <div
        role="img"
        aria-label={`Cabin window: ${sky.label.toLowerCase()}`}
        className={`relative overflow-hidden border-[6px] border-[#232b36] shadow-[inset_0_0_24px_rgba(0,0,0,0.55)] ${compact ? 'h-24 w-16 rounded-[28px]' : 'h-[150px] w-[108px] rounded-[44px]'}`}
        style={{ background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.mid} 62%, ${sky.low} 100%)`, transition: 'background 1s linear' }}
      >
        <svg viewBox="0 0 100 140" className="absolute inset-0 size-full" aria-hidden="true">
          <g opacity={sky.stars}>
            {STARS.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" />
            ))}
          </g>
          {/* cloud deck */}
          <g opacity={0.5 - sky.stars * 0.38} fill="#fff">
            <ellipse cx="22" cy="118" rx="34" ry="9" />
            <ellipse cx="74" cy="126" rx="40" ry="11" />
            <ellipse cx="52" cy="108" rx="22" ry="6" opacity="0.6" />
          </g>
          {/* wing tip */}
          <path d="M100 96 L58 112 L62 116 L100 110 Z" fill="#1a2029" opacity="0.92" />
        </svg>
      </div>
      {!compact && <span className="label ml-5">{sky.label}</span>}
    </div>
  );
}
