import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Wordmark } from '@/components/brand/Brand'
import { AppToaster } from '@/components/ui/AppToaster'
import { Button } from '@/components/ui/Button'
import { GlobePoster } from '@/features/home/GlobePoster'
import { useReducedMotion } from '@/lib/motionPref'

export default function SignInPage() {
  const nav = useNavigate()
  const reduced = useReducedMotion()
  const [email, setEmail] = useState('')
  useEffect(() => {
    document.title = 'Sign in — RoadWatch'
  }, [])
  return (
    <div className="grid min-h-dvh bg-bg0 lg:grid-cols-2">
      <section aria-hidden className="relative hidden overflow-hidden border-r border-line lg:block">
        <GlobePoster spin={!reduced} className="top-1/2 left-1/2 size-[min(70vh,40vw)] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg0 via-transparent to-transparent" />
        <div className="absolute right-10 bottom-10 left-10">
          <p className="t-h2 text-fg">
            Every new road. <span className="t-serif">Seen first.</span>
          </p>
          <p className="mt-3 max-w-md text-muted">Alerts with before/after proof for the NTR and Krishna pilot.</p>
        </div>
      </section>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" aria-label="RoadWatch home">
            <Wordmark />
          </Link>
          <h1 className="mt-10 text-[24px] font-medium tracking-[-0.01em] text-fg">Sign in</h1>
          <p className="mt-1.5 text-[14px] text-muted">Use your work email. We’ll send a one-time sign-in link.</p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              toast('Sign-in isn’t connected yet', { description: 'Supabase Auth arrives with the backend. Use the demo account for now.' })
            }}
          >
            <label htmlFor="email" className="block text-[13px] text-fg">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organisation.in"
              className="h-11 w-full rounded-[8px] border border-line-strong bg-surface px-3 text-[15px] text-fg outline-none placeholder:text-muted focus:border-sentinel"
            />
            <Button type="submit" variant="subtle" size="lg" className="w-full">
              Send sign-in link
            </Button>
          </form>
          <Button variant="outline" size="lg" className="mt-3 w-full" onClick={() => toast('Google sign-in isn’t connected yet', { description: 'Arrives with Supabase Auth in the backend phase.' })}>
            Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-[12px] text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="signal" size="lg" className="w-full" onClick={() => nav('/app')}>
            Explore with demo account
            <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
          </Button>
          <p className="mt-3 text-center text-[12px] text-muted">Read-only. Reviews you make stay in this browser.</p>
        </div>
      </main>
      <AppToaster />
    </div>
  )
}
