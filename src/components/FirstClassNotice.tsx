import { useProfile } from '../store/profileStore';
import { Button } from './ui/Button';

/** One-time message when first class unlocks at 25 focus hours. */
export function FirstClassNotice() {
  const show = useProfile((s) => s.profile.firstClassUnlocked && !s.profile.firstClassNoticeShown);
  const update = useProfile((s) => s.updateProfile);
  if (!show) return null;
  const close = () => update({ firstClassNoticeShown: true });
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" onClick={close}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="fc-title" aria-describedby="fc-desc" className="card border-gold/60 w-full max-w-[440px] p-6" onClick={(e) => e.stopPropagation()}>
        <p className="label !text-gold">★ 25 focus hours</p>
        <h2 id="fc-title" className="mt-2 text-[26px]">
          First class is unlocked
        </h2>
        <p id="fc-desc" className="text-muted mt-2 text-[15px]">
          Rows 1 and 2 are now open on the seat map. First class lets you place meal services anywhere in the flight and earns a gold stamp on landing.
        </p>
        <Button autoFocus onClick={close} className="mt-6 w-full">
          Got it
        </Button>
      </div>
    </div>
  );
}
