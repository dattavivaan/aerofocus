import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'divert';

const STYLES: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary: 'bg-surface text-text border border-border hover:border-muted',
  ghost: 'text-muted hover:text-text',
  divert: 'bg-divert-bg text-divert border border-divert/30 hover:bg-divert/20',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(function Button(
  { variant = 'primary', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={`inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${STYLES[variant]} ${className}`}
    />
  );
});
