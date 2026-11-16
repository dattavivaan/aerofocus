import { accessFor, CABIN_CLASSES, CABIN_NAMES, ROWS_TEXT, UNLOCK_MIN, type CabinClass } from '../engine/seats';
import { useProfile } from '../store/profileStore';
import { Button } from './ui/Button';

const PERKS: Record<CabinClass, string> = {
  premium: 'a window, one meal delay per leg and +10% bonus miles.',
  business: 'a window, one meal delay per leg, +25% bonus miles and a silver passport stamp.',
  first:
    'place meal services anywhere in the flight, +50% bonus miles and a gold passport stamp. You can also now charter the private jet on the seat screen: breaks of any length from 1 to 60 minutes, placed to the minute, and double miles.',
};

/** One-time message when a cabin class unlocks (10, 25 and 50 focus hours). */
export function FirstClassNotice() {
  const profile = useProfile((s) => s.profile);
  const update = useProfile((s) => s.updateProfile);
  const access = accessFor(profile.totals.focusMin, profile.firstClassUnlocked);
  const seen = (c: CabinClass) => (c === 'first' ? profile.firstClassNoticeShown : profile.classNoticesShown.includes(c));
  const cabin = CABIN_CLASSES.find((c) => access[c] && !seen(c));
  if (!cabin) return null;
  const close = () => update(cabin === 'first' ? { firstClassNoticeShown: true } : { classNoticesShown: [...profile.classNoticesShown, cabin] });
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" onClick={close}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="fc-title" aria-describedby="fc-desc" className="card border-gold/60 w-full max-w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
        <p className="label !text-gold">★ {UNLOCK_MIN[cabin] / 60} focus hours</p>
        <h2 id="fc-title" className="mt-2 text-[26px]">
          {CABIN_NAMES[cabin]} is unlocked
        </h2>
        <p id="fc-desc" className="text-muted mt-2 text-[15px]">
          {ROWS_TEXT[cabin]} are now open on the seat map. You get {PERKS[cabin]}
        </p>
        <Button autoFocus onClick={close} className="mt-6 w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}
