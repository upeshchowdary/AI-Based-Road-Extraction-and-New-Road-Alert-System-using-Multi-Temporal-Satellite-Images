import { Toaster } from 'sonner'
import { useResolvedTheme } from '@/lib/theme'

/** Toasts live only in the app (public pages don't use them), keeping sonner out of the public bundle. */
export function AppToaster() {
  const theme = useResolvedTheme()
  return <Toaster position="bottom-right" theme={theme} toastOptions={{ className: '!bg-surface2 !border-line-strong !text-fg !font-sans !rounded-card' }} />
}
