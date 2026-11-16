import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 ships its worker as a separate module; let Vite bundle it.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { headingAt, positionAt, routeLine, type LatLon } from '../../engine/geo';
import { useReducedMotion } from '../../lib/hooks';
import { PlaneIcon } from '../ui/PlaneIcon';

// OpenFreeMap: free vector tiles, no account or key. Confirm terms before launch.
setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** A theme colour (maplibre cannot read CSS variables itself). */
const themeColor = (name: string, fallback: string) =>
  (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

export type MapMode = '3d' | '2d';

interface Props {
  from: LatLon;
  to: LatLon;
  /** 0..1 through the flight. */
  progress: number;
  mode: MapMode;
  /** Frames stayed under 30 fps for 5 s in 3D. */
  onSlow?: () => void;
  className?: string;
}

const line = (coords: [number, number][]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates: coords },
});

/** Route on a plain dark background: used offline or when tiles fail. */
function FallbackMap({ from, to, progress, className }: Props) {
  const all = useMemo(() => routeLine(from, to), [from, to]);
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const pad = 0.18;
  const w = Math.max(Math.max(...lons) - Math.min(...lons), 2);
  const h = Math.max(Math.max(...lats) - Math.min(...lats), 2);
  const x0 = Math.min(...lons) - w * pad;
  const y1 = Math.max(...lats) + h * pad;
  const W = w * (1 + 2 * pad);
  const H = h * (1 + 2 * pad);
  const pt = ([lon, lat]: [number, number]) => `${(((lon - x0) / W) * 1000).toFixed(1)},${(((y1 - lat) / H) * 470).toFixed(1)}`;
  const flown = routeLine(from, to, 0, progress);
  const rest = routeLine(from, to, progress, 1);
  const pos = positionAt(from, to, progress);
  const [px, py] = pt([pos.lon, pos.lat]).split(',').map(Number);
  // Screen heading: the view is stretched, so measure it on screen.
  const ahead = positionAt(from, to, Math.min(1, progress + 0.01));
  const behind = positionAt(from, to, Math.max(0, progress - 0.01));
  const [ax, ay] = pt([ahead.lon, ahead.lat]).split(',').map(Number);
  const [bx, by] = pt([behind.lon, behind.lat]).split(',').map(Number);
  const rot = (Math.atan2(ax - bx, -(ay - by)) * 180) / Math.PI;
  return (
    <div className={`bg-surface-sunk ${className ?? 'relative'}`} data-map="fallback">
      <svg viewBox="0 0 1000 470" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <polyline points={rest.map(pt).join(' ')} fill="none" stroke="var(--sky)" strokeWidth="2.5" strokeDasharray="8 8" vectorEffect="non-scaling-stroke" />
        <polyline points={flown.map(pt).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="text-accent absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${px / 10}%`, top: `${(py / 470) * 100}%` }}>
        <PlaneIcon size={30} rotate={rot} />
      </span>
      <p className="label absolute bottom-3 left-4 !text-[10px]">Map tiles unavailable · showing the route only</p>
    </div>
  );
}

export default function FlightMap(props: Props) {
  const { from, to, progress, mode, onSlow, className } = props;
  const ref = useRef<MapRef>(null);
  const reduced = useReducedMotion();
  const follow = useRef(false); // already following the plane in 3D
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);

  const pos = useMemo(() => positionAt(from, to, progress), [from, to, progress]);
  const heading = useMemo(() => headingAt(from, to, progress), [from, to, progress]);
  const flown = useMemo(() => line(routeLine(from, to, 0, progress)), [from, to, progress]);
  const rest = useMemo(() => line(routeLine(from, to, progress, 1)), [from, to, progress]);
  const zoom = useMemo(() => {
    const span = Math.hypot(to.lat - from.lat, positionAt(from, to, 1).lon - from.lon);
    return span < 6 ? 7.2 : span < 25 ? 6.2 : 5.2;
  }, [from, to]);

  // No tiles within 15 s (offline, blocked): fall back to the plain route.
  useEffect(() => {
    if (loaded || failed) return;
    const id = setTimeout(() => setFailed(true), 15_000);
    return () => clearTimeout(id);
  }, [loaded, failed]);

  // Camera: follow the plane in 3D; fit the whole route in 2D.
  useEffect(() => {
    const map = ref.current;
    if (!map || !loaded) return;
    if (mode === '3d') {
      const cam = { center: [pos.lon, pos.lat] as [number, number], bearing: heading, pitch: 60, zoom };
      // Ease in when 3D is switched on. After that the plane moves a fraction
      // of a pixel per second, so one redraw per tick is enough and keeps the
      // GPU idle for the rest of a long flight.
      if (follow.current || reduced) map.jumpTo(cam);
      else map.easeTo({ ...cam, duration: 900 });
      follow.current = true;
    } else {
      follow.current = false;
      const end = positionAt(from, to, 1);
      const pts = routeLine(from, to);
      const lons = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lons, end.lon), Math.min(...lats)],
          [Math.max(...lons, end.lon), Math.max(...lats)],
        ],
        { padding: 56, pitch: 0, bearing: 0, duration: reduced ? 0 : 900 },
      );
    }
    // 2D only needs to refit when the mode or route changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, mode, reduced, from, to, zoom, mode === '3d' ? progress : 0]);

  // Frame-rate watchdog: under 30 fps for 5 s in 3D → ask for 2D.
  useEffect(() => {
    if (mode !== '3d' || !loaded || !onSlow) return;
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    let slowSince: number | null = null;
    const loop = (t: number) => {
      frames++;
      if (document.hidden) {
        frames = 0;
        windowStart = t;
        slowSince = null;
      } else if (t - windowStart >= 1000) {
        const fps = (frames * 1000) / (t - windowStart);
        frames = 0;
        windowStart = t;
        if (fps < 30) {
          slowSince ??= t;
          if (t - slowSince >= 5000) {
            onSlow();
            return;
          }
        } else slowSince = null;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, loaded, onSlow]);

  if (failed) return <FallbackMap {...props} />;

  return (
    <div className={`bg-surface-sunk ${className ?? 'relative'}`} data-map={loaded ? 'ready' : 'loading'} data-mode={mode}>
      <MapGL
        ref={ref}
        mapStyle={STYLE_URL}
        initialViewState={{ longitude: pos.lon, latitude: pos.lat, zoom, pitch: mode === '3d' ? 60 : 0, bearing: mode === '3d' ? heading : 0 }}
        interactive={false}
        attributionControl={{ compact: true }}
        maxPitch={70}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!loaded) setFailed(true);
        }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Source id="rest" type="geojson" data={rest}>
          <Layer id="rest" type="line" paint={{ 'line-color': themeColor('--sky', '#6FD6E8'), 'line-width': 2.5, 'line-dasharray': [2, 2] }} layout={{ 'line-cap': 'round' }} />
        </Source>
        <Source id="flown" type="geojson" data={flown}>
          <Layer id="flown" type="line" paint={{ 'line-color': themeColor('--accent', '#8EC1FF'), 'line-width': 4 }} layout={{ 'line-cap': 'round' }} />
        </Source>
        <Marker longitude={pos.lon} latitude={pos.lat} rotation={heading} rotationAlignment="map" pitchAlignment="map">
          <span className="text-accent block drop-shadow-[0_0_10px_rgb(var(--tint)/0.8)]">
            <PlaneIcon size={38} />
          </span>
        </Marker>
      </MapGL>
    </div>
  );
}
