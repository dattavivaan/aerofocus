import { useEffect } from 'react';

// Displacement map for the glass edge: red moves pixels sideways, green up and
// down, both strongest at the rim and neutral (50%) in the middle.
const MAP = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" preserveAspectRatio="none">
<defs>
<linearGradient id="x" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="rgb(255,0,0)"/><stop offset=".14" stop-color="rgb(128,0,0)"/><stop offset=".86" stop-color="rgb(128,0,0)"/><stop offset="1" stop-color="rgb(0,0,0)"/></linearGradient>
<linearGradient id="y" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgb(0,255,0)"/><stop offset=".3" stop-color="rgb(0,128,0)"/><stop offset=".7" stop-color="rgb(0,128,0)"/><stop offset="1" stop-color="rgb(0,0,0)"/></linearGradient>
</defs>
<rect width="200" height="200" fill="url(#x)"/>
<rect width="200" height="200" fill="url(#y)" style="mix-blend-mode:screen"/>
</svg>`,
);

/**
 * Live-glass helpers, mounted once:
 *  - the SVG filter behind .glass-refract (only switched on in Chromium, the one
 *    engine that can use an SVG filter as a backdrop filter),
 *  - a sheen on glass that follows the pointer.
 */
export function LiquidDefs() {
  useEffect(() => {
    // `userAgentData` exists in Chromium browsers only (not Safari or Firefox).
    if ('userAgentData' in navigator) document.documentElement.setAttribute('data-refract', '');

    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.glass, .card');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      last = e;
      frame ||= requestAnimationFrame(paint);
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => {
      document.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="liquid-edge" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={`data:image/svg+xml,${MAP}`} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
