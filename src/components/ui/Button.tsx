import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'divert';

const STYLES: Record<Variant, string> = {
  primary: 'btn-gel text-on-accent hover:brightness-110',
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
      className={`inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-[transform,filter,background-color,border-color,color,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.96] active:duration-100 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${STYLES[variant]} ${className}`}
    />
  );
});
