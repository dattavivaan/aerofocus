// Cabin audio. Every sound is synthesized with the Web Audio API, so there are
// no audio files to license or download and it works offline. Each channel is
// a gapless looped buffer with its own gain node.

import type { AudioChannel } from '../engine/types';

type Settings = Record<AudioChannel, { on: boolean; vol: number }>;
type Loop = Exclude<AudioChannel, 'chime'>;

const SR = 44100;

function noiseBuffer(ctx: BaseAudioContext, seconds: number, kind: 'brown' | 'white'): AudioBuffer {
  const buf = ctx.createBuffer(2, SR * seconds, SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      } else d[i] = w;
    }
    // Crossfade the tail into the head so the loop has no click.
    const fade = SR / 2;
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[i] = d[i] * t + d[d.length - fade + i] * (1 - t);
    }
  }
  return buf;
}

/** Cabin: low engine rumble. */
function cabinBuffer(ctx: BaseAudioContext): AudioBuffer {
  return noiseBuffer(ctx, 8, 'brown');
}

/** Rain on the window: hiss plus scattered drops. */
function rainBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = noiseBuffer(ctx, 8, 'white');
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      lp += 0.35 * (d[i] - lp); // soften
      d[i] = (d[i] - lp) * 0.22; // keep the highs: hiss
    }
    for (let n = 0; n < 420; n++) {
      const at = Math.floor(Math.random() * (d.length - 900));
      const amp = 0.15 + Math.random() * 0.4;
      for (let i = 0; i < 700; i++) d[at + i] += Math.sin(i * 0.5) * Math.exp(-i / 90) * amp * (Math.random() * 0.6 + 0.4);
    }
  }
  return buf;
}

/** Lo-fi: a slow four-chord loop with soft keys, a muted kick and vinyl crackle. */
function lofiBuffer(ctx: BaseAudioContext): AudioBuffer {
  const bar = 60 / 72 * 4; // 72 bpm
  const len = Math.round(SR * bar * 4);
  const buf = ctx.createBuffer(2, len, SR);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const chords = [
    [53, 57, 60, 64], // Fmaj7
    [52, 55, 59, 62], // Em7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];
  const add = (i: number, l: number, r: number) => {
    const k = ((i % len) + len) % len; // wrap tails so the loop is seamless
    L[k] += l;
    R[k] += r;
  };
  chords.forEach((chord, c) => {
    const start = Math.round(c * bar * SR);
    chord.forEach((note, n) => {
      const f = hz(note);
      const pan = 0.35 + 0.1 * n;
      // Two soft strums per bar.
      for (const [off, amp] of [[0, 1], [bar / 2 + 0.07 * n, 0.6]] as const) {
        const s0 = start + Math.round((off + n * 0.03) * SR);
        const dur = Math.round(SR * bar * 0.62);
        for (let i = 0; i < dur; i++) {
          const t = i / SR;
          const env = Math.min(1, t / 0.02) * Math.exp(-t * 1.5);
          const wob = 1 + 0.002 * Math.sin(t * 2.2); // tape wobble
          const v = (Math.sin(2 * Math.PI * f * wob * t) + 0.3 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 4)) * env * 0.07 * amp;
          add(s0 + i, v * (1 - pan), v * pan);
        }
      }
    });
    // Bass on the root.
    const fb = hz(chord[0] - 24);
    for (let i = 0; i < SR * bar * 0.9; i++) {
      const t = i / SR;
      const v = Math.sin(2 * Math.PI * fb * t) * Math.min(1, t / 0.03) * Math.exp(-t * 0.9) * 0.12;
      add(start + i, v, v);
    }
    // Kick on beats 1 and 3, soft hat off the beat.
    for (let beat = 0; beat < 4; beat++) {
      const b0 = start + Math.round(((beat * bar) / 4) * SR);
      if (beat % 2 === 0)
        for (let i = 0; i < SR * 0.25; i++) {
          const t = i / SR;
          const v = Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-t * 28)) * t) * Math.exp(-t * 16) * 0.22;
          add(b0 + i, v, v);
        }
      const h0 = b0 + Math.round((bar / 8) * SR);
      for (let i = 0; i < SR * 0.05; i++) {
        const v = (Math.random() * 2 - 1) * Math.exp(-i / (SR * 0.012)) * 0.025;
        add(h0 + i, v * 0.6, v);
      }
    }
  });
  // Vinyl crackle.
  for (let n = 0; n < 160; n++) {
    const at = Math.floor(Math.random() * len);
    const v = (Math.random() * 2 - 1) * 0.05;
    add(at, v, v * 0.7);
  }
  // Gentle one-pole low-pass for warmth.
  for (const d of [L, R]) {
    let lp = 0;
    for (let i = 0; i < len * 2; i++) {
      const k = i % len;
      lp += 0.22 * (d[k] - lp);
      if (i >= len) d[k] = lp;
    }
  }
  return buf;
}

const BUILD: Record<Loop, (ctx: BaseAudioContext) => AudioBuffer> = {
  cabin: cabinBuffer,
  rain: rainBuffer,
  lofi: lofiBuffer,
};
const LOOP_GAIN: Record<Loop, number> = { cabin: 0.5, rain: 0.6, lofi: 0.9 };

export class Mixer {
  private ctx: AudioContext | null = null;
  private gains = new Map<Loop, GainNode>();
  private sources = new Map<Loop, AudioBufferSourceNode>();
  private settings: Settings | null = null;
  private ambient = true;

  static supported(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  /** Create the audio context. Call from a user gesture where possible. */
  start(): void {
    if (this.ctx || !Mixer.supported()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    if (this.settings) this.apply(this.settings, this.ambient);
  }

  /** Browsers suspend audio until a gesture; call this on any click. */
  unlock(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /** `ambient` false (middle seats) silences everything except the chime. */
  apply(settings: Settings, ambient: boolean): void {
    this.settings = settings;
    this.ambient = ambient;
    const ctx = this.ctx;
    if (!ctx) return;
    for (const ch of ['cabin', 'rain', 'lofi'] as Loop[]) {
      const want = ambient && settings[ch].on;
      if (want && !this.sources.has(ch)) {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);
        const src = ctx.createBufferSource();
        src.buffer = BUILD[ch](ctx); // built on first use
        src.loop = true;
        src.connect(gain);
        src.start();
        this.gains.set(ch, gain);
        this.sources.set(ch, src);
      }
      const gain = this.gains.get(ch);
      if (gain) gain.gain.setTargetAtTime(want ? settings[ch].vol * LOOP_GAIN[ch] : 0, ctx.currentTime, 0.15);
      if (!want && this.sources.has(ch)) {
        const src = this.sources.get(ch)!;
        this.sources.delete(ch);
        setTimeout(() => {
          src.stop();
          src.disconnect();
        }, 600);
      }
    }
  }

  /** Two-tone cabin chime. */
  chime(): void {
    const ctx = this.ctx;
    const s = this.settings?.chime;
    if (!ctx || !s?.on) return;
    this.unlock();
    const t0 = ctx.currentTime + 0.02;
    [
      [659.25, 0],
      [523.25, 0.45],
    ].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(0.4 * s.vol, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.6);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 1.7);
    });
  }

  stop(): void {
    for (const src of this.sources.values()) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.gains.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const mixer = new Mixer();
