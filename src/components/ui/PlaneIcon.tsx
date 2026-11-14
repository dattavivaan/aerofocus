/** The AeroFocus plane glyph. Points up (north) at 0°. */
export function PlaneIcon({ size = 20, rotate = 0, className = '' }: { size?: number; rotate?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        fill="currentColor"
        d="M12 1.5c.9 0 1.6 1.2 1.6 2.9v4.3l8 4.9v2.1l-8-2.5v4.6l2.3 1.7v1.7L12 20.2l-3.9 1v-1.7l2.3-1.7v-4.6l-8 2.5v-2.1l8-4.9V4.4c0-1.7.7-2.9 1.6-2.9Z"
      />
    </svg>
  );
}
