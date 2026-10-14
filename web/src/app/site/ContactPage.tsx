import { Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { ScanLine } from '@/components/brand/Brand'
import { PageIntro } from '@/components/site/PageIntro'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { useReducedMotion } from '@/lib/motionPref'

const USES = ['Security monitoring', 'Rural road audit (PMGSY)', 'Planning', 'Research / academic', 'Other']
const field = 'h-11 w-full rounded-[8px] border bg-surface px-3 text-[15px] text-fg outline-none placeholder:text-muted focus:border-sentinel'

export default function ContactPage() {
  const reduced = useReducedMotion()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (f.get('website')) return // honeypot: bots fill hidden fields
    const err: Record<string, string> = {}
    if (!String(f.get('name')).trim()) err.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.get('email')))) err.email = 'Enter an email address like name@organisation.in.'
    if (String(f.get('message')).trim().length < 10) err.message = 'Write at least a sentence so we can help.'
    setErrors(err)
    if (!Object.keys(err).length) setSent(true)
  }

  return (
    <>
      <PageIntro docTitle="Contact" title="Talk to the team" lead="Questions about the method, the data, or using RoadWatch in your work." />
      <section className="section-y">
        <div className="container-rw max-w-2xl">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative overflow-hidden rounded-panel border border-line bg-surface p-8" role="status">
                {!reduced && <ScanLine className="rw-cta-scan" />}
                <span className="grid size-12 place-items-center rounded-full border border-verified bg-verified/15 text-verified">
                  <Check className="size-6" strokeWidth={2} />
                </span>
                <h2 className="t-h3 mt-5 text-fg">Message ready</h2>
                <p className="mt-2 text-muted">This UI build doesn’t send messages yet — delivery connects with the backend (Supabase). Nothing left your browser.</p>
                <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
                  Write another
                </Button>
              </motion.div>
            ) : (
              <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={submit} noValidate className="space-y-5">
                {(
                  [
                    ['name', 'Name', 'text', 'name'],
                    ['email', 'Email', 'email', 'email'],
                    ['org', 'Organisation (optional)', 'text', 'organization'],
                  ] as const
                ).map(([n, l, t, ac]) => (
                  <div key={n}>
                    <label htmlFor={n} className="text-[14px] text-fg">
                      {l}
                    </label>
                    <input id={n} name={n} type={t} autoComplete={ac} aria-invalid={Boolean(errors[n])} aria-describedby={errors[n] ? `${n}-err` : undefined} className={cn(field, 'mt-1.5', errors[n] ? 'border-priority' : 'border-line-strong')} />
                    {errors[n] && (
                      <p id={`${n}-err`} className="mt-1.5 text-[13px] text-priority">
                        {errors[n]}
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label htmlFor="use" className="text-[14px] text-fg">
                    Use case
                  </label>
                  <select id="use" name="use" className={cn(field, 'mt-1.5 border-line-strong')}>
                    {USES.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="text-[14px] text-fg">
                    Message
                  </label>
                  <textarea id="message" name="message" rows={6} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-err' : undefined} className={cn(field, 'mt-1.5 h-auto py-3', errors.message ? 'border-priority' : 'border-line-strong')} />
                  {errors.message && (
                    <p id="message-err" className="mt-1.5 text-[13px] text-priority">
                      {errors.message}
                    </p>
                  )}
                </div>
                {/* honeypot */}
                <div aria-hidden className="absolute -left-[9999px]">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                <Button type="submit" variant="signal" size="lg">
                  Send message
                </Button>
                <p className="text-[13px] text-muted">We store only what you type here, to reply. See Privacy.</p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </section>
    </>
  )
}
