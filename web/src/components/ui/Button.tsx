import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/cn'

type Variant = 'signal' | 'ghost' | 'outline' | 'subtle' | 'danger' | 'verified'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-ui ' +
  'disabled:opacity-45 disabled:pointer-events-none active:translate-y-px'

const variants: Record<Variant, string> = {
  // Amber is precious: only the primary CTA uses it.
  signal:
    'bg-signal text-on-signal hover:shadow-[0_0_0_4px_var(--signal-glow)] hover:brightness-105',
  ghost: 'text-fg hover:bg-surface2',
  outline: 'border border-line-strong text-fg hover:border-sentinel/60 hover:bg-surface2/60',
  subtle: 'bg-surface2 text-fg border border-line hover:border-line-strong',
  danger: 'border border-priority/40 text-priority hover:bg-priority/10',
  verified: 'border border-verified/40 text-verified hover:bg-verified/10',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-chip',
  md: 'h-10 px-4 text-sm rounded-[8px]',
  lg: 'h-12 px-6 text-[15px] rounded-[10px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest} />
})

export interface ButtonLinkProps extends LinkProps {
  variant?: Variant
  size?: Size
  children: ReactNode
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'outline', size = 'md', className, ...rest },
  ref,
) {
  return <Link ref={ref} className={cn(base, variants[variant], sizes[size], className as string)} {...rest} />
})

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-[8px] text-muted transition-colors duration-200',
        'hover:bg-surface2 hover:text-fg aria-pressed:bg-surface2 aria-pressed:text-fg',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
