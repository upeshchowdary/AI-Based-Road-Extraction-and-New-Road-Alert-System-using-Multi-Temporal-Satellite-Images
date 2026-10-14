/**
 * ScrollReveal — lightweight IntersectionObserver-based reveal.
 * Adds 'is-visible' class once when the element enters the viewport.
 * Works with CSS classes: rw-reveal, rw-reveal-left, rw-reveal-scale, rw-stagger.
 * Respects prefers-reduced-motion (skips animation, shows element immediately).
 */
import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { reducedMotionNow } from '@/lib/motionPref'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  /** Animation variant */
  variant?: 'fade-up' | 'fade-left' | 'scale' | 'stagger'
  /** How much of the element must be visible before animating (0–1) */
  threshold?: number
  /** CSS delay before the transition fires */
  delay?: number
  /** HTML tag to render */
  as?: React.ElementType
  style?: CSSProperties
}

const variantClass: Record<NonNullable<ScrollRevealProps['variant']>, string> = {
  'fade-up': 'rw-reveal',
  'fade-left': 'rw-reveal-left',
  'scale': 'rw-reveal-scale',
  'stagger': 'rw-stagger',
}

export function ScrollReveal({
  children,
  className,
  variant = 'fade-up',
  threshold = 0.12,
  delay,
  as: Tag = 'div',
  style,
}: ScrollRevealProps) {
  const ref = useRef<Element>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotionNow()) {
      el.classList.add('is-visible')
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  const vc = variantClass[variant]
  const Tag_ = Tag as any
  return (
    <Tag_
      ref={ref}
      className={cn(vc, className)}
      style={delay ? { transitionDelay: `${delay}ms`, ...style } : style}
    >
      {children}
    </Tag_>
  )
}
