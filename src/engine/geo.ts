// Great-circle math on a sphere. No dependencies, so it is testable and
// handles routes that cross the 180° meridian (e.g. SEA → NRT).

export interface LatLon {
  lat: number;
  lon: number;
}

export const EARTH_RADIUS_MI = 3958.8;
export const KM_PER_MI = 1.609344;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Haversine distance in statute miles. */
export function distanceMi(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point a fraction f (0..1) of the way along the great circle from a to b. */
export function interpolate(a: LatLon, b: LatLon, f: number): LatLon {
  const d = distanceMi(a, b) / EARTH_RADIUS_MI; // angular distance
  if (d < 1e-9) return { ...a };
  const t = Math.min(1, Math.max(0, f));
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon));
  const y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon));
  const z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) };
}

/** Initial compass bearing from a to b, 0..360 (0 = north). */
export function bearing(a: LatLon, b: LatLon): number {
  const dLon = rad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Heading of travel at fraction f along the route. */
export function headingAt(a: LatLon, b: LatLon, f: number): number {
  const t = Math.min(1, Math.max(0, f));
  if (t >= 0.999) return (bearing(b, a) + 180) % 360;
  return bearing(interpolate(a, b, t), b);
}

/**
 * The route as [lon, lat] pairs from fraction `from` to `to`. Longitudes are
 * "unwrapped" (they may pass ±180) so the line never jumps across the map.
 */
export function routeLine(a: LatLon, b: LatLon, from = 0, to = 1, steps = 96): [number, number][] {
  const out: [number, number][] = [];
  const n = Math.max(1, Math.ceil(steps * Math.abs(to - from)));
  let prev: number | undefined;
  // Unwrap from the origin so partial lines join up with each other.
  const anchor = unwrapPath(a, b, from);
  for (let i = 0; i <= n; i++) {
    const p = interpolate(a, b, from + ((to - from) * i) / n);
    let lon = p.lon;
    const ref = prev ?? anchor;
    while (lon - ref > 180) lon -= 360;
    while (lon - ref < -180) lon += 360;
    prev = lon;
    out.push([lon, p.lat]);
  }
  return out;
}

/** Unwrapped longitude of the point at fraction f, walking from the origin. */
function unwrapPath(a: LatLon, b: LatLon, f: number): number {
  let prev = a.lon;
  const n = Math.max(1, Math.ceil(96 * f));
  for (let i = 1; i <= n; i++) {
    let lon = interpolate(a, b, (f * i) / n).lon;
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    prev = lon;
  }
  return prev;
}

/** Position at fraction f with an unwrapped longitude matching routeLine. */
export function positionAt(a: LatLon, b: LatLon, f: number): LatLon {
  const t = Math.min(1, Math.max(0, f));
  return { lat: interpolate(a, b, t).lat, lon: unwrapPath(a, b, t) };
}
