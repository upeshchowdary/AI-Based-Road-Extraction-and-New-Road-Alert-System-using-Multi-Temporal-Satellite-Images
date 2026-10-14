import { Tooltip as RTooltip } from 'radix-ui'
import type { ReactNode } from 'react'

/** Radix tooltip with collision handling — used in the app. Public pages use the CSS-only Hint. */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Provider delayDuration={250}>
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-72 rounded-chip border border-line-strong bg-surface2 px-2.5 py-1.5 text-[12px] leading-snug text-fg shadow-[var(--shadow-panel)]"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
    </RTooltip.Provider>
  )
}
