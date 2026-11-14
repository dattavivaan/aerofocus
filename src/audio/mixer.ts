// Cabin audio. Every sound is synthesized with the Web Audio API, so there are
// no audio files to license or download and it works offline.
//
// Two kinds of sound:
//  - Loops (cabin, rain, lo-fi): gapless buffers, one gain node per channel.
//    The cabin loop also follows the flight phase (quiet taxi, loud climb...).
//  - Cues (seatbelt sign, meal chime, buckle, touchdown...): short one-shots,
//    all controlled by the "chime" channel.

import type { AudioChannel } from '../engine/types';

type Settings = Record<AudioChannel, { on: boolean; vol: number }>;
type Loop = Exclude<AudioChannel, 'chime' | 'voice'>;

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

/** How the engines sound in each part of the flight: [loudness, brightness in Hz]. */
const ENGINE: Record<string, [number, number]> = {
  taxiing: [0.55, 420],
  climbing: [1.3, 1500],
  cruising: [1, 900],
  meal: [1, 900],
  seatbelt: [1, 900],
  descending: [0.8, 650],
};

export type Cue =
  | 'boarding' // door closes, seatbelt sign on
  | 'seatbelt-on' // one low bong
  | 'seatbelt-off' // one higher ding
  | 'meal-start' // hi-lo cabin chime
  | 'meal-end' // hi-lo chime; with `sign`, the seatbelt bong follows
  | 'buckle' // seatbelt click
  | 'delay' // soft acknowledgement
  | 'landing' // touchdown, reverse thrust, arrival chime
  | 'divert'; // lo-lo alert

export class Mixer {
  private ctx: AudioContext | null = null;
  private gains = new Map<Loop, GainNode>();
  private sources = new Map<Loop, AudioBufferSourceNode>();
  private engineFilter: BiquadFilterNode | null = null;
  private settings: Settings | null = null;
  private ambient = true;
  private phase = 'cruising';
  private closing: ReturnType<typeof setTimeout> | undefined;

  static supported(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
  }

  /** Create the audio context. Call from a user gesture where possible. */
  start(): void {
    clearTimeout(this.closing); // a new flight began before the old audio closed
    this.closing = undefined;
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

  private engine(): [number, number] {
    return ENGINE[this.phase] ?? ENGINE.cruising;
  }

  /** `ambient` false (middle seats) silences everything except the cues. */
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
        if (ch === 'cabin') {
          // The engine note: a low-pass that opens up on the climb.
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = this.engine()[1];
          src.connect(f).connect(gain);
          this.engineFilter = f;
        } else src.connect(gain);
        src.start();
        this.gains.set(ch, gain);
        this.sources.set(ch, src);
      }
      const gain = this.gains.get(ch);
      const level = settings[ch].vol * LOOP_GAIN[ch] * (ch === 'cabin' ? this.engine()[0] : 1);
      if (gain) gain.gain.setTargetAtTime(want ? level : 0, ctx.currentTime, 0.15);
      if (!want && this.sources.has(ch)) {
        const src = this.sources.get(ch)!;
        this.sources.delete(ch);
        if (ch === 'cabin') this.engineFilter = null;
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            /* context already closed */
          }
        }, 600);
      }
    }
  }

  /** The engines follow the flight: spool up for the climb, ease off to descend. */
  setPhase(phase: string): void {
    if (phase === this.phase) return;
    this.phase = phase;
    const ctx = this.ctx;
    const s = this.settings;
    if (!ctx || !s) return;
    const [loud, bright] = this.engine();
    const gain = this.gains.get('cabin');
    if (gain && this.ambient && s.cabin.on) gain.gain.setTargetAtTime(s.cabin.vol * LOOP_GAIN.cabin * loud, ctx.currentTime, 2.5);
    this.engineFilter?.frequency.setTargetAtTime(bright, ctx.currentTime, 2.5);
  }

  // ---- cues --------------------------------------------------------------

  /** A soft bell: a sine with two quieter overtones. */
  private bell(freq: number, at: number, vol: number, length = 1.8): void {
    const ctx = this.ctx!;
    [
      [1, 1],
      [2, 0.28],
      [3.01, 0.1],
    ].forEach(([mult, amp]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.32 * vol * amp, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + length / mult);
      osc.connect(g).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + length / mult + 0.05);
    });
  }

  /** A burst of filtered noise: clicks, thumps and whooshes. */
  private noise(at: number, length: number, vol: number, type: BiquadFilterType, freq: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(at);
  }

  /** A low thud that drops in pitch: doors and wheels. */
  private thud(at: number, vol: number, from = 110, to = 42): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + 0.18);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    osc.connect(g).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.45);
  }

  /**
   * Play a cabin cue. All cues follow the "chime" switch and volume.
   * `sign` on meal-end adds the seatbelt bong (seats that resume by hand).
   */
  cue(name: Cue, opts: { sign?: boolean } = {}): void {
    const ctx = this.ctx;
    const s = this.settings?.chime;
    if (!ctx || !s?.on) return;
    this.unlock();
    const v = s.vol;
    const t = ctx.currentTime + 0.03;
    switch (name) {
      case 'boarding':
        this.thud(t, 0.5 * v);
        this.noise(t, 0.25, 0.25 * v, 'lowpass', 500);
        this.noise(t + 0.32, 0.06, 0.2 * v, 'bandpass', 2400); // latch
        this.bell(494, t + 1.1, v);
        break;
      case 'seatbelt-on':
        this.bell(494, t, v);
        break;
      case 'seatbelt-off':
        this.bell(740, t, v, 1.5);
        break;
      case 'meal-start':
        this.bell(659.25, t, v);
        this.bell(523.25, t + 0.45, v);
        break;
      case 'meal-end':
        this.bell(659.25, t, v);
        this.bell(523.25, t + 0.45, v);
        if (opts.sign) this.bell(494, t + 1.7, v);
        break;
      case 'buckle':
        this.noise(t, 0.035, 0.5 * v, 'bandpass', 3200, 0.001);
        this.noise(t + 0.09, 0.05, 0.7 * v, 'bandpass', 1900, 0.001);
        this.thud(t + 0.09, 0.18 * v, 240, 120);
        break;
      case 'delay':
        this.bell(880, t, v * 0.6, 0.7);
        break;
      case 'landing':
        this.thud(t, 0.7 * v);
        this.noise(t, 0.3, 0.3 * v, 'lowpass', 300);
        this.thud(t + 0.22, 0.4 * v, 90, 40); // nose wheel
        this.noise(t + 0.4, 3.2, 0.22 * v, 'bandpass', 700, 1.1); // reverse thrust
        this.bell(523.25, t + 3.4, v);
        this.bell(659.25, t + 3.75, v);
        this.bell(783.99, t + 4.1, v, 2.4);
        break;
      case 'divert':
        this.bell(440, t, v);
        this.bell(349.23, t + 0.4, v);
        break;
    }
  }

  /**
   * Fade the loops and close the audio. `tailMs` keeps the context alive long
   * enough for a last cue (the landing) to finish.
   */
  stop(tailMs = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const g of this.gains.values()) g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    clearTimeout(this.closing);
    const close = () => {
      this.closing = undefined;
      for (const src of this.sources.values()) {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }
      this.sources.clear();
      this.gains.clear();
      this.engineFilter = null;
      void this.ctx?.close();
      this.ctx = null;
    };
    if (tailMs > 0) this.closing = setTimeout(close, tailMs);
    else close();
  }
}

export const mixer = new Mixer();
