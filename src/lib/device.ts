// Small wrappers around device APIs that may be missing.

let lookup: ((lat: number, lon: number) => string) | null = null;
let loading: Promise<void> | null = null;

/** IANA timezone at a position, once the lookup table has loaded. */
export function tzAt(lat: number, lon: number): string | undefined {
  if (!lookup) {
    loading ??= import('tz-lookup').then((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lookup = ((m as any).default ?? m) as (lat: number, lon: number) => string;
    });
    return undefined;
  }
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  try {
    return lookup(Math.max(-90, Math.min(90, lat)), wrapped);
  } catch {
    return undefined;
  }
}

/** Ask for notification permission (call from a click). */
export function askNotifications(): void {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => {});
  }
}

/** System notification, only when the tab is hidden. Best effort. */
export function notifyIfHidden(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    new Notification(title, { body, tag: 'aerofocus', icon: `${import.meta.env.BASE_URL}favicon.svg` });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

/** Keep the screen awake. Returns a release function. */
export function keepAwake(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wl = (navigator as any).wakeLock;
  if (!wl) return () => {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lock: any = null;
  let released = false;
  const acquire = () => {
    if (released || document.hidden) return;
    wl.request('screen')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((l: any) => {
        if (released) l.release();
        else lock = l;
      })
      .catch(() => {});
  };
  // The lock is dropped when the tab is hidden; take it again on return.
  document.addEventListener('visibilitychange', acquire);
  acquire();
  return () => {
    released = true;
    document.removeEventListener('visibilitychange', acquire);
    lock?.release?.().catch?.(() => {});
  };
}
