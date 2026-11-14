// Crew announcements, spoken with the browser's built-in speech (no audio
// files, works offline). The voice itself comes from the device, so it sounds
// different on each one. Controlled by the "voice" channel in the mixer.

let pending: ReturnType<typeof setTimeout> | undefined;

export const voiceSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

// Natural-sounding voices first, where the device has them.
const PREFERRED = [/natural/i, /samantha/i, /google uk english female/i, /aria/i, /jenny/i, /karen/i, /serena/i, /google us english/i];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const english = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  for (const re of PREFERRED) {
    const v = english.find((x) => re.test(x.name));
    if (v) return v;
  }
  return english.find((v) => v.default) ?? english[0];
}

/**
 * Say one announcement, after `delayMs` so it follows the chime. A newer
 * announcement replaces one that is waiting or still being spoken.
 */
export function announce(text: string, volume: number, delayMs = 0): void {
  if (!voiceSupported()) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = 0.94;
      u.pitch = 1;
      u.volume = Math.min(1, Math.max(0, volume));
      synth.speak(u);
    } catch {
      /* speech is a nicety; never break the flight */
    }
  }, delayMs);
}

export function silence(): void {
  clearTimeout(pending);
  if (voiceSupported()) window.speechSynthesis.cancel();
}

/** "1 hour 50 minutes", "45 minutes", "10 hours". */
export function spokenDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hours = h ? `${h} hour${h === 1 ? '' : 's'}` : '';
  const mins = r || !h ? `${r} minute${r === 1 ? '' : 's'}` : '';
  return [hours, mins].filter(Boolean).join(' ');
}

/** "AX500" → "A X 500", so it is read as a flight number. */
const spokenFlight = (flightNo: string) => flightNo.replace(/^([A-Z])([A-Z])/, '$1 $2 ');

export const SCRIPT = {
  boarding: (flightNo: string, city: string, blockMin: number) =>
    `Welcome aboard AeroFocus flight ${spokenFlight(flightNo)} to ${city}. Our flight time is ${spokenDuration(blockMin)}. Doors are closed. Please fasten your seatbelt and put distractions away.`,
  cruise: () => `We have reached cruising altitude, and the seatbelt sign is off. Settle in and enjoy your focus time.`,
  mealStart: (lengthMin: number) => `Meal service is now beginning. Please take a break for the next ${spokenDuration(lengthMin)}.`,
  mealEnd: (autoResume: boolean) =>
    autoResume ? `Meal service is complete. We are back to work.` : `Meal service is complete. Please fasten your seatbelt to continue the flight.`,
  descent: (city: string, remainingMin: number) =>
    `We have begun our descent into ${city}, with about ${spokenDuration(remainingMin)} remaining. Time to wrap up what you are working on.`,
  landing: (city: string, focusedMin: number) =>
    `Welcome to ${city}. You focused for ${spokenDuration(focusedMin)}. Thank you for flying AeroFocus.`,
  divert: (focusedMin: number) => `This flight is diverting. Your ${spokenDuration(focusedMin)} of focus have been credited.`,
};
