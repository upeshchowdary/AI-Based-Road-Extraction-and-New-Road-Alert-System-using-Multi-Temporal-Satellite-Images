import { Send } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { MotionToggle, ThemeToggle } from '@/components/site/SiteFooter'
import { Button } from '@/components/ui/Button'
import { Panel, Segmented } from '@/components/ui/primitives'
import { Switch } from '@/components/ui/Switch'
import { PageHeader, PermissionNote } from '@/components/ui/States'
import { useReview } from '@/lib/appStore'
import { usePrefs } from '@/lib/store'

/** Team roles from DECISIONS.md ADR-009 (names are placeholders until the team confirms). */
const TEAM = [
  ['You', 'Model engineering lead', 'Admin'],
  ['Teammate A', 'Spatial evidence & provenance lead', 'Analyst'],
  ['Teammate B', 'GIS workflow & delivery lead', 'Analyst'],
  ['Teammate C', 'Validation & uncertainty lead', 'Reviewer'],
  ['Teammate D', 'Training runs & reproducibility lead', 'Reviewer'],
]

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5 last:border-0">
      <div>
        <p className="text-[14px] text-fg">{label}</p>
        {hint && <p className="text-[12px] text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const offline = usePrefs((s) => s.offline)
  const setOffline = usePrefs((s) => s.setOffline)
  const resetReviews = useReview((s) => s.resetReviews)
  return (
    <div className="pb-10">
      <PageHeader title="Settings" description="Profile, team, notifications and display." demo={false} />
      <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:p-6">
        <Panel className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-medium text-fg">Profile</h2>
          <Row label="Name">
            <span className="text-[14px] text-muted">Demo analyst</span>
          </Row>
          <Row label="Account" hint="Supabase Auth connects in the backend phase.">
            <span className="text-[14px] text-muted">Read-only demo account</span>
          </Row>
        </Panel>

        <Panel className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-medium text-fg">Team and roles</h2>
          <div className="mt-3">
            <PermissionNote>Only admins can change roles. You’re signed in with the read-only demo account.</PermissionNote>
          </div>
          <table className="mt-3 mb-2 w-full text-[13px]">
            <caption className="sr-only">Team members and roles</caption>
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 font-normal">Member</th>
                <th className="py-2 font-normal">Project role</th>
                <th className="py-2 font-normal">App role</th>
              </tr>
            </thead>
            <tbody>
              {TEAM.map(([n, r, a]) => (
                <tr key={n} className="border-b border-line last:border-0">
                  <td className="py-2 text-fg">{n}</td>
                  <td className="py-2 text-muted">{r}</td>
                  <td className="py-2">
                    <select disabled defaultValue={a} aria-label={`App role for ${n}`} className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[13px] text-muted">
                      <option>Admin</option>
                      <option>Analyst</option>
                      <option>Reviewer</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-medium text-fg">Notifications</h2>
          <Row label="Telegram" hint="Alerts from priority zones, sent by a bot.">
            <Button size="sm" variant="outline" onClick={() => toast('Telegram connects with the backend', { description: 'The bot token lives on the server, never in the browser.' })}>
              <Send className="size-3.5" strokeWidth={1.75} /> Connect Telegram
            </Button>
          </Row>
          <Row label="Email digest" hint="Daily summary of new alerts.">
            <Switch checked onCheckedChange={() => toast('Email connects with the backend')} label="Email digest" />
          </Row>
        </Panel>

        <Panel className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-medium text-fg">Display</h2>
          <Row label="Theme" hint="Night Survey (dark) or Paper Survey (light).">
            <ThemeToggle size="md" />
          </Row>
          <Row label="Motion" hint="“Off” turns map pulses and transitions into simple fades.">
            <MotionToggle size="md" />
          </Row>
          <Row label="Language" hint="Telugu for public pages is planned (UI-4).">
            <Segmented size="sm" label="Language" value="en" onChange={() => toast('Telugu arrives in phase UI-4')} options={[{ value: 'en', label: 'English' }, { value: 'te', label: 'తెలుగు' }]} />
          </Row>
        </Panel>

        <Panel className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-medium text-fg">Data</h2>
          <Row label="Offline mode" hint="Use only cached data; external services pause.">
            <Switch checked={offline} onCheckedChange={setOffline} label="Offline mode" />
          </Row>
          <Row label="Attributions" hint="Every dataset, imagery source, font and library licence.">
            <Link to="/attributions" className="text-[14px] text-sentinel-ink hover:underline">
              View attributions
            </Link>
          </Row>
          <Row label="Reset demo reviews" hint="Clears accept/reject decisions stored in this browser.">
            <Button size="sm" variant="danger" onClick={() => (resetReviews(), toast('Demo reviews reset'))}>
              Reset
            </Button>
          </Row>
        </Panel>
      </div>
    </div>
  )
}
