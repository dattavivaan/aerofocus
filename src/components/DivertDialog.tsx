import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';

interface Props {
  /** Seconds the button must be held (exit row: 10). 0 = a normal confirm. */
  holdSec: number;
  focusedMin: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-page confirm for ending a flight early. */
export function DivertDialog({ holdSec, focusedMin, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [held, setHeld] = useState(0); // 0..1
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startedAt = useRef<number | null>(null);

  // The parent re-renders every second, so keep the latest callbacks in refs
  // and set up the listeners once. Otherwise each tick would cancel the hold.
  const cancelFn = useRef(onCancel);
  const confirmFn = useRef(onConfirm);
  useEffect(() => {
    cancelFn.current = onCancel;
    confirmFn.current = onConfirm;
  });

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelFn.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(timer.current);
    };
  }, []);

  const stop = () => {
    clearInterval(timer.current);
    startedAt.current = null;
    setHeld(0);
  };
  const start = () => {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now();
    timer.current = setInterval(() => {
      if (startedAt.current === null) return;
      const p = Math.min(1, (Date.now() - startedAt.current) / (holdSec * 1000));
      setHeld(p);
      if (p >= 1) {
        clearInterval(timer.current);
        startedAt.current = null;
        confirmFn.current();
      }
    }, 100);
  };
  const isHoldKey = (e: React.KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="divert-title"
        aria-describedby="divert-desc"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Keep focus inside the dialog.
          if (e.key !== 'Tab') return;
          const f = e.currentTarget.querySelectorAll<HTMLElement>('button');
          const first = f[0];
          const last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
        className="card w-full max-w-[440px] p-6"
      >
        <h2 id="divert-title" className="text-[24px]">
          Divert this flight?
        </h2>
        <p id="divert-desc" className="text-muted mt-2 text-[15px]">
          The flight ends now and is logged as Diverted. You keep the {focusedMin} focused minute{focusedMin === 1 ? '' : 's'} so far, but there is no stamp and no miles.
          {holdSec > 0 && ` Exit row: press and hold for ${holdSec} seconds to confirm.`}
        </p>
        <div className="mt-6 flex flex-col gap-3 md:flex-row-reverse">
          <Button ref={cancelRef} onClick={onCancel} className="md:flex-1">
            Stay on board
          </Button>
          {holdSec > 0 ? (
            <button
              type="button"
              onPointerDown={start}
              onPointerUp={stop}
              onPointerLeave={stop}
              onPointerCancel={stop}
              onKeyDown={(e) => isHoldKey(e) && !e.repeat && start()}
              onKeyUp={(e) => isHoldKey(e) && stop()}
              onBlur={stop}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`Hold for ${holdSec} seconds to divert`}
              className="bg-divert-bg text-divert border-divert/30 relative min-h-11 cursor-pointer touch-none overflow-hidden rounded-full border px-5 text-[15px] font-semibold select-none md:flex-1"
            >
              <span className="bg-divert/30 absolute inset-y-0 left-0" style={{ width: `${held * 100}%` }} aria-hidden="true" />
              <span className="relative">{held > 0 ? `Keep holding… ${Math.ceil(holdSec * (1 - held))}s` : `Hold ${holdSec}s to divert`}</span>
            </button>
          ) : (
            <Button variant="divert" onClick={onConfirm} className="md:flex-1">
              Divert
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
