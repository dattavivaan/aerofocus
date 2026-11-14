import { CloudRain, Bell, Megaphone, Music, Wind } from 'lucide-react';
import { voiceSupported } from '../../audio/voice';
import type { AudioChannel, Profile } from '../../engine/types';

const CHANNELS: { id: AudioChannel; label: string; Icon: typeof Wind }[] = [
  { id: 'cabin', label: 'Cabin white noise', Icon: Wind },
  { id: 'rain', label: 'Rain on window', Icon: CloudRain },
  { id: 'lofi', label: 'Soft lo-fi', Icon: Music },
  { id: 'chime', label: 'Cabin chime alerts', Icon: Bell },
  { id: 'voice', label: 'Crew announcements', Icon: Megaphone },
];

interface Props {
  audio: Profile['audio'];
  /** Middle seats: only the chime can be turned on. */
  ambient: boolean;
  onChange: (audio: Profile['audio']) => void;
}

export function AudioMixer({ audio, ambient, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {CHANNELS.map(({ id, label, Icon }) => {
        const locked = (!ambient && id !== 'chime') || (id === 'voice' && !voiceSupported());
        const ch = audio[id];
        const on = ch.on && !locked;
        return (
          <div key={id} className={`flex min-h-11 items-center gap-3 ${locked ? 'opacity-45' : ''}`}>
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" className={on ? 'text-accent' : 'text-muted'} />
            <span className="min-w-0 flex-1 truncate text-[14px]">{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ch.vol}
              disabled={locked || !ch.on}
              aria-label={`${label} volume`}
              onChange={(e) => onChange({ ...audio, [id]: { ...ch, vol: Number(e.target.value) } })}
              className="h-11 w-20 accent-[var(--accent)] md:w-28"
            />
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={label}
              disabled={locked}
              onClick={() => onChange({ ...audio, [id]: { ...ch, on: !ch.on } })}
              className="flex h-11 w-12 shrink-0 cursor-pointer items-center disabled:cursor-not-allowed"
            >
              <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-accent' : 'bg-border'}`}>
                <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>
          </div>
        );
      })}
      <p className="text-muted mt-1 text-[12px]">
        {ambient
          ? voiceSupported()
            ? 'Chimes cover the seatbelt sign, meal service, doors and touchdown. Announcements use your device’s built-in voice.'
            : 'Chimes cover the seatbelt sign, meal service, doors and touchdown. This browser has no built-in voice for announcements.'
          : 'Middle seat: ambient audio is off. Chimes only.'}
      </p>
    </div>
  );
}
