import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { AlertSummary } from '@/components/alerts/AlertSummary'
import type { DateInfo, DemoAlert } from '@/lib/data'

/** Phone layout for /explore: controls and alert detail as bottom sheets. */
export default function ExploreMobileSheets({
  panelOpen,
  onPanelOpenChange,
  panel,
  alert,
  dates,
  onCloseAlert,
}: {
  panelOpen: boolean
  onPanelOpenChange: (o: boolean) => void
  panel: ReactNode
  alert: DemoAlert | null
  dates: DateInfo[]
  onCloseAlert: () => void
}) {
  return (
    <>
      <Drawer.Root open={panelOpen} onOpenChange={onPanelOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Drawer.Content id="explore-panel" className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-[20px] border-t border-line bg-bg0 outline-none">
            <Drawer.Handle className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-line-strong" />
            <Drawer.Title className="sr-only">Map controls</Drawer.Title>
            {panel}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
      <Drawer.Root open={Boolean(alert)} onOpenChange={(o) => !o && onCloseAlert()}>
        <Drawer.Portal>
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[72dvh] overflow-y-auto rounded-t-[20px] border-t border-line bg-surface p-5 outline-none">
            <Drawer.Handle className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <Drawer.Title className="sr-only">Alert detail</Drawer.Title>
            {alert && <AlertSummary alert={alert} dates={dates} />}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
