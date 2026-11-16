import { useEffect, useMemo, useState } from 'react';
import { geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import { distanceMi, EARTH_RADIUS_MI, interpolate, type LatLon } from '../engine/geo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toLand = (topo: any): GeoPermissibleObjects => feature(topo, topo.objects.land) as unknown as GeoPermissibleObjects;

const LAND_COARSE = toLand(land110);

/** Share of the globe's width the route should fill. Short routes zoom in. */
const ROUTE_SPAN = 0.6;
const MAX_ZOOM = 30;

/** A small globe with the route arc. Decorative; the route is in the text. */
export function Globe({ from, to, size = 200 }: { from: LatLon; to?: LatLon; size?: number }) {
  const r = size / 2;
  // Finer coastlines are fetched on demand, because a zoomed-in short route shows them.
  const [fine, setFine] = useState<GeoPermissibleObjects | null>(null);
  useEffect(() => {
    let live = true;
    void import('world-atlas/land-50m.json').then((m) => live && setFine(toLand(m.default)));
    return () => {
      live = false;
    };
  }, []);

  const { land, arc, a, b } = useMemo(() => {
    const centre = to ? interpolate(from, to, 0.5) : from;
    const angle = to ? distanceMi(from, to) / EARTH_RADIUS_MI : 0;
    const zoom = to && angle > 1e-6 ? Math.min(MAX_ZOOM, Math.max(1, ROUTE_SPAN / Math.sin(Math.min(angle, Math.PI) / 2))) : 1;
    const proj = geoOrthographic()
      .rotate([-centre.lon, -centre.lat])
      .translate([r, r])
      .scale(r * zoom)
      .clipAngle(90);
    const path = geoPath(proj);
    const pt = (p: LatLon) => (proj([p.lon, p.lat]) ?? null) as [number, number] | null;
    return {
      land: path(fine ?? LAND_COARSE) ?? '',
      // d3 draws the great-circle arc between the two points and clips it at the horizon.
      arc: to ? (path({ type: 'LineString', coordinates: [[from.lon, from.lat], [to.lon, to.lat]] }) ?? '') : '',
      a: pt(from),
      b: to ? pt(to) : null,
    };
  }, [from, to, r, fine]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      <defs>
        <radialGradient id="globe-sea" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#1c2a40" />
          <stop offset="1" stopColor="#0b1019" />
        </radialGradient>
        <clipPath id="globe-clip">
          <circle cx={r} cy={r} r={r - 1} />
        </clipPath>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill="url(#globe-sea)" stroke="var(--border)" />
      <g clipPath="url(#globe-clip)">
        <path d={land} fill="#27364a" stroke="#3a4b63" strokeWidth="0.5" />
        {arc && <path d={arc} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />}
      </g>
      {a && <circle cx={a[0]} cy={a[1]} r="3.5" fill="var(--accent)" />}
      {b && <circle cx={b[0]} cy={b[1]} r="3.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />}
    </svg>
  );
}
