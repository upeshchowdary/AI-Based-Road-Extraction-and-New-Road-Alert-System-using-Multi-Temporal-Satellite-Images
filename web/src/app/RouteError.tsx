import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Wordmark } from '@/components/brand/Brand'

export function RouteError() {
  const err = useRouteError()
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unknown error'
  return (
    <div className="grid min-h-dvh place-items-center bg-bg0 p-6">
      <div className="max-w-md">
        <Wordmark />
        <h1 className="t-h3 mt-8">This page failed to load.</h1>
        <p className="mt-3 text-muted">The error was: <code className="t-mono text-fg">{msg}</code>. Reload the page, or go back home.</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => location.reload()} className="h-10 rounded-[8px] border border-line-strong px-4 text-sm">
            Reload
          </button>
          <Link to="/" className="inline-flex h-10 items-center rounded-[8px] px-4 text-sm text-muted hover:text-fg">
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
