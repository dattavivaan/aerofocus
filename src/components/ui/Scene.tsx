import { useReducedMotion } from '../../lib/hooks';

export type SceneName = 'dawn' | 'grid' | 'cabin' | 'runway' | 'arrival' | 'sky' | 'quiet';

const PATHS = ['M-40 760 C 380 380, 1000 300, 1500 520', 'M-40 850 C 420 520, 1060 470, 1500 700', 'M200 -20 C 560 220, 1100 180, 1500 40'];

/** A globe graticule: meridians and (tilted) parallels as ellipses. */
function Graticule() {
  const R = 520;
  const tilt = (22 * Math.PI) / 180;
  const meridians = [0, 1, 2, 3, 4, 5].map((k) => Math.abs(Math.cos((k * 30 * Math.PI) / 180)) * R);
  const parallels = [-60, -30, 0, 30, 60].map((lat) => {
    const phi = (lat * Math.PI) / 180;
    const rx = Math.cos(phi) * R;
    return { cy: Math.sin(phi) * Math.cos(tilt) * R, rx, ry: rx * Math.sin(tilt) };
  });
  return (
    <svg className="turn absolute" style={{ right: '-18vmax', top: '-14vmax', width: '78vmax', height: '78vmax' }} viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`}>
      <g fill="none" stroke="rgb(var(--tint) / 0.16)" strokeWidth="1.2">
        <circle r={R} stroke="rgb(var(--tint) / 0.28)" />
        {meridians.map((rx, i) => (
          <ellipse key={i} rx={rx} ry={R} />
        ))}
        {parallels.map((p, i) => (
          <ellipse key={i} cy={p.cy} rx={p.rx} ry={p.ry} />
        ))}
      </g>
    </svg>
  );
}

/** The animated background behind each screen. Decorative. */
export function Scene({ name }: { name: SceneName }) {
  const reduced = useReducedMotion();
  return (
    <div className={`scene scene-${name}`} aria-hidden="true">
      {name === 'dawn' && (
        <>
          {[
            { top: '14%', w: '62vw', d: 96, delay: -20 },
            { top: '31%', w: '48vw', d: 124, delay: -70 },
            { top: '52%', w: '70vw', d: 150, delay: -40 },
          ].map((c, i) => (
            <span key={i} className="cloud" style={{ top: c.top, width: c.w, animationDuration: `${c.d}s`, animationDelay: `${c.delay}s` }} />
          ))}
          <svg className="scene-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
            <g fill="none" stroke="rgb(var(--tint-pale) / 0.22)" strokeWidth="1.2" strokeDasharray="2 10" strokeLinecap="round">
              {PATHS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            {!reduced && (
              <g fill="rgb(var(--tint-light))">
                <path d="M0-7 L16 0 L0 7 L4 0 Z" />
                <animateMotion dur="54s" repeatCount="indefinite" rotate="auto" path={PATHS[0]} />
              </g>
            )}
          </svg>
        </>
      )}
      {name === 'grid' && (
        <>
          <Graticule />
          <span className="sweep" />
        </>
      )}
      {name === 'cabin' &&
        Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="cabin-light" style={{ left: `${4 + i * 11.2}%`, animationDuration: `${5 + (i % 4) * 1.4}s`, animationDelay: `${-i * 0.9}s` }} />
        ))}
      {name === 'runway' && (
        <svg className="scene-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
          <g stroke="rgb(var(--tint-pale) / 0.55)" strokeWidth="3" strokeLinecap="round" fill="none">
            <line className="runway-line" x1="720" y1="360" x2="720" y2="900" />
            <line className="runway-line" style={{ animationDelay: '-0.4s' }} x1="716" y1="360" x2="420" y2="900" opacity="0.5" />
            <line className="runway-line" style={{ animationDelay: '-0.8s' }} x1="724" y1="360" x2="1020" y2="900" opacity="0.5" />
            <line className="runway-line" style={{ animationDelay: '-1.2s' }} x1="712" y1="360" x2="60" y2="900" opacity="0.22" />
            <line className="runway-line" style={{ animationDelay: '-1.5s' }} x1="728" y1="360" x2="1380" y2="900" opacity="0.22" />
          </g>
        </svg>
      )}
      {name === 'arrival' && <span className="sunrise" />}
      {name === 'sky' && <span className="stars" />}
      {name === 'quiet' && (
        <>
          {[
            { top: '6%', d: 26, delay: 0, o: 1 },
            { top: '44%', d: 34, delay: -12, o: 0.7 },
            { top: '70%', d: 41, delay: -24, o: 0.5 },
          ].map((r) => (
            <span key={r.top} className="ribbon-wrap" style={{ top: r.top, opacity: r.o }}>
              <span className="ribbon" style={{ animationDuration: `${r.d}s`, animationDelay: `${r.delay}s` }} />
            </span>
          ))}
        </>
      )}
    </div>
  );
}
