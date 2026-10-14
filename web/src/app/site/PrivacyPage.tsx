import { PageIntro, Section } from '@/components/site/PageIntro'

const ROWS = [
  ['Contact form', 'Name, email, organisation, message, use case', 'To reply to you', 'Not sent in this UI build'],
  ['App account', 'Email and sign-in method (Supabase Auth)', 'To sign you in and record who reviewed an alert', 'When the backend is connected'],
  ['Review decisions', 'Accept / reject / flag and reasons', 'Audit log and training labels', 'This browser only, for now'],
  ['Display preferences', 'Theme, motion, sidebar, tour seen', 'Remember your settings', 'This browser only (localStorage)'],
]

export default function PrivacyPage() {
  return (
    <>
      <PageIntro docTitle="Privacy" title="Privacy" lead="Short version: we store only what we need to run RoadWatch, we sell nothing, and there are no tracking cookies or analytics." />
      <Section title="What is stored">
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <caption className="sr-only">Data stored, purpose and location</caption>
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="p-4 font-normal">What</th>
                <th className="p-4 font-normal">Contains</th>
                <th className="p-4 font-normal">Why</th>
                <th className="p-4 font-normal">Where / when</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r[0]} className="border-b border-line align-top last:border-0">
                  {r.map((c, i) => (
                    <td key={i} className={i === 0 ? 'p-4 text-fg' : 'p-4 text-muted'}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="What is not done" className="border-b-0">
        <ul className="max-w-3xl space-y-3 text-[16px] text-muted">
          <li>No analytics, tracking scripts or advertising cookies.</li>
          <li>No data is sold or shared for marketing.</li>
          <li>Optional AI features (later) receive alert text and metadata only — never imagery of priority zones — and are off in offline mode.</li>
          <li>Map tiles are requested from OpenFreeMap and AWS; those requests include your IP address, as any web request does.</li>
        </ul>
      </Section>
    </>
  )
}
