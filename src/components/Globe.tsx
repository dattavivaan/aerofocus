import { useMemo } from 'react';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import { interpolate, type LatLon } from '../engine/geo';

type Ring = [number, number][];

// Land outlines as plain rings of [lon, lat], decoded once.
const LAND: Ring[] = (() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topo = land110 as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geo = feature(topo, topo.objects.land) as any;
  const rings: Ring[] = [];
  const geoms = geo.type === 'FeatureCollection' ? geo.features.map((f: { geometry: unknown }) => f.geometry) : [geo.geometry];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push(ring);
  }
  return rings;
})();

const rad = (d: number) => (d * Math.PI) / 180;

/** Orthographic projection centred on `c`. Returns null on the far side. */
function project(lon: number, lat: number, c: LatLon, r: number): [number, number] | null {
  const l = rad(lon - c.lon);
  const p = rad(lat);
  const p0 = rad(c.lat);
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  if (cosc < 0) return null;
  return [r + r * Math.cos(p) * Math.sin(l), r - r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l))];
}

function pathFor(points: [number, number][], c: LatLon, r: number, close: boolean): string {
  let d = '';
  let pen = false;
  for (const [lon, lat] of points) {
    const q = project(lon, lat, c, r);
    if (!q) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`;
    pen = true;
  }
  return close && d ? d : d;
}

/** A small globe with the route arc. Decorative; the route is in the text. */
export function Globe({ from, to, size = 200 }: { from: LatLon; to?: LatLon; size?: number }) {
  const r = size / 2;
  const centre = useMemo(() => (to ? interpolate(from, to, 0.5) : from), [from, to]);
  const land = useMemo(() => LAND.map((ring) => pathFor(ring, centre, r, true)).join(''), [centre, r]);
  const arc = useMemo(() => {
    if (!to) return '';
    const pts: [number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const p = interpolate(from, to, i / 64);
      pts.push([p.lon, p.lat]);
    }
    return pathFor(pts, centre, r, false);
  }, [from, to, centre, r]);
  const a = project(from.lon, from.lat, centre, r);
  const b = to && project(to.lon, to.lat, centre, r);

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
        <path d={land} fill="#27364a" stroke="#3a4b63" strokeWidth="0.5" fillRule="evenodd" />
        {arc && <path d={arc} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />}
      </g>
      {a && <circle cx={a[0]} cy={a[1]} r="3.5" fill="var(--accent)" />}
      {b && <circle cx={b[0]} cy={b[1]} r="3.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />}
    </svg>
  );
}
