// Cabin window sky: day → golden hour → night as the flight goes on.

type RGB = [number, number, number];
interface Key {
  at: number;
  top: RGB;
  mid: RGB;
  low: RGB;
  stars: number;
}

const KEYS: Key[] = [
  { at: 0, top: [58, 122, 201], mid: [120, 174, 226], low: [198, 222, 240], stars: 0 },
  { at: 0.5, top: [52, 110, 190], mid: [128, 176, 222], low: [214, 224, 228], stars: 0 },
  { at: 0.72, top: [62, 84, 150], mid: [222, 150, 96], low: [246, 196, 104], stars: 0 },
  { at: 0.86, top: [30, 34, 78], mid: [124, 70, 110], low: [226, 124, 72], stars: 0.35 },
  { at: 1, top: [8, 11, 24], mid: [18, 24, 48], low: [44, 44, 78], stars: 1 },
];

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const css = (c: RGB) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

export interface Sky {
  top: string;
  mid: string;
  low: string;
  stars: number;
  label: 'Day' | 'Golden hour' | 'Dusk' | 'Night';
}

export function skyAt(progress: number): Sky {
  const p = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].at) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (p - a.at) / (b.at - a.at);
  return {
    top: css(mix(a.top, b.top, t)),
    mid: css(mix(a.mid, b.mid, t)),
    low: css(mix(a.low, b.low, t)),
    stars: a.stars + (b.stars - a.stars) * t,
    label: p < 0.6 ? 'Day' : p < 0.8 ? 'Golden hour' : p < 0.92 ? 'Dusk' : 'Night',
  };
}
